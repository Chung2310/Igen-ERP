import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Search, X, XCircle, Trash2 } from "lucide-react";
import { Pagination } from "../components/common/Pagination";
import { LogisticsEmptyIllustration } from "../components/common/LogisticsEmptyIllustration";

export type EquipmentBorrowRequest = {
  _id: string;
  equipmentId: string;
  equipmentName: string;
  equipmentCode: string;
  employeeId: string;
  employeeName: string;
  requestType: "borrow" | "return";
  status: "pending" | "approved" | "rejected" | "cancelled";
  reason?: string;
  note?: string;
  expectedReturnAt?: string;
  rejectionReason?: string;
};

type Props = {
  requests: EquipmentBorrowRequest[];
  loading: boolean;
  canManage: boolean;
  onCancel: (id: string) => void;
  onDecision: (id: string, decision: "approved" | "rejected", rejectionReason?: string) => void;
};

const statusLabel: Record<string, string> = {
  pending: "Chờ duyệt", approved: "Đã duyệt", rejected: "Từ chối", cancelled: "Đã hủy",
};

export default function EquipmentRequestsView({ requests, loading, canManage, onCancel, onDecision }: Props) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [requestToReject, setRequestToReject] = useState<EquipmentBorrowRequest | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((request) => {
      const matchType = !type || request.requestType === type;
      const matchStatus = !status || request.status === status;
      const matchSearch = !q ||
        (request.equipmentName || "").toLowerCase().includes(q) ||
        (request.equipmentCode || "").toLowerCase().includes(q) ||
        (request.employeeName || "").toLowerCase().includes(q) ||
        (request.reason || "").toLowerCase().includes(q) ||
        (request.note || "").toLowerCase().includes(q);
      return matchType && matchStatus && matchSearch;
    });
  }, [requests, type, status, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedRequests = useMemo(() => {
    const startIndex = (safePage - 1) * pageSize;
    return filtered.slice(startIndex, startIndex + pageSize);
  }, [filtered, safePage, pageSize]);

  useEffect(() => {
    if (!requestToReject) return;

    cancelButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setRequestToReject(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [requestToReject]);

  const confirmRejection = () => {
    if (!requestToReject) return;
    onDecision(requestToReject._id, "rejected", "Quản lý đã từ chối yêu cầu");
    setRequestToReject(null);
  };

  return (
    <>
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              aria-label="Tìm kiếm yêu cầu"
              type="text"
              placeholder="Tìm theo thiết bị, nhân viên..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full sm:w-60 rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-400 bg-white"
            />
          </div>
          <select
            aria-label="Loại yêu cầu"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setCurrentPage(1);
            }}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white outline-none"
          >
            <option value="">Tất cả loại</option><option value="borrow">Mượn</option><option value="return">Trả</option>
          </select>
          <select
            aria-label="Trạng thái yêu cầu"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white outline-none"
          >
            <option value="">Tất cả trạng thái</option><option value="pending">Chờ duyệt</option><option value="approved">Đã duyệt</option><option value="rejected">Từ chối</option><option value="cancelled">Đã hủy</option>
          </select>
        </div>
      </div>
      {loading ? <p className="p-10 text-center text-slate-400">Đang tải yêu cầu...</p> : filtered.length === 0 ? <div className="px-4 py-12 text-center text-on-surface-variant"><LogisticsEmptyIllustration kind="documents" /><p className="mt-2 text-pretty text-sm">Không có yêu cầu phù hợp.</p></div> : (
        <>
          <div className="divide-y divide-slate-100">
            {paginatedRequests.map((request) => <article key={request._id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><p className="font-bold text-slate-900">{request.equipmentName} <span className="font-mono text-xs text-slate-400">({request.equipmentCode})</span></p><span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-bold">{request.requestType === "borrow" ? "Mượn" : "Trả"}</span><span className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 text-[11px] font-bold">{statusLabel[request.status]}</span></div>
                <p className="text-sm text-slate-600 mt-2">{canManage && <><b>{request.employeeName}</b> · </>}{request.reason || request.note || "Không có ghi chú"}</p>
                {request.expectedReturnAt && <p className="text-xs text-slate-500 mt-1">Dự kiến trả: {new Date(request.expectedReturnAt).toLocaleDateString("vi-VN")}</p>}
                {request.rejectionReason && <p className="text-xs text-rose-600 mt-1">Phản hồi: {request.rejectionReason}</p>}
              </div>
              {request.status === "pending" && <div className="flex gap-2 shrink-0">
                {canManage ? <><button aria-label="Duyệt yêu cầu" onClick={() => onDecision(request._id, "approved")} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold"><Check className="w-4 h-4" />Duyệt</button><button aria-label="Từ chối yêu cầu" onClick={() => setRequestToReject(request)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 text-rose-700 text-sm font-semibold"><XCircle className="w-4 h-4" />Từ chối</button></> : <button aria-label="Hủy yêu cầu" onClick={() => onCancel(request._id)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold"><Trash2 className="w-4 h-4" />Hủy yêu cầu</button>}
              </div>}
            </article>)}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-100 bg-slate-50/50 p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>
                Hiển thị <b>{(safePage - 1) * pageSize + 1}</b> - <b>{Math.min(safePage * pageSize, filtered.length)}</b> trên tổng số <b>{filtered.length}</b> yêu cầu
              </span>
              <span className="hidden sm:inline text-slate-300">|</span>
              <label className="flex items-center gap-1.5">
                <span>Mỗi trang:</span>
                <select
                  aria-label="Số yêu cầu mỗi trang"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-slate-400"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </label>
            </div>

            <Pagination
              currentPage={safePage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        </>
      )}
    </section>
    {requestToReject && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) setRequestToReject(null);
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="equipment-rejection-title"
          className="w-full max-w-md overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl"
        >
          <div className="flex items-start gap-4 border-b border-slate-100 px-6 py-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 id="equipment-rejection-title" className="text-lg font-bold text-slate-900">Từ chối yêu cầu</h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">Hành động này sẽ từ chối yêu cầu đang chờ duyệt.</p>
            </div>
            <button type="button" aria-label="Đóng popup" onClick={() => setRequestToReject(null)} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Thiết bị</p>
            <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="font-semibold text-slate-900">{requestToReject.equipmentName}</p>
              <p className="mt-0.5 font-mono text-xs text-slate-500">{requestToReject.equipmentCode}</p>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/70 px-6 py-4 sm:flex-row sm:justify-end">
            <button ref={cancelButtonRef} type="button" onClick={() => setRequestToReject(null)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              Hủy
            </button>
            <button type="button" onClick={confirmRejection} className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700">
              <XCircle className="h-4 w-4" />
              Xác nhận từ chối
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
