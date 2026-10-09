import { ROBOT_PATTERN, decodeHtml, hasVeganClaim, isObject, isOrganic, parsePrice, str, type Adapter, type MutationInput, type SessionSignals } from "./adapter.js";
import type { ShopConfig } from "./config.js";
import { ContractChangedError } from "./errors.js";
import type { CartInput, ProductInput, SummaryInput } from "./types.js";

export interface PrestashopOptions {
  origin: string;
  hosts: string[];
  /** Sélecteur CSS supplémentaire pour retrouver le lien produit d’une vignette. */
  linkSelector?: string;
}

/** Fonctions JavaScript exécutées dans la page officielle (sans dépendance, sans accent de syntaxe moderne exotique). */
const PRELUDE = String.raw`
const clean = (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim();
const productLd = (doc) => {
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const json = JSON.parse(script.textContent);
      const list = Array.isArray(json) ? json : (json["@graph"] || [json]);
      const found = list.find((entry) => entry && (entry["@type"] === "Product" || (Array.isArray(entry["@type"]) && entry["@type"].indexOf("Product") >= 0)));
      if (found) return found;
    } catch (error) { /* bloc JSON-LD non exploitable */ }
  }
  return null;
};
const offerOf = (ld) => ld ? (Array.isArray(ld.offers) ? ld.offers[0] : ld.offers) || null : null;
const metaContent = (doc, selector) => { const node = doc.querySelector(selector); return node ? (node.getAttribute("content") || node.getAttribute("href") || clean(node.textContent)) : null; };
const productInfo = (doc) => {
  const ld = productLd(doc);
  const offer = offerOf(ld);
  const micro = (name) => metaContent(doc, "[itemprop='" + name + "']");
  const info = {
    name: (ld && ld.name) || micro("name") || metaContent(doc, "meta[property='og:title']"),
    sku: (ld && ld.sku) || micro("sku") || null,
    gtin: (ld && (ld.gtin13 || ld.gtin || ld.gtin14 || ld.gtin8)) || micro("gtin13") || metaContent(doc, "meta[property='product:ean']") || null,
    brand: (ld && ld.brand && (ld.brand.name || ld.brand)) || micro("brand") || metaContent(doc, "meta[property='product:brand']") || null,
    description: (ld && ld.description) || metaContent(doc, "meta[property='og:description']") || null,
    price: (offer && offer.price) || metaContent(doc, "meta[property='product:price:amount']") || micro("price") || null,
    availability: (offer && offer.availability) || micro("availability") || null,
  };
  return info.name && info.price ? info : null;
};
const extractPrestashop = (html) => {
  const marker = html.indexOf("var prestashop = ");
  if (marker < 0) return null;
  const start = html.indexOf("{", marker);
  let depth = 0, quoted = false, escaped = false;
  for (let index = start; index < html.length; index += 1) {
    const char = html[index];
    if (quoted) { if (escaped) escaped = false; else if (char === "\\") escaped = true; else if (char === '"') quoted = false; continue; }
    if (char === '"') quoted = true; else if (char === "{") depth += 1; else if (char === "}" && --depth === 0) return JSON.parse(html.slice(start, index + 1));
  }
  return null;
};
const cartUrl = () => (window.prestashop && prestashop.urls && prestashop.urls.pages && prestashop.urls.pages.cart) || (location.origin + "/panier");
const readCart = async () => {
  const response = await fetch(cartUrl() + (cartUrl().indexOf("?") >= 0 ? "&" : "?") + "action=show", { credentials: "include" });
  if (!response.ok) throw new Error("Panier HTTP " + response.status);
  const state = extractPrestashop(await response.text());
  if (!state || !state.cart || !Array.isArray(state.cart.products)) throw new Error("Contrat prestashop.cart absent");
  const cart = state.cart;
  const subtotal = cart.subtotals && cart.subtotals.products && cart.subtotals.products.value;
  const total = cart.totals && cart.totals.total && cart.totals.total.value;
  return {
    total_text: subtotal || total || null,
    products: cart.products.map((p) => ({
      id_product: p.id_product, id_product_attribute: p.id_product_attribute, name: p.name,
      quantity: p.cart_quantity, unit_price: p.price_wt != null ? p.price_wt : p.price_amount, line_total: p.total_wt != null ? p.total_wt : p.total_amount,
      available_quantity: p.quantity_available == null ? null : p.quantity_available,
    })),
  };
};
`;

