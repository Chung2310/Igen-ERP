import { useEffect, useId, useState } from "react";
import type { LeadTargetModule } from "../../../../../../shared/marketing-suite/lead-intake";
import { leadModuleTargets, type LeadDestinationChannel, type LeadDestinationSettings } from "../../../../../../shared/marketing-suite/lead-module-destination";
import { leadModuleDestinationService } from "../../services/leadModuleDestinationService";

function ChannelDestination({ channel, availableModules, canEdit }: {
  channel: LeadDestinationChannel;
  availableModules: LeadTargetModule[];
  canEdit: boolean;
}) {
  const selectId = useId();
  const feedbackId = useId();
  const [saved, setSaved] = useState(channel.targetModule);
  const [target, setTarget] = useState<LeadTargetModule | "">(channel.targetModule ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const available = leadModuleTargets.filter(module => availableModules.includes(module.value));
  const inactive = leadModuleTargets.find(module => module.value === saved && !availableModules.includes(module.value));

  async function save() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await leadModuleDestinationService.save({
        platform: channel.platform, accountId: channel.accountId, targetModule: target || null,
      });
      setSaved(result.targetModule);
      setTarget(result.targetModule ?? "");
      setNotice("Đã lưu.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Không thể lưu phân hệ nhận Lead.");
    } finally {
      setSaving(false);
    }
  }

  return <li className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
    <div className="min-w-0">
      <label htmlFor={selectId} className="block break-words text-sm font-medium">{channel.displayName}</label>
      <p className="break-all text-xs text-on-surface-variant">{channel.platform === "zalo" ? "Zalo OA" : "Facebook Page"} · {channel.accountId}</p>
    </div>
    <select
      id={selectId}
      value={target}
      disabled={!canEdit || saving}
      aria-describedby={feedbackId}
      onChange={event => {
        setTarget(event.target.value as LeadTargetModule | "");
        setError("");
        setNotice("");
      }}
      className="min-h-9 w-full min-w-0 rounded-md border border-outline-variant bg-surface-container-lowest px-2 text-sm outline-none focus:border-primary disabled:opacity-60"
    >
      <option value="">Chọn khi đồng bộ</option>
      {available.map(module => <option key={module.value} value={module.value}>{module.label}</option>)}
      {inactive && <option disabled value={inactive.value}>{inactive.label} · Đã tắt</option>}
    </select>
    {canEdit && <button type="button" onClick={() => void save()} disabled={saving || (target || null) === saved}
      aria-label={`Lưu phân hệ nhận Lead cho ${channel.displayName}`}
      className="min-h-9 justify-self-start rounded-md border border-outline-variant px-3 text-sm font-medium hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50">
      {saving ? "Đang lưu…" : "Lưu"}
    </button>}
    <div id={feedbackId} role={error ? "alert" : "status"}
      className={`text-xs empty:hidden sm:col-span-full ${error ? "text-error" : "text-on-surface-variant"}`}>{error || notice}</div>
  </li>;
}

export default function LeadDestinationSettingsCard({ canEdit }: { canEdit: boolean }) {
  const headingId = useId();
  const [state, setState] = useState<{ data?: LeadDestinationSettings; error?: string }>({});
  const [loadAttempt, setLoadAttempt] = useState(0);
  const { data, error } = state;

  useEffect(() => {
    const controller = new AbortController();
    void leadModuleDestinationService.readSettings(controller.signal).then(data => {
      if (!controller.signal.aborted) setState({ data });
    }).catch(error => {
      if (!controller.signal.aborted) setState({ error: error instanceof Error ? error.message : "Không tải được danh sách Page/OA." });
    });
    return () => controller.abort();
  }, [loadAttempt]);

  return <section aria-labelledby={headingId} className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4 text-on-surface">
    <h3 id={headingId} className="text-balance text-sm font-semibold">Phân hệ nhận Lead</h3>
    <p className="mt-1 text-pretty text-xs text-on-surface-variant">Chọn phân hệ được điền sẵn khi nhân viên đồng bộ Lead từ từng Page/OA.</p>
    {error && <div className="mt-3 flex flex-wrap items-center gap-2">
      <p role="alert" className="text-sm text-error">{error}</p>
      <button type="button" className="min-h-9 rounded-md border border-outline-variant px-3 text-sm focus-visible:outline-2 focus-visible:outline-primary"
        onClick={() => { setState({}); setLoadAttempt(current => current + 1); }}>Thử lại</button>
    </div>}
    {!data && !error && <p role="status" className="mt-3 text-sm text-on-surface-variant">Đang tải Page/OA…</p>}
    {data && (data.channels.length ? (
      <ul className="mt-3 divide-y divide-outline-variant border-t border-outline-variant">
        {data.channels.map(channel => <ChannelDestination key={`${channel.platform}:${channel.accountId}`}
          channel={channel} availableModules={data.availableModules} canEdit={canEdit} />)}
      </ul>
    ) : <p className="mt-3 text-sm text-on-surface-variant">Kết nối Facebook Page hoặc Zalo OA trong tab MXH Doanh nghiệp để thiết lập phân hệ.</p>)}
  </section>;
}
