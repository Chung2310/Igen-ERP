import React, { useState, useEffect } from "react";
import { Sliders, Save, Info, Mail, Server, Key, Eye, EyeOff, Activity, ExternalLink, RefreshCw, Building2, Lock } from "lucide-react";
import { toast } from "../../../../pages/Toast";
import { useAuth } from "../../../../context/AuthContext";
import { apiFetch } from "../../lib/api";
import { getModuleSettings, updateModuleSettings } from "../../api/moduleSettings.api";
import { canChangeEntityPreset, DEFAULT_ENTITY_PRESET, ENTITY_PRESET_OPTIONS, type EntityPreset } from "../../config/entityLabels";
import { getWorkerOperationalCopy } from "../../config/workerRecruitmentCopy";

type FieldConfig = { visible: boolean; required: boolean };
type FieldsConfig = Record<string, FieldConfig>;

interface SettingsPageProps {
  selectedCenter?: string;
}

export function SettingsPage({ selectedCenter }: SettingsPageProps) {
  const { userProfile, refreshProfile } = useAuth();

  const getOwnerId = () => {
    if (userProfile?.role === "superadmin" && selectedCenter && selectedCenter !== "all") {
      return selectedCenter;
    }
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

  // SMTP Settings State
  const [smtpForm, setSmtpForm] = useState({
    smtpHost: "smtp.gmail.com",
    smtpPort: "587",
    smtpSecure: false,
    smtpUser: "",
    smtpPass: "",
    smtpFrom: "",
    smtpSandboxEmail: "",
  });
  const [isCustomSmtp, setIsCustomSmtp] = useState(false);
  const [isLoadingSmtp, setIsLoadingSmtp] = useState(false);
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [isSavingSmtp, setIsSavingSmtp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [entityPreset, setEntityPreset] = useState<EntityPreset>(DEFAULT_ENTITY_PRESET);
  const operationalCopy = getWorkerOperationalCopy(entityPreset);
  const [isLoadingPreset, setIsLoadingPreset] = useState(false);
  const [isSavingPreset, setIsSavingPreset] = useState(false);

  useEffect(() => {
    let mounted = true;
    setIsLoadingPreset(true);
    getModuleSettings()
      .then((settings) => {
        if (mounted) setEntityPreset(settings.entityPreset);
      })
      .catch((error) => console.error("Lỗi khi tải cấu hình loại hình doanh nghiệp:", error))
      .finally(() => {
        if (mounted) setIsLoadingPreset(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleSaveEntityPreset = async (nextPreset: EntityPreset) => {
    if (!canChangeEntityPreset(userProfile?.role) || isReadOnly) return;
    setIsSavingPreset(true);
    try {
      const updated = await updateModuleSettings(nextPreset);
      setEntityPreset(updated.entityPreset);
      window.dispatchEvent(new CustomEvent("entity-label:changed", { detail: { entityPreset: updated.entityPreset } }));
      toast.success("Đã cập nhật loại hình doanh nghiệp!");
    } catch (error) {
      console.error("Lỗi khi lưu loại hình doanh nghiệp:", error);
      toast.error("Không thể lưu loại hình doanh nghiệp. Vui lòng thử lại.");
    } finally {
      setIsSavingPreset(false);
    }
  };

  // Reload settings dynamically when active center / owner changes
  useEffect(() => {
    const saved = localStorage.getItem(configKey);
    if (saved) {
      try {
        setFieldsConfig({ ...defaultFieldsConfig, ...JSON.parse(saved) });
        setHasChanges(false);
      } catch (e) {
        console.error(e);
      }
    } else {
      setFieldsConfig(defaultFieldsConfig);
      setHasChanges(false);
    }

    // Fetch SMTP settings
    const fetchSmtpSettings = async () => {
      setIsLoadingSmtp(true);
      try {
        const res = await apiFetch("/auth/me");
        if (res.success && res.data?.user) {
          const u = res.data.user;
          const host = u.smtpHost || "";
          // If host is empty or smtp.gmail.com, default to simplified Gmail mode
          const isGmailDefault = host === "" || host === "smtp.gmail.com";
          setIsCustomSmtp(!isGmailDefault);

          setSmtpForm({
            smtpHost: host || "smtp.gmail.com",
            smtpPort: u.smtpPort !== undefined && u.smtpPort !== null ? String(u.smtpPort) : "587",
            smtpSecure: u.smtpSecure === true || u.smtpSecure === "true",
            smtpUser: u.smtpUser || "",
            smtpPass: u.smtpPass || "",
            smtpFrom: u.smtpFrom || "",
            smtpSandboxEmail: u.smtpSandboxEmail || "",
          });
        }
      } catch (error) {
        console.error("Lỗi khi tải cấu hình SMTP:", error);
      } finally {
        setIsLoadingSmtp(false);
      }
    };
    fetchSmtpSettings();
  }, [configKey]);

  const isReadOnly = userProfile?.role === "superadmin" && selectedCenter === "all";
  const canEditEntityPreset = canChangeEntityPreset(userProfile?.role) && !isReadOnly;

  const handleToggleVisible = (field: string) => {
    if (isReadOnly) return;
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
    if (isReadOnly) return;
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
    if (isReadOnly) return;
    localStorage.setItem(configKey, JSON.stringify(fieldsConfig));
    setHasChanges(false);
    toast.success(operationalCopy.settingsSavedMessage);
  };

  const handleTestConnection = async () => {
    const finalUser = smtpForm.smtpUser.trim();
    const finalPass = smtpForm.smtpPass.trim();

    if (!finalUser || !finalPass) {
      toast.error("Vui lòng nhập đầy đủ Email và Mật khẩu SMTP để kiểm tra.");
      return;
    }

    setIsTestingSmtp(true);
    try {
      const testPayload = {
        check: true,
        smtpHost: isCustomSmtp ? smtpForm.smtpHost.trim() : "smtp.gmail.com",
        smtpPort: isCustomSmtp ? (smtpForm.smtpPort ? parseInt(smtpForm.smtpPort, 10) : 587) : 587,
        smtpSecure: isCustomSmtp ? smtpForm.smtpSecure : false,
        smtpUser: finalUser,
        smtpPass: finalPass,
        smtpFrom: isCustomSmtp ? smtpForm.smtpFrom.trim() : `"${userProfile?.displayName || 'Hệ thống Quản lý'}" <${finalUser}>`,
        smtpSandboxEmail: isCustomSmtp ? smtpForm.smtpSandboxEmail.trim() : "",
      };

      const res = await apiFetch("/send-email", {
        method: "POST",
        body: JSON.stringify(testPayload),
      });
      if (res.success) {
        toast.success("Kết nối máy chủ SMTP thành công!");
      } else {
        toast.error(res.error || "Kết nối máy chủ SMTP thất bại.");
      }
    } catch (error: any) {
      toast.error(error.message || "Không thể kết nối tới máy chủ SMTP.");
    } finally {
      setIsTestingSmtp(false);
    }
  };

  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;

    const finalUser = smtpForm.smtpUser.trim();
    const finalPass = smtpForm.smtpPass.trim();

    if (!finalUser || !finalPass) {
      toast.error("Vui lòng nhập đầy đủ Email và Mật khẩu SMTP.");
      return;
    }

    setIsSavingSmtp(true);
    try {
      const payload = {
        smtpHost: isCustomSmtp ? smtpForm.smtpHost.trim() : "smtp.gmail.com",
        smtpPort: isCustomSmtp ? (smtpForm.smtpPort ? parseInt(smtpForm.smtpPort, 10) : 587) : 587,
        smtpSecure: isCustomSmtp ? smtpForm.smtpSecure : false,
        smtpUser: finalUser,
        smtpPass: finalPass,
        smtpFrom: isCustomSmtp ? smtpForm.smtpFrom.trim() : `"${userProfile?.displayName || 'Hệ thống Quản lý'}" <${finalUser}>`,
        smtpSandboxEmail: isCustomSmtp ? smtpForm.smtpSandboxEmail.trim() : "",
      };

      const res = await apiFetch("/auth/smtp-settings", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      if (res.success) {
        toast.success("Đã lưu cấu hình SMTP thành công!");
        await refreshProfile();
      } else {
        toast.error(res.error || "Lỗi khi lưu cấu hình SMTP.");
      }
    } catch (error: any) {
      toast.error(error.message || "Lỗi hệ thống khi lưu cấu hình.");
    } finally {
      setIsSavingSmtp(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-left">
      {/* Settings Header */}
   

      {/* Warning Alert if superadmin selected "all" */}
    

      {/* Main Settings Table */}
    

      {/* Entity Preset Card (Selectable / Editable) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-cyan-600" />
              Loại hình doanh nghiệp
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Chọn loại hình doanh nghiệp để tùy chỉnh xưng hô thực thể (Học viên, Ứng viên, Khách hàng, Lao động) và tự động bật/tắt các module phù hợp trên toàn hệ thống.
            </p>
            {!canEditEntityPreset && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-700">
                <Lock className="h-3.5 w-3.5" />
                Chỉ Super Admin được quyền thay đổi loại hình doanh nghiệp.
              </p>
            )}
          </div>
        </div>
        {isLoadingPreset ? (
          <div className="flex items-center justify-center py-6 gap-2 text-slate-500 text-xs">
            <RefreshCw className="h-4 w-4 animate-spin text-cyan-600" />
            Đang tải thông tin loại hình...
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ENTITY_PRESET_OPTIONS.map((option) => {
              const isSelected = entityPreset === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={isSavingPreset || !canEditEntityPreset}
                  onClick={() => handleSaveEntityPreset(option.value)}
                  className={`flex items-center justify-between px-4 py-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? "border-cyan-500 bg-cyan-50/90 text-cyan-900 font-bold shadow-sm ring-2 ring-cyan-500/20"
                      : "border-slate-200 bg-white hover:bg-cyan-50/40 hover:border-cyan-200 text-slate-700 font-semibold"
                  } ${isSavingPreset ? "opacity-60 cursor-wait" : !canEditEntityPreset ? "opacity-70 cursor-not-allowed" : ""}`}
                >
                  <span className="text-sm font-bold">{option.label}</span>
                  {isSelected ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-cyan-600 text-white px-2.5 py-1 rounded-md shadow-xs">
                      {isSavingPreset ? <RefreshCw className="h-3 w-3 animate-spin" /> : "Đang dùng"}
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-slate-400 group-hover:text-cyan-600 transition-colors">
                      {canEditEntityPreset ? "Chọn" : <Lock className="h-3.5 w-3.5" />}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* SMTP Email Settings Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Mail className="h-5 w-5 text-cyan-600" />
            Cấu hình Gửi Email (SMTP)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {operationalCopy.settingsMailDescription}
          </p>
        </div>

        {/* Non-Tech User Guide Box */}
        <div className="bg-cyan-50/50 border border-cyan-100 rounded-2xl p-4 space-y-2.5 text-xs text-slate-700">
          <div className="flex items-center gap-2 font-bold text-cyan-800">
            <Info className="h-4.5 w-4.5 text-cyan-600 shrink-0" />
            Hướng dẫn kết nối Gmail nhanh (Chỉ tốn 1 phút)
          </div>
          <div className="pl-6 space-y-1.5 leading-relaxed text-slate-600">
            <p>
              Để hệ thống gửi email bằng tài khoản Gmail của bạn, bạn cần sử dụng <strong>Mật khẩu ứng dụng (App Password)</strong> chứ không dùng mật khẩu Gmail thông thường:
            </p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Đảm bảo tài khoản Gmail của bạn đã <strong>Bật Xác minh 2 bước</strong>.</li>
              <li>
                Truy cập trang cài đặt bảo mật của Google:{" "}
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-600 hover:text-cyan-700 font-bold inline-flex items-center gap-0.5 underline transition-all"
                >
                  myaccount.google.com/apppasswords
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>Nhập tên ứng dụng là <code>QLHV ERP</code> rồi nhấn <strong>Tạo (Create)</strong>.</li>
              <li>Sao chép <strong>mã mật khẩu 16 chữ số</strong> màu vàng hiển thị trên màn hình.</li>
              <li>Dán mã đó vào ô <strong>Mật khẩu ứng dụng Gmail</strong> bên dưới là hoàn tất!</li>
            </ol>
          </div>
        </div>

        {isLoadingSmtp ? (
          <div className="flex items-center justify-center py-10 gap-2 text-slate-500 text-xs">
            <RefreshCw className="h-4.5 w-4.5 animate-spin text-cyan-600" />
            Đang tải thông tin cấu hình...
          </div>
        ) : (
          <form onSubmit={handleSaveSmtp} className="space-y-6">
            <div className="space-y-4">
              {/* Main Gmail Fields (Minimal layout for non-tech) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* User Email */}
                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                    Địa chỉ Email Gmail <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    disabled={isReadOnly}
                    placeholder="Ví dụ: trungtamlai xe@gmail.com"
                    value={smtpForm.smtpUser}
                    onChange={(e) => setSmtpForm({ ...smtpForm, smtpUser: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all outline-none"
                  />
                </div>

                {/* App Password */}
                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Key className="h-3.5 w-3.5 text-slate-400" />
                    Mật khẩu ứng dụng Gmail (16 chữ số) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      disabled={isReadOnly}
                      placeholder="Nhập 16 ký tự màu vàng đã copy ở Google"
                      value={smtpForm.smtpPass}
                      onChange={(e) => setSmtpForm({ ...smtpForm, smtpPass: e.target.value })}
                      className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Advanced toggle */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-left">
                <input
                  type="checkbox"
                  id="toggleCustomSmtp"
                  disabled={isReadOnly}
                  checked={isCustomSmtp}
                  onChange={(e) => setIsCustomSmtp(e.target.checked)}
                  className="h-4 w-4 text-cyan-600 border-slate-300 rounded focus:ring-cyan-500 cursor-pointer"
                />
                <label htmlFor="toggleCustomSmtp" className="text-xs text-slate-600 font-bold select-none cursor-pointer hover:text-slate-800 transition-colors">
                  Sử dụng nhà cung cấp email khác (Cấu hình nâng cao)
                </label>
              </div>

              {/* Advanced configuration block */}
              {isCustomSmtp && (
                <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4 animate-fadeIn">
                  {/* Host */}
                  <div className="space-y-1.5 text-left">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Server className="h-3.5 w-3.5 text-slate-400" />
                      Máy chủ SMTP (Host) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required={isCustomSmtp}
                      disabled={isReadOnly}
                      placeholder="Ví dụ: smtp.mailgun.org"
                      value={smtpForm.smtpHost}
                      onChange={(e) => setSmtpForm({ ...smtpForm, smtpHost: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all outline-none"
                    />
                  </div>

                  {/* Port */}
                  <div className="space-y-1.5 text-left">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Server className="h-3.5 w-3.5 text-slate-400" />
                      Cổng SMTP (Port) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required={isCustomSmtp}
                      disabled={isReadOnly}
                      placeholder="Ví dụ: 465 (SSL) hoặc 587 (TLS)"
                      value={smtpForm.smtpPort}
                      onChange={(e) => setSmtpForm({ ...smtpForm, smtpPort: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all outline-none"
                    />
                  </div>

                  {/* Sender Name / Header (smtpFrom) */}
                  <div className="space-y-1.5 text-left">
                    <label className="text-xs font-bold text-slate-700">
                      Tên hiển thị người gửi (Không bắt buộc)
                    </label>
                    <input
                      type="text"
                      disabled={isReadOnly}
                      placeholder='Ví dụ: "Hệ thống Quản lý" <trungtamlai xe@gmail.com>'
                      value={smtpForm.smtpFrom}
                      onChange={(e) => setSmtpForm({ ...smtpForm, smtpFrom: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all outline-none"
                    />
                  </div>

                  {/* Sandbox Email */}
                  <div className="space-y-1.5 text-left">
                    <label className="text-xs font-bold text-slate-700">
                      Email Sandbox nhận thử nghiệm (Không bắt buộc)
                    </label>
                    <input
                      type="email"
                      disabled={isReadOnly}
                      placeholder="Ví dụ: test-email@gmail.com"
                      value={smtpForm.smtpSandboxEmail}
                      onChange={(e) => setSmtpForm({ ...smtpForm, smtpSandboxEmail: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all outline-none"
                    />
                  </div>

                  {/* Security Checkbox for SSL/TLS */}
                  <div className="flex items-center gap-2 text-left md:col-span-2">
                    <input
                      type="checkbox"
                      id="smtpSecure"
                      disabled={isReadOnly}
                      checked={smtpForm.smtpSecure}
                      onChange={(e) => setSmtpForm({ ...smtpForm, smtpSecure: e.target.checked })}
                      className="h-4 w-4 text-cyan-600 border-slate-300 rounded focus:ring-cyan-500 cursor-pointer"
                    />
                    <label htmlFor="smtpSecure" className="text-xs text-slate-700 font-medium select-none cursor-pointer">
                      Sử dụng kết nối bảo mật SSL/TLS (Khuyên dùng khi dùng cổng 465)
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Buttons Row */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTestingSmtp}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isTestingSmtp ? (
                  <RefreshCw className="h-4 w-4 animate-spin text-slate-500" />
                ) : (
                  <Activity className="h-4 w-4 text-slate-500" />
                )}
                {isTestingSmtp ? "Đang kết nối..." : "Kiểm tra kết nối SMTP"}
              </button>

              <button
                type="submit"
                disabled={isSavingSmtp || isReadOnly}
                className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isReadOnly
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "bg-cyan-600 hover:bg-cyan-700 text-white shadow-md shadow-cyan-150 hover:-translate-y-0.5 active:scale-95 cursor-pointer"
                }`}
              >
                {isSavingSmtp ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {isSavingSmtp ? "Đang lưu..." : "Lưu cấu hình SMTP"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
