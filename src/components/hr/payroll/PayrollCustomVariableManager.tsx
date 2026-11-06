import { useEffect, useState } from "react";
import { Plus, WalletCards } from "lucide-react";
import { StyledSelect } from "../../common/StyledSelect";
import { payrollService } from "../../../services/payrollService";
import { toast } from "../../../pages/Toast";
import { primaryCreateButtonClass } from "../../common/primaryCreateButton";

export function PayrollCustomVariableManager() {
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", unit: "number", defaultValue: "" });

  const load = async () => {
    try { setItems(await payrollService.getPeriodInputVariables()); } catch {}
  };

  useEffect(() => { void load(); }, []);

  const create = async () => {
    try {
      await payrollService.createPeriodInputVariable({
        ...form,
        ...(form.defaultValue === "" ? {} : { defaultValue: Number(form.defaultValue) }),
      });
      setOpen(false);
      setForm({ code: "", name: "", unit: "number", defaultValue: "" });
      await load();
      toast.success("Đã thêm khoản");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể thêm khoản");
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant px-4 py-3">
            <h3 className="flex items-center gap-2 text-base font-medium text-on-surface text-balance"><WalletCards className="size-4 text-primary" aria-hidden="true" />Khoản bổ sung</h3>
            <button
              type="button"
              aria-expanded={open}
              aria-controls="payroll-add-variable-form"
              onClick={() => setOpen(!open)}
              className={primaryCreateButtonClass}
            >
              <Plus className="size-4" aria-hidden="true" /> Thêm khoản
            </button>
      </div>
      <div className="p-4">
          {open && (
            <div id="payroll-add-variable-form" className="mb-2 grid gap-2 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_140px_minmax(0,1fr)_auto]">
              <input aria-label="Mã khoản" className="h-9 min-w-0 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface outline-none focus:border-primary" placeholder="Mã khoản" value={form.code} onChange={event => setForm({ ...form, code: event.target.value })} />
              <input aria-label="Tên khoản" className="h-9 min-w-0 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface outline-none focus:border-primary" placeholder="Tên khoản" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} />
              <StyledSelect className="!h-9" value={form.unit} onChange={value => setForm({ ...form, unit: value })} ariaLabel="Đơn vị khoản" options={[{ value: "money", label: "Tiền" }, { value: "number", label: "Số" }, { value: "days", label: "Ngày" }, { value: "hours", label: "Giờ" }, { value: "minutes", label: "Phút" }, { value: "percent", label: "%" }]} />
              <input aria-label="Giá trị mặc định" className="no-number-spinner h-9 min-w-0 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface outline-none focus:border-primary" type="number" inputMode="decimal" placeholder="Mặc định" value={form.defaultValue} onChange={event => setForm({ ...form, defaultValue: event.target.value })} />
              <button type="button" onClick={() => void create()} className="h-9 rounded-lg bg-primary px-5 text-sm font-medium text-on-primary hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary">Lưu</button>
            </div>
          )}
          <div className="divide-y divide-outline-variant">
            {items.map(item => (
              <div key={item._id} className="flex items-center justify-between gap-3 py-2 text-sm text-on-surface">
                <span className="font-medium">{item.name}</span>
                <div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        item.status === "active"
                          ? await payrollService.retirePeriodInputVariable(item._id)
                          : await payrollService.activatePeriodInputVariable(item._id);
                        await load();
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Không thể cập nhật");
                      }
                    }}
                    className="text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    {item.status === "active" ? "Tắt" : "Bật"}
                  </button>
                </div>
              </div>
            ))}
          </div>
      </div>
    </div>
  );
}
