import React, { useState } from "react";
import { Sliders, Save, Info } from "lucide-react";
import { toast } from "../../../../pages/Toast";
import { useAuth } from "../../../../context/AuthContext";

type FieldConfig = { visible: boolean; required: boolean };
type FieldsConfig = Record<string, FieldConfig>;

export function SettingsPage() {
  const { userProfile } = useAuth();

  const getOwnerId = () => {
    return (userProfile as any)?.centerId || userProfile?.companyCode || userProfile?.uid || 'default';
  };
  const configKey = `studentFormConfig_${getOwnerId()}`;

  const defaultFieldsConfig: FieldsConfig = {
    email:           { visible: true,  required: false },
    birthday:        { visible: true,  required: false },
    idCard:          { visible: true,  required: false },
    address:         { visible: true,  required: false },
    referral:        { visible: true,  required: false },
    idCardFrontFile: { visible: false, required: false },
    idCardBackFile:  { visible: false, required: false },
    portraitFile:    { visible: false, required: false },
  };

  const [fieldsConfig, setFieldsConfig] = useState<FieldsConfig>(() => {
    const saved = localStorage.getItem(configKey);
    if (saved) {
      try {
        return { ...defaultFieldsConfig, ...JSON.parse(saved) };
      } catch (e) {
        console.error(e);
      }
    }
    return defaultFieldsConfig;
  });

  const [hasChanges, setHasChanges] = useState(false);

  const handleToggleVisible = (field: string) => {
    setFieldsConfig((prev) => {
      const updated = {
        ...prev,
        [field]: {
          ...prev[field],
          visible: !prev[field].visible,
          required: prev[field].visible ? false : prev[field].required
        }
      };
      setHasChanges(true);
      return updated;
    });
  };

  const handleToggleRequired = (field: string) => {
    setFieldsConfig((prev) => {
      const updated = {
        ...prev,
        [field]: {
          ...prev[field],
          required: !prev[field].required,
          visible: !prev[field].required ? true : prev[field].visible
        }
      };
      setHasChanges(true);
      return updated;
    });
  };

  const handleSave = () => {
    localStorage.setItem(configKey, JSON.stringify(fieldsConfig));
    setHasChanges(false);
    toast.success("Cấu hình form học viên đã được lưu thành công!");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Settings Header */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Sliders className="h-5 w-5 text-cyan-600" />
            Cài đặt Form Học viên
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Tùy chỉnh bật/tắt hiển thị và đánh dấu bắt buộc nhập đối với các trường thông tin trong form Thêm/Sửa học viên.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasChanges && (
            <span className="text-xs text-amber-500 font-bold bg-amber-50 border border-amber-200/60 px-3 py-1.5 rounded-xl">
              Có thay đổi chưa lưu
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              hasChanges
                ? "bg-cyan-600 hover:bg-cyan-700 text-white shadow-md shadow-cyan-150 hover:-translate-y-0.5 active:scale-95 cursor-pointer"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            }`}
          >
            <Save className="h-4 w-4" />
            Lưu cấu hình
          </button>
        </div>
      </div>

      {/* Main Settings Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3 px-6">Tên trường thông tin</th>
                <th className="py-3 px-4 text-center">Cho phép hiển thị</th>
                <th className="py-3 px-4 text-center">Bắt buộc nhập</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {([
                { key: 'email', label: 'Email học viên' },
                { key: 'birthday', label: 'Ngày sinh' },
                { key: 'idCard', label: 'Số CCCD / CMND' },
                { key: 'address', label: 'Địa chỉ' },
                { key: 'referral', label: 'Nguồn giới thiệu' },
                { key: 'idCardFrontFile', label: 'Ảnh CCCD mặt trước' },
                { key: 'idCardBackFile', label: 'Ảnh CCCD mặt sau' },
                { key: 'portraitFile', label: 'Ảnh chân dung' },
              ] as { key: string; label: string }[]).map((item) => {
                const config = (fieldsConfig as Record<string, { visible: boolean; required: boolean }>)[item.key] ?? { visible: false, required: false };
                return (
                  <tr key={item.key} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-semibold text-slate-800 text-xs">{item.label}</div>
                      <div className="text-[10px] text-slate-400 font-normal mt-0.5">Trường khóa: {item.key}</div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleVisible(item.key)}
                        className={`relative inline-flex items-center h-5 w-9 rounded-full transition-colors focus:outline-none ${config.visible ? 'bg-cyan-600' : 'bg-slate-200'}`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform ${config.visible ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                      </button>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => config.visible && handleToggleRequired(item.key)}
                        disabled={!config.visible}
                        className={`relative inline-flex items-center h-5 w-9 rounded-full transition-colors focus:outline-none disabled:opacity-30 disabled:cursor-not-allowed ${config.required ? 'bg-rose-500' : 'bg-slate-200'}`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform ${config.required ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-start gap-2.5 text-[10px] text-slate-500">
          <Info className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-slate-600 mb-0.5">Lưu ý cấu hình:</p>
            <p>• Khi tắt "Cho phép hiển thị", trường đó sẽ tự động được đánh dấu là không bắt buộc nhập.</p>
            <p>• Bất kỳ thay đổi nào sẽ được lưu trực tiếp cho cơ sở trung tâm hiện tại và áp dụng lập tức trên toàn hệ thống đăng ký học viên.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
