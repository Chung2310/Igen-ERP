import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import * as XLSX from "xlsx";

interface ExcelPreviewProps {
  /** URL proxy download (same-origin, kèm token) để tải nội dung file */
  downloadHref: string;
  fileName: string;
  /** Gọi khi không tải/parse được file — cha sẽ hiển thị fallback tải xuống */
  onError: () => void;
}

interface SheetData {
  name: string;
  rows: (string | number | boolean | null)[][];
}

/** Giới hạn số dòng/cột render để tránh treo trình duyệt với file lớn */
const MAX_ROWS = 500;
const MAX_COLS = 50;

/** Xem trước file Excel/CSV: tải file qua proxy, parse bằng SheetJS và render dạng bảng. */
export const ExcelPreview: React.FC<ExcelPreviewProps> = ({ downloadHref, fileName, onError }) => {
  const [sheets, setSheets] = useState<SheetData[] | null>(null);
  const [activeSheet, setActiveSheet] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("accessToken");
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(downloadHref, { headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buffer = await res.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const parsed: SheetData[] = workbook.SheetNames.map((name) => {
          const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(workbook.Sheets[name], {
            header: 1,
            defval: "",
          });
          return { name, rows: rows.slice(0, MAX_ROWS).map((r) => r.slice(0, MAX_COLS)) };
        });
        if (parsed.length === 0) throw new Error("Workbook không có sheet nào.");
        if (!cancelled) {
          setSheets(parsed);
          setActiveSheet(0);
        }
      } catch (err) {
        console.error("[ExcelPreview] Không đọc được file:", fileName, err);
        if (!cancelled) onError();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [downloadHref]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-300">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!sheets) return null;

  const sheet = sheets[activeSheet] ?? sheets[0];
  const colCount = Math.max(1, ...sheet.rows.map((r) => r.length));

  return (
    <div className="flex h-[80vh] flex-col bg-white">
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-max min-w-full border-collapse text-xs">
          <tbody>
            {sheet.rows.map((row, ri) => (
              <tr key={ri} className={ri === 0 ? "bg-slate-50 font-semibold text-slate-700" : "text-slate-600"}>
                <td className="sticky left-0 border border-slate-200 bg-slate-50 px-2 py-1 text-center text-[10px] text-slate-400">
                  {ri + 1}
                </td>
                {Array.from({ length: colCount }, (_, ci) => (
                  <td key={ci} className="max-w-[280px] truncate border border-slate-200 px-2 py-1">
                    {String(row[ci] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
            {sheet.rows.length === 0 && (
              <tr>
                <td className="p-6 text-center text-slate-400">Sheet trống</td>
              </tr>
            )}
          </tbody>
        </table>
        {sheet.rows.length >= MAX_ROWS && (
          <p className="p-3 text-center text-[11px] text-slate-400">
            Chỉ hiển thị {MAX_ROWS} dòng đầu tiên. Tải xuống để xem đầy đủ.
          </p>
        )}
      </div>
      {sheets.length > 1 && (
        <div className="flex shrink-0 gap-1 overflow-x-auto border-t border-slate-200 bg-slate-50 px-3 py-2">
          {sheets.map((s, i) => (
            <button
              key={s.name}
              onClick={() => setActiveSheet(i)}
              className={`whitespace-nowrap rounded-lg px-3 py-1 text-xs font-semibold ${
                i === activeSheet ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-100"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
