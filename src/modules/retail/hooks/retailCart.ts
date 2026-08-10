import type { RetailProduct } from "../types";
export type RetailCartLine = { product: RetailProduct; quantity: number };
export type RetailQuote = { subtotal: number; grandTotal: number; [key: string]: unknown };
export type RetailCartState = { lines: RetailCartLine[]; quote: RetailQuote | null; quoteDirty: boolean };
type Action = { type: "add"; product: RetailProduct } | { type: "quantity"; productId: string; quantity: number } | { type: "remove"; productId: string } | { type: "quote"; quote: RetailQuote } | { type: "load"; lines: RetailCartLine[] } | { type: "reset" };
export const initialRetailCart: RetailCartState = { lines: [], quote: null, quoteDirty: false };
export function retailCartReducer(state: RetailCartState, action: Action): RetailCartState {
  if (action.type === "reset") return initialRetailCart;
  if (action.type === "load") return { lines: action.lines, quote: null, quoteDirty: true };
  if (action.type === "quote") return { ...state, quote: action.quote, quoteDirty: false };
  if (action.type === "add") { const exists = state.lines.some((line) => line.product._id === action.product._id); return { ...state, lines: exists ? state.lines.map((line) => line.product._id === action.product._id ? { ...line, quantity: line.quantity + 1 } : line) : [...state.lines, { product: action.product, quantity: 1 }], quoteDirty: true }; }
  if (action.type === "remove") return { ...state, lines: state.lines.filter((line) => line.product._id !== action.productId), quoteDirty: true };
  const quantity = Math.max(0, Math.floor(action.quantity)); return { ...state, lines: quantity === 0 ? state.lines.filter((line) => line.product._id !== action.productId) : state.lines.map((line) => line.product._id === action.productId ? { ...line, quantity } : line), quoteDirty: true };
}
