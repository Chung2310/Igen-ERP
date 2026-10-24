import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { inventorySerialService, type InventorySerialEvent, type InventorySerialUnit, type SerialUnitStatus } from "../../services/inventorySerialService";
import { toast } from "../../pages/Toast";
import { StyledSelect } from "../common/StyledSelect";
import "./inventory-ui.css";

const statuses: Array<"" | SerialUnitStatus> = ["", "in_stock", "sold", "returned", "defective", "repairing", "scrapped"];

const serialStatusLabels: Record<SerialUnitStatus, string> = {
  in_stock: "Trong kho", in_transit: "Đang chuyển kho", sold: "Đã bán", returned: "Đã trả hàng",
  defective: "Lỗi", repairing: "Đang sửa chữa", scrapped: "Đã thanh lý", lost: "Thất lạc",
};

const serialEventLabels: Record<string, string> = {
  received: "Nhập kho", sold: "Bán hàng", sale_cancelled: "Hủy bán hàng", transferred: "Điều chuyển kho",
  transfer_requested: "Yêu cầu chuyển kho", transfer_received: "Đã nhận chuyển kho", transfer_cancelled: "Hủy chuyển kho",
  repair_received: "Nhận sửa chữa", repair_delivered: "Hoàn tất sửa chữa", warranty_adjusted: "Điều chỉnh bảo hành",
  count_lost: "Kiểm kê ghi nhận thất lạc",
};

function serialStatusLabel(status?: SerialUnitStatus) { return status ? serialStatusLabels[status] : "Chưa có trạng thái"; }
function serialEventLabel(eventType: string) { return serialEventLabels[eventType] || "Thao tác khác"; }

