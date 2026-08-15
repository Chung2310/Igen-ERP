import React from "react";
import { getApiErrorMessage } from "../../../utils/errorMessage";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  Loader2,
  Play,
  Upload,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "../../../pages/Toast";
import type {
  BulkWorkerInput,
  WorkerLaborType,
  WorkerBulkImportResult,
  WorkerProjectSummary,
} from "../types";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onImport: (rows: BulkWorkerInput[], projectId?: string, sourceFile?: File) => Promise<WorkerBulkImportResult>;
  projects?: WorkerProjectSummary[];
};

export type WorkerImportRow = {
  rowNum: number;
  data: BulkWorkerInput;
  isValid: boolean;
  errors: string[];
};

const DATE_PATTERN = /^([0-2][0-9]|3[0-1])\/(0[1-9]|1[0-2])\/\d{4}$/;

const TEMPLATE_HEADERS = [
  "Họ và tên",
  "Số điện thoại",
  "Mã đối tác giới thiệu",
  "Ngày sinh",
  "CCCD / CMND",
  "Email",
  "Địa chỉ",
  "Ngày tiếp nhận",
  "Loại lao động",
  "Quốc tịch",
  "Số GPLĐ / visa",
  "Ngày hết hạn GPLĐ / visa",
  "Ghi chú",
];

/** Cùng quy tắc với normalizeLaborType phía server, để xem trước khớp dữ liệu lưu. */
export function normalizeImportLaborType(value: unknown): WorkerLaborType {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "official" || raw === "seasonal" || raw === "foreign") return raw;
  if (raw.includes("thời vụ") || raw.includes("thoi vu")) return "seasonal";
  if (raw.includes("nước ngoài") || raw.includes("nuoc ngoai")) return "foreign";
  return "official";
}

/**
 * Mirror the server's normalizeWorkerPhone so the preview shows exactly what
 * will be stored, and in-file duplicate detection matches the server's.
 */
export function normalizeImportPhone(value: unknown): string {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("84") && digits.length === 11) digits = `0${digits.slice(2)}`;
  if (/^[1-9]\d{8}$/.test(digits)) digits = `0${digits}`;
  return digits;
}

function mapHeaders(row: unknown[]): Record<string, number> {
  const map: Record<string, number> = {};
  row.forEach((cell, index) => {
    if (cell === null || cell === undefined) return;
    const value = String(cell).trim().toLowerCase();
    if (!value) return;
    if (value.includes("họ và tên") || value.includes("họ tên") || value.includes("ho ten") || value === "tên" || value === "ten") map.fullName = index;
    else if (value.includes("số điện thoại") || value.includes("điện thoại") || value.includes("dien thoai") || value === "sdt" || value === "sđt") map.phone = index;
    else if (value.includes("mã đối tác") || value.includes("ma doi tac") || value.includes("partner code")) map.partnerCode = index;
    else if (value.includes("ngày sinh") || value.includes("ngay sinh") || value.includes("năm sinh")) map.birthday = index;
    else if (value.includes("cccd") || value.includes("cmnd") || value.includes("định danh") || value.includes("dinh danh")) map.idCard = index;
    else if (value.includes("email")) map.email = index;
    else if (value.includes("địa chỉ") || value.includes("dia chi") || value.includes("nơi ở")) map.address = index;
    else if (value.includes("ngày tiếp nhận") || value.includes("ngay tiep nhan") || value.includes("tiếp nhận")) map.registrationDate = index;
    else if (value.includes("loại lao động") || value.includes("loai lao dong")) map.laborType = index;
    else if (value.includes("quốc tịch") || value.includes("quoc tich")) map.nationality = index;
    else if (value.includes("hết hạn") || value.includes("het han")) map.workPermitExpiry = index;
    else if (value.includes("gplđ") || value.includes("gpld") || value.includes("giấy phép") || value.includes("giay phep") || value.includes("visa")) map.workPermitNumber = index;
    else if (value.includes("ghi chú") || value.includes("ghi chu")) map.note = index;
  });
  return map;
}

