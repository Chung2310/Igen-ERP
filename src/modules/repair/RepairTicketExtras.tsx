import React, { useEffect, useState } from "react";
import { authService } from "../../services/authService";
import { apiFetch } from "../shared/lib/apiFetch";
import { repairExtras, repairService, type RepairNotification, type RepairPart, type RepairPartBilling, type RepairRatingCriteria, type RepairTicket } from "../../services/repairService";

const money = (value: number) => Number(value || 0).toLocaleString("vi-VN");
const date = (value?: string) => (value ? new Date(value).toLocaleString("vi-VN") : "—");
const BILLING_LABEL: Record<string, string> = { customer: "Khách trả", warranty_shop: "Bảo hành cửa hàng", warranty_supplier: "Bảo hành NCC" };
const NOTIFY_LABEL: Record<string, string> = { received: "Tiếp nhận", done: "Sửa xong" };
const NOTIFY_STATUS: Record<string, string> = { sent: "Đã gửi", failed: "Lỗi", skipped: "Bỏ qua" };
const CRITERIA: Array<{ key: keyof RepairRatingCriteria; label: string }> = [{ key: "skill", label: "Tay nghề" }, { key: "attitude", label: "Thái độ" }, { key: "speed", label: "Tốc độ" }];

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return <div className="mt-4 rounded-lg border p-3 text-sm"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><b>{title}</b>{action}</div><div className="mt-2">{children}</div></div>;
}

/** Phân công kỹ thuật viên: chọn trong tài khoản cùng công ty. */
function TechnicianPicker({ ticket, onChanged }: { ticket: RepairTicket; onChanged: () => void }) {
  const [people, setPeople] = useState<Array<{ uid: string; displayName?: string; email?: string }>>([]);
  const [value, setValue] = useState(ticket.technicianId || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { void authService.getColleagues().then((items) => setPeople(items as any)).catch(() => setPeople([])); }, []);
  const save = async () => {
    setBusy(true); setError("");
    try { await repairExtras.assignTechnician(ticket._id, value); onChanged(); }
    catch (e) { setError(e instanceof Error ? e.message : "Không thể phân công kỹ thuật viên."); }
    finally { setBusy(false); }
  };
  return <Section title="Kỹ thuật viên phụ trách">
    <div className="flex flex-wrap items-center gap-2">
      <select value={value} onChange={(e) => setValue(e.target.value)} className="rounded border px-3 py-2 text-sm">
        <option value="">— Chưa phân công —</option>
        {people.map((person) => <option key={person.uid} value={person.uid}>{person.displayName || person.email}</option>)}
      </select>
      <button type="button" disabled={busy || !value || value === ticket.technicianId} onClick={() => void save()} className="min-h-11 rounded bg-cyan-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Lưu phân công</button>
      {ticket.technicianName && <span className="text-xs text-slate-500">Đang phụ trách: <b>{ticket.technicianName}</b> · {date(ticket.assignedAt)}</span>}
    </div>
    {error && <p className="mt-2 text-xs text-rose-700">{error}</p>}
  </Section>;
}

const defaultBillingFor = (costBearer?: string): RepairPartBilling => (costBearer === "supplier" ? "warranty_supplier" : costBearer === "shop" ? "warranty_shop" : "customer");

type PartSearchHit = { _id: string; sku: string; name: string; price?: number; costPrice?: number; stock?: number };

