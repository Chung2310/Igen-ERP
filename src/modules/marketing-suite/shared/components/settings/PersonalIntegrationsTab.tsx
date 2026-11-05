/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from "react";
import { CheckCircle, Send, ArrowRight } from "lucide-react";
import { authService } from "../../services/authService";
import { toast } from "../../../../../pages/Toast";

export default function PersonalIntegrationsTab() {
  // Telegram States & Handlers
  const [telegramStatus, setTelegramStatus] = useState<any>(null);
  const [loadingTelegram, setLoadingTelegram] = useState(false);
  const [creatingCode, setCreatingCode] = useState(false);
  const [unlinkingTelegram, setUnlinkingTelegram] = useState(false);

  const fetchTelegramStatus = async () => {
    setLoadingTelegram(true);
    try {
      let data = await authService.getTelegramLinkStatus();
      if (!data.linked && !data.pendingCode) {
        data = await authService.createTelegramLinkCode();
      }
      setTelegramStatus(data);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Không thể tải trạng thái Telegram.");
    } finally {
      setLoadingTelegram(false);
    }
  };


  const handleCreateTelegramCode = async () => {
    setCreatingCode(true);
    try {
      const data = await authService.createTelegramLinkCode();
      setTelegramStatus(data);
      toast.success("Đã tạo mã liên kết Telegram mới!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Không thể tạo mã liên kết.");
    } finally {
      setCreatingCode(false);
    }
  };

  const handleUnlinkTelegram = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn hủy liên kết Telegram? Bạn sẽ không nhận được thông báo duyệt bài nữa.")) {
      return;
    }
    setUnlinkingTelegram(true);
    try {
      await authService.unlinkTelegram();
      await fetchTelegramStatus();
      toast.success("Đã hủy liên kết Telegram thành công.");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Không thể hủy liên kết Telegram.");
    } finally {
      setUnlinkingTelegram(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Initialize the legacy connection-status request without changing its loading behavior.
    void fetchTelegramStatus();
  }, []);

  return (
    <div className="space-y-3">
      {/* Telegram Notification integration */}
      <div className="rounded-md border border-outline-variant bg-surface-container-lowest p-4 shadow-xs text-left">
        <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
          <Send className="h-5 w-5 text-primary" aria-hidden="true" />
          <div>
            <h3 className="text-balance text-lg font-semibold text-on-surface">
              Nhận Thông Báo Qua Telegram
            </h3>
            <p className="mt-0.5 text-pretty text-sm text-on-surface-variant">
              Liên kết tài khoản Telegram của bạn để nhận thông báo duyệt bài đăng hoặc báo cáo nhanh từ AI.
            </p>
          </div>
        </div>

        <div className="mt-3">
          {loadingTelegram ? (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : telegramStatus?.linked ? (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/30 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0 shadow-xs">
                  <CheckCircle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    Đã liên kết Telegram thành công
                  </p>
                  <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">
                    User ID: <code className="font-mono">{telegramStatus.telegramUserId}</code> | Chat ID: <code className="font-mono">{telegramStatus.telegramChatId}</code>
                  </p>
                  {telegramStatus.linkedAt && (
                    <p className="text-[9px] text-gray-400 mt-0.5">
                      Liên kết ngày: {new Date(telegramStatus.linkedAt).toLocaleString("vi-VN")}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={handleUnlinkTelegram}
                disabled={unlinkingTelegram}
                className="rounded-xl border border-red-200 bg-white hover:bg-red-50 px-4 py-2 text-xs font-bold text-red-700 transition-all cursor-pointer disabled:opacity-60 shrink-0"
              >
                {unlinkingTelegram ? "Đang hủy..." : "Hủy liên kết"}
              </button>
            </div>
          ) : (
            <div className="rounded-md border border-outline-variant bg-surface-container-lowest p-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-on-surface">
                    Chưa liên kết tài khoản Telegram
                  </p>
                  <p className="mt-1 text-pretty text-xs leading-relaxed text-on-surface-variant">
                    Tạo mã liên kết nhanh sau đó mở bot Telegram để hoàn tất xác thực tài khoản.
                  </p>
                </div>
                {!telegramStatus?.pendingCode && (
                  <button
                    type="button"
                    onClick={handleCreateTelegramCode}
                    disabled={creatingCode}
                    className="rounded-xl bg-sky-600 hover:bg-sky-700 px-4 py-2.5 text-xs font-bold text-white transition-all cursor-pointer disabled:opacity-60"
                  >
                    {creatingCode ? "Đang tạo..." : "Tạo mã liên kết nhanh"}
                  </button>
                )}
              </div>

              {telegramStatus?.pendingCode && (
                <div className="mt-4 border-t border-slate-200/80 pt-4 text-left">
                  <p className="text-sm font-semibold text-on-surface">
                    Mã liên kết của bạn: <span className="font-mono text-sm text-sky-600 bg-sky-50 px-2 py-0.5 rounded border border-sky-100">{telegramStatus.pendingCode}</span>
                  </p>
                  <p className="mt-2 flex items-center gap-1 text-xs leading-relaxed text-on-surface-variant">
                    <ArrowRight size={12} />Hướng dẫn hoàn tất kết nối:
                  </p>
                  <ol className="mt-1.5 list-inside list-decimal space-y-1 text-xs leading-relaxed text-on-surface-variant">
                    <li>Nhấn vào nút <b>Kết nối trực tiếp trên Telegram</b> bên dưới để mở bot.</li>
                    <li>Hoặc tìm kiếm bot <b>@{telegramStatus.botUsername}</b> trên ứng dụng Telegram.</li>
                    <li>Gửi tin nhắn: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-700">/link {telegramStatus.pendingCode}</code> để liên kết.</li>
                  </ol>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <a
                      href={`https://t.me/${telegramStatus.botUsername}?start=${telegramStatus.pendingCode}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 px-4 py-2.5 text-xs font-bold text-white transition-all cursor-pointer"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Kết nối trực tiếp trên Telegram
                    </a>
                    <button
                      type="button"
                      onClick={handleCreateTelegramCode}
                      disabled={creatingCode}
                      className="rounded-xl border border-gray-200 bg-white hover:bg-gray-50 px-4 py-2.5 text-xs font-bold text-gray-600 transition-all cursor-pointer"
                    >
                      Đổi mã khác
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
