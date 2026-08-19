import { useCallback, useEffect, useState } from "react";
import { CalendarPlus, Loader2, Trash2 } from "lucide-react";
import { marketingApi, type MarketingCampaign } from "../api/marketing.api";
import TemplateEditor from "./TemplateEditor";

const emptyDraft = () => ({ name: "", runDate: "", targetTierCodes: "", subject: "", html: "" });

export default function HolidayCampaignsSection({ canManage }: { canManage: boolean }) {
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [draft, setDraft] = useState(emptyDraft());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCampaigns(await marketingApi.listCampaigns());
    } catch (err: any) {
      setError(err?.message || "Không tải được danh sách chiến dịch.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    if (!draft.name.trim() || !draft.runDate || !draft.subject.trim() || !draft.html.trim()) {
      setError("Cần nhập tên, ngày chạy, tiêu đề và nội dung.");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await marketingApi.createCampaign({
        name: draft.name.trim(),
        runDate: draft.runDate,
        subject: draft.subject.trim(),
        html: draft.html.trim(),
        targetTierCodes: draft.targetTierCodes.split(",").map((item) => item.trim()).filter(Boolean),
      });
      setDraft(emptyDraft());
      await load();
    } catch (err: any) {
      setError(err?.message || "Tạo chiến dịch thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (campaign: MarketingCampaign) => {
    await marketingApi.updateCampaign(campaign._id, { enabled: !campaign.enabled });
    await load();
  };

  const remove = async (campaign: MarketingCampaign) => {
    await marketingApi.deleteCampaign(campaign._id);
    await load();
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="font-bold text-slate-800">Chiến dịch lễ tết</h3>
      <p className="text-xs text-slate-500">
        Mỗi chiến dịch chạy đúng ngày đã đặt, gửi cho các hạng khách hàng được chọn (để trống = mọi khách hàng đang hoạt động).
      </p>

      {error && <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</div>}

      {loading ? (
        <div className="mt-3 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Đang tải…</div>
      ) : (
        <ul className="mt-3 space-y-2">
          {campaigns.length === 0 && <li className="text-sm text-slate-400">Chưa có chiến dịch nào.</li>}
          {campaigns.map((campaign) => (
            <li key={campaign._id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-700">{campaign.name}</p>
                <p className="text-xs text-slate-500">
                  {campaign.runDate} ·{" "}
                  {campaign.targetTierCodes?.length ? `Hạng: ${campaign.targetTierCodes.join(", ")}` : "Tất cả khách hàng"}
                </p>
              </div>
              {canManage && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggle(campaign)}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold ${campaign.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                  >
                    {campaign.enabled ? "Đang bật" : "Đang tắt"}
                  </button>
                  <button type="button" onClick={() => remove(campaign)} className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50" aria-label={`Xoá ${campaign.name}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <div className="mt-4 grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-2">
          <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Tên dịp (VD: Tết Nguyên Đán)" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <input type="date" value={draft.runDate} onChange={(event) => setDraft({ ...draft, runDate: event.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <input value={draft.targetTierCodes} onChange={(event) => setDraft({ ...draft, targetTierCodes: event.target.value })} placeholder="Mã hạng khách hàng, cách nhau dấu phẩy (để trống = gửi tất cả)" className="rounded-lg border border-slate-200 px-3 py-2 text-sm sm:col-span-2" />
          <div className="sm:col-span-2">
            <TemplateEditor
              automationType="holiday"
              subject={draft.subject}
              html={draft.html}
              disabled={false}
              onChange={(values) => setDraft({ ...draft, ...values })}
            />
          </div>
          <div className="sm:col-span-2">
            <button type="button" onClick={create} disabled={busy} className="flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
              Thêm chiến dịch
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
