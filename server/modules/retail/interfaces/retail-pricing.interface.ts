export type DiscountInput = { type: "amount" | "percent"; value: number };
export interface PricingItemInput { productId: string; sku: string; productName: string; unit: string; category?: string; brand?: string; quantity: number; unitPrice: number; unitCost: number; trackingMode?: "none" | "quantity" | "lot" | "serial"; variantId?: string; serialNumbers?: string[]; discount?: DiscountInput; note?: string }
export interface PricingInput { items: PricingItemInput[]; orderDiscount: DiscountInput; taxRate: number; shippingFee: number; maxDiscountPercent: number }
export interface PricingLineResult extends Omit<PricingItemInput, "discount"> { discountAmount: number; lineTotal: number }
export interface PricingResult { lines: PricingLineResult[]; subtotal: number; orderDiscount: number; taxRate: number; taxAmount: number; shippingFee: number; grandTotal: number; totalCost: number; totalDiscount: number }
