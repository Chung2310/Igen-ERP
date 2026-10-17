import { useEffect, useState } from "react";
import { Plus, WalletCards } from "lucide-react";
import { StyledSelect } from "../../common/StyledSelect";
import { payrollService } from "../../../services/payrollService";
import { toast } from "../../../pages/Toast";

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
    <div className="rounded-2xl bg-white p-3 shadow-[0_2px_16px_rgba(33,84,123,0.07)]">
      <div className="flex items-start gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#D8F5E7] text-[#009965]" aria-hidden="true">
          <WalletCards size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-[#08734E]">Khoản bổ sung</h3>
            <button
              onClick={() => setOpen(!open)}
              className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#DDF6EA] px-3 text-xs font-medium text-[#008C67] transition-colors hover:bg-[#C9F0DE]"
            >
              <Plus size={14} /> Thêm khoản
            </button>
          </div>
          {open && (
            <div className="mb-2 grid gap-2 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_140px_minmax(0,1fr)_auto]">
              <input aria-label="Mã khoản" className="h-9 min-w-0 w-full rounded-xl border border-[#DCE7F4] bg-white px-3 text-sm text-slate-700 outline-none transition-colors focus:border-[#8BDCF9] focus:ring-2 focus:ring-[#00ADFC]/15" placeholder="Mã khoản" value={form.code} onChange={event => setForm({ ...form, code: event.target.value })} />
              <input aria-label="Tên khoản" className="h-9 min-w-0 w-full rounded-xl border border-[#DCE7F4] bg-white px-3 text-sm text-slate-700 outline-none transition-colors focus:border-[#8BDCF9] focus:ring-2 focus:ring-[#00ADFC]/15" placeholder="Tên khoản" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} />
              <StyledSelect className="!h-9" value={form.unit} onChange={value => setForm({ ...form, unit: value })} ariaLabel="Đơn vị khoản" options={[{ value: "money", label: "Tiền" }, { value: "number", label: "Số" }, { value: "days", label: "Ngày" }, { value: "hours", label: "Giờ" }, { value: "minutes", label: "Phút" }, { value: "percent", label: "%" }]} />
              <input className="no-number-spinner h-9 min-w-0 w-full rounded-xl border border-[#DCE7F4] bg-white px-3 text-sm text-slate-700 outline-none transition-colors focus:border-[#8BDCF9] focus:ring-2 focus:ring-[#00ADFC]/15" type="number" inputMode="decimal" placeholder="Mặc định" value={form.defaultValue} onChange={event => setForm({ ...form, defaultValue: event.target.value })} />
              <button onClick={() => void create()} className="h-9 rounded-xl bg-[#00A4E8] px-5 text-sm font-medium text-white transition-colors hover:bg-[#008FCB]">Lưu</button>
            </div>
          )}
          <div className="space-y-2">
            {items.map(item => (
              <div key={item._id} className={`rounded-xl bg-[#E8F8F0] px-3 py-1.5 text-xs ${item.status === "active" ? "text-[#08734E]" : "text-slate-500"}`}>
                <span className="font-medium">{item.name}</span>
                <div className="mt-0.5">
                  <button
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
                    className="text-[#008C67]"
                  >
                    {item.status === "active" ? "Tắt" : "Bật"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
