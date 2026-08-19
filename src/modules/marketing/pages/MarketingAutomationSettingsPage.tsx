import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarHeart, Gift, HeartHandshake, Loader2, Send, Sparkles } from "lucide-react";
import {
  marketingApi,
  type MarketingAutomationConfig,
  type MarketingAutomationType,
  type MarketingChannel,
  type MarketingChannelStatus,
  type MarketingSettings,
} from "../api/marketing.api";
import HolidayCampaignsSection from "../components/HolidayCampaignsSection";
import TemplateEditor from "../components/TemplateEditor";

const AUTOMATIONS: Array<{
  type: MarketingAutomationType;
  title: string;
  description: string;
  icon: typeof Gift;
  manualScan?: "birthday" | "holiday" | "remarketing";
}> = [
  { type: "thank_you", title: "Cảm ơn sau khi xuất hoá đơn", description: "Gửi ngay khi đơn bán hàng được xác nhận và xuất hoá đơn.", icon: HeartHandshake },
  { type: "birthday", title: "Chúc mừng sinh nhật", description: "Quét mỗi ngày, gửi cho khách có ngày sinh trùng hôm nay.", icon: Gift, manualScan: "birthday" },
  { type: "holiday", title: "Lễ tết theo nhóm khách hàng", description: "Chạy theo các chiến dịch đã lên lịch bên dưới.", icon: CalendarHeart, manualScan: "holiday" },
  { type: "remarketing", title: "Remarketing khách cũ", description: "Hỏi thăm khách đã lâu không quay lại mua hàng.", icon: Sparkles, manualScan: "remarketing" },
];

const CHANNEL_HINT = "Kênh chưa được nối API sẽ tự bỏ qua, hệ thống dùng kênh khả dụng đầu tiên trong danh sách.";

