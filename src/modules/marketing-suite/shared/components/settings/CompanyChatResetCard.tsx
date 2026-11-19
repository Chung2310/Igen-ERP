import { useState } from "react";
import { ConfirmDialog } from "../../../../../components/common/ConfirmDialog";
import { socialIntegrationService } from "../../services/socialIntegrationService";

export default function CompanyChatResetCard({ companyCode, companyName }: { companyCode: string; companyName?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const company = companyName ? `${companyName} (${companyCode})` : companyCode;

  async function confirmReset() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError("");
    try {
      const { conversationCount, messageCount } = await socialIntegrationService.resetCompanyChat(companyCode);
      setResult(conversationCount || messageCount
        ? `Đã xóa ${conversationCount.toLocaleString("vi-VN")} hội thoại và ${messageCount.toLocaleString("vi-VN")} tin nhắn.`
        : "Dữ liệu chat đã được dọn.");
      setIsOpen(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Không thể xóa dữ liệu chat. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <details className="rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface">
      <summary className="cursor-pointer rounded-lg px-4 py-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-primary">
        Quản lý dữ liệu chat
      </summary>
      <div className="space-y-3 border-t border-outline-variant px-4 py-3">
        <button
          type="button"
          className="min-h-10 cursor-pointer rounded-md border border-outline-variant px-3 text-sm font-medium text-error hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-error"
          onClick={() => {
            setError("");
            setResult("");
            setIsOpen(true);
          }}
        >
          Xóa dữ liệu chat
        </button>
        <div role="status" className="text-sm text-on-surface-variant tabular-nums empty:hidden">{result}</div>
      </div>
      <ConfirmDialog
        appearance="erp"
        native
        isOpen={isOpen}
        isSubmitting={isSubmitting}
        title={`Xóa dữ liệu chat của ${company}?`}
        description="Hội thoại và tin nhắn đã lưu trong ERP từ các kênh thuộc doanh nghiệp này, cùng lịch sử chat thử, sẽ bị xóa vĩnh viễn."
        confirmLabel="Xóa vĩnh viễn"
        error={error}
        onClose={() => setIsOpen(false)}
        onConfirm={confirmReset}
      />
    </details>
  );
}