function IssuePartForm({ ticket, onIssued }: { ticket: RepairTicket; onIssued: () => void }) {
  const [manual, setManual] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PartSearchHit[]>([]);
  const [selected, setSelected] = useState<PartSearchHit | null>(null);
  const [manualName, setManualName] = useState("");
  const [manualSku, setManualSku] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unitCost, setUnitCost] = useState(0);
  const [unitPrice, setUnitPrice] = useState(0);
  const [billing, setBilling] = useState<RepairPartBilling>(defaultBillingFor(ticket.coverage.costBearer));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const toggleManual = (value: boolean) => {
    setManual(value);
    setSelected(null);
    setResults([]);
    setQuery("");
    setManualName("");
    setManualSku("");
    setUnitCost(0);
    setUnitPrice(0);
    setError("");
  };

  const search = async (value: string) => {
    setQuery(value);
    setSelected(null);
    if (!value.trim()) { setResults([]); return; }
    try {
      const res = await apiFetch<{ success: boolean; data: PartSearchHit[] }>("/crud/products", { params: { search: value.trim(), limit: 10 } });
      setResults(res.data || []);
    } catch { setResults([]); }
  };

  const pick = (product: PartSearchHit) => {
    setSelected(product);
    setResults([]);
    setQuery(product.name);
    setUnitCost(Number(product.costPrice || 0));
    setUnitPrice(Number(product.price || 0));
  };

  const ready = manual ? manualName.trim().length > 0 : Boolean(selected);

  const submit = async () => {
    if (!ready) { setError(manual ? "Nhập tên linh kiện." : "Chọn linh kiện từ kho trước."); return; }
    if (!Number.isInteger(quantity) || quantity <= 0) { setError("Số lượng không hợp lệ."); return; }
    setBusy(true);
    setError("");
    try {
      const key = `repair:${ticket._id}:part:${manual ? "manual" : selected!._id}:${Date.now()}`;
      await repairService.issuePart(ticket._id, {
        productId: manual ? key : selected!._id,
        sku: manual ? (manualSku.trim() || "MANUAL") : selected!.sku,
        productName: manual ? manualName.trim() : selected!.name,
        quantity,
        unitCost,
        unitPrice,
        billing,
        manual,
        idempotencyKey: key,
      });
      toggleManual(manual);
      setQuantity(1);
      onIssued();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không xuất được linh kiện.");
    } finally {
      setBusy(false);
    }
  };

  return <div className="mt-3 space-y-2 rounded-lg border border-dashed p-3">
    <label className="flex items-center gap-2 text-xs text-slate-600">
      <input type="checkbox" checked={manual} onChange={(e) => toggleManual(e.target.checked)} />
      Linh kiện không có trong kho (phụ kiện rời / 0đ) — cho phép nhập tay, không trừ tồn kho
    </label>
    {manual ? <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-xs text-slate-600">Tên linh kiện<input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="VD: Ốc vít, keo dán, dây nguồn kèm theo..." className="rounded border px-2 py-1" /></label>
      <label className="flex flex-col gap-1 text-xs text-slate-600">Mã (tuỳ chọn)<input value={manualSku} onChange={(e) => setManualSku(e.target.value)} className="rounded border px-2 py-1" /></label>
    </div> : <div className="relative">
      <input value={query} onChange={(e) => void search(e.target.value)} placeholder="Tìm thiết bị thay thế trong kho theo tên hoặc SKU..." className="w-full rounded border px-3 py-2 text-sm" />
      {results.length > 0 && <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded border bg-white shadow-lg">
        {results.map((product) => <button type="button" key={product._id} onClick={() => pick(product)} className="block w-full border-b px-3 py-2 text-left text-xs hover:bg-slate-50">
          <b>{product.name}</b> · {product.sku} · Tồn kho: {product.stock ?? 0}
        </button>)}
      </div>}
    </div>}
    {ready && <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <label className="flex flex-col gap-1 text-xs text-slate-600">Số lượng<input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="rounded border px-2 py-1" /></label>
      <label className="flex flex-col gap-1 text-xs text-slate-600">Giá vốn<input type="number" min={0} value={unitCost} onChange={(e) => setUnitCost(Number(e.target.value))} className="rounded border px-2 py-1" /></label>
      <label className="flex flex-col gap-1 text-xs text-slate-600">Giá thu khách<input type="number" min={0} value={unitPrice} onChange={(e) => setUnitPrice(Number(e.target.value))} className="rounded border px-2 py-1" /></label>
      <label className="flex flex-col gap-1 text-xs text-slate-600">Diện chi phí
        <select value={billing} onChange={(e) => setBilling(e.target.value as RepairPartBilling)} className="rounded border px-2 py-1">
          <option value="customer">Khách trả (sửa chữa)</option>
          <option value="warranty_shop">Bảo hành cửa hàng</option>
          <option value="warranty_supplier">Bảo hành NCC</option>
        </select>
      </label>
    </div>}
    {error && <p className="text-xs text-rose-700">{error}</p>}
    <button type="button" disabled={busy || !ready} onClick={() => void submit()} className="min-h-11 rounded bg-cyan-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy ? "Đang xuất..." : manual ? "Thêm linh kiện (không trừ kho)" : "Xuất linh kiện từ kho"}</button>
  </div>;
}

