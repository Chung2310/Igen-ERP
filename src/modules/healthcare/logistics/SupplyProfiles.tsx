import { useRef, useState } from "react";
import { Settings2 } from "lucide-react";
import type { Supply, LogisticsList } from "../../../../shared/healthcare-logistics";
import type { HealthcareApi } from "../api";
import { Field, Table, Cell, Feedback, buttonClass, useHealthcareQuery } from "../ui";
import { ErpRefreshButton } from "../../../components/common/ErpRefreshButton";
import { TableFilterToolbar } from "../../../components/common/TableFilterToolbar";
import { TablePagination } from "../../../components/common/TablePagination";
import { HrStatusBadge } from "../../../components/hr/HrStatusBadge";
import { LogisticsForm } from "./LogisticsForm";

const surfacePanelClass =
  "min-w-0 space-y-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-3 sm:p-4";

const rowActionClass =
  "inline-flex min-h-8 shrink-0 items-center justify-center gap-1 rounded-md border border-outline-variant bg-surface-container-lowest px-2.5 py-1 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";

export default function SupplyProfiles({ api, canManage }: { api: HealthcareApi; canManage: boolean }) {
  const focus = useRef<HTMLElement | null>(null);
  function close() {
    setRecord(undefined);
    requestAnimationFrame(() => focus.current?.focus());
  }
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [record, setRecord] = useState<Supply>();
  const list = useHealthcareQuery<LogisticsList<Supply>>(
    api,
    `/logistics/supplies?q=${encodeURIComponent(q)}&page=${page}`,
  );
  return (
    <div className={surfacePanelClass}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 data-typography="section-title" className="text-balance text-base font-semibold text-on-surface">
          Đơn vị quy đổi
        </h3>
        <ErpRefreshButton loading={list.refreshing} onClick={list.refresh} />
      </div>
      <TableFilterToolbar
        appearance="plain"
        search={{
          value: q,
          onChange: (value) => {
            setQ(value);
            setPage(1);
          },
          placeholder: "Tìm mã hoặc tên vật tư",
          ariaLabel: "Tìm vật tư",
          className: "min-w-0",
        }}
        totalCount={list.data ? list.data.total : undefined}
        countLabel="vật tư"
        hasActiveFilters={Boolean(q.trim())}
        onResetFilters={() => {
          setQ("");
          setPage(1);
        }}
      />
      <Feedback loading={list.loading} error={list.error} onRetry={list.refresh} />
      {list.data && (
        <>
          <Table
            headers={["Vật tư", "Đơn vị cơ sở", "Theo dõi", "Quy đổi", "Thao tác"]}
            empty={!list.data.items.length ? "Chưa có vật tư để cấu hình quy đổi." : undefined}
          >
            {list.data.items.map((row) => (
              <tr key={row._id}>
                <Cell>
                  <span className="block font-medium text-on-surface">{row.name}</span>
                  <span className="mt-0.5 inline-block rounded bg-surface-container px-1.5 py-0.5 text-xs text-on-surface-variant">
                    {row.code}
                  </span>
                </Cell>
                <Cell className="whitespace-nowrap">{row.unit}</Cell>
                <Cell className="whitespace-nowrap">
                  <HrStatusBadge tone={row.trackingMode === "none" ? "neutral" : "info"} className="normal-case">
                    {row.trackingMode === "none" ? "Không theo lô" : "Theo lô"}
                  </HrStatusBadge>
                </Cell>
                <Cell>
                  {row.conversions?.length ? (
                    row.conversions.map((c) => `1 ${c.unit} = ${c.factor} ${row.unit}`).join("; ")
                  ) : (
                    <span className="text-xs text-on-surface-variant">Chưa khai báo</span>
                  )}
                </Cell>
                <Cell align="right">
                  {canManage && (
                    <button
                      type="button"
                      className={rowActionClass}
                      onClick={() => {
                        focus.current = document.activeElement as HTMLElement;
                        setRecord(row);
                      }}
                    >
                      <Settings2 className="size-3.5 text-on-surface-variant" aria-hidden="true" />
                      Cấu hình
                    </button>
                  )}
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
      {record && (
        <ProfileEditor
          key={record._id}
          api={api}
          record={record}
          onClose={close}
          onSaved={() => {
            close();
            list.refresh();
          }}
        />
      )}
    </div>
  );
}

function ProfileEditor({
  api,
  record,
  onClose,
  onSaved,
}: {
  api: HealthcareApi;
  record: Supply;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rows, setRows] = useState(record.conversions || []);
  return (
    <LogisticsForm
      title={`Quy đổi · ${record.name}`}
      api={api}
      path={`/logistics/profiles/${record._id}`}
      method="PUT"
      onClose={onClose}
      onSaved={onSaved}
      payload={(data) => ({
        revision: record.revision,
        precision: Number(data.get("precision")),
        trackingMode: data.get("trackingMode"),
        requiresExpiry: data.get("requiresExpiry") === "true",
        conversions: rows,
      })}
    >
      {(error) => (
        <>
          <p className="text-sm text-on-surface-variant">
            Đơn vị cơ sở: <strong className="text-on-surface">{record.unit}</strong>. Cấu hình không được đổi khi vật tư đã có chứng từ.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              name="precision"
              label="Số chữ số thập phân"
              type="number"
              min={0}
              max={6}
              value={String(record.precision ?? 3)}
              error={error}
            />
            <Field
              name="trackingMode"
              label="Cách theo dõi"
              value={record.trackingMode || "lot"}
              options={[
                { value: "lot", label: "Theo lô" },
                { value: "none", label: "Không theo lô" },
              ]}
            />
            <Field
              name="requiresExpiry"
              label="Hạn dùng"
              value={String(record.requiresExpiry)}
              options={[
                { value: "true", label: "Bắt buộc" },
                { value: "false", label: "Không bắt buộc" },
              ]}
            />
          </div>
          {rows.map((row, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-3">
              <Field
                name={`unit-${index}`}
                label={`Đơn vị quy đổi ${index + 1}`}
                value={row.unit}
                required
                onChange={(e) => setRows((v) => v.map((r, i) => (i === index ? { ...r, unit: e.target.value } : r)))}
              />
              <Field
                name={`factor-${index}`}
                label={`Số ${record.unit} trong 1 đơn vị`}
                value={row.factor}
                required
                inputMode="decimal"
                onChange={(e) => setRows((v) => v.map((r, i) => (i === index ? { ...r, factor: e.target.value } : r)))}
              />
              <button
                type="button"
                className={buttonClass}
                onClick={() => setRows((v) => v.filter((_, i) => i !== index))}
              >
                Bỏ đơn vị {index + 1}
              </button>
            </div>
          ))}
          <button
            type="button"
            className={buttonClass}
            disabled={rows.length >= 20}
            onClick={() => setRows((v) => [...v, { unit: "", factor: "1" }])}
          >
            Thêm đơn vị quy đổi
          </button>
        </>
      )}
    </LogisticsForm>
  );
}