export default function MarketingAutomationSettingsPage({ canManage }: { canManage: boolean }) {
  const [settings, setSettings] = useState<MarketingSettings>();
  /** Bản đã lưu trên máy chủ, dùng để biết còn thay đổi nào chưa bấm Lưu. */
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [channels, setChannels] = useState<MarketingChannelStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string }>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await marketingApi.getSettings();
      setSettings(data.settings);
      setSavedSnapshot(JSON.stringify(data.settings));
      setChannels(data.channels);
    } catch (error: any) {
      setMessage({ tone: "error", text: error?.message || "Không tải được cài đặt." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const patch = (type: MarketingAutomationType, values: Partial<MarketingAutomationConfig>) => {
    setSettings((current) => (current ? { ...current, [type]: { ...current[type], ...values } } : current));
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    setMessage(undefined);
    try {
      const saved = await marketingApi.updateSettings(settings);
      setSettings(saved);
      setSavedSnapshot(JSON.stringify(saved));
      setMessage({ tone: "ok", text: "Đã lưu cài đặt." });
    } catch (error: any) {
      setMessage({ tone: "error", text: error?.message || "Lưu thất bại." });
    } finally {
      setSaving(false);
    }
  };

  const runScan = async (type: "birthday" | "holiday" | "remarketing") => {
    setMessage(undefined);
    try {
      const stats = await marketingApi.runScan(type);
      setMessage({ tone: "ok", text: `Đã quét: ${stats.eligible} khách phù hợp · gửi ${stats.queued} · bỏ qua ${stats.skipped} · lỗi ${stats.failed}.` });
    } catch (error: any) {
      setMessage({ tone: "error", text: error?.message || "Chạy quét thất bại." });
    }
  };

  const sendTest = async (type: MarketingAutomationType) => {
    const recipient = window.prompt("Gửi thử tới địa chỉ nào?");
    if (!recipient) return;
    setMessage(undefined);
    try {
      const result = await marketingApi.sendTest(type, recipient.trim());
      setMessage(result.status === "sent"
        ? { tone: "ok", text: `Đã gửi thử tới ${recipient}.` }
        : { tone: "error", text: `Không gửi được: ${result.reason || result.status}.` });
    } catch (error: any) {
      setMessage({ tone: "error", text: error?.message || "Gửi thử thất bại." });
    }
  };

  const dirty = Boolean(settings) && JSON.stringify(settings) !== savedSnapshot;
  const availableChannels = useMemo(() => channels.filter((item) => item.implemented && item.configured).length, [channels]);

  if (loading || !settings) {
    return <div className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Đang tải cài đặt…</div>;
  }

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-bold text-slate-800">Tin nhắn tự động</h2>
        <p className="mt-1 text-sm text-slate-500">
          Hệ thống quét mỗi ngày vào giờ đã đặt và gửi tin cho khách hàng. {CHANNEL_HINT}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="text-sm font-semibold text-slate-600">
            Giờ gửi hằng ngày
            <input
              type="time"
              value={settings.sendTime}
              disabled={!canManage}
              onChange={(event) => setSettings({ ...settings, sendTime: event.target.value })}
              className="ml-2 rounded-lg border border-slate-200 px-2 py-1 font-normal"
            />
          </label>
          <span className="text-xs text-slate-400">Múi giờ {settings.timeZone}</span>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${availableChannels ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
            {availableChannels ? `${availableChannels} kênh sẵn sàng` : "Chưa cấu hình kênh gửi nào"}
          </span>
        </div>
        {!availableChannels && (
          <p className="mt-2 text-xs text-amber-700">
            Email cần cấu hình SMTP của công ty tại Cài đặt · Email trước khi tin tự động gửi được.
          </p>
        )}
      </header>

      {message && (
        <div className={`rounded-xl px-4 py-3 text-sm font-semibold ${message.tone === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
          {message.text}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {AUTOMATIONS.map((automation) => {
          const config = settings[automation.type];
          const Icon = automation.icon;
          return (
            <section key={automation.type} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="rounded-xl bg-cyan-50 p-2 text-cyan-700"><Icon className="h-5 w-5" /></span>
                  <div>
                    <h3 className="font-bold text-slate-800">{automation.title}</h3>
                    <p className="text-xs text-slate-500">{automation.description}</p>
                  </div>
                </div>
                <label className="flex shrink-0 items-center gap-2 text-sm font-semibold text-slate-600">
                  <input
                    type="checkbox"
                    checked={config.enabled}
                    disabled={!canManage}
                    onChange={(event) => patch(automation.type, { enabled: event.target.checked })}
                    className="h-4 w-4 accent-cyan-600"
                  />
                  Bật
                </label>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {channels.map((channel) => {
                  const active = config.channels.includes(channel.channel);
                  const usable = channel.implemented;
                  return (
                    <button
                      key={channel.channel}
                      type="button"
                      disabled={!canManage}
                      title={usable ? (channel.configured ? "Đã cấu hình" : "Chưa cấu hình") : "Chưa nối API nhà cung cấp"}
                      onClick={() => patch(automation.type, {
                        channels: active
                          ? config.channels.filter((item) => item !== channel.channel)
                          : ([...config.channels, channel.channel] as MarketingChannel[]),
                      })}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${active ? "border-cyan-500 bg-cyan-50 text-cyan-700" : "border-slate-200 text-slate-500"} ${usable ? "" : "opacity-60"}`}
                    >
                      {channel.label}
                      {!usable && " · sắp có"}
                      {usable && !channel.configured && " · chưa cấu hình"}
                    </button>
                  );
                })}
              </div>

              {automation.type === "thank_you" && (
                <label className="mt-3 flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600">
                  <input
                    type="checkbox"
                    checked={settings.attachInvoicePdf}
                    disabled={!canManage}
                    onChange={(event) => setSettings({ ...settings, attachInvoicePdf: event.target.checked })}
                    className="mt-0.5 h-4 w-4 accent-cyan-600"
                  />
                  <span>
                    Gửi kèm hoá đơn PDF
                    <span className="block text-xs font-normal text-slate-500">
                      Dùng đúng bản in hoá đơn của chi nhánh. Chỉ áp dụng cho kênh email; đơn chưa xuất hoá đơn thì tin vẫn gửi nhưng không có tệp đính kèm.
                    </span>
                  </span>
                </label>
              )}

              {automation.type === "remarketing" && (
                <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-600">
                  <label className="font-semibold">
                    Không mua sau (ngày)
                    <input
                      type="number"
                      min={7}
                      value={settings.remarketingInactiveDays}
                      disabled={!canManage}
                      onChange={(event) => setSettings({ ...settings, remarketingInactiveDays: Number(event.target.value) })}
                      className="ml-2 w-24 rounded-lg border border-slate-200 px-2 py-1 font-normal"
                    />
                  </label>
                  <label className="font-semibold">
                    Chờ giữa 2 lần (ngày)
                    <input
                      type="number"
                      min={7}
                      value={settings.remarketingCooldownDays}
                      disabled={!canManage}
                      onChange={(event) => setSettings({ ...settings, remarketingCooldownDays: Number(event.target.value) })}
                      className="ml-2 w-24 rounded-lg border border-slate-200 px-2 py-1 font-normal"
                    />
                  </label>
                </div>
              )}

              <TemplateEditor
                automationType={automation.type}
                subject={config.subject}
                html={config.html}
                disabled={!canManage}
                onChange={(values) => patch(automation.type, values)}
              />

              {canManage && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => sendTest(automation.type)} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                    <Send className="h-3.5 w-3.5" /> Gửi thử
                  </button>
                  {automation.manualScan && (
                    <button type="button" onClick={() => runScan(automation.manualScan!)} className="rounded-lg border border-cyan-200 px-3 py-1.5 text-xs font-semibold text-cyan-700 hover:bg-cyan-50">
                      Chạy quét ngay
                    </button>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <HolidayCampaignsSection canManage={canManage} />

      {canManage && (
        <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-slate-200 bg-white/90 p-3 backdrop-blur">
          <span className={`text-sm font-semibold ${dirty ? "text-amber-700" : "text-slate-400"}`}>
            {dirty ? "Có thay đổi chưa lưu" : "Đã lưu"}
          </span>
          <button
            type="button"
            onClick={save}
            disabled={saving || !dirty}
            className="flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Lưu cài đặt
          </button>
        </div>
      )}
    </div>
  );
}
