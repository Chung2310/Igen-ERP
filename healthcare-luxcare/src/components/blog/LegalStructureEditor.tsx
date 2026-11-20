import React, { useEffect, useState } from "react";
import { legalRequest, type LegalSection, type LegalStructure } from "../../services/legalDocumentService";

export default function LegalStructureEditor({
  id,
  onSaved,
  onClose,
}: {
  id: string;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [data, setData] = useState<LegalStructure | null>(null);
  const [sections, setSections] = useState<LegalSection[]>([]);
  const [selection, setSelection] = useState<{ index: number; offset: number } | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    void legalRequest<LegalStructure>(`/${id}/structure`)
      .then((result) => {
        setData(result);
        setSections(result.sections);
      })
      .catch((e) => setError(e.message));
  }, [id]);
  const change = (value: LegalSection[]) => {
    setSections(value);
    setReviewed(false);
  };
  const split = (index: number) => {
    if (selection?.index !== index) return;
    const section = sections[index];
    const point = section.start + selection.offset;
    if (point <= section.start || point >= section.end) return;
    let key = `${section.key.slice(0, 80)}-phan-2`;
    while (sections.some((s) => s.key === key)) key += "x";
    change([
      ...sections.slice(0, index),
      { ...section, end: point },
      { ...section, key, label: `${section.label.slice(0, 160)} (phần tiếp)`, start: point },
      ...sections.slice(index + 1),
    ]);
    setSelection(null);
  };
  const save = async () => {
    if (!data) return;
    setBusy(true);
    setError("");
    try {
      await legalRequest(`/${id}/structure`, {
        method: "PUT",
        body: JSON.stringify({
          sections,
          updatedAt: data.document.updatedAt,
          sourceRevision: data.sourceRevision,
          reviewed,
        }),
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể lưu cấu trúc.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      aria-label="Kiểm tra cấu trúc điều khoản"
      className="my-4 rounded-xl border border-indigo-300 bg-indigo-50 p-4"
    >
      <div className="flex justify-between">
        <h3 className="font-semibold">Kiểm tra cấu trúc điều/khoản {data?.document.number}</h3>
        <button onClick={onClose}>Đóng cấu trúc</button>
      </div>
      <p className="my-2 text-sm">
        Các ranh giới dưới đây được gợi ý từ tiêu đề và số khoản. Hãy kiểm tra cả phần trích dẫn, phụ lục và nội dung
        dẫn nhập. Mỗi phần chỉ gồm đúng nội dung đang hiển thị; khi sửa cả một điều có nhiều phần, cần đối chiếu tất cả
        phần liên quan.
      </p>
      {error && (
        <p role="alert" className="my-2 text-red-700">
          {error}
        </p>
      )}
      {!data && !error && <p>Đang đọc file nguồn…</p>}
      {data && !data.canEdit && (
        <p className="my-2 text-sm">Cấu trúc đã duyệt được giữ cố định để bảo toàn các tham chiếu sửa đổi.</p>
      )}
      <div className="max-h-[65vh] space-y-3 overflow-auto">
        {data &&
          sections.map((section, index) => (
            <div key={index} className="rounded-lg border bg-white p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-sm">
                  Mã phần {index + 1}
                  <input
                    disabled={!data.canEdit || busy}
                    value={section.key}
                    className="w-full rounded border p-2"
                    onChange={(e) => change(sections.map((s, i) => (i === index ? { ...s, key: e.target.value } : s)))}
                  />
                </label>
                <label className="text-sm">
                  Tên phần {index + 1}
                  <input
                    disabled={!data.canEdit || busy}
                    value={section.label}
                    className="w-full rounded border p-2"
                    onChange={(e) =>
                      change(sections.map((s, i) => (i === index ? { ...s, label: e.target.value } : s)))
                    }
                  />
                </label>
              </div>
              <textarea
                aria-label={`Nội dung phần ${index + 1}`}
                readOnly
                value={data.text.slice(section.start, section.end)}
                rows={6}
                className="my-2 w-full rounded border p-2 text-sm"
                onSelect={(e) => setSelection({ index, offset: e.currentTarget.selectionEnd })}
              />
              {data.canEdit && (
                <div className="flex gap-3 text-sm">
                  <button
                    disabled={
                      busy ||
                      selection?.index !== index ||
                      !selection.offset ||
                      selection.offset >= section.end - section.start
                    }
                    onClick={() => split(index)}
                  >
                    Tách tại vị trí con trỏ
                  </button>
                  <button
                    disabled={busy || index === sections.length - 1}
                    onClick={() =>
                      change(
                        sections.flatMap((s, i) =>
                          i === index ? [{ ...s, end: sections[index + 1].end }] : i === index + 1 ? [] : [s],
                        ),
                      )
                    }
                  >
                    Gộp với phần tiếp
                  </button>
                </div>
              )}
            </div>
          ))}
      </div>
      {data?.canEdit && (
        <div className="mt-3">
          <label className="flex gap-2 text-sm">
            <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} />
            Tôi đã kiểm tra mã, tên và ranh giới từng phần; nội dung vẫn đầy đủ và đúng file nguồn.
          </label>
          <button
            disabled={busy || !reviewed}
            onClick={() => void save()}
            className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-white disabled:opacity-50"
          >
            Lưu cấu trúc đã kiểm tra
          </button>
        </div>
      )}
    </section>
  );
}
