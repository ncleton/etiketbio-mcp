import type { BrowserAdapter, BrowserTab } from "../client/camoufox.js";

export interface FakeHandlers {
  search(): unknown;
  product(): unknown;
  cart(): unknown;
  mutate(productId: string, target: number): unknown;
}

/** Navigateur simulé : reconnaît l’opération grâce au marqueur /*op:...*\/ posé par le client. */
export class FakeBrowser implements BrowserAdapter {
  tabs: BrowserTab[];
  snapshotValue: string;
  navigations: string[] = [];
  evaluations: string[] = [];

  constructor(readonly entryUrl: string, snapshot: string, private readonly handlers: FakeHandlers) {
    this.tabs = [{ tabId: "tab-1", url: entryUrl }];
    this.snapshotValue = snapshot;
  }

  async health() { return { version: "2.4.6" }; }
  async listTabs() { return this.tabs; }
  async open(url: string) { const tab = { tabId: "tab-opened", url }; this.tabs.push(tab); return tab; }
  async navigate(tabId: string, url: string) { this.navigations.push(url); return { tabId, url }; }
  async snapshot() { return this.snapshotValue; }
  async evaluate<T>(_tabId: string, expression: string): Promise<T> {
    const marker = expression.match(/^\/\*op:(\w+)(?: ([^*]*))?\*\//);
    if (!marker) throw new Error("Expression sans marqueur d’opération.");
    this.evaluations.push(marker[1]);
    if (marker[1] === "search") return this.handlers.search() as T;
    if (marker[1] === "product") return this.handlers.product() as T;
    if (marker[1] === "cart") return this.handlers.cart() as T;
    if (marker[1] === "mutate") {
      const meta = new URLSearchParams((marker[2] ?? "").replace(/ /g, "&"));
      return this.handlers.mutate(decodeURIComponent(meta.get("product") ?? ""), Number(meta.get("target"))) as T;
    }
    throw new Error("Opération inconnue.");
  }
}
