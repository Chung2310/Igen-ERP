import React from "react";
import {
  CircleX,
  CreditCard,
  FileText,
  Search,
  Settings,
  ShoppingCart,
  Ticket,
  Users,
  X,
} from "lucide-react";
import { Dropdown } from "../../../../components/common/Dropdown";
import CustomerPicker from "./CustomerPicker";
import RetailCollaboratorSelect from "./RetailCollaboratorSelect";
import RetailPointsInput from "./RetailPointsInput";
import OrderAdjustments from "./OrderAdjustments";
import CartCouponPicker from "../coupons/CartCouponPicker";
import { QuantityInput } from "./QuantityInput";
import DiscountInput from "./DiscountInput";
import { SerialPicker, UnitBarcodePicker } from "./RetailUnitPickerDialog";
import type { RetailCartState } from "../../hooks/retailCart";
import type { RetailScope } from "../../types";

const money = (value: number) =>
  new Intl.NumberFormat("vi-VN").format(value) + " ₫";

const formatVndBadge = (val: number) =>
  new Intl.NumberFormat("vi-VN").format(val) + "đ";

export interface CartPanelProps {
  scope: RetailScope;
  cart: RetailCartState;
  billingProfiles: any[];
  busy: boolean;
  canPay: boolean;
  dispatch: React.Dispatch<any>;
  onPay: () => void;
}

