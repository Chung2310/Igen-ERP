import React, { useEffect, useState } from "react";
import { legalRequest } from "../../services/legalDocumentService";
interface Result {
  rootNumber: string;
  asOf: string;
  units: { label: string; action: string; sourceNumber: string; sourceUrl: string; text: string }[];
}
export default function LegalEffectiveView({ id, onClose }: { id: string; onClose: () => void }) {
  const [date, setDate] = useState("");
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => {
    setBusy(true);
    setError("");
    try {
      setData(await legalRequest<Result>(`/${id}/effective${date ? `?date=${date}` : ""}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tra cứu.");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void load();
  }, [id]);
  return (
    <section aria-label="Nội dung pháp lý theo thời điểm" className="my-4 rounded-xl border p-4">
      <div className="flex justify-between">
        <h3 className="font-semibold">Nội dung áp dụng — {data?.rootNumber}</h3>
        <button onClick={onClose}>Đóng tra cứu</button>
      </div>
      <p className="my-2 text-sm">
        Bản đối chiếu phục vụ tra cứu, kèm nguồn của từng phần. Nội dung gốc đã bị thay thế được loại khỏi bản này.
      </p>
      <label className="text-sm">
        Ngày tra cứu (để trống = hiện tại)
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mx-2 rounded border p-2" />
      </label>
      <button disabled={busy} onClick={() => void load()}>
        Tra cứu
      </button>
      {error && (
        <p role="alert" className="my-2 text-red-700">
          {error}
        </p>
      )}
      {data && (
        <p className="my-2 text-sm">
          Kết quả tại {new Date(data.asOf).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })} (giờ Việt Nam)
        </p>
      )}
      {data && !data.units.length && <p>Không có nội dung còn hiệu lực hoặc đủ dữ liệu tại ngày đã chọn.</p>}
      <div className="max-h-[65vh] space-y-3 overflow-auto">
        {data?.units.map((unit, index) => (
          <article key={index} className="rounded-lg bg-slate-50 p-3">
            <h4 className="font-medium">
              {unit.label}
              {unit.action === "repeal" ? " — ĐÃ BÃI BỎ" : ""}
            </h4>
            <a href={unit.sourceUrl} target="_blank" rel="noreferrer" className="text-sm text-indigo-700 underline">
              Nguồn: {unit.sourceNumber}
            </a>
            <pre className="mt-2 whitespace-pre-wrap text-sm">{unit.text}</pre>
          </article>
        ))}
      </div>
    </section>
  );
}
