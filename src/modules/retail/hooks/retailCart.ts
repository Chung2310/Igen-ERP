import type { RetailCustomer, RetailCustomerBillingProfile, RetailDiscountInput, RetailInstallment, RetailProduct } from "../types";
export type RetailCartLine = { product: RetailProduct; quantity: number; discount: RetailDiscountInput; serialNumbers?: string[]; internalBarcodes?: string[] };
export type RetailQuote = { subtotal: number; grandTotal: number; [key: string]: unknown };
export type RetailCartState = { lines: RetailCartLine[]; customer: RetailCustomer | null; billingProfile: RetailCustomerBillingProfile | null; orderDiscount: RetailDiscountInput; couponCode: string; pointsToRedeem: number; note?: string; installment?: RetailInstallment | null; taxRate: number; shippingFee: number; quote: RetailQuote | null; quoteDirty: boolean };
type Action =
  | { type: "note"; note: string }
  | { type: "installment"; installment: RetailInstallment | null }
  | { type: "add"; product: RetailProduct }
  | { type: "quantity"; productId: string; quantity: number }
  | { type: "remove"; productId: string }
  | { type: "lineDiscount"; productId: string; discount: RetailDiscountInput }
  | { type: "serials"; productId: string; serialNumbers: string[] }
  | { type: "internalBarcodes"; productId: string; internalBarcodes: string[] }
  | { type: "orderAdjustments"; orderDiscount: RetailDiscountInput; taxRate: number; shippingFee: number }
  | { type: "defaultTaxRate"; taxRate: number }
  | { type: "coupon"; couponCode: string }
  | { type: "points"; pointsToRedeem: number }
  | { type: "customer"; customer: RetailCustomer | null }
  | { type: "billingProfile"; billingProfile: RetailCustomerBillingProfile | null }
  | { type: "quote"; quote: RetailQuote }
  | { type: "load"; lines: RetailCartLine[]; customer?: RetailCustomer | null; billingProfile?: RetailCustomerBillingProfile | null; orderDiscount?: RetailDiscountInput; couponCode?: string; pointsToRedeem?: number; note?: string; installment?: RetailInstallment | null; taxRate?: number; shippingFee?: number }
  | { type: "reset"; taxRate?: number };
const noDiscount: RetailDiscountInput = { type: "amount", value: 0 };
const normalizeDiscount = (discount?: RetailDiscountInput): RetailDiscountInput => ({
  type: discount?.type === "percent" ? "percent" : "amount",
  value: Math.max(0, Number(discount?.value) || 0),
});
export const initialRetailCart: RetailCartState = { lines: [], customer: null, billingProfile: null, orderDiscount: noDiscount, couponCode: "", pointsToRedeem: 0, note: "", installment: null, taxRate: 0, shippingFee: 0, quote: null, quoteDirty: false };
export function retailCartReducer(state: RetailCartState, action: Action): RetailCartState {
  if (action.type === "note") return { ...state, note: action.note };
  if (action.type === "installment") return { ...state, installment: action.installment };
  if (action.type === "reset") return { ...initialRetailCart, taxRate: action.taxRate ?? initialRetailCart.taxRate };
  if (action.type === "defaultTaxRate") return { ...state, taxRate: action.taxRate, quote: null, quoteDirty: state.lines.length > 0 };
  if (action.type === "load") return { lines: action.lines.map((line) => ({ ...line, discount: normalizeDiscount(line.discount) })), customer: action.customer || null, billingProfile: action.billingProfile || null, orderDiscount: normalizeDiscount(action.orderDiscount), couponCode: action.couponCode || "", pointsToRedeem: action.pointsToRedeem || 0, note: action.note || "", installment: action.installment || null, taxRate: action.taxRate || 0, shippingFee: action.shippingFee || 0, quote: null, quoteDirty: true };
  if (action.type === "quote") return { ...state, quote: action.quote, quoteDirty: false };
  if (action.type === "customer") return { ...state, customer: action.customer, billingProfile: null, couponCode: "", pointsToRedeem: 0, quoteDirty: true };
  if (action.type === "billingProfile") return { ...state, billingProfile: action.billingProfile, quoteDirty: true };
  if (action.type === "orderAdjustments") return { ...state, orderDiscount: normalizeDiscount(action.orderDiscount), taxRate: action.taxRate, shippingFee: action.shippingFee, quoteDirty: true };
  if (action.type === "coupon") return { ...state, couponCode: action.couponCode.toUpperCase().trim(), quoteDirty: true };
  if (action.type === "points") return { ...state, pointsToRedeem: action.pointsToRedeem, quoteDirty: true };
  if (action.type === "lineDiscount") return { ...state, lines: state.lines.map((line) => line.product._id === action.productId ? { ...line, discount: normalizeDiscount(action.discount) } : line), quoteDirty: true };
  if (action.type === "serials") return { ...state, lines: state.lines.map((line) => line.product._id === action.productId ? { ...line, serialNumbers: action.serialNumbers } : line), quoteDirty: true };
  if (action.type === "internalBarcodes") return { ...state, lines: state.lines.map((line) => line.product._id === action.productId ? { ...line, internalBarcodes: action.internalBarcodes } : line), quoteDirty: true };
  if (action.type === "add") { const exists = state.lines.some((line) => line.product._id === action.product._id); return { ...state, lines: exists ? state.lines.map((line) => line.product._id === action.product._id ? { ...line, quantity: line.quantity + 1 } : line) : [...state.lines, { product: action.product, quantity: 1, discount: noDiscount }], quoteDirty: true }; }
  if (action.type === "remove") return { ...state, lines: state.lines.filter((line) => line.product._id !== action.productId), quoteDirty: true };
  const quantity = Math.max(0, Math.floor(action.quantity)); return { ...state, lines: quantity === 0 ? state.lines.filter((line) => line.product._id !== action.productId) : state.lines.map((line) => line.product._id === action.productId ? { ...line, quantity } : line), quoteDirty: true };
}
