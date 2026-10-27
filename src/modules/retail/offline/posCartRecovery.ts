import { initialRetailCart, type RetailCartState } from "../hooks/retailCart";

export function readPosCart(key: string): { cart: RetailCartState; error?: string } {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { cart: initialRetailCart };
    const value = JSON.parse(raw);
    if (value.version !== 1 || !Array.isArray(value.cart?.lines) || value.cart.lines.some((line: any) => !line.product?._id || !Number.isSafeInteger(line.quantity) || line.quantity <= 0)) throw new Error("Invalid saved cart");
    return { cart: { ...initialRetailCart, ...value.cart, quote: null, quoteDirty: value.cart.lines.length > 0 } };
  } catch {
    // Keep the original record for recovery; never turn it into a confirmed sale.
    return { cart: initialRetailCart, error: "Không đọc được giỏ đã lưu. Bản lưu gốc đang được giữ để phục hồi." };
  }
}

export function savePosCart(key: string, cart: RetailCartState) {
  if (!cart.lines.length) { localStorage.removeItem(key); return; }
  localStorage.setItem(key, JSON.stringify({ version: 1, cart: { ...cart, quote: null, quoteDirty: true } }));
}

export function discardPosCart(key: string) { localStorage.removeItem(key); }
