import type { DiscountInput, PricingInput, PricingResult } from "../interfaces/retail-pricing.interface";

const percentage = (value: number, name: string) => {
  if (!Number.isFinite(value) || value < 0 || value > 100 || Math.round(value * 100) !== value * 100) throw new Error(`${name} không hợp lệ.`);
  return value;
};
const integerMoney = (value: number, name: string) => {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} phải là số nguyên VNĐ không âm.`);
  return value;
};
const discountAmount = (discount: DiscountInput | undefined, base: number, name: string) => {
  if (!discount) return 0;
  const value = Number(discount.value);
  if (isNaN(value) || value < 0) throw new Error(`${name} không được là số âm.`);
  const amount = discount.type === "percent" ? Math.round(base * percentage(value, name) / 100) : integerMoney(value, name);
  if (amount > base) throw new Error(`${name} không được vượt giá trị gốc.`);
  return amount;
};

export function toDiscountInput(value: unknown): DiscountInput | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "object") {
    const raw = value as any;
    return { type: raw.type === "percent" ? "percent" : "amount", value: Number(raw.value) };
  }
  return { type: "amount", value: Number(value) };
}

export function calculateOrderTotals(input: PricingInput): PricingResult {
  if (!Array.isArray(input.items) || input.items.length === 0) throw new Error("Đơn hàng phải có ít nhất một sản phẩm.");
  const maxDiscountPercent = percentage(Number(input.maxDiscountPercent), "Hạn mức giảm giá");
  const taxRate = percentage(Number(input.taxRate), "Thuế suất");
  const shippingFee = integerMoney(Number(input.shippingFee), "Phí giao hàng");
  let merchandiseBase = 0;
  let totalCost = 0;
  const lines = input.items.map((item) => {
    const quantity = Number(item.quantity);
    if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error("Số lượng phải là số nguyên dương.");
    const unitPrice = integerMoney(Number(item.unitPrice), "Đơn giá");
    const unitCost = integerMoney(Number(item.unitCost), "Giá vốn");
    const base = Math.round(quantity * unitPrice);
    const normalizedDiscount = discountAmount(item.discount, base, "Giảm giá dòng");
    merchandiseBase += base;
    totalCost += quantity * unitCost;
    const { discount: _discount, ...snapshot } = item;
    return { ...snapshot, quantity, unitPrice, unitCost, discountAmount: normalizedDiscount, lineTotal: base - normalizedDiscount };
  });
  const subtotal = lines.reduce((sum, item) => sum + item.lineTotal, 0);
  const orderDiscount = discountAmount(input.orderDiscount, subtotal, "Giảm giá đơn");
  const lineDiscount = merchandiseBase - subtotal;
  const totalDiscount = lineDiscount + orderDiscount;
  if (merchandiseBase > 0 && totalDiscount * 100 > merchandiseBase * maxDiscountPercent + 0.000001) {
    throw new Error(`Tổng giảm giá (${totalDiscount.toLocaleString()} VNĐ) vượt quá hạn mức cho phép của chi nhánh (${maxDiscountPercent}%).`);
  }
  const taxable = subtotal - orderDiscount;
  const taxAmount = Math.round(taxable * taxRate / 100);
  return { lines, subtotal, orderDiscount, taxRate, taxAmount, shippingFee, grandTotal: taxable + taxAmount + shippingFee, totalCost, totalDiscount };
}
