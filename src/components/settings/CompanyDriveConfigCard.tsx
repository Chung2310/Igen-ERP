import React, { useCallback, useEffect, useRef, useState } from "react";
import { HardDrive, ExternalLink, Loader2, Lock, CheckCircle2, Link2, Unlink } from "lucide-react";
import { toast } from "../../pages/Toast";
import { authService } from "../../services/authService";

interface CompanyDriveConfigCardProps {
  userProfile: any;
}

/**
 * Kết nối Google Drive riêng của từng công ty qua OAuth.
 * Chỉ admin/superadmin được kết nối/ngắt; dùng ở tab "Tài nguyên → Google Drive".
 */
export default function CompanyDriveConfigCard({ userProfile }: CompanyDriveConfigCardProps) {
  const companyCode = userProfile?.companyCode || "";
  const canEdit = userProfile?.role === "admin" || userProfile?.role === "superadmin";

  const [connected, setConnected] = useState(false);
  const [email, setEmail] = useState("");
  const [folderLink, setFolderLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const popupRef = useRef<Window | null>(null);

  const loadConfig = useCallback(async () => {
    if (!companyCode) return;
    setLoading(true);
    try {
      const config = await authService.getCompanyDriveConfig(companyCode);
      setConnected(config.driveConnected);
      setEmail(config.driveConnectedEmail || "");
      setFolderLink(config.driveFolderLink || "");
    } catch (err: any) {
      console.error("[CompanyDriveConfigCard] load error:", err);
    } finally {
      setLoading(false);
    }
  }, [companyCode]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Nhận kết quả OAuth từ popup
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "GOOGLE_DRIVE_OAUTH_RESULT") {
        setConnecting(false);
        if (event.data.ok) {
          toast.success(`Đã kết nối Google Drive: ${event.data.message || ""}`);
          loadConfig();
        } else {
          toast.error(event.data.message || "Kết nối Google Drive thất bại.");
        }
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [loadConfig]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const url = await authService.getDriveOAuthUrl(companyCode);
      const w = 560;
      const h = 680;
      const left = window.screen.width / 2 - w / 2;
      const top = window.screen.height / 2 - h / 2;
      popupRef.current = window.open(
        url,
        "GoogleDriveOAuthPopup",
        `width=${w},height=${h},left=${left},top=${top},status=no,resizable=yes,scrollbars=yes`
      );
      if (!popupRef.current) {
        throw new Error("Trình duyệt đang chặn popup. Vui lòng cho phép popup và thử lại.");
      }
      // Fallback: theo dõi localStorage phòng khi postMessage bị chặn
      const timer = setInterval(() => {
        const raw = localStorage.getItem("gdrive_oauth_result");
        if (raw) {
          clearInterval(timer);
          localStorage.removeItem("gdrive_oauth_result");
          try {
            const payload = JSON.parse(raw);
            setConnecting(false);
            if (payload.ok) {
              toast.success(`Đã kết nối Google Drive: ${payload.message || ""}`);
              loadConfig();
            } else {
              toast.error(payload.message || "Kết nối Google Drive thất bại.");
            }
          } catch { /* ignore */ }
        }
        if (popupRef.current?.closed) {
          clearInterval(timer);
          setConnecting(false);
        }
      }, 800);
    } catch (err: any) {
      toast.error(err.message || "Không mở được cửa sổ kết nối Google Drive.");
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await authService.disconnectCompanyDrive(companyCode);
      toast.success("Đã ngắt kết nối Google Drive.");
      setConnected(false);
      setEmail("");
      setFolderLink("");
    } catch (err: any) {
      toast.error(err.message || "Không ngắt kết nối được.");
    } finally {
      setDisconnecting(false);
    }
  };

  if (!companyCode) return null;

  return (
    <div className="bg-white/80 backdrop-blur-md border border-gray-200/80 rounded-2xl p-6 shadow-xs">
      <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4 mb-4">
        <div className="text-left">
          <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-blue-600" />
            Google Drive của công ty
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Kết nối tài khoản Google Drive <strong>của riêng công ty này</strong>. Tài liệu ở mục{" "}
            <strong>Tài nguyên → Google Drive</strong> sẽ được tải thẳng vào Drive của công ty.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải trạng thái...
        </div>
      ) : (
        <div className="space-y-4 text-left">
          {connected ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-green-800">Đã kết nối Google Drive</p>
                <p className="text-xs text-green-700 truncate">{email || "Tài khoản Google"}</p>
              </div>
              <div className="flex items-center gap-2">
                {folderLink && (
                  <a
                    href={folderLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-green-300 bg-white px-3 py-2 text-xs font-bold text-green-700 hover:bg-green-100 transition"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Mở thư mục
                  </a>
                )}
                {canEdit && (
                  <button
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                  >
                    {disconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />}
                    Ngắt kết nối
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gray-700">Chưa kết nối Google Drive</p>
                <p className="text-xs text-gray-500">Kết nối để tải tài liệu công ty lên Google Drive.</p>
              </div>
              {canEdit ? (
                <button
                  onClick={handleConnect}
                  disabled={connecting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 px-4 py-2.5 text-sm font-bold text-white shadow-md transition cursor-pointer"
                >
                  {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                  {connecting ? "Đang kết nối..." : "Kết nối Google Drive"}
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  <Lock className="h-3.5 w-3.5" /> Chỉ admin được kết nối
                </span>
              )}
            </div>
          )}

          <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-3 py-2.5 text-[11px] leading-relaxed text-blue-800/90">
            <p className="font-bold mb-1">Cách hoạt động:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Bấm <strong>Kết nối Google Drive</strong> và đăng nhập tài khoản Google của công ty.</li>
              <li>Hệ thống tự tạo một thư mục riêng trong Drive của công ty để chứa tài liệu.</li>
              <li>File tải lên ở tab Tài nguyên sẽ nằm trong Drive của chính công ty (đúng dung lượng của công ty).</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
