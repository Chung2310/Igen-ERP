import type { Balance, Supply } from "../../../../shared/healthcare-logistics";
import { HrStatusBadge } from "../../../components/hr/HrStatusBadge";
import { healthcareApi } from "../api";
import { Cell, Table, Feedback, dayLabel, useHealthcareQuery } from "../ui";

const qualityMeta = {
  available: { label: "Sẵn dùng", tone: "success" },
  quarantine: { label: "Cách ly", tone: "warning" },
  damaged: { label: "Hỏng", tone: "danger" },
} as const;

export default function StockRows({
  rows,
  api,
  warehouseName,
  ledger,
}: {
  rows: Balance[];
  api: ReturnType<typeof healthcareApi>;
  warehouseName: (id: string) => string;
  ledger: boolean;
}) {
  return (
    <Table
      headers={["Vật tư", "Kho / Lô", "Hạn dùng", "Chất lượng", ledger ? "Số lượng" : "Tồn", "Giá trị"]}
      empty={!rows.length ? "Chưa có dữ liệu kho." : undefined}
    >
      {rows.map((row) => (
        <StockRow key={row._id} row={row} api={api} warehouseName={warehouseName} ledger={ledger} />
      ))}
    </Table>
  );
}
function StockRow({
  row,
  api,
  warehouseName,
  ledger,
}: {
  row: Balance & { unit?: string };
  api: ReturnType<typeof healthcareApi>;
  warehouseName: (id: string) => string;
  ledger: boolean;
}) {
  const supply = useHealthcareQuery<Supply>(api, `/logistics/supplies/${row.supplyId}`);
  const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  const quality = qualityMeta[row.quality] || { label: row.quality, tone: "neutral" as const };
  const isExpired = Boolean(row.expiryDay && row.expiryDay < today);
  return (
    <tr>
      <Cell>
        <span className="font-medium text-on-surface">{supply.data?.name || "Đang tải vật tư…"}</span>
        <Feedback error={supply.error} onRetry={supply.refresh} />
        {!ledger && supply.data && row.quantity < supply.data.minQuantity && (
          <div className="mt-1">
            <HrStatusBadge dot tone="danger">
              Dưới ngưỡng tồn
            </HrStatusBadge>
          </div>
        )}
      </Cell>
      <Cell>
        <span className="block text-on-surface">{warehouseName(row.warehouseId)}</span>
        <span className="mt-0.5 block text-xs text-on-surface-variant">
          Lô: {row.lot || "Không có lô"}
        </span>
      </Cell>
      <Cell className="whitespace-nowrap">
        <span>{dayLabel(row.expiryDay)}</span>
        {isExpired && (
          <div className="mt-1">
            <HrStatusBadge dot tone="danger">
              Hết hạn
            </HrStatusBadge>
          </div>
        )}
      </Cell>
      <Cell className="whitespace-nowrap">
        <HrStatusBadge dot tone={quality.tone}>
          {quality.label}
        </HrStatusBadge>
      </Cell>
      <Cell align="right" className="whitespace-nowrap tabular-nums">
        <span className="font-medium text-on-surface">{row.quantity.toLocaleString("vi-VN")}</span>{" "}
        <span className="text-xs text-on-surface-variant">{row.unit || supply.data?.unit}</span>
      </Cell>
      <Cell align="right" className="whitespace-nowrap font-medium tabular-nums">
        {row.value.toLocaleString("vi-VN")} đ
      </Cell>
    </tr>
  );
}
