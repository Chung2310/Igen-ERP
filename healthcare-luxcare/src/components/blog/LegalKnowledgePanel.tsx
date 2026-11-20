import React, { useEffect, useState } from "react";
import {
  legalRequest,
  downloadLegalSource,
  type LegalDocument,
  type LegalList,
} from "../../services/legalDocumentService";
import type { BlogPostItem } from "../../services/blogService";
import LegalStructureEditor from "./LegalStructureEditor";
import LegalAmendmentEditor from "./LegalAmendmentEditor";
import LegalEffectiveView from "./LegalEffectiveView";
import KnowledgeProcessingStatus from "../knowledge/KnowledgeProcessingStatus";

const empty = {
  number: "",
  title: "",
  issuer: "",
  issuedAt: "",
  effectiveFrom: "",
  effectiveTo: "",
  sourceUrl: "",
  applicability: "",
  companyCodes: "",
  replaces: "",
};
const date = (value: string) => new Date(value).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
const inputClass = "w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900";
export default function LegalKnowledgePanel({
  posts,
  onClose,
  initialPostId = "",
}: {
  posts: BlogPostItem[];
  onClose: () => void;
  initialPostId?: string;
}) {
  const [data, setData] = useState<LegalList>({ canManage: false, canApprove: false, documents: [] });
  const [form, setForm] = useState(empty);
  const [postId, setPostId] = useState(initialPostId);
  const [filterPost, setFilterPost] = useState(Boolean(initialPostId));
  const [editing, setEditing] = useState<LegalDocument | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<{
    document: LegalDocument;
    chunks: { text: string; chunkIndex: number }[];
  } | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [withdrawId, setWithdrawId] = useState("");
  const [reason, setReason] = useState("");
  const [structureId, setStructureId] = useState("");
  const [amendment, setAmendment] = useState<LegalDocument | null>(null);
  const [effectiveId, setEffectiveId] = useState("");
  const load = async () => setData(await legalRequest<LegalList>());
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [busy, onClose]);
  useEffect(() => {
    if (!data.documents.some((d) => d.status === "draft" && ["queued", "processing"].includes(d.indexingStatus || "")))
      return;
    const timer = setInterval(() => {
      void load().catch((e) => setError(e.message));
    }, 5000);
    return () => clearInterval(timer);
  }, [data.documents]);
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Thao tác thất bại.");
    } finally {
      setBusy(false);
    }
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const metadata = {
        ...form,
        companyCodes: form.companyCodes
          .split(",")
          .map((c) => c.trim().toUpperCase())
          .filter(Boolean),
        effectiveTo: form.effectiveTo || undefined,
        replaces: form.replaces || undefined,
        amends: editing?.amends,
        sectionChanges: editing?.sectionChanges || [],
      };
      if (editing) {
        await legalRequest(`/${editing._id}`, {
          method: "PATCH",
          body: JSON.stringify({ metadata, updatedAt: editing.updatedAt }),
        });
      } else {
        if (!file || !postId) throw new Error("Chọn bài đăng và file pháp lý.");
        if (file.size > 10 * 1024 * 1024) throw new Error("File tối đa 10 MB.");
        const body = new FormData();
        body.set("postId", postId);
        body.set("file", file);
        body.set("metadata", JSON.stringify(metadata));
        await legalRequest("", { method: "POST", body });
      }
      setEditing(null);
      setPreview(null);
      setForm(empty);
      setFile(null);
      setFileInputKey((key) => key + 1);
      setPostId("");
      setNotice(
        editing
          ? "Đã lưu thông tin. Mở lại nội dung để kiểm tra trước khi duyệt."
          : "Đã tiếp nhận file. Chờ xử lý, sau đó xem nội dung và duyệt để AI sử dụng.",
      );
      await load();
    });
  };
  const status = (d: LegalDocument) =>
    d.status === "draft"
      ? "Chờ duyệt"
      : d.status === "withdrawn"
        ? "Đã thu hồi"
        : new Date(d.effectiveFrom) > new Date()
          ? "Chờ ngày hiệu lực"
          : d.current
            ? "Đang áp dụng"
            : "Lưu trữ / ngoài phạm vi doanh nghiệp đang xem";
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Kho pháp lý chung"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-3 sm:p-8"
    >
      <div className="mx-auto max-w-5xl rounded-2xl bg-white p-5 text-slate-900 shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Kho pháp lý chung</h2>
          <button onClick={onClose} className="rounded-lg border px-3 py-2">
            Đóng
          </button>
        </div>
        <p className="my-3 text-sm text-slate-600">
          Tài liệu đã duyệt được AI sử dụng theo phạm vi và ngày hiệu lực. File gắn với bài blog; thu hồi tài liệu được
          quản lý riêng.
        </p>
        {error && (
          <p role="alert" className="my-3 rounded-lg bg-red-50 p-3 text-red-700">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="my-3 rounded-lg bg-green-50 p-3 text-green-800">
            {notice}
          </p>
        )}
        {data.canManage && (
          <form onSubmit={submit} className="my-4 rounded-xl border bg-slate-50 p-4">
            <h3 className="mb-3 font-semibold">
              {editing ? "Sửa thông tin bản chờ duyệt" : "Thêm file pháp lý vào bài đăng"}
            </h3>
            <label className="block text-sm">
              Bài blog đã đăng
              <select
                disabled={Boolean(editing)}
                required
                value={postId}
                onChange={(e) => setPostId(e.target.value)}
                className={inputClass}
              >
                <option value="">Chọn bài đăng</option>
                {posts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title || p.content.slice(0, 100) || p.authorName}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["number", "Số hiệu văn bản", "text"],
                  ["title", "Tên văn bản", "text"],
                  ["issuer", "Cơ quan ban hành", "text"],
                  ["issuedAt", "Ngày ban hành", "date"],
                  ["effectiveFrom", "Ngày bắt đầu hiệu lực", "date"],
                  ["effectiveTo", "Ngày hết hiệu lực (nếu có)", "date"],
                  ["sourceUrl", "Đường dẫn nguồn chính thức (HTTPS)", "url"],
                  ["applicability", "Mô tả phạm vi áp dụng", "text"],
                  ["companyCodes", "Mã doanh nghiệp, cách nhau bằng dấu phẩy; để trống = tất cả", "text"],
                ] as const
              ).map(([key, label, type]) => (
                <label key={key} className="text-sm">
                  {label}
                  <input
                    className={inputClass}
                    type={type}
                    value={form[key]}
                    required={!["effectiveTo", "companyCodes"].includes(key)}
                    maxLength={
                      key === "sourceUrl" || key === "applicability" ? 2000 : key === "companyCodes" ? 25000 : 300
                    }
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  />
                </label>
              ))}
              <label className="text-sm">
                Thay thế toàn bộ văn bản
                <select
                  value={form.replaces}
                  onChange={(e) => setForm({ ...form, replaces: e.target.value })}
                  className={inputClass}
                >
                  <option value="">Văn bản độc lập, không thay thế</option>
                  {data.documents
                    .filter((d) => d.approvedAt)
                    .map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.number} — {d.title}
                      </option>
                    ))}
                </select>
              </label>
              {!editing && (
                <label className="text-sm">
                  File nguồn (tối đa 10 MB)
                  <input
                    key={fileInputKey}
                    className={inputClass}
                    type="file"
                    accept=".pdf,.docx,.txt,.md"
                    required
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                </label>
              )}
            </div>
            <p className="my-3 text-sm text-amber-800">
              Nếu chỉ sửa một phần: tải file trước, kiểm tra “Cấu trúc điều/khoản”, rồi chọn “Đối chiếu sửa đổi” để chỉ
              rõ phần bị tác động. Ngày hiệu lực tính theo giờ Việt Nam.
            </p>
            <button disabled={busy} className="rounded-lg bg-indigo-600 px-4 py-2 text-white disabled:opacity-50">
              {busy ? "Đang xử lý…" : editing ? "Lưu thông tin" : "Tải file và tạo bản chờ duyệt"}
            </button>
            {editing && (
              <button
                type="button"
                className="ml-4"
                onClick={() => {
                  setEditing(null);
                  setForm(empty);
                  setPostId("");
                }}
              >
                Hủy sửa
              </button>
            )}
          </form>
        )}
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Văn bản pháp lý</h3>
          <button disabled={busy} onClick={() => void run(load)} className="rounded border px-3 py-1">
            Làm mới
          </button>
        </div>
        {initialPostId && (
          <label className="my-2 flex gap-2 text-sm">
            <input type="checkbox" checked={filterPost} onChange={(e) => setFilterPost(e.target.checked)} />
            Chỉ xem tài liệu của bài đăng đã chọn
          </label>
        )}
        {!data.documents.length && (
          <p className="py-5 text-sm text-slate-500">Chưa có văn bản trong phạm vi được xem.</p>
        )}
        <div className="my-3 space-y-3">
          {data.documents
            .filter((d) => !filterPost || d.postId === initialPostId)
            .map((d) => (
              <article key={d._id} className="rounded-xl border p-4">
                <h4 className="font-semibold">
                  {d.number} — {d.title}
                </h4>
                <p className="text-sm text-indigo-700">
                  {status(d)}
                  {d.status === "draft"
                    ? ` · ${({ queued: "Chờ xử lý file", processing: "Đang đọc file", indexed: "Đã đọc file", failed: "Xử lý file thất bại" } as Record<string, string>)[d.indexingStatus || ""] || "Chưa có chỉ mục"}`
                    : ""}
                </p>
                {d.indexingStatus && (
                  <div className="my-2 max-w-md">
                    <KnowledgeProcessingStatus
                      status={d.indexingStatus}
                      progress={d.indexingProgress}
                      completedLabel={d.status === "approved" ? "Đã duyệt" : "Đã xử lý · Chờ duyệt"}
                    />
                  </div>
                )}
                <p className="my-2 text-sm">
                  {d.issuer} · Hiệu lực: {date(d.effectiveFrom)}
                  {d.effectiveTo ? ` đến trước ${date(d.effectiveTo)}` : ""}
                  <br />
                  {d.applicability}
                  <br />
                  Doanh nghiệp: {d.companyCodes.join(", ") || "Toàn hệ thống"}
                </p>
                <p className="text-xs text-slate-500">
                  Bài blog:{" "}
                  {posts.find((p) => p.id === d.postId)?.title ||
                    posts.find((p) => p.id === d.postId)?.content.slice(0, 100) ||
                    d.postId}
                </p>
                {d.indexingError && <p className="text-sm text-red-700">{d.indexingError}</p>}
                {d.withdrawalReason && <p className="text-sm">Lý do thu hồi: {d.withdrawalReason}</p>}
                <div className="mt-3 flex flex-wrap gap-3 text-sm">
                  <a href={d.sourceUrl} target="_blank" rel="noreferrer" className="text-indigo-700 underline">
                    Nguồn chính thức
                  </a>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        setPreview(await legalRequest(`/${d._id}`));
                        setReviewed(false);
                      })
                    }
                    className="text-indigo-700 underline"
                  >
                    Xem nội dung / duyệt
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      setStructureId(d._id);
                      setAmendment(null);
                    }}
                    className="text-indigo-700 underline"
                  >
                    Cấu trúc điều/khoản
                  </button>
                  {(data.canManage || d.amends) && (
                    <button
                      disabled={busy}
                      onClick={() => {
                        setAmendment(d);
                        setStructureId("");
                      }}
                      className="text-indigo-700 underline"
                    >
                      Đối chiếu sửa đổi
                    </button>
                  )}
                  {d.approvedAt && (
                    <button disabled={busy} onClick={() => setEffectiveId(d._id)} className="text-indigo-700 underline">
                      Nội dung áp dụng theo ngày
                    </button>
                  )}
                  <button
                    disabled={busy}
                    onClick={() => void run(() => downloadLegalSource(d._id))}
                    className="text-indigo-700 underline"
                  >
                    Tải file gốc
                  </button>
                  {data.canManage && d.status === "draft" && (
                    <button
                      disabled={busy}
                      onClick={() => {
                        const localDate = (v: string) =>
                          new Date(new Date(v).getTime() + 7 * 3600000).toISOString().slice(0, 10);
                        setEditing(d);
                        setPostId(d.postId);
                        setForm({
                          number: d.number,
                          title: d.title,
                          issuer: d.issuer,
                          issuedAt: localDate(d.issuedAt),
                          effectiveFrom: localDate(d.effectiveFrom),
                          effectiveTo: d.effectiveTo ? localDate(d.effectiveTo) : "",
                          sourceUrl: d.sourceUrl,
                          applicability: d.applicability,
                          companyCodes: d.companyCodes.join(", "),
                          replaces: d.replaces || "",
                        });
                      }}
                    >
                      Sửa thông tin
                    </button>
                  )}
                  {data.canManage && d.status === "draft" && d.indexingStatus === "failed" && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await legalRequest(`/${d._id}/retry`, { method: "POST" });
                          await load();
                        })
                      }
                    >
                      Thử xử lý lại
                    </button>
                  )}
                  {data.canApprove && d.status !== "withdrawn" && (
                    <button
                      disabled={busy}
                      className="text-red-700"
                      onClick={() => {
                        setWithdrawId(d._id);
                        setReason("");
                      }}
                    >
                      Thu hồi
                    </button>
                  )}
                </div>
              </article>
            ))}
        </div>
        {withdrawId && (
          <div className="my-4 rounded-xl border border-red-200 p-4">
            <label className="text-sm">
              Lý do thu hồi
              <textarea
                className={inputClass}
                maxLength={2000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <p className="my-2 text-sm">Thu hồi không tự khôi phục văn bản cũ đã bị thay thế.</p>
            <button
              disabled={busy || !reason.trim()}
              className="mr-4 text-red-700"
              onClick={() =>
                void run(async () => {
                  await legalRequest(`/${withdrawId}/withdraw`, { method: "POST", body: JSON.stringify({ reason }) });
                  setWithdrawId("");
                  setPreview(null);
                  await load();
                })
              }
            >
              Xác nhận thu hồi
            </button>
            <button onClick={() => setWithdrawId("")}>Hủy</button>
          </div>
        )}
        {structureId && (
          <LegalStructureEditor
            key={structureId}
            id={structureId}
            onClose={() => setStructureId("")}
            onSaved={() => {
              setStructureId("");
              setPreview(null);
              void run(async () => {
                await load();
                setNotice("Đã lưu cấu trúc điều/khoản. Mở lại nội dung để duyệt phiên bản mới nhất.");
              });
            }}
          />
        )}
        {amendment && (
          <LegalAmendmentEditor
            key={amendment._id}
            document={amendment}
            documents={data.documents}
            onClose={() => setAmendment(null)}
            onSaved={() => {
              setAmendment(null);
              setPreview(null);
              void run(async () => {
                await load();
                setNotice("Đã lưu đối chiếu. Người duyệt cần kiểm tra các phần cũ và mới trước khi công bố.");
              });
            }}
          />
        )}
        {effectiveId && <LegalEffectiveView key={effectiveId} id={effectiveId} onClose={() => setEffectiveId("")} />}
        {preview && (
          <section className="my-4 rounded-xl border border-indigo-200 p-4">
            <h3 className="font-semibold">
              Kiểm tra: {preview.document.number} — {preview.document.title}
            </h3>
            <p className="my-2 text-sm">
              Hiệu lực: {date(preview.document.effectiveFrom)} · {preview.document.applicability} · Doanh nghiệp:{" "}
              {preview.document.companyCodes.join(", ") || "Toàn hệ thống"}
            </p>
            <p className="my-2 text-sm">
              Thay thế: {data.documents.find((d) => d._id === preview.document.replaces)?.number || "Không"}
            </p>
            {preview.document.amends && (
              <div className="my-3 rounded border bg-indigo-50 p-3 text-sm">
                <p>Sửa đổi văn bản: {data.documents.find((d) => d._id === preview.document.amends)?.number}</p>
                <ul className="mt-2 list-disc pl-5">
                  {preview.document.sectionChanges?.map((change) => (
                    <li key={change.targetKey}>
                      {change.action === "repeal" ? "Bãi bỏ" : change.action === "add" ? "Bổ sung" : "Thay nội dung"}:{" "}
                      {change.targetLabel}; nguồn mới: {change.sourceKeys.join(", ")}; phiên bản trước:{" "}
                      {data.documents.find((d) => d._id === change.previousAmendmentId)?.number || "Văn bản gốc"}.
                    </li>
                  ))}
                </ul>
                <button className="mt-2 underline" onClick={() => setAmendment(preview.document)}>
                  Xem đối chiếu nội dung cũ và mới
                </button>
              </div>
            )}
            <div className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded bg-slate-50 p-3 text-sm">
              {preview.chunks.map((c) => (
                <p className="mb-3" key={c.chunkIndex}>
                  {c.text}
                </p>
              ))}
              {!preview.chunks.length && "Chưa có nội dung. Chờ xử lý file hoặc thử lại nếu có lỗi."}
            </div>
            {data.canApprove && preview.document.status === "draft" && preview.chunks.length > 0 && (
              <div className="mt-3">
                <label className="flex gap-2 text-sm">
                  <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} />
                  Tôi đã kiểm tra file gốc, nội dung trích xuất, ngày hiệu lực, doanh nghiệp áp dụng và toàn bộ quan hệ
                  thay thế hoặc đối chiếu điều/khoản.
                </label>
                <button
                  disabled={busy || !reviewed}
                  className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-white disabled:opacity-50"
                  onClick={() =>
                    void run(async () => {
                      await legalRequest(`/${preview.document._id}/approve`, {
                        method: "POST",
                        body: JSON.stringify({ reviewed: true, reviewedUpdatedAt: preview.document.updatedAt }),
                      });
                      setPreview(null);
                      setNotice("Đã duyệt. AI sử dụng văn bản khi đến ngày hiệu lực.");
                      await load();
                    })
                  }
                >
                  Duyệt văn bản
                </button>
              </div>
            )}
            <button className="mt-3 text-sm underline" onClick={() => setPreview(null)}>
              Đóng nội dung
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
