import { Building2, Lock, Mail, RefreshCw, User, X } from "lucide-react";
import { CompanyEditFormState, CompanyFormState } from "./types";

interface Props {
  mode: "create" | "edit";
  open: boolean;
  form: CompanyFormState | CompanyEditFormState;
  submitting: boolean;
  onClose: () => void;
  onChange: (field: string, value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function CompanyModal({ mode, open, form, submitting, onClose, onChange, onSubmit }: Props) {
  if (!open) return null;

  const isEdit = mode === "edit";

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden transform transition-all scale-100">
        <div className="bg-slate-900 text-white p-6 flex justify-between items-center relative">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-500/20">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-sm uppercase tracking-wider font-sans">
                {isEdit ? "Chỉnh sửa doanh nghiệp" : "Đăng ký doanh nghiệp mới"}
              </h3>
              <p className="text-[10px] text-slate-350 font-mono mt-0.5">
                {isEdit ? "Chỉ superadmin được phép cập nhật thông tin doanh nghiệp" : "Khởi tạo môi trường SaaS Multi-tenant"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 text-left col-span-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Tên doanh nghiệp *</label>
              <input
                type="text"
                required
                placeholder="Ví dụ: Công ty TNHH ABC"
                value={(form as any).companyName ?? (form as any).name}
                onChange={(e) => onChange(isEdit ? "name" : "companyName", e.target.value)}
                className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
            <div className="space-y-1.5 text-left col-span-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Mã doanh nghiệp *</label>
              <input
                type="text"
                required
                placeholder="Ví dụ: ABC"
                value={(form as any).companyCode ?? (form as any).code}
                onChange={(e) => onChange(isEdit ? "code" : "companyCode", e.target.value)}
                className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono uppercase"
              />
            </div>
          </div>

          {isEdit ? (
            <div className="space-y-1.5 text-left">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Email chủ doanh nghiệp *</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="email"
                  required
                  placeholder="owner@company.com"
                  value={(form as CompanyEditFormState).ownerEmail}
                  onChange={(e) => onChange("ownerEmail", e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono"
                />
              </div>
            </div>
          ) : (
            <div className="border-t border-gray-100 my-4 pt-4 space-y-4">
              <div className="text-left">
                <span className="text-[10px] font-bold text-indigo-650 uppercase tracking-widest font-mono">Tài khoản chủ doanh nghiệp (Admin Owner)</span>
              </div>
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Tên chủ sở hữu *</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Nguyễn Văn A"
                    value={(form as CompanyFormState).ownerName}
                    onChange={(e) => onChange("ownerName", e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Địa chỉ email *</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="email"
                    required
                    placeholder="owner@company.com"
                    value={(form as CompanyFormState).ownerEmail}
                    onChange={(e) => onChange("ownerEmail", e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono"
                  />
                </div>
              </div>
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Mật khẩu *</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="password"
                    required
                    placeholder="Tối thiểu 6 ký tự"
                    value={(form as CompanyFormState).ownerPassword}
                    onChange={(e) => onChange("ownerPassword", e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50 transition-all cursor-pointer">
              Hủy bỏ
            </button>
            <button type="submit" disabled={submitting} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer">
              {submitting ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Đang xử lý...
                </>
              ) : isEdit ? "Lưu doanh nghiệp" : "Khởi tạo doanh nghiệp"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
