import { useCallback, useEffect, useId, useState } from "react";
import { cn } from "../../../../student-management/lib/utils";
import { primaryCreateButtonClass } from "../../../../../components/common/primaryCreateButton";
import type { SocialIntegration } from "../../services/socialIntegrationService";
import { leadSheetService, type LeadSheetConfig, type LeadSheetStatus } from "../../services/leadSheetService";

const inputClass = "w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none disabled:opacity-50";
const buttonClass = "rounded-lg border border-outline-variant px-3 py-2 text-sm text-on-surface hover:bg-surface-container-low focus-visible:outline focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";
const emptyConfig: LeadSheetConfig = { enabled: false, spreadsheetUrl: "", sheetName: "Leads" };

export default function LeadSheetConfigCard({ integration }: { integration: SocialIntegration }) {
  const id = useId();
  const integrationId = integration._id;
  const usable = Boolean(integrationId && /^[a-f\d]{24}$/i.test(integrationId));
  const [config, setConfig] = useState(emptyConfig);
  const [status, setStatus] = useState<LeadSheetStatus | null>(null);
  const [loading, setLoading] = useState(usable);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const load = useCallback(async () => {
    if (!integrationId || !/^[a-f\d]{24}$/i.test(integrationId)) return;
    setLoading(true);
    try { const value = await leadSheetService.get(integrationId); setStatus(value); setConfig(value.config); setNotice(null); }
    catch (error) { setNotice({ error: true, text: error instanceof Error ? error.message : "Không thể tải cấu hình Sheet." }); }
    finally { setLoading(false); }
  }, [integrationId]);
  useEffect(() => { void load(); }, [load]);

  async function run(action: "save" | "test" | "retry") {
    if (!integrationId) return;
    setBusy(action); setNotice(null);
    try {
      const input = { enabled: config.enabled, spreadsheetUrl: config.spreadsheetUrl.trim(), sheetName: config.sheetName.trim() || "Leads" };
      if ((action === "test" || action === "save" && input.enabled) && !input.spreadsheetUrl) throw new Error("Cần nhập link Google Sheet.");
      let text: string;
      if (action === "save") {
        const saved = await leadSheetService.save(integrationId, input);
        setConfig(saved); setStatus(current => current ? { ...current, config: saved } : current);
        text = "Đã lưu cấu hình. Hồ sơ khách vẫn được lưu vào ERP trước khi đồng bộ sang Sheet.";
      } else if (action === "test") {
        const result = await leadSheetService.test(integrationId, input); text = `Đọc được Google Sheet: ${result.title}`;
      } else {
        const result = await leadSheetService.retry(integrationId); text = `Đã xếp lịch thử lại ${result.queued} khách.`;
        setStatus(await leadSheetService.get(integrationId));
      }
      setNotice({ error: false, text });
    } catch (error) { setNotice({ error: true, text: error instanceof Error ? error.message : "Không thể cập nhật Sheet." }); }
    finally { setBusy(""); }
  }

  return <section aria-labelledby={`${id}-title`} aria-busy={loading || Boolean(busy)} className="space-y-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-left text-on-surface">
    <h3 id={`${id}-title`} className="text-balance text-sm font-semibold">Lưu khách tiềm năng vào Google Sheets</h3>
    <p id={`${id}-help`} className="text-pretty text-xs text-on-surface-variant">Lưu khách vào ERP trước. Khi bật, tự đồng bộ thêm tên, số điện thoại, địa chỉ và ghi chú sang Sheet, kể cả khi khách chưa chốt đơn. Mỗi khách trên cùng Page được cập nhật một dòng.</p>
    {!usable ? <p className="text-pretty text-xs">Lưu liên kết Fanpage của doanh nghiệp trước để cấu hình lưu khách.</p> : <>
      {loading && <p role="status" className="text-pretty text-xs">Đang tải cấu hình…</p>}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={config.enabled} onChange={event => setConfig({ ...config, enabled: event.target.checked })}
          disabled={loading || Boolean(busy) || !status} aria-describedby={`${id}-help`} className="size-4 accent-primary focus-visible:outline focus-visible:outline-primary" />
        Bật đồng bộ khách sang Sheet
      </label>
      {status?.serviceAccountEmail && <p className="break-words text-pretty text-xs text-on-surface-variant">Chia sẻ Sheet quyền chỉnh sửa cho: <span>{status.serviceAccountEmail}</span></p>}
      <label className="block space-y-1 text-sm">Link Google Sheet
        <input type="url" value={config.spreadsheetUrl} onChange={event => setConfig({ ...config, spreadsheetUrl: event.target.value })}
          disabled={loading || Boolean(busy) || !status} placeholder="https://docs.google.com/spreadsheets/d/..."
          required={config.enabled} aria-invalid={Boolean(notice?.error && config.enabled && !config.spreadsheetUrl.trim()) || undefined}
          aria-describedby={notice?.error ? `${id}-notice` : `${id}-help`} className={inputClass} />
      </label>
      <label className="block space-y-1 text-sm">Tên tab lưu khách
        <input value={config.sheetName} onChange={event => setConfig({ ...config, sheetName: event.target.value })} maxLength={80}
          disabled={loading || Boolean(busy) || !status} aria-describedby={notice?.error ? `${id}-notice` : `${id}-help`} className={inputClass} />
      </label>
      {status && <p role="status" className="tabular-nums text-pretty text-xs text-on-surface-variant">Đã đồng bộ: {status.synced} · Đang chờ: {status.pending} · Lỗi: {status.failed}</p>}
      {status?.lastError && <p role="alert" className="break-words text-pretty text-xs text-error">Lỗi đồng bộ gần nhất: {status.lastError}. Hồ sơ khách vẫn được giữ trong ERP.</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void run("save")} disabled={loading || Boolean(busy) || !status} className={cn(primaryCreateButtonClass, "text-sm")}>{busy === "save" ? "Đang lưu…" : "Lưu cấu hình khách"}</button>
        <button type="button" onClick={() => void run("test")} disabled={loading || Boolean(busy) || !status} className={buttonClass}>{busy === "test" ? "Đang kiểm tra…" : "Kiểm tra kết nối"}</button>
        <button type="button" onClick={() => void load()} disabled={loading || Boolean(busy)} className={buttonClass}>{status ? "Làm mới trạng thái" : "Thử tải lại"}</button>
        {Boolean(status?.failed) && <button type="button" onClick={() => void run("retry")} disabled={loading || Boolean(busy) || !status?.config.enabled} className={buttonClass}>{busy === "retry" ? "Đang xếp lịch…" : "Thử đồng bộ lại"}</button>}
      </div>
    </>}
    {notice && <p id={`${id}-notice`} role={notice.error ? "alert" : "status"} className={cn("break-words text-pretty text-xs", notice.error ? "text-error" : "text-on-surface-variant")}>{notice.text}</p>}
  </section>;
}