function PartsSection({ ticket, onChanged }: { ticket: RepairTicket; onChanged: () => void }) {
  const [parts, setParts] = useState<RepairPart[]>([]);
  const [busyId, setBusyId] = useState("");
  const load = () => repairService.parts(ticket._id).then((items) => setParts(items as RepairPart[])).catch(() => setParts([]));
  useEffect(() => { void load(); }, [ticket._id]);
  const canIssue = ["approved", "repairing"].includes(ticket.status);

  const returnPart = async (part: RepairPart) => {
    const reason = window.prompt("Lý do hoàn linh kiện?", "");
    if (reason === null) return;
    setBusyId(part._id);
    try {
      await repairService.returnPart(ticket._id, part._id, reason);
      await load();
      onChanged();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Không hoàn được linh kiện.");
    } finally {
      setBusyId("");
    }
  };

  return <Section title="Thiết bị thay thế (xuất từ kho)">
    {parts.length ? <div className="overflow-x-auto"><table className="w-full text-xs">
      <thead><tr className="text-left text-slate-500"><th className="py-1">Linh kiện</th><th>SL</th><th>Diện chi phí</th><th className="text-right">Khách trả</th><th>Trạng thái</th><th></th></tr></thead>
      <tbody>{parts.map((part) => <tr key={part._id} className="border-t">
        <td className="py-1"><b>{part.productName}</b>{part.manual && <span className="ml-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">Thủ công</span>}<div className="text-slate-400">{part.sku}</div></td>
        <td>{part.quantity}</td>
        <td><span className={`rounded px-2 py-0.5 ${part.chargeable ? "bg-slate-100" : "bg-emerald-50 text-emerald-700"}`}>{BILLING_LABEL[part.billing] || part.billing}</span></td>
        <td className="text-right">{part.chargeable ? money(part.lineTotal) : "0"}</td>
        <td>{part.status === "issued" ? "Đã xuất" : part.status === "returned" ? "Đã hoàn" : "Đã huỷ"}</td>
        <td>{part.status === "issued" && <button type="button" disabled={busyId === part._id} onClick={() => void returnPart(part)} className="rounded border px-2 py-1 text-[11px] text-rose-700 disabled:opacity-50">Hoàn</button>}</td>
      </tr>)}</tbody>
    </table></div> : <p className="text-xs text-slate-500">Chưa xuất linh kiện nào cho phiếu này.</p>}
    {canIssue ? <IssuePartForm ticket={ticket} onIssued={() => { void load(); onChanged(); }} /> : <p className="mt-2 text-[11px] text-slate-400">Chỉ xuất được thiết bị thay thế khi phiếu đã được duyệt hoặc đang sửa.</p>}
  </Section>;
}

