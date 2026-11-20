import React, { useEffect, useState } from "react";
import { AiSharingNotice } from "../AiSharingNotice";
import { useAiSharing } from "../../hooks/useAiSharing";
import { useAuth } from "../../context/AuthContext";
import {
  legalRequest,
  type LegalDocument,
  type LegalSectionChange,
  type LegalStructure,
} from "../../services/legalDocumentService";

export default function LegalAmendmentEditor({
  document,
  documents,
  onSaved,
  onClose,
}: {
  document: LegalDocument;
  documents: LegalDocument[];
  onSaved: () => void;
  onClose: () => void;
}) {
  const { userProfile } = useAuth();
  const sharing = useAiSharing("company", `${userProfile?.uid}:${userProfile?.companyCode}`);
  const [rootId, setRootId] = useState(document.amends || "");
  const [changes, setChanges] = useState<LegalSectionChange[]>(document.sectionChanges || []);
  const [sources, setSources] = useState<Record<string, LegalStructure>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<LegalSectionChange & { sourceQuote: string }>>([]);
  const editable = document.status === "draft";
  const load = async (id: string) => {
    const result = await legalRequest<LegalStructure>(`/${id}/structure`);
    setSources((old) => ({ ...old, [id]: result }));
  };
  useEffect(() => {
    void load(document._id).catch((e) => setError(e.message));
  }, [document._id]);
  useEffect(() => {
    if (rootId) void load(rootId).catch((e) => setError(e.message));
  }, [rootId]);
  useEffect(() => {
    for (const id of new Set(
      document.sectionChanges?.map((c) => c.previousAmendmentId).filter((id): id is string => Boolean(id)),
    ))
      void load(id).catch((e) => setError(e.message));
  }, [document._id]);
  const source = sources[document._id];
  const root = sources[rootId];
  const priorDocuments = documents.filter((d) => d.approvedAt && d.amends === rootId && d._id !== document._id);
  const targets = new Map((root?.sections || []).map((s) => [s.key, s.label]));
  priorDocuments.forEach((d) => d.sectionChanges?.forEach((c) => targets.set(c.targetKey, c.targetLabel)));
  const update = (index: number, patch: Partial<LegalSectionChange>) =>
    setChanges((old) => old.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  const save = async () => {
    setError("");
    setBusy(true);
    try {
      await legalRequest(`/${document._id}/amendment`, {
        method: "PATCH",
        body: JSON.stringify({ amends: rootId, sectionChanges: changes, updatedAt: document.updatedAt }),
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể lưu đối chiếu.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-label="Đối chiếu sửa đổi điều khoản" className="my-4 rounded-xl border border-indigo-300 p-4">
      <div className="flex justify-between">
        <h3 className="font-semibold">Đối chiếu sửa đổi — {document.number}</h3>
        <button onClick={onClose}>Đóng đối chiếu</button>
      </div>
      {error && (
        <p role="alert" className="my-2 text-red-700">
          {error}
        </p>
      )}
      <p className="my-2 text-sm">
        Chọn phần bị tác động và phần trong file mới làm căn cứ. Với bãi bỏ, chọn đoạn ghi rõ việc bãi bỏ. Bản sửa đổi
        tiếp theo phải trỏ đúng văn bản đã sửa phần đó trước đây.
      </p>
      <label className="text-sm">
        Văn bản gốc được sửa đổi
        <select
          disabled={!editable || busy}
          value={rootId}
          className="my-2 w-full rounded border p-2"
          onChange={(e) => {
            setRootId(e.target.value);
            setChanges([]);
            setSuggestions([]);
          }}
        >
          <option value="">Không phải văn bản sửa đổi</option>
          {documents
            .filter((d) => d.approvedAt && !d.amends && d._id !== document._id)
            .map((d) => (
              <option key={d._id} value={d._id}>
                {d.number} — {d.title}
              </option>
            ))}
        </select>
      </label>
      {(!source?.saved || (rootId && !root?.saved)) && (
        <p className="my-2 text-amber-800">
          Cần mở “Cấu trúc điều/khoản” và lưu cấu trúc đã kiểm tra của cả văn bản gốc và file mới trước khi duyệt sửa
          đổi.
        </p>
      )}
      {changes.map((change, index) => {
        const priors = priorDocuments.filter((d) => d.sectionChanges?.some((c) => c.targetKey === change.targetKey));
        const prior = documents.find((d) => d._id === change.previousAmendmentId);
        const priorChange = prior?.sectionChanges?.find((c) => c.targetKey === change.targetKey);
        const oldSource = sources[change.previousAmendmentId || rootId];
        const oldKeys = priorChange?.sourceKeys || [change.targetKey];
        return (
          <div key={index} className="my-3 rounded-lg border bg-slate-50 p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                Loại thay đổi {index + 1}
                <select
                  disabled={!editable || busy}
                  className="w-full rounded border p-2"
                  value={change.action}
                  onChange={(e) =>
                    update(index, {
                      action: e.target.value as LegalSectionChange["action"],
                      targetKey: "",
                      targetLabel: "",
                      previousAmendmentId: undefined,
                    })
                  }
                >
                  <option value="replace">Sửa đổi / thay nội dung</option>
                  <option value="repeal">Bãi bỏ</option>
                  <option value="add">Bổ sung phần mới</option>
                </select>
              </label>
              {change.action === "add" ? (
                <label className="text-sm">
                  Mã phần mới
                  <input
                    disabled={!editable || busy}
                    className="w-full rounded border p-2"
                    placeholder="dieu-5/khoan-3"
                    value={change.targetKey}
                    onChange={(e) => update(index, { targetKey: e.target.value })}
                  />
                </label>
              ) : (
                <label className="text-sm">
                  Phần bị tác động {index + 1}
                  <select
                    disabled={!editable || busy}
                    className="w-full rounded border p-2"
                    value={change.targetKey}
                    onChange={(e) =>
                      update(index, {
                        targetKey: e.target.value,
                        targetLabel: targets.get(e.target.value) || "",
                        previousAmendmentId: undefined,
                      })
                    }
                  >
                    <option value="">Chọn điều/khoản</option>
                    {[...targets].map(([key, label]) => (
                      <option key={key} value={key}>
                        {label} ({key})
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="text-sm">
                Tên phần được đối chiếu {index + 1}
                <input
                  disabled={!editable || busy}
                  className="w-full rounded border p-2"
                  value={change.targetLabel}
                  onChange={(e) => update(index, { targetLabel: e.target.value })}
                />
              </label>
              <label className="text-sm">
                Phiên bản trước {index + 1}
                <select
                  disabled={!editable || busy || change.action === "add"}
                  className="w-full rounded border p-2"
                  value={change.previousAmendmentId || ""}
                  onChange={(e) => {
                    update(index, { previousAmendmentId: e.target.value || undefined });
                    if (e.target.value) void load(e.target.value).catch((error) => setError(error.message));
                  }}
                >
                  <option value="">Nội dung trong văn bản gốc</option>
                  {priors.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.number} — hiệu lực {new Date(d.effectiveFrom).toLocaleDateString("vi-VN")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm sm:col-span-2">
                Phần nguồn trong file mới {index + 1} (có thể chọn nhiều)
                <select
                  multiple
                  size={5}
                  disabled={!editable || busy}
                  className="w-full rounded border p-2"
                  value={change.sourceKeys}
                  onChange={(e) =>
                    update(index, { sourceKeys: Array.from(e.target.selectedOptions, (option) => option.value) })
                  }
                >
                  {source?.sections.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label} ({s.key})
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <h4 className="text-sm font-medium">Nội dung trước</h4>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-xs">
                  {oldSource
                    ? oldSource.sections
                        .filter((s) => oldKeys.includes(s.key))
                        .map((s) => oldSource.text.slice(s.start, s.end))
                        .join("\n")
                    : "Chọn phiên bản trước để xem nội dung."}
                </pre>
              </div>
              <div>
                <h4 className="text-sm font-medium">Nội dung / căn cứ mới</h4>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-xs">
                  {source?.sections
                    .filter((s) => change.sourceKeys.includes(s.key))
                    .map((s) => source.text.slice(s.start, s.end))
                    .join("\n")}
                </pre>
              </div>
            </div>
            {editable && (
              <button
                disabled={busy}
                className="mt-2 text-sm text-red-700"
                onClick={() => setChanges(changes.filter((_, i) => i !== index))}
              >
                Bỏ đối chiếu {index + 1}
              </button>
            )}
          </div>
        );
      })}
      {editable && <AiSharingNotice sharing={sharing} />}
      {editable && (
        <div className="mt-3 flex gap-3">
          <button
            disabled={busy || !sharing.accepted || !rootId || !source?.saved || !root?.saved}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const result = await legalRequest<{
                  suggestions: Array<LegalSectionChange & { sourceQuote: string }>;
                  reviewedUpdatedAt: string;
                }>(`/${document._id}/suggest-amendment`, { method: "POST", body: JSON.stringify({ rootId }) });
                if (result.reviewedUpdatedAt !== document.updatedAt)
                  throw new Error("Văn bản đã đổi. Mở lại đối chiếu trước khi dùng gợi ý.");
                setSuggestions(result.suggestions);
                if (!result.suggestions.length) setError("AI chưa tìm được đối chiếu đủ căn cứ. Hãy chọn thủ công.");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Không thể gợi ý đối chiếu.");
              } finally {
                setBusy(false);
              }
            }}
          >
            AI gợi ý đối chiếu
          </button>
          <span className="text-xs text-slate-500">AI doanh nghiệp, dùng chung hạn mức của tài khoản.</span>
          <button
            disabled={busy || !rootId || !source?.saved || !root?.saved}
            onClick={() =>
              setChanges([...changes, { action: "replace", targetKey: "", targetLabel: "", sourceKeys: [] }])
            }
          >
            Thêm điều/khoản bị tác động
          </button>
          <button
            disabled={busy}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-white disabled:opacity-50"
            onClick={() => void save()}
          >
            Lưu đối chiếu
          </button>
        </div>
      )}
      {suggestions.length > 0 && (
        <div className="my-3 rounded border border-amber-300 bg-amber-50 p-3">
          <p className="text-sm">
            Đây là gợi ý chưa được lưu. Kiểm tra trích dẫn rồi thêm từng đối chiếu vào bản chờ duyệt.
          </p>
          {suggestions.map((suggestion, index) => (
            <div key={index} className="my-2 border-t pt-2 text-sm">
              <p>
                {suggestion.targetLabel} —{" "}
                {suggestion.action === "repeal" ? "Bãi bỏ" : suggestion.action === "add" ? "Bổ sung" : "Sửa đổi"}
              </p>
              <blockquote className="my-2 whitespace-pre-wrap">{suggestion.sourceQuote}</blockquote>
              <button
                disabled={busy || changes.some((c) => c.targetKey === suggestion.targetKey)}
                onClick={() => {
                  const { sourceQuote: _quote, ...change } = suggestion;
                  setChanges([...changes, change]);
                  if (change.previousAmendmentId)
                    void load(change.previousAmendmentId).catch((e) => setError(e.message));
                }}
              >
                Thêm vào đối chiếu để kiểm tra
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
