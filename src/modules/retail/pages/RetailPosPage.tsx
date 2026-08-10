import React from "react";
import { Camera, Pause, Search, ShoppingCart, X } from "lucide-react";
import BarcodeScannerDialog from "../components/pos/BarcodeScannerDialog";
import CustomerPicker from "../components/pos/CustomerPicker";
import DiscountInput from "../components/pos/DiscountInput";
import HeldDraftsBar from "../components/pos/HeldDraftsBar";
import OrderAdjustments from "../components/pos/OrderAdjustments";
import PaymentDialog from "../components/pos/PaymentDialog";
import { retailOrdersApi } from "../api/retailOrders.api";
import { retailProductsApi } from "../api/retailProducts.api";
import { retailShiftsApi } from "../api/retailShifts.api";
import { initialRetailCart, retailCartReducer, type RetailCartState } from "../hooks/retailCart";
import { buildRetailOrderInput } from "../hooks/retailOrderInput";
import { buildPaymentSummary } from "../hooks/retailPayment";
import { useRetailScope } from "../hooks/useRetailScope";
import type { RetailOrder, RetailPaymentInput, RetailProduct, RetailScope, RetailShift } from "../types";

const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value) + " ₫";

export default function RetailPosPage() {
  const { scope } = useRetailScope();
  const [cart, dispatch] = React.useReducer(retailCartReducer, initialRetailCart);
  const [products, setProducts] = React.useState<RetailProduct[]>([]);
  const [drafts, setDrafts] = React.useState<RetailOrder[]>([]);
  const [draft, setDraft] = React.useState<RetailOrder | null>(null);
  const [shift, setShift] = React.useState<RetailShift | null>(null);
  const [q, setQ] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [paying, setPaying] = React.useState(false);
  const [scanning, setScanning] = React.useState(false);

  const show = React.useCallback((cause: unknown) => setMessage(cause instanceof Error ? cause.message : "Không xử lý được yêu cầu."), []);
  const refreshDrafts = React.useCallback(() => { if (scope) void retailOrdersApi.list(scope, { heldOnly: true, limit: 5 }).then((data) => setDrafts(data.items)).catch(show); }, [scope?.companyCode, scope?.branchId, show]);

  React.useEffect(() => { if (!scope) return; void retailShiftsApi.current(scope).then(setShift).catch(show); refreshDrafts(); }, [scope?.companyCode, scope?.branchId, refreshDrafts, show]);
  React.useEffect(() => { if (!scope) return; const timer = window.setTimeout(() => void retailProductsApi.list(scope, { q }).then((data) => setProducts(data.items)).catch(show), 200); return () => window.clearTimeout(timer); }, [scope?.companyCode, scope?.branchId, q, show]);
  React.useEffect(() => { if (!scope || !cart.lines.length || !cart.quoteDirty) return; const timer = window.setTimeout(() => void retailOrdersApi.quote(scope, buildRetailOrderInput(cart)).then((quote) => dispatch({ type: "quote", quote })).catch(show), 180); return () => window.clearTimeout(timer); }, [scope, cart, show]);

  if (!scope) return <Notice />;

  const scan = async (barcode: string) => { try { const result = await retailProductsApi.list(scope, { barcode, limit: 1 }); if (!result.items[0]) throw new Error("Không tìm thấy sản phẩm theo mã vừa quét."); dispatch({ type: "add", product: result.items[0] }); setQ(""); } catch (error) { show(error); } };
  const openDraft = (value: RetailOrder) => {
    setDraft(value);
    dispatch({
      type: "load",
      lines: value.items.map((item) => ({ product: { _id: item.productId, sku: item.sku, name: item.productName, category: "", unit: item.unit, stock: 0, price: item.unitPrice }, quantity: item.quantity, discount: { type: "amount", value: item.discountAmount } })),
      customer: value.customerId ? { _id: value.customerId, customerCode: value.customerId, companyCode: scope.companyCode, originBranchId: scope.branchId, name: value.customerName || "Khách hàng", phone: value.customerPhone } : null,
      orderDiscount: { type: "amount", value: value.orderDiscount }, taxRate: value.taxRate, shippingFee: value.shippingFee,
    });
    setMessage(`Đang xử lý đơn treo #${value._id.slice(-6)}`);
  };
  const saveDraft = async () => { if (!cart.lines.length) return; setBusy(true); try { const input = buildRetailOrderInput(cart); if (draft) await retailOrdersApi.updateDraft(scope, draft._id, { ...input, version: draft.version }); else await retailOrdersApi.createDraft(scope, input); dispatch({ type: "reset" }); setDraft(null); refreshDrafts(); setMessage("Đã treo đơn. Đơn không giữ tồn kho."); } catch (error) { show(error); } finally { setBusy(false); } };
  const checkout = async (payments: RetailPaymentInput[], dueDate?: string) => { if (!cart.quote) return; const customerId = cart.customer?._id; buildPaymentSummary(cart.quote.grandTotal, payments, { customerId, dueDate }); setBusy(true); const key = crypto.randomUUID(); try { const input = { ...buildRetailOrderInput(cart), dueDate }; const saved = draft ? await retailOrdersApi.updateDraft(scope, draft._id, { ...input, version: draft.version }) : await retailOrdersApi.createDraft(scope, input); await retailOrdersApi.confirm(scope, saved._id, { expectedGrandTotal: cart.quote.grandTotal, payments, idempotencyKey: key }); finish("Thanh toán thành công."); } catch (error) { const attempt = await retailOrdersApi.idempotency(scope, key).catch(() => null); if (attempt?.status === "completed") finish("Giao dịch đã hoàn tất."); else show(error); } finally { setBusy(false); } };
  const finish = (text: string) => { dispatch({ type: "reset" }); setDraft(null); setPaying(false); refreshDrafts(); setMessage(text); };

  return <section className="grid min-h-[65vh] gap-4 lg:grid-cols-[1fr_440px]">
    <main className="space-y-4"><header className="flex flex-wrap items-center justify-between gap-2"><div><h1 className="text-xl font-bold">Bán hàng</h1><p className="text-sm text-slate-500">{shift ? `${shift.shiftCode} · ${shift.businessDate}` : "Chưa mở ca bán hàng"}</p></div><button className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm" onClick={() => setScanning(true)}><Camera className="h-4 w-4" />Quét bằng camera</button></header><HeldDraftsBar drafts={drafts} activeId={draft?._id} onOpen={openDraft} /><label className="relative block"><Search className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" /><input autoFocus aria-label="Tìm hoặc quét sản phẩm" className="w-full rounded-xl border py-3 pl-10 pr-4" placeholder="Tên, SKU hoặc mã vạch" value={q} onChange={(event) => setQ(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && q.trim()) void scan(q.trim()); }} /></label><ProductGrid products={products} onAdd={(product) => dispatch({ type: "add", product })} /></main>
    <CartPanel scope={scope} cart={cart} message={message} busy={busy} canPay={Boolean(shift)} dispatch={dispatch} onHold={saveDraft} onPay={() => setPaying(true)} />
    {paying && cart.quote && <PaymentDialog total={cart.quote.grandTotal} busy={busy} customerId={cart.customer?._id} onClose={() => setPaying(false)} onSubmit={checkout} />}
    {scanning && <BarcodeScannerDialog onScan={(value) => void scan(value)} onClose={() => setScanning(false)} />}
  </section>;
}