export function CartPanel({
  scope,
  cart,
  billingProfiles,
  busy,
  canPay,
  dispatch,
  onPay,
}: CartPanelProps) {
  const [showDiscountModal, setShowDiscountModal] = React.useState(false);
  const [showCollaboratorModal, setShowCollaboratorModal] = React.useState(false);
  const [showNoteModal, setShowNoteModal] = React.useState(false);
  const [showInstallmentModal, setShowInstallmentModal] = React.useState(false);

  const orderNote = cart.note || "";
  const [noteEditorValue, setNoteEditorValue] = React.useState("");
  const isInstallment = Boolean(cart.installment);
  const [installmentPartner, setInstallmentPartner] = React.useState("HD Saison");
  const [installmentMonths, setInstallmentMonths] = React.useState(6);
  const [prepayPercent, setPrepayPercent] = React.useState(20);
  const totalItemCount = cart.lines.reduce((sum, line) => sum + line.quantity, 0);
  const totalDiscount = Number(cart.quote?.orderDiscount || 0);

  return (
    <aside className="flex flex-col h-full min-h-0 bg-white border-l border-slate-200 p-4 overflow-hidden text-slate-800 select-none shadow-xs">
      {/* Customer Picker */}
      <div className="space-y-2 shrink-0">
        <p className="text-[11px] font-medium text-slate-500">Khách thành viên <span className="font-normal text-slate-400">· không bắt buộc, dùng để tích điểm</span></p>
        <CustomerPicker
          scope={scope}
          value={cart.customer}
          onChange={(customer) => dispatch({ type: "customer", customer })}
        />

        <RetailPointsInput scope={scope} customerId={cart.customer?._id} value={cart.pointsToRedeem || 0} onChange={(pointsToRedeem) => dispatch({ type: "points", pointsToRedeem })} />
        {cart.customer?.type === "vat" && (
          <div className="space-y-1.5 rounded-xl border border-amber-300 bg-amber-50/70 p-2.5 text-xs text-amber-900 shadow-2xs">
            <div className="flex items-center justify-between font-bold text-amber-800">
              <span>Hóa đơn VAT</span>
              {cart.billingProfile && (
                <span className="font-mono text-[10px] text-amber-700">
                  MST: {cart.billingProfile.taxId}
                </span>
              )}
            </div>
            <Dropdown
              name="billingProfile"
              aria-label="Ho so VAT"
              placeholder="Chọn hồ sơ xuất VAT"
              value={cart.billingProfile?._id || ""}
              onChange={(val) =>
                dispatch({
                  type: "billingProfile",
                  billingProfile:
                    billingProfiles.find((item) => item._id === val) || null,
                })
              }
              options={billingProfiles.map((profile) => ({
                value: profile._id,
                label: `${profile.legalName} - ${profile.taxId}`,
              }))}
              variant="form"
              size="sm"
              className="w-full text-slate-800"
            />
            {!billingProfiles.length && (
              <p className="text-[11px] text-amber-700">
                Khách này chưa có hồ sơ VAT đang hoạt động.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Cart Items List */}
      <div className="my-3 flex-1 min-h-[140px] space-y-2 overflow-y-auto pr-1 scrollbar-thin">
        {cart.lines.length === 0 ? (
          <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-3 p-4 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#e8f2ff] via-[#edf3ff] to-[#f5f0ff] text-[#5875a6] shadow-inner" aria-hidden="true">
              <ShoppingCart className="h-8 w-8" strokeWidth={1.8} />
            </span>
            <p className="text-sm font-medium text-slate-400">Chưa có sản phẩm nào trong giỏ hàng</p>
          </div>
        ) : (
          cart.lines.map((line) => (
            <div
              key={line.product._id}
              className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-slate-800 transition hover:border-slate-300 shadow-2xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-sm text-slate-800">
                    {line.product.name}
                  </p>
                  <p className="font-mono text-xs text-[#0866f5] font-bold">
                    {money(line.product.price)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <QuantityInput
                    ariaLabel={`Số lượng ${line.product.name}`}
                    value={line.quantity}
                    onQuantityChange={(quantity) =>
                      dispatch({
                        type: "quantity",
                        productId: line.product._id,
                        quantity,
                      })
                    }
                  />

                  <button
                    type="button"
                    aria-label={`Xóa ${line.product.name}`}
                    onClick={() =>
                      dispatch({ type: "remove", productId: line.product._id })
                    }
                    className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <DiscountInput
                label={`Giảm giá ${line.product.name}`}
                value={line.discount}
                onChange={(discount) =>
                  dispatch({
                    type: "lineDiscount",
                    productId: line.product._id,
                    discount,
                  })
                }
              />

              {line.product.trackingMode === "serial" && (
                <SerialPicker
                  scope={scope}
                  productId={line.product.productId || (line.product.variantId ? "" : line.product._id)}
                  variantId={line.product.variantId}
                  quantity={line.quantity}
                  value={line.serialNumbers || []}
                  onChange={(serialNumbers) =>
                    dispatch({
                      type: "serials",
                      productId: line.product._id,
                      serialNumbers,
                    })
                  }
                />
              )}

              {line.product.trackingMode === "unit_barcode" && (
                <UnitBarcodePicker
                  scope={scope}
                  productId={line.product.productId || (line.product.variantId ? "" : line.product._id)}
                  variantId={line.product.variantId}
                  quantity={line.quantity}
                  value={line.internalBarcodes || []}
                  onChange={(internalBarcodes) =>
                    dispatch({
                      type: "internalBarcodes",
                      productId: line.product._id,
                      internalBarcodes,
                    })
                  }
                />
              )}
            </div>
          ))
        )}
      </div>

      {/* Action Buttons: 4 Light Pill Buttons */}
      <div className="space-y-2 pt-2 border-t border-slate-200 shrink-0">
        {/* Button 1: Giảm giá */}
        <div>
          <button
            type="button"
            onClick={() => setShowDiscountModal(true)}
            className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition cursor-pointer shadow-2xs ${
              totalDiscount > 0 || cart.couponCode
                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300"
            }`}
          >
            <Settings className="h-4 w-4 text-slate-500" />
            <span>Giảm giá</span>
            {(totalDiscount > 0 || cart.couponCode) && (
              <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                {cart.couponCode || `-${formatVndBadge(totalDiscount)}`}
              </span>
            )}
          </button>
        </div>

        {/* Người giới thiệu */}
        <div>
          <button
            type="button"
            onClick={() => setShowCollaboratorModal(true)}
            aria-haspopup="dialog"
            className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition cursor-pointer shadow-2xs ${
              cart.collaboratorId
                ? "border-[#9ec1ff] bg-[#edf3ff] text-[#0844a8]"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300"
            }`}
          >
            <Users className="h-4 w-4 text-slate-500" aria-hidden="true" />
            <span>Người giới thiệu</span>
            {cart.collaboratorId && (
              <span className="rounded-md border border-[#c2d7ff] bg-[#dce9ff] px-1.5 py-0.5 text-[10px] font-bold text-[#0758d5]">
                Đã chọn
              </span>
            )}
          </button>
        </div>

        {/* Ghi chú và trả góp */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setNoteEditorValue(orderNote);
              setShowNoteModal(true);
            }}
            className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition cursor-pointer shadow-2xs ${
              orderNote
                ? "border-[#9ec1ff] bg-[#edf3ff] text-[#0844a8]"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300"
            }`}
          >
            <FileText className="h-4 w-4 text-slate-500" />
            <span>Ghi chú</span>
            {orderNote && (
              <span className="h-2 w-2 rounded-full bg-[#0866f5]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setInstallmentPartner(cart.installment?.partner || "HD Saison");
              setInstallmentMonths(cart.installment?.months || 6);
              setPrepayPercent(cart.installment?.prepayPercent ?? 20);
              setShowInstallmentModal(true);
            }}
            className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition cursor-pointer shadow-2xs ${
              isInstallment
                ? "border-amber-300 bg-amber-50 text-amber-800"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300"
            }`}
          >
            <CreditCard className="h-4 w-4 text-slate-500" />
            <span>Trả góp</span>
            {isInstallment && (
              <span className="text-[10px] text-amber-700 font-bold">{cart.installment?.months}T</span>
            )}
          </button>
        </div>
      </div>

      {/* Summary and Main Checkout Button */}
      <div className="mt-3 pt-3 border-t border-slate-200 space-y-1.5 shrink-0">
        <div className="flex justify-between text-xs text-slate-500 font-medium">
          <span>Tạm tính</span>
          <span className="font-mono text-[#0866f5] font-semibold">
            {formatVndBadge(cart.quote?.subtotal || 0)}
          </span>
        </div>

        <div className="flex justify-between text-xs text-slate-500 font-medium">
          <span>VAT {cart.taxRate ?? 0}%</span>
          <span className="font-mono text-[#0866f5] font-semibold">
            {formatVndBadge(Number(cart.quote?.tax || cart.quote?.taxAmount || 0))}
          </span>
        </div>

        <div className="flex items-baseline justify-between pt-1">
          <span className="text-base font-bold text-slate-900">Tổng</span>
          <span className="font-mono text-xl sm:text-2xl font-black text-[#0866f5]">
            {formatVndBadge(cart.quote?.grandTotal || 0)}
          </span>
        </div>

        <button
          type="button"
          disabled={
            !cart.lines.length ||
            !cart.quote ||
            cart.quoteDirty ||
            !canPay ||
            busy
          }
          className={`mt-2 w-full flex items-center justify-center rounded-xl py-3.5 text-sm font-bold transition shadow-xs ${
            cart.lines.length > 0 && cart.quote && !cart.quoteDirty && canPay && !busy
              ? "bg-gradient-to-r from-[#0866f5] to-[#7138f5] hover:from-[#0758d5] hover:to-[#622ae1] text-white shadow-md shadow-[#0866f5]/20 cursor-pointer active:scale-[0.99]"
              : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
          }`}
          onClick={onPay}
        >
          Thanh toán
        </button>
      </div>

      {/* Discount & Order Adjustments Modal */}
      {showDiscountModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Giảm giá & Điều chỉnh đơn"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
        >
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl text-slate-800 sm:p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#edf3ff] text-[#0866f5]"><Settings className="h-4 w-4" /></span>
                <h3 className="font-bold text-base text-slate-900">Giảm giá & Điều chỉnh đơn</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDiscountModal(false)}
                aria-label="Đóng giảm giá và điều chỉnh đơn"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="my-4 space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <OrderAdjustments
                  orderDiscount={cart.orderDiscount}
                  taxRate={cart.taxRate}
                  shippingFee={cart.shippingFee}
                  onChange={(value) => dispatch({ type: "orderAdjustments", ...value })}
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2">
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <Ticket className="h-3.5 w-3.5 text-[#0866f5]" />
                  Mã ưu đãi (Coupon)
                </label>
                <CartCouponPicker
                  scope={scope}
                  customerId={cart.customer?._id}
                  value={cart.couponCode || ""}
                  onChange={(code) => dispatch({ type: "coupon", code })}
                />
                <div className="relative flex items-center">
                  <input
                    aria-label="Mã ưu đãi"
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-3.5 pr-8 font-mono text-xs font-bold uppercase tracking-wider text-slate-900 placeholder:font-sans placeholder:normal-case placeholder:text-slate-400 hover:border-slate-300 focus:border-[#0866f5] focus:outline-none focus:ring-2 focus:ring-[#0866f5]/20 shadow-2xs transition"
                    maxLength={32}
                    placeholder="Nhập mã ưu đãi..."
                    value={cart.couponCode || ""}
                    onChange={(event) =>
                      dispatch({ type: "coupon", code: event.target.value })
                    }
                  />
                  {cart.couponCode && (
                    <button
                      type="button"
                      onClick={() => dispatch({ type: "coupon", code: "" })}
                      className="absolute right-2.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                      title="Xóa mã"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {cart.couponCode && (
                  <div className="text-[11px]">
                    {cart.quoteDirty ? (
                      <span className="text-slate-400">Đang kiểm tra mã...</span>
                    ) : cart.quote && Number(cart.quote.orderDiscount || 0) > 0 ? (
                      <span className="font-semibold text-emerald-600">
                        ✓ Đã áp dụng giảm {money(Number(cart.quote.orderDiscount || 0))}
                      </span>
                    ) : (
                      <span className="text-amber-600">
                        Chưa áp dụng được mã. Kiểm tra điều kiện hoặc đổi mã.
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDiscountModal(false)}
                className="rounded-xl bg-[#0866f5] px-5 py-2 text-xs font-bold text-white hover:bg-[#0758d5] cursor-pointer shadow-xs"
              >
                Áp dụng & Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collaborator Modal */}
      {showCollaboratorModal && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowCollaboratorModal(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Chọn người giới thiệu"
            className="relative flex min-h-[300px] w-full max-w-md flex-col justify-between rounded-3xl border border-slate-200 bg-white p-5 text-slate-800 shadow-2xl sm:p-6"
          >
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#edf3ff] text-[#0866f5]" aria-hidden="true">
                    <Users className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-base font-extrabold leading-tight text-slate-900">Người giới thiệu / CTV</h3>
                    <p className="text-[11px] text-slate-500">Ghi nhận cộng tác viên giới thiệu đơn hàng</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCollaboratorModal(false)}
                  aria-label="Đóng người giới thiệu"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <RetailCollaboratorSelect
                  scope={scope}
                  value={cart.collaboratorId || ""}
                  onChange={(collaboratorId) => dispatch({ type: "collaborator", collaboratorId })}
                />
                {cart.collaboratorId && (
                  <button
                    type="button"
                    onClick={() => dispatch({ type: "collaborator", collaboratorId: "" })}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg text-xs font-semibold text-rose-600 transition hover:text-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <CircleX className="h-4 w-4 shrink-0" aria-hidden="true" />
                    Bỏ chọn người giới thiệu
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setShowCollaboratorModal(false)}
                className="min-h-10 rounded-xl bg-[#0866f5] px-5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#0758d5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Note Modal */}
      {showNoteModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Ghi chú đơn hàng"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
        >
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl text-slate-800 sm:p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#edf3ff] text-[#0866f5]"><FileText className="h-4 w-4" /></span>
                <h3 className="font-bold text-base text-slate-900">Ghi chú đơn hàng</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNoteModal(false)}
                aria-label="Đóng ghi chú đơn hàng"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="my-4 space-y-3">
              <textarea
                className="w-full h-24 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800 placeholder-slate-400 focus:border-[#0866f5] focus:bg-white focus:outline-none resize-none transition"
                placeholder="Nhập ghi chú hoặc yêu cầu giao hàng..."
                value={noteEditorValue}
                onChange={(e) => setNoteEditorValue(e.target.value)}
              />
              <div className="flex flex-wrap gap-1.5">
                {["Dán cường lực", "Cài đặt máy", "Giao gấp", "Bọc quà tặng", "Khách quen"].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() =>
                      setNoteEditorValue((prev) =>
                        prev ? `${prev}, ${preset}` : preset
                      )
                    }
                    className="rounded-lg border border-slate-200 bg-slate-100 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-200 hover:text-slate-900 transition cursor-pointer"
                  >
                    + {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setNoteEditorValue("");
                  dispatch({ type: "note", note: "" });
                  setShowNoteModal(false);
                }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Xóa ghi chú
              </button>
              <button
                type="button"
                onClick={() => {
                  dispatch({ type: "note", note: noteEditorValue.trim() });
                  setShowNoteModal(false);
                }}
                className="rounded-xl bg-[#0866f5] px-5 py-2 text-xs font-bold text-white hover:bg-[#0758d5] cursor-pointer shadow-xs"
              >
                Lưu ghi chú
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Installment Modal */}
      {showInstallmentModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Thông tin trả góp"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
        >
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl text-slate-800 sm:p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#edf3ff] text-[#0866f5]"><CreditCard className="h-4 w-4" /></span>
                <h3 className="font-bold text-base text-slate-900">Hồ sơ trả góp</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInstallmentModal(false)}
                aria-label="Đóng hồ sơ trả góp"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="my-4 space-y-4 text-xs">
              <p className="rounded-lg bg-amber-50 p-2 text-amber-800">Ghi nhận thông tin trả góp đã được đối tác xác nhận. Ước tính chưa bao gồm lãi/phí của đối tác.</p>
              <div>
                <label className="block text-slate-600 font-medium mb-1.5">
                  Đối tác tài chính / Ngân hàng
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {["HD Saison", "Home Credit", "MCredit", "Thẻ tín dụng (0%)"].map((partner) => (
                    <button
                      key={partner}
                      type="button"
                      onClick={() => setInstallmentPartner(partner)}
                      className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition cursor-pointer ${
                        installmentPartner === partner
                          ? "border-[#0866f5] bg-[#edf3ff] text-[#0844a8] font-bold shadow-2xs"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {partner}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1.5">
                  Kỳ hạn trả góp
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[3, 6, 9, 12].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setInstallmentMonths(m)}
                      className={`py-2 rounded-xl border text-xs font-semibold text-center transition cursor-pointer ${
                        installmentMonths === m
                          ? "border-[#0866f5] bg-[#edf3ff] text-[#0844a8] font-bold shadow-2xs"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {m} tháng
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1.5">
                  Trả trước ({prepayPercent}%)
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {[0, 10, 20, 30, 50].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setPrepayPercent(pct)}
                      className={`py-1.5 rounded-lg border text-[11px] font-semibold text-center transition cursor-pointer ${
                        prepayPercent === pct
                          ? "border-[#0866f5] bg-[#edf3ff] text-[#0844a8] font-bold shadow-2xs"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              {cart.quote && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1.5 text-slate-700">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Trả trước ước tính:</span>
                    <span className="font-mono font-bold text-[#0866f5]">
                      {formatVndBadge(Math.round((cart.quote.grandTotal * prepayPercent) / 100))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Ước tính gốc mỗi tháng ({installmentMonths}T):</span>
                    <span className="font-mono font-bold text-slate-900">
                      {formatVndBadge(
                        Math.round(
                          (cart.quote.grandTotal * (100 - prepayPercent)) /
                            (100 * installmentMonths)
                        )
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  dispatch({ type: "installment", installment: null });
                  setShowInstallmentModal(false);
                }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Hủy trả góp
              </button>
              <button
                type="button"
                onClick={() => {
                  dispatch({ type: "installment", installment: { partner: installmentPartner, months: installmentMonths, prepayPercent } });
                  setShowInstallmentModal(false);
                }}
                className="rounded-xl bg-[#0866f5] px-5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#0758d5] cursor-pointer"
              >
                Áp dụng trả góp
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

export default CartPanel;