function searchExpression(query: string, limit: number, linkSelector: string | undefined): string {
  return `(async () => {
    ${PRELUDE}
    const query = ${JSON.stringify(query)};
    const limit = ${limit};
    const searchPath = (window.prestashop && prestashop.urls && prestashop.urls.pages && prestashop.urls.pages.search) || (location.origin + "/recherche");
    const url = new URL(searchPath, location.origin);
    url.searchParams.set("controller", "search");
    url.searchParams.set("s", query);
    url.searchParams.set("resultsPerPage", String(limit));
    const response = await fetch(url.toString(), { credentials: "include" });
    if (!response.ok) throw new Error("Recherche HTTP " + response.status);
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const articles = Array.prototype.slice.call(doc.querySelectorAll("article.js-product-miniature, article.product-miniature, .js-product-miniature"));
    if (!articles.length) {
      const emptyMarker = doc.querySelector(".page-not-found, #search_filters_wrapper, #js-product-list, #products, .products") || /aucun produit|aucun r[ée]sultat|pas de r[ée]sultat|n.a pas [ée]t[ée] trouv/i.test(clean(doc.body && doc.body.textContent).slice(0, 6000));
      if (!emptyMarker) throw new Error("Contrat liste produits absent");
      return [];
    }
    const items = articles.slice(0, limit).map((article) => {
      const link = article.querySelector(${JSON.stringify(linkSelector ? linkSelector + ", " : "")} + ".product-title a, h2 a, h3 a, a.product-thumbnail, a[href$='.html']");
      const price = article.querySelector(".product-price-and-shipping .price, .price, .product-price");
      const regular = article.querySelector(".regular-price");
      const unit = article.querySelector(".unit-price, .price-per-unit, .product-unit-price, .unity");
      const title = article.querySelector(".product-title, .product-name, h2, h3");
      const brand = article.querySelector(".product-brand, .manufacturer-name, .brand");
      const button = article.querySelector("button.add-to-cart, .add-to-cart, [data-button-action='add-to-cart']");
      return {
        id_product: article.getAttribute("data-id-product"),
        id_product_attribute: article.getAttribute("data-id-product-attribute") || "0",
        name: clean((title && title.textContent) || (link && (link.getAttribute("title") || link.textContent))),
        url: link ? link.href : null,
        price: price ? clean(price.textContent) : null,
        regular_price: regular ? clean(regular.textContent) : null,
        unit_price: unit ? clean(unit.textContent) : null,
        brand: brand ? clean(brand.textContent) : null,
        flags: Array.prototype.map.call(article.querySelectorAll(".product-flags li, .product-flag"), (flag) => clean(flag.className + " " + flag.textContent)),
        button: button ? (button.disabled || button.classList.contains("disabled") ? "disabled" : "enabled") : "absent",
        availability: null,
      };
    });
    await Promise.all(items.filter((item) => item.button === "absent" && item.url).map(async (item) => {
      try {
        const page = await fetch(item.url, { credentials: "include" });
        if (!page.ok) return;
        const info = productInfo(new DOMParser().parseFromString(await page.text(), "text/html"));
        item.availability = info && info.availability ? String(info.availability) : null;
      } catch (error) { /* disponibilité laissée inconnue */ }
    }));
    return items;
  })()`;
}

function productExpression(productUrl: string): string {
  return `(async () => {
    ${PRELUDE}
    const response = await fetch(${JSON.stringify(productUrl)}, { credentials: "include" });
    if (!response.ok) throw new Error("Fiche HTTP " + response.status);
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const info = productInfo(doc);
    if (!info) throw new Error("Contrat fiche produit absent (JSON-LD, microdonnées ou balises meta)");
    const form = doc.querySelector("#add-to-cart-or-refresh, form[action*='panier']");
    const field = (name) => { const input = (form || doc).querySelector("input[name='" + name + "']"); return input ? input.value : null; };
    const holder = doc.querySelector("[data-product]");
    let data = null;
    try { data = holder ? JSON.parse(holder.getAttribute("data-product")) : null; } catch (error) { data = null; }
    const button = (form || doc).querySelector("button.add-to-cart, [data-button-action='add-to-cart']");
    let ingredients = null;
    for (const element of Array.prototype.slice.call(doc.querySelectorAll("h2, h3, h4, h5, h6, strong, b, dt, p, div, li, span")).reverse()) {
      const own = clean(element.textContent);
      if (/^ingr[ée]dients?\b\s*[:\-]?\s*\S/i.test(own) && own.length < 4000 && element.children.length < 6) { ingredients = own.replace(/^ingr[ée]dients?\b\s*[:\-]?\s*/i, ""); break; }
      if (/^ingr[ée]dients?\s*:?$/i.test(own)) {
        const next = element.nextElementSibling ? clean(element.nextElementSibling.textContent) : "";
        const parentText = element.parentElement ? clean(element.parentElement.textContent).replace(/^ingr[ée]dients?\s*:?\s*/i, "") : "";
        const candidate = next || parentText;
        if (candidate && candidate.length < 4000) { ingredients = candidate; break; }
      }
    }
    const nutrition = [];
    for (const table of doc.querySelectorAll("table")) {
      if (!/[ée]nergie|energy|kcal|prot[ée]ines|glucides/i.test(table.textContent)) continue;
      for (const row of table.querySelectorAll("tr")) {
        const cells = Array.prototype.map.call(row.querySelectorAll("th, td"), (cell) => clean(cell.textContent));
        if (cells.length >= 2 && cells[0] && cells[1]) nutrition.push({ label: cells[0], value: cells[1] });
      }
      if (nutrition.length) break;
    }
    return {
      info: info,
      id_product: field("id_product") || (data && String(data.id_product)) || null,
      id_product_attribute: field("id_product_attribute") || (data && data.id_product_attribute != null ? String(data.id_product_attribute) : "0"),
      data_quantity: data && data.quantity != null ? data.quantity : null,
      button: button ? (button.disabled || button.classList.contains("disabled") ? "disabled" : "enabled") : "absent",
      ingredients, nutrition,
      url: response.url,
      unit_price: (doc.querySelector(".product-unit-price, .unit-price, .price-per-unit") || {}).textContent || null,
    };
  })()`;
}