function ProductGrid({ products, onAdd }: { products: RetailProduct[]; onAdd: (product: RetailProduct) => void }) { return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{products.map((product) => <button key={product._id} className="rounded-2xl border bg-white p-4 text-left hover:border-cyan-500" onClick={() => onAdd(product)}><p className="font-bold">{product.name}</p><p className="text-xs text-slate-500">{product.sku} · Tồn {product.stock}</p><p className="mt-2 font-bold text-cyan-700">{money(product.price)}</p></button>)}</div>; }

function CartPanel({ scope, cart, message, busy, canPay, dispatch, onHold, onPay }: { scope: RetailScope; cart: RetailCartState; message: string; busy: boolean; canPay: boolean; dispatch: React.Dispatch<any>; onHold: () => Promise<void>; onPay: () => void }) {
  return <aside className="flex flex-col rounded-2xl border bg-white p-4"><h2 className="flex items-center gap-2 font-bold"><ShoppingCart className="h-5 w-5" />Giỏ hàng ({cart.lines.reduce((sum, line) => sum + line.quantity, 0)})</h2><div className="mt-3"><CustomerPicker scope={scope} value={cart.customer} onChange={(customer) => dispatch({ type: "customer", customer })} /></div><div className="my-4 flex-1 space-y-3">{cart.lines.map((line) => <div key={line.product._id} className="space-y-2 border-b pb-3"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate font-medium">{line.product.name}</p><p className="text-xs text-slate-500">{money(line.product.price)}</p></div><input aria-label={`Số lượng ${line.product.name}`} className="w-16 rounded-lg border px-2 py-1" type="number" min="0" value={line.quantity} onChange={(event) => dispatch({ type: "quantity", productId: line.product._id, quantity: Number(event.target.value) })} /><button aria-label={`Xóa ${line.product.name}`} onClick={() => dispatch({ type: "remove", productId: line.product._id })}><X className="h-4 w-4" /></button></div><DiscountInput label={`Giảm giá ${line.product.name}`} value={line.discount} onChange={(discount) => dispatch({ type: "lineDiscount", productId: line.product._id, discount })} /></div>)}</div><OrderAdjustments orderDiscount={cart.orderDiscount} taxRate={cart.taxRate} shippingFee={cart.shippingFee} onChange={(value) => dispatch({ type: "orderAdjustments", ...value })} />{message && <p className="my-3 text-sm text-cyan-700">{message}</p>}<div className="border-t pt-4"><div className="flex justify-between text-lg font-bold"><span>Tổng tiền</span><span>{money(cart.quote?.grandTotal || 0)}</span></div><div className="mt-4 grid grid-cols-2 gap-2"><button disabled={!cart.lines.length || busy} className="flex items-center justify-center gap-2 rounded-xl border px-3 py-3 font-bold disabled:opacity-40" onClick={() => void onHold()}><Pause className="h-4 w-4" />Treo đơn</button><button disabled={!cart.lines.length || !cart.quote || !canPay || busy} className="rounded-xl bg-cyan-600 px-3 py-3 font-bold text-white disabled:opacity-40" onClick={onPay}>Thanh toán</button></div></div></aside>;
}

function Notice() { return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-800">Vui lòng chọn chi nhánh.</div>; }
