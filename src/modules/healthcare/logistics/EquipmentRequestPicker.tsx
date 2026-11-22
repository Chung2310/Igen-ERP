import { useState } from "react";
import type { Equipment, LogisticsList } from "../../../../shared/healthcare-logistics";
import type { HealthcareApi } from "../api";
import { ErpModal } from "../../../components/common/ErpModal";
import { TablePagination } from "../../../components/common/TablePagination";
import { buttonClass, Field, Feedback, useHealthcareQuery } from "../ui";
import { cn } from "../../student-management/lib/utils";

export default function EquipmentRequestPicker({ api, type, onClose, onSelect }: {
  api: HealthcareApi;
  type: "borrow" | "return";
  onClose: () => void;
  onSelect: (row: Equipment, type: "borrow" | "return") => void;
}) {
  const [requestType, setRequestType] = useState(type);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const list = useHealthcareQuery<LogisticsList<Equipment>>(api,
    `/logistics/equipment?${requestType === "borrow" ? "status=available" : "returnable=true"}&page=${page}&q=${encodeURIComponent(search)}`);
  return <ErpModal native title="Tạo phiếu mượn/trả thiết bị" onClose={onClose} maxWidth="max-w-3xl">
    <div className="space-y-4">
      <div role="group" className="inline-flex gap-1 rounded-xl border border-outline-variant bg-surface-container-lowest p-1" aria-label="Loại yêu cầu">
        {(["borrow", "return"] as const).map((value) => <button key={value} type="button" aria-pressed={requestType === value} className={cn(buttonClass, requestType === value && "border-primary bg-primary text-on-primary")} onClick={() => { setRequestType(value); setPage(1); }}>
          {value === "borrow" ? "Mượn thiết bị" : "Trả thiết bị"}
        </button>)}
      </div>
      <Field name="request-equipment-search" label="Tìm thiết bị" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
      <Feedback loading={list.loading} error={list.error} onRetry={list.refresh} />
      {list.data && <>
        {!list.data.items.length && <p role="status">{requestType === "borrow" ? "Không có thiết bị sẵn sàng để mượn." : "Không có thiết bị đang sử dụng để yêu cầu trả."}</p>}
        <ul className="space-y-2">
          {list.data.items.map((row) => <li key={row._id} className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant p-3">
            <span>{row.name}<span className="block text-sm text-on-surface-variant">{row.code} · {row.location || "Chưa có vị trí"}</span></span>
            <button type="button" className={buttonClass} onClick={() => onSelect(row, requestType)}>{requestType === "borrow" ? "Chọn mượn" : "Chọn trả"}</button>
          </li>)}
        </ul>
        <TablePagination appearance="erp" currentPage={page} totalPages={Math.max(1, Math.ceil(list.data.total / 25))} totalItems={list.data.total} pageSize={25} pageSizeOptions={[25]} onPageChange={setPage} onPageSizeChange={() => {}} />
      </>}
    </div>
  </ErpModal>;
}
