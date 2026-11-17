import { useEffect, useState } from "react";
import type { TelecomInvoicePlatform, TelecomInvoiceSettings } from "../../../../../../shared/marketing-suite/telecom-invoice";
import { StyledSelect } from "../../../../../components/common/StyledSelect";
import { primaryCreateButtonClass } from "../../../../../components/common/primaryCreateButton";
import { crmService } from "../../services/crmService";

type InvoiceSettingsAccount = { platform: TelecomInvoicePlatform; accountId: string };

export function TelecomInvoiceSettingsPanel({ platform, accountId }: InvoiceSettingsAccount) {
  const [open, setOpen] = useState(false);
  return <details className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="cursor-pointer rounded text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary">Đọc hóa đơn nhà mạng</summary>
    {open && <TelecomInvoiceSettingsForm key={`${platform}:${accountId}`} platform={platform} accountId={accountId} />}
  </details>;
}

function TelecomInvoiceSettingsForm({ platform, accountId }: InvoiceSettingsAccount) {
  const [settings, setSettings] = useState<TelecomInvoiceSettings>();
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const accountLabel = platform === "zalo" ? "Zalo OA" : "Page";
  useEffect(() => {
    const controller = new AbortController();
    void crmService.getTelecomInvoiceSettings(platform, accountId, controller.signal).then(result => {
      if (!controller.signal.aborted) setSettings(result);
    }).catch(cause => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không tải được cấu hình hóa đơn.");
    });
    return () => controller.abort();
  }, [platform, accountId, attempt]);

  async function save() {
    if (!settings || saving) return;
    if (settings.enabled && !settings.subscriberFieldKey) {
      setError("Lưu bộ trường Lead và chọn cột Mã thuê bao trước khi bật đọc hóa đơn.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { enabled, subscriberFieldKey } = settings;
      const saved = await crmService.saveTelecomInvoiceSettings(platform, accountId, { enabled, subscriberFieldKey });
      setSettings(saved);
      setNotice(`Đã ${saved.enabled ? "bật" : "tắt"} đọc hóa đơn cho ${accountLabel} này.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không lưu được cấu hình hóa đơn.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="mt-3 space-y-3" aria-busy={saving || (!settings && !error)}>
    {error && <p role="alert" className="text-sm text-error">{error}</p>}
    {!settings ? error
      ? <button type="button" className="rounded text-sm font-medium text-primary underline focus-visible:outline-2 focus-visible:outline-primary" onClick={() => { setError(""); setAttempt(current => current + 1); }}>Tải lại cấu hình</button>
      : <p role="status" className="text-sm text-on-surface-variant">Đang tải cấu hình hóa đơn…</p>
      : <>
        <label className="flex w-fit items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={settings.enabled} disabled={saving} className="size-4 accent-primary" onChange={event => {
            setNotice("");
            setSettings({ ...settings, enabled: event.target.checked });
          }} />
          Bật đọc hóa đơn cho {accountLabel} này
        </label>
        {settings.enabled && <div className="space-y-2">
          <p className="text-pretty text-sm text-on-surface-variant">Bot đọc theo bộ trường Lead đang áp dụng cho {accountLabel}. Ảnh rõ và đủ trường bắt buộc được lưu tự động. Ảnh mờ hoặc thiếu thông tin cần đối chiếu.</p>
          {settings.leadFields.length ? <div className="max-w-sm space-y-1">
            <span className="text-sm font-medium">Cột dùng làm Mã thuê bao</span>
            <StyledSelect ariaLabel="Cột dùng làm Mã thuê bao" value={settings.subscriberFieldKey ?? ""} disabled={saving}
              options={[{ value: "", label: "Chọn cột Mã thuê bao" }, ...settings.leadFields.map(({ key, label }) => ({ value: key, label }))]}
              onChange={subscriberFieldKey => {
                setNotice("");
                setError("");
                setSettings({ ...settings, subscriberFieldKey: subscriberFieldKey || undefined });
              }} />
          </div> : <p className="text-pretty text-sm text-on-surface-variant">Lưu và áp dụng bộ trường Lead có cột Mã thuê bao trước.</p>}
        </div>}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={primaryCreateButtonClass} disabled={saving} onClick={() => void save()}>{saving ? "Đang lưu…" : "Lưu cấu hình hóa đơn"}</button>
          {notice && <p role="status" className="text-xs text-on-surface-variant">{notice}</p>}
        </div>
      </>}
  </div>;
}
