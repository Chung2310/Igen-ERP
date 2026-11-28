import { useId, useState } from "react";
import { StyledSelect } from "../../../../../components/common/StyledSelect";
import { primaryCreateButtonClass } from "../../../../../components/common/primaryCreateButton";
import { fieldInputClass, secondaryBtnClass } from "../../../message/components/crm/crmFormStyles";
import { socialIntegrationService, type SocialIntegration } from "../../services/socialIntegrationService";

export default function ZaloAppConnection({ integration, onBusyChange, navigate = url => window.location.assign(url) }: {
  integration?: SocialIntegration; onBusyChange?: (busy: boolean) => void; navigate?: (url: string) => void;
}) {
  const prefix = useId();
  const [expanded, setExpanded] = useState(!integration);
  const [mode, setMode] = useState<"default" | "custom">(integration?.zaloAppMode || "default");
  const [appId, setAppId] = useState(integration?.zaloAppId || "");
  const [appSecret, setAppSecret] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [invalid, setInvalid] = useState<Record<string, string>>({});
  const sameApp = integration?.zaloAppMode === "custom" && integration.zaloAppId === appId.trim();
  const keepAppSecret = sameApp && integration?.hasZaloAppSecret;
  const keepWebhook = sameApp && integration?.hasZaloWebhookSecret;
  const appSettingsUrl = mode === "custom" && /^\d{1,30}$/.test(appId.trim())
    ? `https://developers.zalo.me/app/${appId.trim()}/oa/settings`
    : "https://developers.zalo.me/apps";
  async function connect() {
    const errors: Record<string, string> = {};
    if (mode === "custom") {
      if (!/^\d{1,30}$/.test(appId.trim())) errors.appId = "Nhập App ID dạng chữ số.";
      if (!appSecret.trim() && !keepAppSecret) errors.appSecret = "Nhập App Secret của App này.";
      if (!webhookSecret.trim() && !keepWebhook) errors.webhookSecret = "Nhập khóa xác minh webhook của App này.";
    }
    setInvalid(errors); setError("");
    if (Object.keys(errors).length) return;
    setBusy(true); onBusyChange?.(true);
    try {
      const url = await socialIntegrationService.startZaloOAuth({ appMode: mode, ...(integration?._id ? { integrationId: integration._id } : {}),
        ...(mode === "custom" ? { appId: appId.trim(), ...(appSecret.trim() ? { appSecret: appSecret.trim() } : {}), ...(webhookSecret.trim() ? { webhookSecret: webhookSecret.trim() } : {}) } : {}),
      });
      setAppSecret(""); setWebhookSecret(""); navigate(url);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Không thể mở trang cấp quyền Zalo OA."); }
    finally { setBusy(false); onBusyChange?.(false); }
  }
  return <section className="space-y-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-3 text-sm text-on-surface" aria-label="App của kết nối Zalo OA">
    {integration && <div className="flex flex-wrap items-center justify-between gap-2">
      <span>{integration.zaloAppMode === "custom" ? `App riêng: ${integration.zaloAppId}` : "App mặc định của hệ thống"}</span>
      <button type="button" className={secondaryBtnClass} aria-expanded={expanded} aria-controls={`${prefix}-settings`} disabled={busy} onClick={() => setExpanded(value => !value)}>Cấu hình App / Kết nối lại</button>
    </div>}
    {expanded && <div id={`${prefix}-settings`} className="space-y-3" aria-busy={busy}>
      <StyledSelect ariaLabel="App dùng cho OA" value={mode} disabled={busy} onChange={value => { setMode(value as "default" | "custom"); setError(""); setInvalid({}); }}
        options={[{ value: "default", label: "App mặc định của hệ thống" }, { value: "custom", label: "App riêng của doanh nghiệp" }]} />
      {mode === "custom" && <>
        <p className="text-pretty text-xs text-on-surface-variant">Dùng App đã tạo template của OA. Đăng ký callback OAuth và webhook của ERP trên App này trước khi cấp quyền.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {([
            ["appId", "App ID", appId, setAppId, false, false],
            ["appSecret", "App Secret", appSecret, setAppSecret, true, keepAppSecret],
            ["webhookSecret", "Khóa xác minh webhook", webhookSecret, setWebhookSecret, true, keepWebhook],
          ] as const).map(([key, label, value, setter, secret, saved]) => <div key={key} className="space-y-1.5">
            <label htmlFor={`${prefix}-${key}`} className="block text-xs">{label}{saved ? " · Đã lưu" : " *"}</label>
            <input id={`${prefix}-${key}`} type={secret ? "password" : "text"} inputMode={secret ? undefined : "numeric"}
              autoComplete={secret ? "new-password" : "off"} value={value} maxLength={secret ? 2048 : 30} disabled={busy}
              aria-required={!saved} aria-invalid={Boolean(invalid[key])} aria-describedby={invalid[key] ? `${prefix}-${key}-error` : undefined}
              placeholder={saved ? "Để trống để giữ khóa đã lưu" : label} className={fieldInputClass} onChange={event => setter(event.target.value)} />
            {invalid[key] && <p id={`${prefix}-${key}-error`} role="alert" className="text-pretty text-xs text-error">{invalid[key]}</p>}
          </div>)}
        </div>
        {sameApp && <p className="text-pretty text-xs text-on-surface-variant">Khóa đã lưu không hiển thị lại. Chỉ nhập khi cần thay khóa.</p>}
      </>}
      {integration && <p className="text-pretty text-xs text-on-surface-variant">Cấu hình mới chỉ được lưu sau khi cấp quyền thành công cho đúng OA này. Nếu đổi App, các đợt gửi cũ chưa thực hiện sẽ cần kiểm tra lại.</p>}
      <details className="rounded-lg border border-outline-variant p-3 text-xs text-on-surface-variant">
        <summary className="cursor-pointer font-medium text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Quyền cần cấp cho Inbox và template Zalo</summary>
        <div className="mt-2 space-y-2">
          <p className="text-pretty">Chọn và lưu các nhóm quyền trên App trong Zalo Developers trước, rồi cấp quyền cho đúng OA ở màn hình Zalo.</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>Gửi tin OA, gồm template qua UID.</li>
            <li>Đọc và quản lý hội thoại; truy cập thông tin OA và người dùng.</li>
            <li>Đọc danh sách và chi tiết Message Template để đồng bộ mẫu.</li>
            <li>Gửi template qua SĐT và tra cứu kết quả gửi.</li>
            <li>Nhận webhook tin đến, tin gửi, đã nhận/đã đọc qua UID và giao tin qua SĐT.</li>
          </ul>
          <p className="text-pretty">Quyền gửi SĐT và liên kết ZBS cần được thiết lập riêng trên Zalo. Kết nối OA thành công chưa xác nhận đã đủ mọi quyền; sau khi bổ sung quyền, hãy cấp quyền lại và thử đồng bộ mẫu.</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <a href={appSettingsUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Mở cấu hình quyền trên Zalo (tab mới)</a>
            <a href="https://docs.zaloplatforms.com/docs/ZBS/bat-dau/gioi-thieu-ve-cac-nhom-quyen-thuoc-zbs-template-message" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Hướng dẫn quyền ZBS (tab mới)</a>
          </div>
        </div>
      </details>
      {error && <p role="alert" className="text-pretty text-sm text-error">{error}</p>}
      <button type="button" className={primaryCreateButtonClass} disabled={busy} onClick={() => void connect()}>
        {busy ? "Đang mở trang cấp quyền…" : integration ? "Cấp quyền lại cho OA này" : "Kết nối Zalo OA"}
      </button>
    </div>}
  </section>;
}