function cartExpression(): string {
  return `(async () => { ${PRELUDE} return readCart(); })()`;
}

function mutationExpression(input: MutationInput): string {
  const [productId, attributeId = "0"] = input.productId.split(":");
  return `(async () => {
    ${PRELUDE}
    const token = window.prestashop && prestashop.static_token;
    if (!token) throw new Error("Contrat prestashop.static_token absent");
    const productId = ${JSON.stringify(productId)};
    const attributeId = ${JSON.stringify(attributeId)};
    const target = ${input.targetQuantity};
    const before = await readCart();
    const line = before.products.find((p) => String(p.id_product) === productId && String(p.id_product_attribute) === attributeId);
    const current = line ? Number(line.quantity) : 0;
    if (current === target) return { before, after: before, applied: false };
    const post = async (extra) => {
      const body = new URLSearchParams(Object.assign({ token: token, id_product: productId, id_product_attribute: attributeId, id_customization: "0", action: "update" }, extra));
      const reply = await fetch(cartUrl(), { method: "POST", credentials: "include", headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "X-Requested-With": "XMLHttpRequest", Accept: "application/json, text/javascript, */*; q=0.01" }, body: body });
      if (!reply.ok) throw new Error("Panier HTTP " + reply.status);
      const json = await reply.json();
      if (json.success === false) throw new Error("Panier refusé : " + clean(JSON.stringify(json.errors || json.errors_message || "")).slice(0, 200));
      return json;
    };
    if (target === 0) await post({ delete: "1" });
    else if (target > current) await post({ add: "1", qty: String(target - current) });
    else await post({ update: "1", op: "down", qty: String(current - target) });
    return { before, after: await readCart(), applied: true };
  })()`;
}

function availabilityFromSchema(value: unknown): "available" | "out_of_stock" | null {
  const text = typeof value === "string" ? value : "";
  if (/InStock|LimitedAvailability|InStoreOnly|OnlineOnly/i.test(text)) return "available";
  if (/OutOfStock|SoldOut|Discontinued/i.test(text)) return "out_of_stock";
  return null;
}

function productKey(rawId: unknown, rawAttribute: unknown): string | null {
  const id = str({ v: rawId }, "v");
  if (!id) return null;
  return `${id}:${str({ v: rawAttribute }, "v") ?? "0"}`;
}

