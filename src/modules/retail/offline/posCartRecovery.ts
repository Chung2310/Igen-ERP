import { initialRetailCart, type RetailCartState } from "../hooks/retailCart";

export function readPosCart(key: string): { cart: RetailCartState; error?: string } {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { cart: initialRetailCart };
    const saved = JSON.parse(raw);
    const lines = saved?.version === 1 && saved.cart?.lines;
    if (!Array.isArray(lines) || lines.some((line: any) =>
      !line?.product?._id || !Number.isSafeInteger(line.quantity) || line.quantity <= 0 ||
      (line.serialNumbers !== undefined && (!Array.isArray(line.serialNumbers) || line.serialNumbers.some((value: unknown) => typeof value !== "string"))) ||
      (line.internalBarcodes !== undefined && (!Array.isArray(line.internalBarcodes) || line.internalBarcodes.some((value: unknown) => typeof value !== "string")))
    )) throw new Error("Giỏ hàng đã lưu không hợp lệ.");
    return {
      cart: {
        ...initialRetailCart,
        ...saved.cart,
        note: typeof saved.cart.note === "string" ? saved.cart.note.slice(0, 2000) : "",
        installment: saved.cart.installment && typeof saved.cart.installment.partner === "string" && Number.isSafeInteger(saved.cart.installment.months) && Number.isFinite(saved.cart.installment.prepayPercent) ? saved.cart.installment : null,
        quote: null,
        quoteDirty: lines.length > 0,
      },
    };
  } catch {
    return { cart: initialRetailCart, error: "Không đọc được giỏ đã lưu. Bản lưu gốc được giữ lại để đối chiếu." };
  }
}

export function savePosCart(key: string, cart: RetailCartState) {
  if (!cart.lines.length) {
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, JSON.stringify({ version: 1, cart: { ...cart, quote: null, quoteDirty: true } }));
}

export function discardPosCart(key: string) {
  localStorage.removeItem(key);
}
