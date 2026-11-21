import { ArrowDownLeft, ArrowUpRight, FileText, Pencil } from "lucide-react";
import type {
  Equipment,
  LogisticsReferences,
} from "../../../../shared/healthcare-logistics";
import { equipmentLabels } from "../../../../shared/healthcare-logistics";
import { HrStatusBadge } from "../../../components/hr/HrStatusBadge";
import { cn } from "../../student-management/lib/utils";
import { Cell, dayLabel, Table } from "../ui";

type Action = "compliance" | "equipment" | "borrow" | "return";

const mobileActionClass =
  "inline-flex min-h-8 shrink-0 items-center justify-center gap-1 rounded-md border border-outline-variant bg-surface-container-lowest px-2.5 py-1 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";

const iconActionClass =
  "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-outline-variant bg-surface-container-lowest text-on-surface-variant transition-colors hover:border-primary/40 hover:bg-surface-container hover:text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";

const primaryIconActionClass =
  "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-primary/35 bg-primary/5 text-primary transition-colors hover:bg-primary/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";

const equipmentStatusTone = {
  available: "success",
  "in-use": "info",
  requested: "warning",
  maintenance: "warning",
  broken: "danger",
  retired: "neutral",
} as const;

const riskTone = {
  A: "neutral",
  B: "info",
  C: "warning",
  D: "danger",
} as const;

const equipmentColumnWidths = [
  "21%",
  "8.5%",
  "14%",
  "10.5%",
  "12.5%",
  "8%",
  "6.5%",
  "7%",
  "12%",
];

