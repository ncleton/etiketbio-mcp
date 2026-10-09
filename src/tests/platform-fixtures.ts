import type { ShopConfig } from "../client/config.js";
import { RETAILER } from "../client/retailer.js";
import { FakeBrowser } from "./fake-browser.js";

export interface Captured {
  query: string;
  productUrl: string;
  expected: { productId: string; name: string; price: number };
  searchRaw: unknown[];
  productRaw: Record<string, unknown>;
  cartEmpty: unknown;
  cartFilled: { quantity: number; raw: unknown };
}

type RawCart = { total_text: string | null; products: Array<Record<string, unknown>> };

export function buildPrestashopShop(data: Captured, scope: Record<string, string> = {}) {
  const config: ShopConfig = {
    scope,
    camoufoxUrl: "http://127.0.0.1:9377",
    camoufoxUserId: "test-profile-user",
    camoufoxApiKey: "0123456789abcdefghijklmnopqrstuvwxyzAB",
  };
  let quantity = 0;
  const filled = data.cartFilled.raw as RawCart;
  const line = filled.products[0];
  const unit = Number(String(line.unit_price).replace(",", "."));
  const cartRaw = (count: number): RawCart => {
    if (count === 0) return data.cartEmpty as RawCart;
    return {
      total_text: `${(unit * count).toFixed(2).replace(".", ",")} €`,
      products: [{ ...line, quantity: count, line_total: unit * count }],
    };
  };
  const snapshot = `navigation "Menu"\nlink "Mon compte"\nlink "Panier"\ntext "${RETAILER.label}"`;
  const browser = new FakeBrowser(RETAILER.entryUrl, snapshot, {
    search: () => data.searchRaw,
    product: () => data.productRaw,
    cart: () => cartRaw(quantity),
    mutate: (_productId, target) => { const before = cartRaw(quantity); quantity = target; return { before, after: cartRaw(quantity), applied: true }; },
  });
  return {
    config,
    browser,
    cartQuantity: () => quantity,
    setCartQuantity: (value: number) => { quantity = value; },
  };
}