export function createPrestashopAdapter(options: PrestashopOptions): Adapter {
  const hosts = new Set(options.hosts);
  const inHosts = (url: URL): boolean => url.protocol === "https:" && hosts.has(url.hostname);
  return {
    entryUrl: () => `${options.origin}/`,
    matchesTab: (url) => inHosts(url),
    inspectSession({ snapshot, tabUrl }): SessionSignals {
      let onSite = false;
      try { onSite = inHosts(new URL(tabUrl)); } catch { onSite = false; }
      const robotVisible = ROBOT_PATTERN.test(snapshot);
      return {
        ready: onSite && !robotVisible && snapshot.trim().length > 0,
        robotVisible,
        accountConnected: /d[ée]connexion|se d[ée]connecter|sign out/i.test(snapshot),
      };
    },
    validateProductUrl(url) {
      if (!inHosts(url)) throw new Error("Hors du site officiel configuré.");
    },
    searchExpression: (_config: ShopConfig, query, limit) => searchExpression(query, limit, options.linkSelector),
    normalizeSearch(raw): SummaryInput[] {
      if (!Array.isArray(raw)) throw new ContractChangedError("La recherche n’a pas retourné une liste de vignettes produit.");
      return raw.map((entry): SummaryInput => {
        if (!isObject(entry)) throw new ContractChangedError("Une vignette produit n’est plus un objet exploitable.");
        const id = productKey(entry.id_product, entry.id_product_attribute);
        const name = str(entry, "name");
        const price = parsePrice(entry.price);
        const url = str(entry, "url");
        if (!id || !name || price === null || !url) throw new ContractChangedError("Une vignette produit ne contient plus son identifiant, son nom, son prix ou son URL.");
        const flags = Array.isArray(entry.flags) ? entry.flags.map(String) : [];
        let availability: SummaryInput["availability"] = "unknown";
        if (flags.some((flag) => /rupture|[ée]puis|out.?of.?stock|indisponible|sold.?out/i.test(flag)) || entry.button === "disabled") availability = "out_of_stock";
        else if (entry.button === "enabled") availability = "available";
        else availability = availabilityFromSchema(entry.availability) ?? "unknown";
        return {
          product_id: id, name: decodeHtml(name), brand: str(entry, "brand"), price,
          unit_price: str(entry, "unit_price"), availability, available_quantity: null,
          organic: isOrganic(`${name} ${flags.join(" ")}`), product_url: url,
        };
      });
    },
    productExpression: (_config, productUrl) => productExpression(productUrl),
    normalizeProduct(raw, _config, requestedUrl): ProductInput {
      if (!isObject(raw) || !isObject(raw.info)) throw new ContractChangedError("La fiche n’a pas retourné l’objet produit attendu.");
      const info = raw.info;
      const id = productKey(raw.id_product, raw.id_product_attribute);
      const name = str(info, "name");
      const price = parsePrice(info.price);
      if (!id || !name || price === null) throw new ContractChangedError("La fiche ne contient plus son identifiant, son nom ou son prix.");
      let availability = availabilityFromSchema(info.availability);
      if (!availability) availability = raw.button === "enabled" ? "available" : raw.button === "disabled" ? "out_of_stock" : null;
      if (!availability) throw new ContractChangedError("La fiche ne publie plus la disponibilité du produit.");
      const dataQuantity = typeof raw.data_quantity === "number" && Number.isInteger(raw.data_quantity) && raw.data_quantity >= 0 ? raw.data_quantity : null;
      const text = `${name} ${str(info, "description") ?? ""}`;
      const nutrition = Array.isArray(raw.nutrition) ? raw.nutrition.flatMap((row): ProductInput["nutrition"] => isObject(row) && str(row, "label") && str(row, "value") ? [{ label: str(row, "label")!, value: str(row, "value")!, unit: null }] : []) : [];
      return {
        product_id: id, name: decodeHtml(name), brand: str(info, "brand"), price,
        unit_price: str(raw, "unit_price"), availability, available_quantity: dataQuantity,
        organic: isOrganic(text), product_url: requestedUrl,
        ean: str(info, "gtin"), ingredients: str(raw, "ingredients"), vegan_claim: hasVeganClaim(text), nutrition,
      };
    },
    cartExpression: () => cartExpression(),
    normalizeCart(raw): CartInput {
      if (!isObject(raw) || !Array.isArray(raw.products)) throw new ContractChangedError("Le panier n’a plus la forme observée.");
      const items = raw.products.map((entry) => {
        if (!isObject(entry)) throw new ContractChangedError("Une ligne de panier n’est plus exploitable.");
        const id = productKey(entry.id_product, entry.id_product_attribute);
        const quantity = Number(entry.quantity);
        if (!id || !Number.isInteger(quantity) || quantity < 0) throw new ContractChangedError("Une ligne de panier ne contient plus son identifiant ou sa quantité.");
        const available = entry.available_quantity == null ? null : Number(entry.available_quantity);
        return {
          product_id: id, name: str(entry, "name"), quantity,
          available_quantity: available !== null && Number.isInteger(available) && available >= 0 ? available : null,
          unit_price: parsePrice(entry.unit_price), line_total: parsePrice(entry.line_total),
        };
      });
      const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
      return { empty: totalQuantity === 0, total_quantity: totalQuantity, total_price: str(raw, "total_text") ?? "0,00 €", items };
    },
    mutationExpression: (_config, input) => mutationExpression(input),
  };
}