function NotificationsSection({ ticket }: { ticket: RepairTicket }) {
  const [rows, setRows] = useState<RepairNotification[]>([]);
  const [busy, setBusy] = useState("");
  const load = () => repairExtras.notifications(ticket._id).then(setRows).catch(() => setRows([]));
  useEffect(() => { void load(); }, [ticket._id]);
  const resend = async (event: "received" | "done") => {
    setBusy(event);
    try { const result = await repairExtras.resendNotification(ticket._id, event); if (result.status !== "sent") window.alert(`Không gửi được: ${result.reason || result.status}`); await load(); }
    catch (e) { window.alert(e instanceof Error ? e.message : "Không gửi lại được thông báo."); }
    finally { setBusy(""); }
  };
  return <Section title="Thông báo đã gửi khách" action={<div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
    <button type="button" disabled={busy === "received"} onClick={() => void resend("received")} className="min-h-11 w-full rounded border px-2 py-1 text-xs sm:w-auto">Gửi lại tin tiếp nhận</button>
    <button type="button" disabled={busy === "done" || !["done", "delivered"].includes(ticket.status)} onClick={() => void resend("done")} className="min-h-11 w-full rounded border px-2 py-1 text-xs disabled:opacity-50 sm:w-auto">Gửi lại tin sửa xong</button>
  </div>}>
    {rows.length ? rows.map((row) => <p key={row._id} className="text-xs text-slate-600">{date(row.sentAt)} · {NOTIFY_LABEL[row.event] || row.event} · {row.channel || "—"} → {row.recipient || "—"} · <b>{NOTIFY_STATUS[row.status]}</b>{row.reason ? ` (${row.reason})` : ""}</p>)
      : <p className="text-xs text-slate-500">Chưa gửi thông báo nào.</p>}
  </Section>;
}

/** Chấm điểm tại quầy khi khách nhận máy. Mỗi phiếu chỉ nhận một đánh giá. */
function RatingSection({ ticket }: { ticket: RepairTicket }) {
  const [rating, setRating] = useState(5);
  const [criteria, setCriteria] = useState<RepairRatingCriteria>({});
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState("");
  if (!["done", "delivered"].includes(ticket.status)) return null;
  const submit = async () => {
    setState("busy"); setError("");
    try { await repairExtras.rate(ticket._id, { rating, comment, criteria }); setState("done"); }
    catch (e) { setError(e instanceof Error ? e.message : "Không lưu được đánh giá."); setState("idle"); }
  };
  return <Section title="Chấm điểm kỹ thuật (tại quầy)">
    {state === "done" ? <p className="text-xs text-emerald-700">Đã ghi nhận đánh giá. Cảm ơn quý khách.</p> : <>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-xs">Điểm tổng
          <select value={rating} onChange={(e) => setRating(Number(e.target.value))} className="rounded border px-2 py-1">{[5, 4, 3, 2, 1].map((score) => <option key={score} value={score}>{score} sao</option>)}</select>
        </label>
        {CRITERIA.map((item) => <label key={item.key} className="flex items-center gap-2 text-xs">{item.label}
          <select value={criteria[item.key] ?? ""} onChange={(e) => setCriteria({ ...criteria, [item.key]: e.target.value ? Number(e.target.value) : undefined })} className="rounded border px-2 py-1">
            <option value="">—</option>{[5, 4, 3, 2, 1].map((score) => <option key={score} value={score}>{score}</option>)}
          </select>
        </label>)}
      </div>
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Nhận xét của khách (tuỳ chọn)" className="mt-2 min-h-16 w-full resize-y rounded-lg border px-3 py-2 text-sm" />
      <button type="button" disabled={state === "busy"} onClick={() => void submit()} className="mt-2 rounded bg-amber-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Lưu đánh giá</button>
      {error && <p className="mt-2 text-xs text-rose-700">{error}</p>}
    </>}
  </Section>;
}

export default function RepairTicketExtras({ ticket, onChanged }: { ticket: RepairTicket; onChanged: () => void }) {
  return <>
    <TechnicianPicker ticket={ticket} onChanged={onChanged} />
    <PartsSection ticket={ticket} onChanged={onChanged} />
    <RatingSection ticket={ticket} />
    <NotificationsSection ticket={ticket} />
  </>;
}
