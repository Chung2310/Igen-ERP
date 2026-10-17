import { useEffect, useState } from "react";
import { HardDrive, Trash2, CheckCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { toast } from "../../pages/Toast";
import { getAccessToken } from "../../services/authService";
import { ConfirmDialog } from "../common/ConfirmDialog";

/**
 * Kết nối Google Drive cá nhân — tách riêng khỏi tab MXH (đang ẩn) để người dùng
 * vẫn có thể liên kết Drive phục vụ upload/đồng bộ tài nguyên.
 */
export default function GoogleDriveTab() {
  const { userProfile, refreshProfile } = useAuth();
  const userProfileAny = userProfile as any;
  const [connectingGoogleDrive, setConnectingGoogleDrive] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    const handleGoogleDriveMessage = async (event: MessageEvent) => {
      const isAllowedOrigin =
        event.origin === window.location.origin ||
        event.origin.includes("localhost:") ||
        event.origin.includes("127.0.0.1:");
      if (!isAllowedOrigin) return;

      if (event.data?.type === "GOOGLE_DRIVE_CONNECTED") {
        toast.success(`Đã kết nối Google Drive cá nhân thành công!`);
        void refreshProfile();
        window.location.reload();
      } else if (event.data?.type === "GOOGLE_DRIVE_FAILED") {
        toast.error(event.data.error || "Kết nối Google Drive cá nhân thất bại.");
      }
    };
    window.addEventListener("message", handleGoogleDriveMessage);
    return () => window.removeEventListener("message", handleGoogleDriveMessage);
  }, [refreshProfile]);

  const handleGoogleDriveOAuth = async () => {
    setConnectingGoogleDrive(true);
    try {
      localStorage.removeItem("google_drive_oauth_result");
      const res = await fetch("/api/v1/integrations/google-drive/auth-url", {
        headers: { Authorization: `Bearer ${getAccessToken()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Không thể lấy link xác thực Google.");

      const authUrl = data.authUrl;
      const width = 600;
      const height = 650;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      const oauthWindow = window.open(
        authUrl,
        "GoogleDriveOAuthPopup",
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,scrollbars=yes`
      );

      if (!oauthWindow) {
        throw new Error("Trình duyệt đang chặn cửa sổ popup. Vui lòng cho phép popup để kết nối.");
      }

      const checkInterval = setInterval(() => {
        if (oauthWindow.closed) {
          clearInterval(checkInterval);
          setConnectingGoogleDrive(false);
          // Polling check to automatically reload if connection succeeded
          setTimeout(async () => {
            try {
              const meRes = await fetch("/api/v1/auth/me", {
                headers: { Authorization: `Bearer ${getAccessToken()}` },
              });
              const meData = await meRes.json();
              if (meRes.ok && meData.user?.googleDriveIntegration?.isConnected) {
                toast.success(`Đã kết nối Google Drive cá nhân thành công!`);
                window.location.reload();
              }
            } catch (err) {
              console.error("Lỗi khi kiểm tra kết nối Google Drive:", err);
            }
          }, 600);
        }
      }, 800);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Không thể kết nối Google Drive.");
      setConnectingGoogleDrive(false);
    }
  };

  const handleDisconnectGoogleDrive = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/v1/integrations/google-drive/disconnect", {
        method: "POST",
        headers: { Authorization: `Bearer ${getAccessToken()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Không thể ngắt kết nối.");
      toast.success("Đã ngắt kết nối Google Drive cá nhân.");
      setShowDisconnectConfirm(false);
      void refreshProfile();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Không ngắt kết nối được. Vui lòng thử lại.");
    } finally {
      setDisconnecting(false);
    }
  };

  const isConnected = userProfileAny?.googleDriveIntegration?.isConnected;

  return (
    <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-2 border-b border-slate-100 pb-4 text-left">
        <HardDrive className="mt-0.5 h-4 w-4 text-brand-primary" />
        <div>
          <h3 className="text-base font-medium text-slate-800">Google Drive</h3>
          <p className="mt-1 text-sm font-normal text-slate-500">
            Liên kết tài khoản Google Drive cá nhân để upload và đồng bộ trực tiếp ảnh/video từ ERP.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3 rounded-xl border border-sky-100 bg-sky-50/50 p-4 text-left">
        {isConnected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
              <CheckCircle className="h-4 w-4" />
              Đã kết nối Google Drive
            </div>
            <div className="rounded-xl border border-sky-100 bg-white p-3 text-sm font-normal text-slate-700">
              <p className="text-xs font-medium text-slate-500">Email đã liên kết</p>
              <p className="mt-1 truncate font-mono text-xs">
                {userProfileAny?.googleDriveIntegration?.driveEmail}
              </p>
            </div>
            <button
              onClick={() => setShowDisconnectConfirm(true)}
              className="inline-flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white text-sm font-medium text-rose-600 transition hover:bg-rose-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Ngắt kết nối Google Drive
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm leading-5 text-slate-600">
              Chưa có tài khoản Google Drive nào được liên kết cho tài khoản hiện tại.
            </p>
            <button
              onClick={handleGoogleDriveOAuth}
              disabled={connectingGoogleDrive}
              className="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 text-sm font-medium text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <HardDrive className="h-3.5 w-3.5" />
              {connectingGoogleDrive ? "Đang mở popup..." : "Kết nối Google Drive"}
            </button>
          </>
        )}
      </div>

      <ConfirmDialog
        isOpen={showDisconnectConfirm}
        title="Ngắt kết nối Google Drive cá nhân?"
        description={`Sau khi ngắt kết nối${userProfileAny?.googleDriveIntegration?.driveEmail ? ` tài khoản ${userProfileAny.googleDriveIntegration.driveEmail}` : ""}, bạn sẽ không upload hoặc đồng bộ được tài nguyên lên Google Drive nữa. Các file đã upload vẫn được giữ nguyên trong Drive của bạn. Bạn có thể kết nối lại bất cứ lúc nào.`}
        confirmLabel="Ngắt kết nối"
        cancelLabel="Giữ kết nối"
        tone="danger"
        isSubmitting={disconnecting}
        onClose={() => setShowDisconnectConfirm(false)}
        onConfirm={handleDisconnectGoogleDrive}
      />
    </div>
  );
}
