import React, { useEffect, useState } from "react";
import { legalRequest, type LegalDocument, type LegalList } from "../../services/legalDocumentService";
import KnowledgeProcessingStatus from "../knowledge/KnowledgeProcessingStatus";

/** Stays mounted below the channel conversation when the upload dialog closes. */
export default function LegalKnowledgeProgress() {
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const data = await legalRequest<LegalList>();
        if (alive) {
          setDocuments(
            data.canManage
              ? data.documents.filter(
                  (doc) =>
                    doc.status === "draft" &&
                    (["queued", "processing", "failed"].includes(doc.indexingStatus || "") ||
                      (doc.indexingStatus === "indexed" &&
                        Date.now() - new Date(doc.indexingProgress?.updatedAt || doc.updatedAt).getTime() <
                          15 * 60_000)),
                )
              : [],
          );
          setUnavailable(false);
        }
      } catch {
        if (alive) setUnavailable(true);
      } finally {
        if (alive) timer = setTimeout(refresh, 3000);
      }
    };
    void refresh();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);
  const visible = documents.filter(
    (doc) => !dismissed.has(`${doc._id}:${doc.indexingStatus}:${doc.indexingProgress?.updatedAt || doc.updatedAt}`),
  );
  if (!visible.length) return null;
  return (
    <section
      aria-label="Tiến độ kho tri thức chung"
      className="shrink-0 border-t border-indigo-100 bg-indigo-50/60 p-3 dark:border-slate-700 dark:bg-slate-800"
    >
      <h3 className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
        Tiến độ xử lý tài liệu · Kho chung
      </h3>
      {unavailable && (
        <p role="alert" className="mb-2 text-xs text-amber-700">
          Chưa cập nhật được tiến độ. Đang thử kết nối lại…
        </p>
      )}
      <div className="max-h-40 space-y-2 overflow-y-auto">
        {visible.map((doc) => (
          <div
            key={doc._id}
            className="rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="mb-1.5 flex items-start justify-between gap-2">
              <span className="truncate text-xs font-medium text-slate-700 dark:text-slate-200" title={doc.title}>
                {doc.title}
              </span>
              {["failed", "indexed"].includes(doc.indexingStatus || "") && (
                <button
                  type="button"
                  aria-label={`Ẩn tiến độ ${doc.title}`}
                  onClick={() =>
                    setDismissed((previous) =>
                      new Set(previous).add(
                        `${doc._id}:${doc.indexingStatus}:${doc.indexingProgress?.updatedAt || doc.updatedAt}`,
                      ),
                    )
                  }
                  className="text-xs text-slate-500"
                >
                  Ẩn
                </button>
              )}
            </div>
            <KnowledgeProcessingStatus
              status={doc.indexingStatus}
              progress={doc.indexingProgress}
              completedLabel="Đã xử lý · Chờ duyệt để AI sử dụng"
            />
            {doc.indexingStatus === "failed" && doc.indexingError && (
              <p className="mt-1 text-xs text-rose-600">{doc.indexingError}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
