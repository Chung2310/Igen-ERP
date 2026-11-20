import React, { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ShieldAlert, X, FileText, Pill, AlertOctagon } from "lucide-react";
import { verifySpotCheckDocument } from "../../services/assistantKnowledgeService";
import { toast } from "../../pages/Toast";

export interface MedicalAuditFlag {
  id: string;
  type: "dosage_anomaly" | "ocr_glitch" | "contraindication_highlight" | "table_structure";
  severity: "low" | "medium" | "high";
  snippet: string;
  message: string;
  suggestedCorrection?: string;
  reviewStatus?: "confirmed";
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
}

export interface MedicalSpotCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: {
    _id: string;
    title: string;
    auditFlags?: MedicalAuditFlag[];
    auditStatus?: string;
    contentHash: string;
  } | null;
  onVerified: () => void;
}

export const MedicalSpotCheckModal: React.FC<MedicalSpotCheckModalProps> = ({
  isOpen,
  onClose,
  document,
  onVerified,
}) => {
  const [verifying, setVerifying] = useState(false);
  const [flags, setFlags] = useState<MedicalAuditFlag[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  useEffect(() => {
    setFlags(document?.auditFlags || []);
    setNotes({});
  }, [document, isOpen]);

  if (!isOpen || !document) return null;

  const pendingFlags = flags.filter((f) => f.reviewStatus !== "confirmed");
  const highSeverityCount = pendingFlags.filter((f) => f.severity === "high").length;

  const handleVerify = async (flag?: MedicalAuditFlag) => {
    setVerifying(true);
    try {
      const result = await verifySpotCheckDocument(document._id, {
        contentHash: document.contentHash,
        flagIds: flag ? [flag.id] : pendingFlags.map((item) => item.id),
        note: flag ? notes[flag.id] || "" : "",
      });
      setFlags(result.auditFlags);
      toast.success("Đã xác nhận nội dung đúng. Nội dung tài liệu được giữ nguyên.");
      onVerified();
      if (!flag) onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không thể xác nhận kiểm tra.");
    } finally {
      setVerifying(false);
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case "high":
        return (
          <span className="px-2 py-0.5 text-xs font-semibold rounded bg-rose-100 text-rose-700 border border-rose-200">
            Rủi ro cao (Cần đối chiếu)
          </span>
        );
      case "medium":
        return (
          <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-100 text-amber-700 border border-amber-200">
            Nghi vấn OCR
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-100 text-blue-700 border border-blue-200">
            Lưu ý quan trọng
          </span>
        );
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "dosage_anomaly":
        return <Pill className="w-5 h-5 text-rose-600" />;
      case "ocr_glitch":
        return <AlertOctagon className="w-5 h-5 text-amber-600" />;
      default:
        return <ShieldAlert className="w-5 h-5 text-blue-600" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-800">
                Spot-check nội dung tài liệu
              </h3>
              <p className="text-xs text-slate-500 line-clamp-1">
                Tài liệu: <span className="font-medium text-slate-700">{document.title}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={verifying}
            aria-label="Đóng"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Banner */}
        <div className="px-6 py-3 bg-amber-50/60 border-b border-amber-100 flex items-center gap-2 text-xs text-amber-800">
          <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
          <span>
            Còn {pendingFlags.length} điểm cần xem lại ({highSeverityCount} điểm mức độ cao).
            Cảnh báo và gợi ý không có nghĩa là nội dung sai. Hãy đối chiếu bản gốc; nếu nội dung đã đúng, chọn xác nhận để giữ nguyên.
          </span>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {flags.map((flag, idx) => (
            <div
              key={flag.id || idx}
              className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-shadow shadow-xs space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getIcon(flag.type)}
                  <span className="font-medium text-xs text-slate-800">{flag.message}</span>
                </div>
                {flag.reviewStatus === "confirmed" ? <span className="text-xs font-semibold text-emerald-700">Đã xác nhận</span> : getSeverityBadge(flag.severity)}
              </div>

              {/* Snippet Context */}
              <div className="bg-slate-50 rounded-lg p-2.5 text-xs text-slate-700 font-mono border border-slate-200/70">
                <span className="text-slate-400 select-none">Trích dẫn: </span>
                <span className="font-semibold text-slate-900 bg-amber-100/70 px-1 py-0.5 rounded">
                  {flag.snippet}
                </span>
              </div>

              {flag.suggestedCorrection && (
                <div className="text-xs text-emerald-700 flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Gợi ý cần đối chiếu: <strong>{flag.suggestedCorrection}</strong></span>
                </div>
              )}
              {flag.reviewStatus === "confirmed" ? (
                <p className="text-xs text-emerald-700">
                  Giữ nguyên nội dung.{flag.reviewedBy && ` Người xác nhận: ${flag.reviewedBy}.`}
                  {flag.reviewedAt && ` ${new Date(flag.reviewedAt).toLocaleString("vi-VN")}.`}
                  {flag.reviewNote && ` Ghi chú: ${flag.reviewNote}`}
                </p>
              ) : (
                <div className="space-y-2 pt-2">
                  <input
                    aria-label={`Ghi chú cho điểm ${idx + 1}`}
                    placeholder="Lý do xác nhận (không bắt buộc)"
                    maxLength={1000}
                    value={notes[flag.id] || ""}
                    disabled={verifying}
                    onChange={(event) => setNotes((current) => ({ ...current, [flag.id]: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                  />
                  <button type="button" disabled={verifying} onClick={() => handleVerify(flag)} className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
                    Xác nhận nội dung đúng
                  </button>
                </div>
              )}
            </div>
          ))}

          {flags.length === 0 && (
            <div className="py-8 text-center text-slate-500 text-sm">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              Tài liệu không có cờ cảnh báo bất thường nào.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <button
            onClick={onClose}
            disabled={verifying}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Để xem lại sau
          </button>
          <button
            onClick={() => pendingFlags.length ? handleVerify() : onClose()}
            disabled={verifying}
            className="px-5 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            {verifying ? "Đang xác nhận..." : pendingFlags.length ? "Xác nhận tất cả nội dung đúng" : "Hoàn tất"}
          </button>
        </div>
      </div>
    </div>
  );
};