/**
 * Turn a raw sheet (first row = headers) into preview rows. Exported so the
 * parsing and validation rules can be tested without driving the file input.
 */
export function parseWorkerSheet(sheet: unknown[][]): { rows: WorkerImportRow[]; error?: string } {
  if (!sheet.length) return { rows: [], error: "File Excel không có dữ liệu hoặc thiếu tiêu đề cột." };

  const headers = mapHeaders(sheet[0] || []);
  const missing: string[] = [];
  if (headers.fullName === undefined) missing.push("Họ và tên");
  if (headers.phone === undefined) missing.push("Số điện thoại");
  if (missing.length) {
    return { rows: [], error: `File thiếu các cột bắt buộc sau: ${missing.join(", ")}` };
  }

  const rows: WorkerImportRow[] = [];
  const seenPhones = new Set<string>();

  for (let index = 1; index < sheet.length; index += 1) {
    const row = sheet[index];
    const isBlank =
      !row || row.every((cell) => cell === null || cell === undefined || String(cell).trim() === "");
    if (isBlank) continue;

    const cell = (field: string): string => {
      const column = headers[field];
      if (column === undefined) return "";
      const value = row[column];
      if (value === null || value === undefined) return "";
      return String(value).trim();
    };

    const data: BulkWorkerInput = {
      fullName: cell("fullName"),
      phone: normalizeImportPhone(cell("phone")),
      partnerCode: cell("partnerCode").toUpperCase(),
      birthday: cell("birthday"),
      idCard: cell("idCard"),
      email: cell("email"),
      address: cell("address"),
      registrationDate: cell("registrationDate"),
      laborType: normalizeImportLaborType(cell("laborType")),
      nationality: cell("nationality"),
      workPermitNumber: cell("workPermitNumber"),
      workPermitExpiry: cell("workPermitExpiry"),
      note: cell("note"),
    };

    // Fail fast in the same order as WorkerService.bulkCreate, so a row that
    // the preview marks valid is a row the server will also accept. In
    // particular a rejected row must not reserve its phone number, otherwise
    // the next legitimate row carrying it would be flagged as a duplicate here
    // but imported fine by the server.
    const errors: string[] = [];
    if (!data.fullName) {
      errors.push("Họ và tên không được để trống");
    } else if (!data.phone) {
      errors.push("Số điện thoại không được để trống");
    } else if (seenPhones.has(data.phone)) {
      errors.push("Số điện thoại bị trùng lặp trong file");
    } else {
      seenPhones.add(data.phone);
      if (data.birthday && !DATE_PATTERN.test(data.birthday)) {
        errors.push("Ngày sinh không đúng định dạng DD/MM/YYYY");
      }
      if (data.registrationDate && !DATE_PATTERN.test(data.registrationDate)) {
        errors.push("Ngày tiếp nhận không đúng định dạng DD/MM/YYYY");
      }
      if (data.workPermitExpiry && !DATE_PATTERN.test(data.workPermitExpiry)) {
        errors.push("Ngày hết hạn GPLĐ / visa không đúng định dạng DD/MM/YYYY");
      }
    }

    rows.push({ rowNum: index + 1, data, isValid: errors.length === 0, errors });
  }

  if (!rows.length) return { rows: [], error: "Không tìm thấy lao động hợp lệ nào trong file." };
  return { rows };
}