export function SerialRegistrySection({ onTransfers }: { onTransfers?: () => void } = {}) {
  const [items, setItems] = useState<InventorySerialUnit[]>([]);
  const [serial, setSerial] = useState("");
  const [status, setStatus] = useState<"" | SerialUnitStatus>("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<{ item: InventorySerialUnit; events: InventorySerialEvent[] } | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importForm, setImportForm] = useState({ productId: "", variantId: "", sku: "", productName: "", serialNumbers: "" });
  const [importing, setImporting] = useState(false);
  const [transferItem, setTransferItem] = useState<InventorySerialUnit | null>(null);
  const [transferBranch, setTransferBranch] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [transferring, setTransferring] = useState(false);

  async function load() {
    setLoading(true);
    try { setItems((await inventorySerialService.list({ serial: serial || undefined, status: status || undefined, limit: 100 })).items); }
    catch (problem) { toast.error(problem instanceof Error ? problem.message : "Không thể tải danh sách IMEI/serial."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [status]);

  return <section className="inventory-ui space-y-4 rounded-2xl border border-[#DCE7F4] bg-white p-5">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="border-l-[3px] border-[#00ADFC] pl-3 text-xl font-medium text-slate-900">Quản lý IMEI / Serial</h2><p className="mt-1 pl-[15px] text-sm text-slate-500">Tra cứu vòng đời từng thiết bị và trạng thái tồn kho.</p></div><div className="flex flex-wrap gap-2">{onTransfers && <button type="button" onClick={onTransfers} className="min-h-10 rounded-xl border border-outline px-3 text-sm text-on-surface hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary">Xem điều chuyển</button>}<button type="button" onClick={() => setShowImport((value) => !value)} className="rounded-xl border border-[#DCE7F4] px-3 py-2 text-sm text-slate-700 hover:bg-[#F5FAFE]">{showImport ? "Đóng import" : "Import IMEI"}</button><button type="button" onClick={() => void load()} className="rounded-xl bg-[#00ADFC] px-3 py-2 text-sm font-medium text-white hover:bg-[#0097dc]">Làm mới</button></div></div>
    {showImport && <form className="grid gap-3 rounded-xl border border-[#DCE7F4] bg-[#F8FBFF] p-4 sm:grid-cols-2" onSubmit={async (event) => { event.preventDefault(); setImporting(true); try { await inventorySerialService.importBatch({ productId: importForm.productId.trim(), variantId: importForm.variantId.trim() || undefined, sku: importForm.sku.trim(), productName: importForm.productName.trim(), serialNumbers: importForm.serialNumbers.split(/[\n,;]+/).map((value) => value.trim()).filter(Boolean) }); setImportForm({ productId: "", variantId: "", sku: "", productName: "", serialNumbers: "" }); setShowImport(false); await load(); } catch (problem) { toast.error(problem instanceof Error ? problem.message : "Không thể import IMEI/serial."); } finally { setImporting(false); } }}><input required aria-label="Mã sản phẩm" placeholder="Mã sản phẩm" value={importForm.productId} onChange={(event) => setImportForm((value) => ({ ...value, productId: event.target.value }))} className="h-10 rounded-xl border border-[#DCE7F4] bg-white px-3 text-sm" /><input aria-label="Mã biến thể" placeholder="Mã biến thể (nếu có)" value={importForm.variantId} onChange={(event) => setImportForm((value) => ({ ...value, variantId: event.target.value }))} className="h-10 rounded-xl border border-[#DCE7F4] bg-white px-3 text-sm" /><input required aria-label="SKU" placeholder="SKU" value={importForm.sku} onChange={(event) => setImportForm((value) => ({ ...value, sku: event.target.value }))} className="h-10 rounded-xl border border-[#DCE7F4] bg-white px-3 text-sm" /><input required aria-label="Tên sản phẩm" placeholder="Tên sản phẩm" value={importForm.productName} onChange={(event) => setImportForm((value) => ({ ...value, productName: event.target.value }))} className="h-10 rounded-xl border border-[#DCE7F4] bg-white px-3 text-sm" /><textarea required aria-label="Danh sách IMEI" rows={4} placeholder="Mỗi IMEI một dòng hoặc phân tách bằng dấu phẩy" value={importForm.serialNumbers} onChange={(event) => setImportForm((value) => ({ ...value, serialNumbers: event.target.value }))} className="rounded-xl border border-[#DCE7F4] bg-white px-3 py-2 text-sm sm:col-span-2" /><div className="flex justify-end sm:col-span-2"><button disabled={importing} className="rounded-xl bg-[#00ADFC] px-4 py-2 text-sm font-medium text-white hover:bg-[#0097dc] disabled:opacity-50">{importing ? "Đang import..." : "Import danh sách"}</button></div></form>}
    <form className="flex flex-wrap items-center gap-2" onSubmit={(event) => { event.preventDefault(); void load(); }}><input aria-label="Tìm IMEI / Serial" value={serial} onChange={(event) => setSerial(event.target.value)} placeholder="IMEI / Serial" className="h-10 min-w-60 rounded-xl border border-[#DCE7F4] px-3 text-sm" /><div className="w-52"><StyledSelect ariaLabel="Lọc trạng thái IMEI" value={status} onChange={(value) => setStatus(value as typeof status)} options={statuses.map((value) => ({ value, label: value ? serialStatusLabel(value) : "Tất cả trạng thái" }))} /></div><button className="h-10 rounded-xl border border-[#DCE7F4] px-3 text-sm text-slate-700 hover:bg-[#F5FAFE]">Tìm kiếm</button></form>
    <div className="overflow-x-auto rounded-xl border border-[#DCE7F4]"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-[#E8F7FF] text-sm text-slate-600"><tr><th className="px-3 py-2.5 font-medium">IMEI / Serial</th><th className="px-3 py-2.5 font-medium">SKU</th><th className="px-3 py-2.5 font-medium">Sản phẩm</th><th className="px-3 py-2.5 font-medium">Trạng thái</th><th className="px-3 py-2.5 font-medium">Cập nhật</th><th className="px-3 py-2.5" /></tr></thead><tbody className="divide-y divide-[#E7EFF7]">{loading ? <tr><td colSpan={6} className="p-6 text-center text-slate-400">Đang tải...</td></tr> : items.length === 0 ? <tr><td colSpan={6} className="p-6 text-center text-slate-400">Chưa có dữ liệu.</td></tr> : items.map((item) => <tr key={item._id} className="hover:bg-[#F8FBFF]"><td className="px-3 py-2.5 font-medium text-slate-800">{item.serialNumber}</td><td className="px-3 py-2.5">{item.sku}</td><td className="px-3 py-2.5">{item.productName}</td><td className="px-3 py-2.5"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{serialStatusLabel(item.status)}</span></td><td className="px-3 py-2.5 text-sm text-slate-500">{new Date(item.updatedAt).toLocaleString("vi-VN")}</td><td className="px-3 py-2.5 text-right"><div className="flex justify-end gap-2"><button type="button" className="text-sm text-[#007EB8] hover:underline" onClick={async () => { try { setHistory({ item, events: await inventorySerialService.history(item._id) }); } catch (problem) { toast.error(problem instanceof Error ? problem.message : "Không thể tải lịch sử."); } }}>Lịch sử</button>{item.status === "in_transit" && <><button type="button" className="text-sm text-emerald-700" onClick={async () => { try { await inventorySerialService.acceptTransfer(item._id, {}); await load(); } catch (problem) { toast.error(problem instanceof Error ? problem.message : "Không thể xác nhận nhận hàng."); } }}>Nhận hàng</button><button type="button" className="text-sm text-rose-700" onClick={async () => { const reason = window.prompt("Lý do hủy chuyển kho:"); if (!reason) return; try { await inventorySerialService.cancelTransfer(item._id, reason); await load(); } catch (problem) { toast.error(problem instanceof Error ? problem.message : "Không thể hủy chuyển kho."); } }}>Hủy</button></>}</div></td></tr>)}</tbody></table></div>
    {history && (
      <div data-testid="serial-history-backdrop" className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]" onClick={() => setHistory(null)}>
        <div role="dialog" aria-modal="true" aria-label="Lịch sử IMEI / Serial" className="inventory-ui inventory-popup flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#DCE7F4] bg-white shadow-[0_24px_70px_rgba(11,65,99,0.18)]" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-start justify-between border-b border-[#E7EFF7] px-5 py-4">
            <div>
              <h3 className="border-l-[3px] border-[#00ADFC] pl-3 text-lg font-medium text-slate-900">Lịch sử {history.item.serialNumber}</h3>
              <p className="mt-1 pl-[15px] text-sm text-slate-500">{history.item.productName} · {history.item.sku}</p>
            </div>
            <button
              type="button"
              aria-label="Đóng lịch sử"
              onClick={() => setHistory(null)}
              className="grid h-8 w-8 place-items-center rounded-full bg-rose-500 text-white hover:bg-rose-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="max-h-[60vh] space-y-3 overflow-y-auto bg-[#F8FBFF] p-5">
            {history.events.length === 0 ? (
              <p className="text-center py-6 text-sm text-slate-500">Chưa có lịch sử.</p>
            ) : (
              history.events.map((event) => (
                <div key={event._id} className="rounded-xl border border-[#DCE7F4] bg-white p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3">
                    <strong className="text-sm font-medium text-slate-800 leading-none">
                      {serialEventLabel(event.eventType)}
                    </strong>
                    <span className="text-sm text-slate-500 sm:text-right">
                      {new Date(event.occurredAt).toLocaleString("vi-VN")}
                    </span>
                  </div>
                  <p className="mt-2 break-all text-sm text-slate-500 sm:break-normal">
                    {serialStatusLabel(event.fromStatus)} &rarr; {serialStatusLabel(event.toStatus)} &middot; {event.actorName}
                  </p>
                </div>
              ))
            )}
          </div>
          <div className="flex justify-end border-t border-[#E7EFF7] bg-white px-5 py-3">
            <button
              type="button"
              onClick={() => setHistory(null)}
              className="rounded-xl bg-[#00ADFC] px-4 py-2 text-sm font-medium text-white hover:bg-[#0097dc]"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    )}
    {transferItem && <form className="grid gap-3 rounded-xl border border-[#DCE7F4] bg-[#F8FBFF] p-4 sm:grid-cols-3" onSubmit={async (event) => { event.preventDefault(); setTransferring(true); try { await inventorySerialService.requestTransfer(transferItem._id, { toBranchId: transferBranch.trim(), reason: transferReason.trim() }); setTransferItem(null); setTransferBranch(""); setTransferReason(""); await load(); } catch (problem) { toast.error(problem instanceof Error ? problem.message : "Không thể tạo yêu cầu chuyển kho."); } finally { setTransferring(false); } }}><p className="text-base font-medium text-slate-800 sm:col-span-3">Tạo yêu cầu chuyển {transferItem.serialNumber}</p><input required aria-label="Mã chi nhánh nhận" placeholder="Mã chi nhánh nhận" value={transferBranch} onChange={(event) => setTransferBranch(event.target.value)} className="h-10 rounded-xl border border-[#DCE7F4] bg-white px-3 text-sm" /><input required aria-label="Lý do chuyển" placeholder="Lý do chuyển" value={transferReason} onChange={(event) => setTransferReason(event.target.value)} className="h-10 rounded-xl border border-[#DCE7F4] bg-white px-3 text-sm sm:col-span-2" /><div className="flex justify-end sm:col-span-3"><button disabled={transferring} className="rounded-xl bg-[#00ADFC] px-4 py-2 text-sm font-medium text-white hover:bg-[#0097dc] disabled:opacity-50">{transferring ? "Đang tạo..." : "Tạo yêu cầu chuyển"}</button></div></form>}
    {!transferItem && items.some((item) => item.status === "in_stock") && <button type="button" className="rounded-xl border border-[#DCE7F4] px-3 py-2 text-sm text-[#007EB8] hover:bg-[#F5FAFE]" onClick={() => setTransferItem(items.find((item) => item.status === "in_stock") || null)}>Chuyển serial tồn đầu tiên</button>}
  </section>;
}
