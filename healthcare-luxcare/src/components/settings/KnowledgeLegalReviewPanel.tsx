import React, { useEffect, useState } from "react";
import {
  knowledgeLegalReviewRequest as request,
  type KnowledgeLegalReview,
  type KnowledgeLegalReviewList,
  type KnowledgeLegalReviewDetail,
} from "../../services/knowledgeLegalReviewService";

const statuses: Record<string, string> = {
  suggested: "Chờ đối chiếu",
  using_shared: "Dùng nguồn pháp lý chung",
  current: "Đã rà soát",
  needs_review: "Căn cứ pháp lý đã đổi",
  document_changed: "Tài liệu nội bộ đã đổi",
  dismissed: "Đã bỏ liên kết",
};
const actions: Record<string, string> = {
  copy: "Dùng nguồn chung",
  reference: "Xác nhận căn cứ",
  dismiss: "Bỏ liên kết",
};
const field = "rounded-lg border border-slate-300 px-3 py-2 text-sm w-full";
const button = "rounded-lg border border-indigo-200 px-3 py-2 text-sm text-indigo-700 disabled:opacity-50";

export default function KnowledgeLegalReviewPanel() {
  const [data, setData] = useState<KnowledgeLegalReviewList>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [legalDocumentId, setLegalDocumentId] = useState("");
  const [selected, setSelected] = useState<KnowledgeLegalReview>();
  const [detail, setDetail] = useState<KnowledgeLegalReviewDetail>();
  const [decision, setDecision] = useState("reference");
  const [scope, setScope] = useState("document");
  const [chunks, setChunks] = useState<number[]>([]);
  const [sections, setSections] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const reload = async () => setData(await request<KnowledgeLegalReviewList>());
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể xử lý.");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void run(reload);
  }, []);
  const open = async (row: KnowledgeLegalReview) => {
    setSelected(undefined);
    setDetail(undefined);
    setReviewed(false);
    setNote("");
    const content = await request<KnowledgeLegalReviewDetail>(`/documents/${row.documentId}`);
    if (content.revision !== row.knowledgeRevision) {
      await reload();
      throw new Error("Tài liệu vừa thay đổi. Vui lòng mở lại để rà soát.");
    }
    setDetail(content);
    setSelected(row);
    setDecision(row.relation || (row.matchKind === "identical" ? "copy" : "reference"));
    setScope(row.scope || "document");
    setSections(row.sectionKeys || []);
    setChunks(
      row.status === "document_changed"
        ? []
        : row.chunkIndexes?.length
          ? row.chunkIndexes
          : row.matchedChunkIndexes || [],
    );
  };
  const save = async () => {
    if (!selected || !reviewed || !data?.canManage) return;
    await request(`/${selected.id}/decision`, {
      decision,
      scope: decision === "copy" ? "document" : scope,
      chunkIndexes: decision === "reference" && scope === "chunks" ? chunks : [],
      sectionKeys: decision === "reference" ? sections : [],
      note,
      reviewed,
      knowledgeRevision: selected.knowledgeRevision,
      legalFingerprint: selected.legalFingerprint,
      reviewVersion: selected.reviewVersion,
    });
    setSelected(undefined);
    setDetail(undefined);
    await reload();
    setMessage("Đã lưu kết quả rà soát.");
  };
  return (
    <section aria-label="Rà soát pháp lý" className="rounded-2xl border border-indigo-100 bg-white p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-bold text-lg">Rà soát căn cứ pháp lý</h3>
        <div className="flex gap-2">
          <button
            className={button}
            disabled={busy}
            onClick={() =>
              void run(async () => {
                setSelected(undefined);
                await reload();
              })
            }
          >
            Tải lại
          </button>
          {data?.canManage && (
            <button
              className={button}
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const result = await request<{ scanned: number; matches: number; remaining: number }>("/scan", {});
                  await reload();
                  setMessage(
                    `Đã quét ${result.scanned} tài liệu, tìm thấy ${result.matches} đối chiếu.${result.remaining ? ` Còn ${result.remaining} tài liệu; bấm Quét tiếp để xử lý.` : ""}`,
                  );
                })
              }
            >
              Quét tiếp
            </button>
          )}
        </div>
      </div>
      <p className="text-sm text-slate-600">
        Hệ thống gợi ý từ nội dung trùng hoặc số hiệu văn bản. Gợi ý chưa làm thay đổi nguồn trả lời của AI. Người quản
        lý cần đối chiếu và xác nhận; tài liệu gốc vẫn được lưu.
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-emerald-700">
          {message}
        </p>
      )}
      {busy && (
        <p role="status" className="text-sm">
          Đang xử lý…
        </p>
      )}
      {data?.canManage && (
        <details className="rounded-xl border p-3">
          <summary className="cursor-pointer font-medium text-sm">Thêm đối chiếu thủ công</summary>
          <div className="grid sm:grid-cols-2 gap-3 mt-3">
            <label className="text-sm">
              Tài liệu nội bộ
              <select
                aria-label="Tài liệu nội bộ"
                className={field}
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
              >
                <option value="">Chọn tài liệu</option>
                {data.documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Văn bản pháp lý
              <select
                aria-label="Văn bản pháp lý"
                className={field}
                value={legalDocumentId}
                onChange={(e) => setLegalDocumentId(e.target.value)}
              >
                <option value="">Chọn văn bản</option>
                {data.laws.map((law) => (
                  <option key={law.id} value={law.id}>
                    {law.number} — {law.title}
                  </option>
                ))}
              </select>
            </label>
            <button
              className={button}
              disabled={busy || !documentId || !legalDocumentId}
              onClick={() =>
                void run(async () => {
                  await request("/manual", { documentId, legalDocumentId });
                  await reload();
                  setMessage("Đã thêm đối chiếu. Mở tài liệu để xác nhận cách xử lý.");
                })
              }
            >
              Thêm đối chiếu
            </button>
          </div>
        </details>
      )}
      {data && (
        <>
          <label className="text-sm">
            Trạng thái
            <select
              aria-label="Trạng thái rà soát"
              className={`${field} sm:max-w-xs ml-2`}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="">Tất cả ({data.reviews.length})</option>
              {Object.entries(statuses).map(([value, label]) => (
                <option key={value} value={value}>
                  {label} ({data.reviews.filter((r) => r.status === value).length})
                </option>
              ))}
            </select>
          </label>
          <div className="space-y-2">
            {data.reviews
              .filter((row) => !filter || row.status === filter)
              .map((row) => (
                <article key={row.id} className="border rounded-xl p-3 space-y-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-semibold">{row.documentTitle}</h4>
                      <p className="text-sm">
                        Căn cứ: {row.legalNumber} · {statuses[row.status] || row.status}
                      </p>
                    </div>
                    <button className={button} disabled={busy} onClick={() => void run(() => open(row))}>
                      Mở đối chiếu
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">
                    {row.matchKind === "identical"
                      ? "Trùng nội dung với file pháp lý"
                      : row.matchKind === "manual"
                        ? "Được liên kết thủ công"
                        : "Có nhắc đến số hiệu văn bản"}
                  </p>
                  {row.sample && <p className="text-sm text-slate-600 whitespace-pre-wrap">{row.sample}</p>}
                </article>
              ))}
            {!data.reviews.length && (
              <p className="text-sm text-slate-500">
                Chưa có đối chiếu. Có thể quét tài liệu hoặc thêm liên kết thủ công.
              </p>
            )}
          </div>
        </>
      )}
      {selected && detail && (
        <div
          role="region"
          aria-label="Chi tiết đối chiếu"
          className="border-2 border-indigo-200 rounded-xl p-4 space-y-4"
        >
          <div className="flex justify-between gap-3">
            <h4 className="font-bold">
              {detail.title} · {selected.legalNumber}
            </h4>
            <button className={button} disabled={busy} onClick={() => setSelected(undefined)}>
              Đóng đối chiếu
            </button>
          </div>
          <a className="text-sm text-indigo-700 underline" href="/blog" target="_blank" rel="noreferrer">
            Mở Blog để đối chiếu nguồn pháp lý
          </a>
          {data?.canManage && (
            <>
              <label className="block text-sm">
                Cách xử lý
                <select
                  aria-label="Cách xử lý"
                  className={field}
                  value={decision}
                  disabled={busy}
                  onChange={(e) => {
                    setDecision(e.target.value);
                    setReviewed(false);
                  }}
                >
                  <option value="copy">Đây là bản sao văn bản pháp lý — dùng nguồn chung</option>
                  <option value="reference">Đây là tài liệu nội bộ có căn cứ pháp lý</option>
                  <option value="dismiss">Bỏ liên kết pháp lý này</option>
                </select>
              </label>
              {decision === "copy" && (
                <p className="text-sm text-amber-800">
                  AI sẽ ngừng dùng toàn bộ bản sao này và tra cứu kho pháp lý chung theo hiệu lực. Chỉ chọn nếu tài liệu
                  không chứa hướng dẫn nội bộ cần giữ làm nguồn trả lời.
                </p>
              )}
              {decision === "dismiss" && (
                <p className="text-sm text-amber-800">
                  Liên kết này sẽ ngừng kiểm soát tài liệu. Nội dung có thể được AI sử dụng trở lại nếu không bị một
                  liên kết khác tạm ngừng.
                </p>
              )}
              {decision === "reference" && (
                <div className="space-y-3">
                  {!selected.legalAvailable && (
                    <p role="alert" className="text-sm text-red-700">
                      Căn cứ đã hết hiệu lực hoặc không còn trong phạm vi. Hãy cập nhật tài liệu và liên kết căn cứ mới.
                    </p>
                  )}
                  <label className="block text-sm">
                    Phạm vi nội dung phụ thuộc
                    <select
                      aria-label="Phạm vi nội dung"
                      className={field}
                      value={scope}
                      disabled={busy}
                      onChange={(e) => {
                        setScope(e.target.value);
                        setReviewed(false);
                      }}
                    >
                      <option value="document">Toàn bộ tài liệu</option>
                      <option value="chunks">Các đoạn được chọn bên dưới</option>
                    </select>
                  </label>
                  {selected.sectionChoices.length > 0 && (
                    <fieldset className="text-sm border rounded-lg p-3">
                      <legend>Điều/khoản làm căn cứ (không chọn nghĩa là theo dõi toàn văn)</legend>
                      <div className="flex flex-wrap gap-3">
                        {selected.sectionChoices.map((key) => (
                          <label key={key} className="flex gap-2 items-center">
                            <input
                              type="checkbox"
                              checked={sections.includes(key)}
                              disabled={busy}
                              onChange={(e) => {
                                setSections(e.target.checked ? [...sections, key] : sections.filter((k) => k !== key));
                                setReviewed(false);
                              }}
                            />
                            {key}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  )}
                  <p className="text-sm text-slate-600">
                    Khi căn cứ thay đổi, AI tạm ngừng phần phụ thuộc cho đến khi được rà soát. Chọn theo đoạn sẽ bao gồm
                    đoạn liền kề để tránh sót nội dung giao nhau. Nếu file nội bộ đổi phiên bản, toàn tài liệu tạm ngừng
                    cho đến khi xác nhận lại.
                  </p>
                </div>
              )}
            </>
          )}
          <div className="max-h-80 overflow-auto space-y-2">
            {detail.chunks.map((chunk) => (
              <div key={chunk.chunkIndex} className="rounded-lg border p-3">
                <label className="flex gap-2 text-sm font-medium">
                  {data?.canManage && decision === "reference" && scope === "chunks" && (
                    <input
                      type="checkbox"
                      aria-label={`Theo dõi đoạn ${chunk.chunkIndex + 1}`}
                      checked={chunks.includes(chunk.chunkIndex)}
                      disabled={busy}
                      onChange={(e) => {
                        setChunks(
                          e.target.checked
                            ? [...chunks, chunk.chunkIndex]
                            : chunks.filter((n) => n !== chunk.chunkIndex),
                        );
                        setReviewed(false);
                      }}
                    />
                  )}
                  Đoạn {chunk.chunkIndex + 1}
                </label>
                <p className="text-sm whitespace-pre-wrap text-slate-600">{chunk.text}</p>
              </div>
            ))}
          </div>
          {data?.canManage && (
            <>
              <label className="block text-sm">
                Ghi chú rà soát
                <textarea
                  aria-label="Ghi chú rà soát"
                  maxLength={2000}
                  className={field}
                  value={note}
                  disabled={busy}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
              <label className="flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={reviewed}
                  disabled={busy}
                  onChange={(e) => setReviewed(e.target.checked)}
                />
                Tôi đã đối chiếu nội dung và xác nhận cách xử lý trên.
              </label>
              <button
                className={`${button} bg-indigo-50`}
                disabled={
                  busy ||
                  !reviewed ||
                  (decision === "reference" && (!selected.legalAvailable || (scope === "chunks" && !chunks.length)))
                }
                onClick={() => void run(save)}
              >
                Lưu kết quả rà soát
              </button>
            </>
          )}
          <details>
            <summary className="text-sm cursor-pointer">Lịch sử rà soát</summary>
            <ul className="text-sm space-y-2 mt-2">
              {selected.history.map((item, i) => (
                <li key={i}>
                  {new Date(item.at).toLocaleString("vi-VN")} · {actions[item.action] || item.action} · {item.actor}
                  {item.note ? `: ${item.note}` : ""}
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </section>
  );
}
