import type { Balance, LogisticsList, StockLine, Supply } from "../../../../shared/healthcare-logistics";
import type { HealthcareApi } from "../api";
import { Field, Feedback, useHealthcareQuery, dayLabel } from "../ui";
export function LineOptions({
  api,
  line,
  index,
  warehouse,
  issue,
  onChange,
}: {
  api: HealthcareApi;
  line: StockLine;
  index: number;
  warehouse: string;
  issue: boolean;
  onChange: (value: Partial<StockLine>) => void;
}) {
  const supply = useHealthcareQuery<Supply>(api, line.supplyId ? `/logistics/supplies/${line.supplyId}` : null);
  const lots = useHealthcareQuery<LogisticsList<Balance>>(
    api,
    issue && warehouse && line.supplyId
      ? `/logistics/balances?supplyId=${line.supplyId}&warehouseId=${encodeURIComponent(warehouse)}&pageSize=100`
      : null,
  );
  const available = (lots.data?.items || []).filter((x) => x.quantity > 0 && x.quality === "available");
  return (
    <>
      <Feedback loading={supply.loading} error={supply.error} onRetry={supply.refresh} />
      {supply.data && (
        <Field
          name={`line-${index}-unit`}
          label="Đơn vị giao dịch"
          value={line.unit || supply.data.unit}
          options={[
            { value: supply.data.unit, label: `${supply.data.unit} (cơ sở)` },
            ...(supply.data.conversions || []).map((x) => ({
              value: x.unit,
              label: `${x.unit} = ${x.factor} ${supply.data!.unit}`,
            })),
          ]}
          onSelectChange={(unit) => onChange({ unit })}
        />
      )}
      {issue && (
        <>
          <Feedback loading={lots.loading} error={lots.error} onRetry={lots.refresh} />
          <Field
            name={`line-${index}-balance`}
            label="Chọn lô tồn trong kho"
            value={
              available.find((x) => x.lot === line.lot && x.expiryDay === line.expiryDay && x.quality === line.quality)
                ?._id || ""
            }
            options={[
              { value: "", label: "Chọn lô hoặc nhập số lô bên dưới" },
              ...available.map((x) => ({
                value: x._id,
                label: `${x.lot || "Không có số lô"} · ${dayLabel(x.expiryDay)} · tồn ${x.quantity} ${supply.data?.unit || ""}`,
              })),
            ]}
            onSelectChange={(id) => {
              const row = available.find((x) => x._id === id);
              if (row) onChange({ lot: row.lot, expiryDay: row.expiryDay, quality: row.quality });
            }}
          />
          <p className="text-pretty text-xs text-on-surface-variant">
            Hiển thị tối đa 100 lô. Có thể nhập chính xác số lô và hạn dùng để chọn lô khác.
          </p>
        </>
      )}
    </>
  );
}
