import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, Save, Video } from "lucide-react";
import { ConfirmDialog } from "../../../../../components/common/ConfirmDialog";
import { cn } from "../../../../student-management/lib/utils";
import { authService } from "../../services/authService";
import type { CompanyHeyGenConfig } from "../../types";

type BusyState = "loading" | "saving" | "clearing" | null;

export default function CompanyHeyGenConfigCard({
  canEdit,
  companyCode,
}: {
  canEdit: boolean;
  companyCode: string;
}) {
  const [config, setConfig] = useState<CompanyHeyGenConfig | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [busy, setBusy] = useState<BusyState>("loading");
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  async function loadConfig() {
    setBusy("loading");
    setLoadError("");
    try {
      setConfig(await authService.getCompanyHeyGenConfig());
    } catch (loadFailure) {
      setLoadError(loadFailure instanceof Error ? loadFailure.message : "Không thể tải cấu hình HeyGen.");
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    void loadConfig();
  }, [companyCode]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedApiKey = apiKey.trim();
    if (!normalizedApiKey) {
      setError("Nhập API Key HeyGen trước khi lưu.");
      return;
    }
    setBusy("saving");
    setError("");
    try {
      setConfig(await authService.updateCompanyHeyGenConfig(normalizedApiKey));
      setApiKey("");
    } catch (saveFailure) {
      setError(saveFailure instanceof Error ? saveFailure.message : "Không thể lưu API Key HeyGen.");
    } finally {
      setBusy(null);
    }
  }

  async function clearConfig() {
    setBusy("clearing");
    setError("");
    try {
      setConfig(await authService.clearCompanyHeyGenConfig());
      setApiKey("");
      setConfirmClear(false);
    } catch (clearFailure) {
      setError(clearFailure instanceof Error ? clearFailure.message : "Không thể xóa API Key HeyGen.");
    } finally {
      setBusy(null);
    }
  }

  if (busy === "loading" && !config) {
    return (
      <div role="status" className="rounded-md border border-outline-variant bg-surface-container-lowest p-4 text-sm text-on-surface-variant">
        Đang tải cấu hình HeyGen...
      </div>
    );
  }

  const statusText = config?.hasCompanyApiKey
    ? "Đã cấu hình API Key riêng cho doanh nghiệp. Key được lưu mã hóa và dùng trong HeyGen Studio."
    : config?.hasEnvironmentKey
      ? "Chưa có key riêng cho doanh nghiệp. HEYGEN_API_KEY của máy chủ đã được cấu hình làm key dự phòng."
      : "Chưa có API Key HeyGen cho doanh nghiệp.";

  return (
    <section aria-busy={busy !== null} className="space-y-3 rounded-md border border-outline-variant bg-surface-container-lowest p-4 shadow-xs">
      <div className="flex items-start gap-3 text-left">
        <Video className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <h3 data-typography="section-title" className="text-sm font-semibold text-on-surface">HeyGen</h3>
          <p className="mt-1 text-xs text-on-surface-variant">
            Cấu hình API Key dùng chung cho <span className="font-medium text-on-surface">{config?.companyName || companyCode}</span>.
          </p>
        </div>
      </div>

      {loadError ? (
        <div className="space-y-2">
          <p role="alert" className="text-sm text-error">{loadError}</p>
          <button
            type="button"
            onClick={() => void loadConfig()}
            className="min-h-10 rounded-md border border-outline-variant px-3 text-sm font-medium text-on-surface hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary"
          >
            Tải lại
          </button>
        </div>
      ) : (
        <>
          <p
            role="status"
            className={cn(
              "rounded-md border px-3 py-2 text-sm text-pretty",
              config?.hasCompanyApiKey
                ? "border-outline-variant bg-surface-container-low text-on-surface"
                : "border-outline-variant bg-surface-container-low text-on-surface-variant",
            )}
          >
            {statusText}
          </p>

          <form onSubmit={save} className="space-y-3 text-left">
            <label htmlFor="company-heygen-api-key" className="block space-y-1 text-sm font-medium text-on-surface">
              API Key HeyGen
              <div className="relative">
                <input
                  id="company-heygen-api-key"
                  type={showApiKey ? "text" : "password"}
                  autoComplete="new-password"
                  value={apiKey}
                  disabled={!canEdit || busy !== null}
                  onChange={(event) => {
                    setApiKey(event.target.value);
                    setError("");
                  }}
                  placeholder={config?.hasCompanyApiKey ? "Đã lưu — để trống nếu không thay đổi" : "Nhập API Key HeyGen"}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "company-heygen-api-key-help company-heygen-api-key-error" : "company-heygen-api-key-help"}
                  className="min-h-10 w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2 pr-11 text-sm text-on-surface outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
                />
                <button
                  type="button"
                  aria-label={showApiKey ? "Ẩn API Key HeyGen" : "Hiện API Key HeyGen"}
                  aria-pressed={showApiKey}
                  disabled={!canEdit || busy !== null}
                  onClick={() => setShowApiKey((visible) => !visible)}
                  className="absolute right-1 top-1 flex size-8 items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {showApiKey
                    ? <EyeOff className="size-4" aria-hidden="true" />
                    : <Eye className="size-4" aria-hidden="true" />}
                </button>
              </div>
            </label>
            <p id="company-heygen-api-key-help" className="text-xs text-on-surface-variant">
              Key được mã hóa trong cấu hình công ty. Để trống khi không đổi; chỉ quản trị viên được cập nhật.
            </p>
            {error && <p id="company-heygen-api-key-error" role="alert" className="text-sm text-error">{error}</p>}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant pt-3">
              {canEdit && config?.hasCompanyApiKey ? (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  disabled={busy !== null}
                  className="min-h-10 rounded-md border border-outline-variant px-3 text-sm font-medium text-on-surface-variant hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Xóa key doanh nghiệp
                </button>
              ) : <span />}
              {canEdit && (
                <button
                  type="submit"
                  disabled={busy !== null || !apiKey.trim()}
                  className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-on-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save className="size-4" aria-hidden="true" />
                  {busy === "saving" ? "Đang lưu..." : "Lưu API Key"}
                </button>
              )}
            </div>
          </form>
        </>
      )}

      <ConfirmDialog
        appearance="erp"
        native
        isOpen={confirmClear}
        isSubmitting={busy === "clearing"}
        title={"Xóa API Key HeyGen của " + (config?.companyName || companyCode) + "?"}
        description="HeyGen Studio sẽ chuyển sang dùng HEYGEN_API_KEY của máy chủ nếu biến này được cấu hình."
        confirmLabel={busy === "clearing" ? "Đang xóa..." : "Xóa key"}
        onClose={() => setConfirmClear(false)}
        onConfirm={clearConfig}
      />
    </section>
  );
}