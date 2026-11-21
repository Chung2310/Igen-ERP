import { useRef, useState } from "react";
import type { Equipment, EquipmentRequest, Inspection, LogisticsList } from "../../../../shared/healthcare-logistics";
import { requestLabels } from "../../../../shared/healthcare-logistics";
import type { HealthcareApi } from "../api";
import { buttonClass, Feedback, Table, Cell, dayLabel, timeLabel, messageOf, useHealthcareQuery } from "../ui";
import { ConfirmDialog } from "../../../components/common/ConfirmDialog";
import { TablePagination } from "../../../components/common/TablePagination";
export function EquipmentDelete({
  api,
  row,
  inspection,
  onSaved,
}: {
  api: HealthcareApi;
  row: Equipment | Inspection;
  inspection?: boolean;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  function close() {
    if (!busy) {
      setOpen(false);
      requestAnimationFrame(() => trigger.current?.focus());
    }
  }
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={buttonClass}
        onClick={() => {
          setError("");
          setOpen(true);
        }}
      >
        {inspection ? "Xóa lần kiểm định" : "Xóa thiết bị"}
      </button>
      <ConfirmDialog
        native
        appearance="erp"
        isOpen={open}
        title={inspection ? "Xóa lịch sử kiểm định này?" : "Xóa thiết bị khỏi danh sách?"}
        description={
          inspection
            ? "Lịch kiểm định tiếp theo sẽ được tính lại từ các bản ghi còn lại."
            : "Lịch sử mượn/trả và kiểm định vẫn được lưu."
        }
        onClose={close}
        isSubmitting={busy}
        error={error}
        onConfirm={async () => {
          setBusy(true);
          try {
            await api.json(`/logistics/${inspection ? "inspections" : "equipment"}/${row._id}`, {
              method: "DELETE",
              body: JSON.stringify({ revision: row.revision }),
            });
            setOpen(false);
            onSaved();
          } catch (e) {
            setError(messageOf(e));
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}
export function BorrowHistory({ api, equipmentId }: { api: HealthcareApi; equipmentId: string }) {
  const [page, setPage] = useState(1);
  const list = useHealthcareQuery<LogisticsList<EquipmentRequest>>(
    api,
    `/logistics/requests?equipmentId=${equipmentId}&page=${page}`,
  );
  return (
    <div className="space-y-2">
      <h3 className="text-balance font-semibold">Lịch sử mượn / trả</h3>
      <Feedback loading={list.loading} error={list.error} onRetry={list.refresh} />
      {list.data && (
        <>
          <Table
            headers={["Ngày", "Yêu cầu", "Lý do", "Hạn trả", "Kết quả"]}
            empty={!list.data.items.length ? "Chưa phát sinh mượn/trả." : undefined}
          >
            {list.data.items.map((x) => (
              <tr key={x._id}>
                <Cell>{timeLabel(x.createdAt)}</Cell>
                <Cell>{x.type === "borrow" ? "Mượn" : "Trả"}</Cell>
                <Cell>{x.reason}</Cell>
                <Cell>{dayLabel(x.expectedReturnDay)}</Cell>
                <Cell>
                  {requestLabels[x.status]}
                  {x.decisionReason && ` · ${x.decisionReason}`}
                </Cell>
              </tr>
            ))}
          </Table>
          <TablePagination
            appearance="erp"
            currentPage={page}
            totalPages={Math.max(1, Math.ceil(list.data.total / 25))}
            totalItems={list.data.total}
            pageSize={25}
            pageSizeOptions={[25]}
            onPageChange={setPage}
            onPageSizeChange={() => {}}
          />
        </>
      )}
    </div>
  );
}
