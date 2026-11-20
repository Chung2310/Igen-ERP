import { useEffect, useState } from "react";
import type { TelecomInvoicePlatform, TelecomInvoiceSettings } from "../../../../../../shared/marketing-suite/telecom-invoice";
import { StyledSelect } from "../../../../../components/common/StyledSelect";
import { primaryCreateButtonClass } from "../../../../../components/common/primaryCreateButton";
import { crmService } from "../../services/crmService";

type InvoiceSettingsAccount = { platform: TelecomInvoicePlatform; accountId: string };

export function TelecomInvoiceSettingsPanel({ platform, accountId }: InvoiceSettingsAccount) {
  const [open, setOpen] = useState(false);
  return <details className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="cursor-pointer rounded text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary">Đọc ảnh vào Lead</summary>
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
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không tải được cấu hình đọc ảnh.");
    });
    return () => controller.abort();
  }, [platform, accountId, attempt]);

  async function save() {
    if (!settings || saving) return;
    if (settings.enabled && settings.mode === "contract" && (!settings.contractFieldKey || !settings.contractProvider?.trim())) {
      setError("Chọn cột Mã hợp đồng và nhập tên nhà cung cấp để bật OCR.");
      return;
    }
    if (settings.enabled && settings.mode !== "contract" && !settings.subscriberFieldKey) {
      setError("Lưu bộ trường Lead và chọn cột Mã thuê bao trước khi bật đọc hóa đơn.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { enabled, subscriberFieldKey, mode, contractFieldKey, contractProvider } = settings;
      const input = mode === "contract"
        ? { enabled, mode, contractFieldKey, contractProvider }
        : { enabled, subscriberFieldKey };
      const saved = await crmService.saveTelecomInvoiceSettings(platform, accountId, input);
      setSettings(saved);
      setNotice(`Đã ${saved.enabled ? "bật" : "tắt"} đọc ${saved.mode === "contract" ? "ảnh hợp đồng" : "hóa đơn"} cho ${accountLabel} này.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không lưu được cấu hình đọc ảnh.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="mt-3 space-y-3" aria-busy={saving || (!settings && !error)}>
    {error && <p role="alert" className="text-sm text-error">{error}</p>}
    {!settings ? error
      ? <button type="button" className="rounded text-sm font-medium text-primary underline focus-visible:outline-2 focus-visible:outline-primary" onClick={() => { setError(""); setAttempt(current => current + 1); }}>Tải lại cấu hình</button>
      : <p role="status" className="text-sm text-on-surface-variant">Đang tải cấu hình đọc ảnh…</p>
      : <>
        <label className="flex w-fit items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={settings.enabled} disabled={saving} className="size-4 accent-primary" onChange={event => {
            setNotice("");
            setSettings({ ...settings, enabled: event.target.checked });
          }} />
          Bật đọc {settings.mode === "contract" ? "ảnh vào Lead" : "hóa đơn"} cho {accountLabel} này
        </label>
        {settings.enabled && <div className="space-y-2">
          <div className="max-w-sm space-y-1">
            <span className="text-sm font-medium">Cách ghi vào Lead</span>
            <StyledSelect ariaLabel="Cách ghi vào Lead" value={settings.mode ?? "invoice"} disabled={saving}
              options={[{ value: "contract", label: "Theo mã hợp đồng" }, { value: "invoice", label: "Hóa đơn theo mã thuê bao" }]}
              onChange={value => {
                setError("");
                setNotice("");
                setSettings({ ...settings, mode: value === "contract" ? "contract" : "invoice" });
              }} />
          </div>
          {settings.mode === "contract" ? <div className="grid max-w-xl gap-3 sm:grid-cols-2">
            <div className="min-w-0 space-y-1">
              <span className="text-sm font-medium">Cột Mã hợp đồng</span>
              <StyledSelect ariaLabel="Cột Mã hợp đồng" disabled={saving} value={settings.contractFieldKey ?? ""}
                options={[{ value: "", label: "Chọn cột văn bản" }, ...settings.leadFields
                  .filter(field => !field.type || field.type === "text").map(({ key, label }) => ({ value: key, label }))]}
                onChange={contractFieldKey => setSettings({ ...settings, contractFieldKey: contractFieldKey || undefined })} />
            </div>
            <label className="min-w-0 space-y-1 text-sm font-medium">
              <span>Nhà cung cấp</span>
              <input className="h-9 w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 outline-none focus:border-primary"
                value={settings.contractProvider ?? ""} disabled={saving} maxLength={80} placeholder="Ví dụ FPT"
                onChange={event => setSettings({ ...settings, contractProvider: event.target.value })} />
            </label>
            <p className="text-pretty text-xs text-on-surface-variant sm:col-span-2">Dùng cùng tên nhà cung cấp trên Facebook Page và Zalo OA để ghép về cùng Lead.</p>
          </div> : settings.leadFields.length ? <div className="max-w-sm space-y-1">
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
          <button type="button" className={primaryCreateButtonClass} disabled={saving} onClick={() => void save()}>{saving ? "Đang lưu…" : settings.mode === "contract" ? "Lưu cấu hình OCR" : "Lưu cấu hình hóa đơn"}</button>
          {notice && <p role="status" className="text-xs text-on-surface-variant">{notice}</p>}
        </div>
      </>}
  </div>;
}