export default function EquipmentTable({
  rows,
  refs,
  canManage,
  onOpen,
}: {
  rows: Equipment[];
  refs: LogisticsReferences;
  canManage: boolean;
  onOpen: (kind: Action, row: Equipment) => void;
}) {
  const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 30 * 86400000 + 7 * 3600000)
    .toISOString()
    .slice(0, 10);
  return (
    <>
      <div className="space-y-3 md:hidden">
        {!rows.length && (
          <p className="rounded-lg border border-outline-variant p-4 text-sm text-on-surface-variant">
            Chưa có thiết bị phù hợp. Chọn Thêm thiết bị để bắt đầu.
          </p>
        )}
        {rows.map((row) => (
          <article
            key={row._id}
            className="space-y-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-4"
          >
            <div className="flex items-start gap-3">
              {row.imageUrl && (
                <img
                  src={row.imageUrl}
                  alt={`Ảnh ${row.name}`}
                  className="size-12 shrink-0 rounded-lg border border-outline-variant object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-balance text-sm font-semibold text-on-surface">
                  {row.name}
                </h3>
                <p className="text-xs text-on-surface-variant">
                  {row.code} · {row.category || "Chưa phân loại"}
                </p>
              </div>
              <HrStatusBadge
                dot
                tone={
                  equipmentStatusTone[row.status as keyof typeof equipmentStatusTone] ||
                  "neutral"
                }
              >
                {equipmentLabels[row.status]}
              </HrStatusBadge>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-on-surface-variant">Model / Seri</dt>
                <dd className="font-medium text-on-surface">
                  {[row.modelNumber, row.serialNumber].filter(Boolean).join(" · ") || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-on-surface-variant">Phòng ban / Vị trí</dt>
                <dd className="font-medium text-on-surface">
                  {refs.departments.find((x) => x._id === row.departmentId)?.name ||
                    refs.rooms.find((x) => x._id === row.roomId)?.name ||
                    row.location ||
                    "—"}
                </dd>
              </div>
              <div>
                <dt className="text-on-surface-variant">Kiểm định tiếp theo</dt>
                <dd className="font-medium text-on-surface">{dayLabel(row.nextInspectionDay)}</dd>
              </div>
              <div>
                <dt className="text-on-surface-variant">Hồ sơ</dt>
                <dd className="font-medium text-on-surface">
                  {row.documents?.length || 0} tài liệu
                </dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-2 border-t border-outline-variant pt-3">
              <button
                type="button"
                className={mobileActionClass}
                onClick={() => onOpen("compliance", row)}
              >
                Hồ sơ
              </button>
              {canManage && !["in-use", "requested"].includes(row.status) && (
                <button
                  type="button"
                  className={mobileActionClass}
                  onClick={() => onOpen("equipment", row)}
                >
                  Sửa
                </button>
              )}
              {row.status === "available" && (
                <button
                  type="button"
                  className={mobileActionClass}
                  onClick={() => onOpen("borrow", row)}
                >
                  Yêu cầu mượn
                </button>
              )}
              {row.status === "in-use" && (
                <button
                  type="button"
                  className={mobileActionClass}
                  onClick={() => onOpen("return", row)}
                >
                  Yêu cầu trả
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      <div className="hidden md:block">
        <Table
          minWidth="1080px"
          columnWidths={equipmentColumnWidths}
          headers={[
            "Mã & Tên thiết bị",
            "Phân loại Y tế",
            "Model & Seri",
            "Trạng thái",
            "Kiểm định & Biên bản",
            "Hồ sơ & Giấy tờ",
            "Phòng ban",
            "Vị trí",
            "Thao tác",
          ]}
          empty={
            !rows.length
              ? "Chưa có thiết bị phù hợp. Chọn Thêm thiết bị để bắt đầu."
              : undefined
          }
        >
          {rows.map((row) => {
            const isOverdue = Boolean(row.nextInspectionDay && row.nextInspectionDay < today);
            const isSoon = Boolean(
              !isOverdue && row.nextInspectionDay && row.nextInspectionDay <= soon,
            );
            const inspectionTone = isOverdue
              ? "danger"
              : isSoon
                ? "warning"
                : row.nextInspectionDay
                  ? "success"
                  : "neutral";
            const inspectionText = isOverdue
              ? "Quá hạn"
              : isSoon
                ? "Sắp đến hạn"
                : row.nextInspectionDay
                  ? "Còn hạn"
                  : "Chưa lên lịch";
            const statusTone =
              equipmentStatusTone[row.status as keyof typeof equipmentStatusTone] || "neutral";
            const riskKey = row.riskClassification as keyof typeof riskTone | undefined;
            const modelLine = [row.manufacturer, row.modelNumber].filter(Boolean).join(" · ");
            const departmentName =
              refs.departments.find((x) => x._id === row.departmentId)?.name || "—";
            const locationName =
              refs.rooms.find((x) => x._id === row.roomId)?.name || row.location || "—";

            return (
              <tr key={row._id}>
                <Cell className="min-w-0 align-middle">
                  <div className="flex min-w-0 items-center gap-2.5">
                    {row.imageUrl && (
                      <a
                        href={row.imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0"
                      >
                        <img
                          src={row.imageUrl}
                          alt={`Ảnh ${row.name}`}
                          className="size-9 rounded-md border border-outline-variant object-cover"
                        />
                      </a>
                    )}
                    <div className="min-w-0 flex-1">
                      <span
                        className="block truncate font-medium text-on-surface"
                        title={row.name}
                      >
                        {row.name}
                      </span>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-on-surface-variant">
                        <span className="shrink-0 rounded bg-surface-container px-1.5 py-0.5 text-[11px] font-medium">
                          {row.code}
                        </span>
                        {row.category && (
                          <span className="truncate" title={row.category}>
                            {row.category}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Cell>
                <Cell className="min-w-0 whitespace-nowrap align-middle">
                  {riskKey && riskTone[riskKey] ? (
                    <HrStatusBadge tone={riskTone[riskKey]} className="normal-case">
                      Nhóm {row.riskClassification}
                    </HrStatusBadge>
                  ) : (
                    <span className="text-xs text-on-surface-variant">—</span>
                  )}
                </Cell>
                <Cell className="min-w-0 align-middle">
                  <span className="block truncate text-on-surface" title={modelLine || undefined}>
                    {modelLine || "—"}
                  </span>
                  {row.serialNumber && (
                    <span
                      className="mt-0.5 block truncate text-xs text-on-surface-variant"
                      title={`SN: ${row.serialNumber}`}
                    >
                      SN: {row.serialNumber}
                    </span>
                  )}
                </Cell>
                <Cell align="center" className="min-w-0 whitespace-nowrap align-middle">
                  <HrStatusBadge dot tone={statusTone}>
                    {equipmentLabels[row.status]}
                  </HrStatusBadge>
                  {row.status === "in-use" && row.currentBorrowerId && (
                    <span className="mt-1 block text-xs text-on-surface-variant">
                      Đang được mượn
                    </span>
                  )}
                </Cell>
                <Cell className="min-w-0 whitespace-nowrap align-middle">
                  <div className="space-y-1">
                    <HrStatusBadge dot tone={inspectionTone}>
                      {inspectionText}
                    </HrStatusBadge>
                    {row.nextInspectionDay && (
                      <span className="block text-xs tabular-nums text-on-surface-variant">
                        {dayLabel(row.nextInspectionDay)}
                      </span>
                    )}
                    {row.lastInspectionReportUrl && (
                      <a
                        href={row.lastInspectionReportUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block text-xs font-medium text-primary underline underline-offset-2"
                      >
                        Xem biên bản
                      </a>
                    )}
                  </div>
                </Cell>
                <Cell className="min-w-0 align-middle">
                  <span className="block whitespace-nowrap text-xs font-medium tabular-nums text-on-surface">
                    {row.documents?.length || 0} tài liệu
                  </span>
                  {row.documents?.slice(0, 1).map((doc, i) => (
                    <a
                      key={i}
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 block truncate text-xs text-primary underline underline-offset-2"
                      title={doc.name}
                    >
                      {doc.name}
                    </a>
                  ))}
                </Cell>
                <Cell className="min-w-0 align-middle">
                  <span className="block truncate text-sm" title={departmentName}>
                    {departmentName}
                  </span>
                </Cell>
                <Cell className="min-w-0 align-middle">
                  <span className="block truncate text-sm" title={locationName}>
                    {locationName}
                  </span>
                </Cell>
                <Cell align="right" className="min-w-0 whitespace-nowrap px-2.5 align-middle">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      aria-label="Hồ sơ"
                      title="Hồ sơ & kiểm định"
                      className={iconActionClass}
                      onClick={() => onOpen("compliance", row)}
                    >
                      <FileText className="size-4" aria-hidden="true" />
                    </button>
                    {canManage && !["in-use", "requested"].includes(row.status) && (
                      <button
                        type="button"
                        aria-label="Sửa"
                        title="Sửa thiết bị"
                        className={iconActionClass}
                        onClick={() => onOpen("equipment", row)}
                      >
                        <Pencil className="size-4" aria-hidden="true" />
                      </button>
                    )}
                    {row.status === "available" && (
                      <button
                        type="button"
                        aria-label="Yêu cầu mượn"
                        title="Yêu cầu mượn thiết bị"
                        className={cn(primaryIconActionClass)}
                        onClick={() => onOpen("borrow", row)}
                      >
                        <ArrowUpRight className="size-4" aria-hidden="true" />
                      </button>
                    )}
                    {row.status === "in-use" && (
                      <button
                        type="button"
                        aria-label="Yêu cầu trả"
                        title="Yêu cầu trả thiết bị"
                        className={cn(primaryIconActionClass)}
                        onClick={() => onOpen("return", row)}
                      >
                        <ArrowDownLeft className="size-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </Cell>
              </tr>
            );
          })}
        </Table>
      </div>
    </>
  );
}