export function ImportWorkerModal({ isOpen, onClose, onSuccess, onImport, projects = [] }: Props) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [fileName, setFileName] = React.useState("");
  const [sourceFile, setSourceFile] = React.useState<File | null>(null);
  const [rows, setRows] = React.useState<WorkerImportRow[]>([]);
  const [projectId, setProjectId] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<WorkerBulkImportResult | null>(null);

  if (!isOpen) return null;

  const totalValid = rows.filter((row) => row.isValid).length;
  const totalErrors = rows.length - totalValid;

  const reset = () => {
    setRows([]);
    setFileName("");
    setError(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const downloadTemplate = () => {
    try {
      const worksheet = XLSX.utils.aoa_to_sheet([
        TEMPLATE_HEADERS,
        ["Nguyễn Văn A", "0912345678", "", "25/12/1995", "001234567890", "nva@gmail.com", "123 Lê Lợi, Q.1", "01/08/2026", "Chính thức", "Việt Nam", "", "", ""],
        ["Trần Thị B", "0987654321", "", "10/05/2000", "001234567891", "ttb@gmail.com", "456 Nguyễn Huệ, Hóc Môn", "01/08/2026", "Người nước ngoài", "Nhật Bản", "GPLD-2026-001", "31/12/2027", "Biết tiếng Nhật"],
      ]);
      worksheet["!cols"] = [
        { wch: 22 }, { wch: 16 }, { wch: 24 }, { wch: 13 }, { wch: 18 },
        { wch: 24 }, { wch: 32 }, { wch: 16 }, { wch: 18 },
        { wch: 16 }, { wch: 20 }, { wch: 22 }, { wch: 24 },
      ];
      const guide = XLSX.utils.aoa_to_sheet([
        ["Lưu ý"],
        ["Chỉ hai cột \"Họ và tên\" và \"Số điện thoại\" là bắt buộc. Các cột còn lại có thể bỏ trống."],
        ["Ngày sinh và Ngày tiếp nhận dùng định dạng DD/MM/YYYY, ví dụ 25/12/1995."],
        ["Không cần nhập mã công ty hay chi nhánh — hệ thống tự gán theo phạm vi bạn đang xem."],
        ["Số điện thoại trùng với lao động đã có trong hệ thống sẽ bị bỏ qua và báo lại ở bước cuối."],
        ["Loại lao động nhận: Chính thức, Thời vụ, Người nước ngoài. Bỏ trống sẽ hiểu là Chính thức."],
        ["Mã đối tác giới thiệu không bắt buộc. Nếu nhập, mã phải trùng với một đối tác đang hoạt động trong công ty/chi nhánh hiện tại."],
        ["Số GPLĐ / visa và ngày hết hạn chỉ áp dụng cho loại Người nước ngoài, các loại khác sẽ bỏ qua."],
      ]);
      guide["!cols"] = [{ wch: 110 }];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Lao dong");
      XLSX.utils.book_append_sheet(workbook, guide, "Huong dan");
      XLSX.writeFile(workbook, "mau_import_lao_dong.xlsx");
      toast.success("Đã tải xuống file mẫu.");
    } catch {
      toast.error("Lỗi khi tải file mẫu.");
    }
  };

  const processFile = async (file: File) => {
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      setError("Vui lòng chọn file Excel đúng định dạng (.xlsx, .xls, .csv)");
      return;
    }
    setFileName(file.name);
    setSourceFile(file);
    setError(null);
    setResult(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const sheet = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1 });
      const parsed = parseWorkerSheet(sheet);
      if (parsed.error) {
        setError(parsed.error);
        setRows([]);
        return;
      }
      setRows(parsed.rows);
    } catch {
      setError("Lỗi khi đọc file Excel. Vui lòng kiểm tra lại cấu trúc file.");
    }
  };

  const runImport = async () => {
    const valid = rows.filter((row) => row.isValid).map((row) => row.data);
    if (!valid.length) {
      const message = totalErrors > 0
        ? `Có ${totalErrors} dòng không hợp lệ. Vui lòng sửa lỗi trước khi nhập.`
        : "Không có dòng dữ liệu hợp lệ nào để nhập.";
      setError(message);
      toast.warning(message);
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const imported = await onImport(valid, projectId || undefined, sourceFile || undefined);
      setResult(imported);
      toast.success(`Đã nhập thành công ${imported.importedCount} lao động.`);
      onSuccess();
    } catch (reason) {
      setError(getApiErrorMessage(reason, "Lỗi khi gửi yêu cầu nhập lao động."));
    } finally {
      setUploading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !uploading && onClose()}
          className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
        />
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Nhập danh sách lao động"
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 30 }}
          className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-8 py-5">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Nhập danh sách lao động</h2>
              <p className="mt-0.5 text-xs font-medium text-slate-400">Hỗ trợ định dạng Excel (.xlsx, .xls, .csv)</p>
            </div>
            <button type="button" aria-label="Đóng" onClick={onClose} disabled={uploading} className="rounded-full p-2 hover:bg-slate-100 disabled:opacity-50">
              <X className="h-5 w-5 text-slate-400" />
            </button>
          </div>

          <div className="min-h-[300px] flex-1 overflow-y-auto p-8">
            {error && (
              <div role="alert" className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-100 bg-rose-50 p-4">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-rose-800">Phát hiện lỗi</h4>
                  <p className="mt-1 text-xs font-semibold text-rose-600">{error}</p>
                </div>
              </div>
            )}

            {result ? (
              <div className="space-y-6 py-6 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-emerald-100 bg-emerald-50 text-emerald-500">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Kết quả nhập dữ liệu</h3>
                  <p className="mt-1 text-sm text-slate-500">Đã xử lý xong file <strong>{fileName}</strong></p>
                </div>
                <div className="mx-auto grid max-w-md grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <span className="text-2xl font-black text-emerald-600">{result.importedCount}</span>
                    <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-400">Lao động đã tạo</p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <span className="text-2xl font-black text-amber-500">{result.skippedCount}</span>
                    <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-400">Dòng bị bỏ qua</p>
                  </div>
                </div>
                {result.errors.length > 0 && (
                  <div className="overflow-hidden rounded-2xl border border-slate-100 text-left">
                    <table className="w-full text-xs">
                      <thead className="border-b border-slate-100 bg-slate-50">
                        <tr>
                          <th className="w-16 px-4 py-2 text-center font-bold text-slate-400">Dòng</th>
                          <th className="px-4 py-2 font-bold text-slate-400">Họ và tên</th>
                          <th className="px-4 py-2 font-bold text-slate-400">Lý do bỏ qua</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {result.errors.map((row) => (
                          <tr key={`${row.row}-${row.phone}`}>
                            <td className="px-4 py-2 text-center font-bold text-slate-400">{row.row}</td>
                            <td className="px-4 py-2 font-semibold text-slate-700">{row.name || "—"}</td>
                            <td className="px-4 py-2 font-semibold text-rose-500">{row.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {result.referralErrors && result.referralErrors.length > 0 && (
                  <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-left">
                    <p className="text-xs font-bold text-amber-700">Một số lao động chưa được gắn đối tác</p>
                    <ul className="mt-2 space-y-1 text-xs font-medium text-amber-700">
                      {result.referralErrors.map((item) => (
                        <li key={`${item.workerId}-${item.partnerCode}`}>
                          Mã {item.partnerCode}: {item.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : rows.length === 0 ? (
              <div className="space-y-6">
                <div
                  onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setIsDragging(false);
                    if (event.dataTransfer.files.length) void processFile(event.dataTransfer.files[0]);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-12 text-center transition-all ${isDragging ? "border-cyan-500 bg-cyan-50/30" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/30"}`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    aria-label="Chọn file Excel"
                    onChange={(event) => event.target.files?.[0] && void processFile(event.target.files[0])}
                    className="hidden"
                    accept=".xlsx,.xls,.csv"
                  />
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-slate-100 bg-slate-50 text-slate-400">
                    <Upload className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-sm font-bold text-slate-700">Kéo &amp; thả file Excel vào đây</h3>
                  <p className="mt-1 text-xs text-slate-400">hoặc bấm để chọn file từ máy tính</p>
                </div>
                <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-6 md:flex-row md:items-center">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 rounded-xl border border-slate-100 bg-white p-2 text-cyan-600">
                      <Download className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Chưa có file mẫu?</h4>
                      <p className="mt-0.5 text-xs text-slate-500">Tải file mẫu chuẩn để nhập dữ liệu chính xác ngay lần đầu.</p>
                    </div>
                  </div>
                  <button type="button" onClick={downloadTemplate} className="shrink-0 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50">
                    Tải file mẫu (.xlsx)
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Tên file:</span>
                    <span className="text-sm font-bold text-slate-800">{fileName}</span>
                  </div>
                  <div className="flex items-center gap-6 text-xs font-bold">
                    <span className="flex items-center gap-2 text-emerald-600">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      {totalValid} hợp lệ
                    </span>
                    {totalErrors > 0 && (
                      <span className="flex items-center gap-2 text-rose-500">
                        <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                        {totalErrors} lỗi
                      </span>
                    )}
                    <button type="button" onClick={reset} className="text-slate-400 hover:text-slate-600">Đặt lại</button>
                  </div>
                </div>

                {projects.length > 0 && (
                  <div className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-white px-6 py-4 sm:flex-row sm:items-center sm:gap-4">
                    <label htmlFor="import-project" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Gán vào dự án
                    </label>
                    <select
                      id="import-project"
                      value={projectId}
                      onChange={(event) => setProjectId(event.target.value)}
                      disabled={uploading}
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:border-cyan-600 focus:outline-none disabled:opacity-50"
                    >
                      <option value="">Không gán dự án</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>{project.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                  <div className="max-h-[350px] overflow-x-auto">
                    <table className="w-full min-w-[980px] text-left text-xs">
                      <thead className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50">
                        <tr>
                          <th className="w-12 px-4 py-3 text-center font-bold text-slate-400">Dòng</th>
                          <th className="w-44 px-4 py-3 font-bold text-slate-400">Họ và tên</th>
                          <th className="w-32 px-4 py-3 font-bold text-slate-400">Số điện thoại</th>
                          <th className="w-36 px-3 py-3 font-bold text-slate-400">Mã đối tác</th>
                          <th className="w-28 px-3 py-3 font-bold text-slate-400">Ngày sinh</th>
                          <th className="w-40 px-3 py-3 font-bold text-slate-400">CCCD / CMND</th>
                          <th className="px-4 py-3 font-bold text-slate-400">Trạng thái / Chi tiết lỗi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {rows.map((row) => (
                          <tr key={row.rowNum} className={row.isValid ? "" : "bg-rose-50/20"}>
                            <td className="px-4 py-3 text-center font-bold text-slate-400">{row.rowNum}</td>
                            <td className="px-4 py-3 font-bold text-slate-800">
                              {row.data.fullName || <span className="italic text-slate-300">Trống</span>}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {row.data.phone || <span className="italic text-slate-300">Trống</span>}
                            </td>
                            <td className="px-3 py-3 text-slate-600">
                              {row.data.partnerCode || <span className="italic text-slate-300">Không chọn</span>}
                            </td>
                            <td className="px-3 py-3 text-slate-600">
                              {row.data.birthday || <span className="italic text-slate-300">—</span>}
                            </td>
                            <td className="px-3 py-3 text-slate-600">
                              {row.data.idCard || <span className="italic text-slate-300">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              {row.isValid ? (
                                <span className="flex items-center gap-1.5 font-bold text-emerald-600">
                                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                  Hợp lệ
                                </span>
                              ) : (
                                <span className="flex items-start gap-1.5 font-semibold text-rose-500">
                                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                  <span className="leading-tight">{row.errors.join("; ")}</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-end gap-4 border-t border-slate-100 px-8 py-5">
            <button type="button" onClick={onClose} disabled={uploading} className="text-xs font-bold text-slate-400 hover:text-slate-600 disabled:opacity-50">
              {result ? "Đóng" : "Hủy"}
            </button>
            {!result && rows.length > 0 && (
              <button
                type="button"
                onClick={runImport}
                disabled={uploading}
                className="flex items-center gap-2 rounded-xl bg-cyan-600 px-6 py-3 text-xs font-bold text-white shadow-lg transition-all hover:bg-cyan-700 disabled:opacity-50"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                {uploading
                  ? "Đang nhập dữ liệu..."
                  : totalValid > 0
                    ? `Nhập ${totalValid} lao động hợp lệ`
                    : "Kiểm tra lỗi trước khi nhập"}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
