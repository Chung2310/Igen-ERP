import React from "react";
import { CheckCircle2, Loader2, Save, CreditCard, Undo2 } from "lucide-react";
import { companyPaymentApi } from "../../services/companyPaymentService";
import { toast } from "../../pages/Toast";
import { SearchableSelect } from "../inventory/SearchableSelect";

const empty = { bankId: "", accountNo: "", accountName: "" };

export default function CompanyPaymentSettingsTab() {
  const [form, setForm] = React.useState<any>(empty);
  const [originalForm, setOriginalForm] = React.useState<any>(empty);
  const [busy, setBusy] = React.useState("");
  const [banks, setBanks] = React.useState<any[]>([]);

  React.useEffect(() => {
    companyPaymentApi.getVietqr()
      .then((data) => {
        if (data) {
          setForm(data);
          setOriginalForm(data);
        }
      })
      .catch((e) => toast.error(e.message));

    fetch("https://api.vietqr.io/v2/banks")
      .then(res => res.json())
      .then(res => {
        if (res.code === "00" && Array.isArray(res.data)) {
          setBanks(res.data);
        }
      })
      .catch(console.error);
  }, []);

  const update = (key: string, value: any) =>
    setForm((current: any) => ({ ...current, [key]: value }));

  const act = async (name: string, fn: () => Promise<any>, message: string) => {
    setBusy(name);
    try {
      await fn();
      toast.success(message);
      if (name === "save") {
        setOriginalForm(form);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy("");
    }
  };

  const handleReset = () => {
    setForm(originalForm);
    toast.success("Đã khôi phục lại thông tin ban đầu.");
  };

  return (
    <section className="space-y-5 bg-white border border-slate-200 p-5 rounded-xl">
      <div>
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-indigo-600" />
          Thanh toán SePay doanh nghiệp
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Tài khoản ngân hàng dùng chung để nhận thanh toán tự động qua SePay.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1 text-xs font-semibold text-slate-600">
          <span>Ngân hàng</span>
          <SearchableSelect
            value={form.bankId}
            onChange={(val) => update("bankId", val)}
            options={banks.map((b) => ({ value: b.bin, label: `${b.shortName} - ${b.name}` }))}
            placeholder="-- Chọn ngân hàng --"
            searchPlaceholder="Tìm kiếm ngân hàng..."
          />
        </div>
        <Field
          label="Số tài khoản"
          value={form.accountNo}
          placeholder="Nhập số tài khoản ngân hàng"
          onChange={(v: string) => update("accountNo", v)}
        />
        <Field
          label="Tên chủ tài khoản"
          value={form.accountName}
          placeholder="VI DU TEN TAI KHOAN"
          onChange={(v: string) => update("accountName", v)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Action
          icon={Save}
          busy={busy === "save"}
          label="Lưu cấu hình"
          onClick={() =>
            act("save", () => companyPaymentApi.saveVietqr(form), "Đã lưu tài khoản SePay doanh nghiệp.")
          }
        />
        <Action
          icon={Undo2}
          label="Khôi phục"
          secondary
          onClick={handleReset}
        />
      </div>
    </section>
  );
}

function Field({ label, value, placeholder, onChange, type = "text" }: any) {
  return (
    <label className="space-y-1 text-xs font-semibold text-slate-600">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm h-[42px] outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </label>
  );
}

function Action({ icon: Icon, busy, label, onClick, secondary }: any) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold ${
        secondary
          ? "border border-slate-200 text-slate-700 hover:bg-slate-50"
          : "bg-indigo-600 text-white hover:bg-indigo-700"
      } transition-colors`}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      {label}
    </button>
  );
}
