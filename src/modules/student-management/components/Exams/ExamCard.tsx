import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronDown, UserPlus, Edit3, Trash2,
  CheckCircle2, Map, UserMinus,
  Download, Upload, Calendar as CalendarIcon, Route
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '../../lib/utils';
import { DrivingStudent, ExamSession } from '../../types';
import { apiFetch } from '../../lib/api';
import { toast } from '../../../../pages/Toast';
import { useAuth } from '../../../../context/AuthContext';
import { ExcelImportPreviewModal, PreviewStudent, InvalidStudent } from './ExcelImportPreviewModal';
import { CustomFieldDetails } from '../../custom-fields/CustomFieldDetails';
import { useEntityLabel } from '../../hooks/useEntityLabel';

const handleDownloadTemplate = (exam: ExamSession, students: DrivingStudent[]) => {
  try {
    let headers = ['Họ và tên', 'Số điện thoại', 'Kết quả thi'];
    let data: (string | number)[][] = students.map(s => {
      const examEntry = s.exams?.find(e => e.id === exam.id);
      const overall = examEntry?.result?.overall || 'Chưa có';
      return [s.fullName, s.phone, overall];
    });
    if (data.length === 0) {
      data = [
        ['Nguyễn Văn A (Mẫu)', '0987654321', 'Đậu'],
        ['Trần Thị B (Mẫu)', '0912345678', 'Chưa có']
      ];
    }
    const cols = [{ wch: 25 }, { wch: 18 }, { wch: 15 }];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    ws['!cols'] = cols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kết quả thi");
    XLSX.writeFile(wb, `mau_ket_qua_thi_${exam.name.replace(/\s+/g, '_')}.xlsx`);
  } catch (error) {
    console.error("Error generating exam template:", error);
  }
};

const handleExportResults = (exam: ExamSession, students: DrivingStudent[], listTitle: string) => {
  try {
    const headers = ['Họ và tên', 'Số điện thoại', 'Trạng thái học', 'Kết quả thi'];
    const data = students.map(s => {
      const examEntry = s.exams?.find(e => e.id === exam.id);
      const overall = examEntry?.result?.overall || 'Chưa có';
      return [s.fullName, s.phone, Array.isArray(s.status) ? s.status.join(', ') : s.status, overall];
    });
    const cols = [{ wch: 25 }, { wch: 18 }, { wch: 18 }, { wch: 15 }];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    ws['!cols'] = cols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, listTitle);
    XLSX.writeFile(wb, `ket_qua_thi_${exam.name.replace(/\s+/g, '_')}.xlsx`);
  } catch (error) {
    console.error("Error exporting exam results:", error);
  }
};

const formatExcelPhone = (phoneVal: unknown): string => {
  if (phoneVal === undefined || phoneVal === null) return '';
  let clean = String(phoneVal).trim().replace(/[\s.-]/g, '');
  if (!clean) return '';
  if (clean.startsWith('84') && clean.length === 11) {
    clean = '0' + clean.slice(2);
  }
  if (clean.startsWith('+84')) {
    clean = '0' + clean.slice(3);
  }
  if (/^[1-9]\d{8}$/.test(clean)) {
    clean = '0' + clean;
  }
  return clean;
};

export interface ExamCardProps {
  exam: ExamSession;
  assignedStudents: DrivingStudent[];
  onDelete: () => void | Promise<unknown>;
  onEdit: () => void | Promise<unknown>;
  onAssignClick: () => void | Promise<unknown>;
  onUnassignStudent?: (studentId: string) => void | Promise<unknown>;
  onUpdateStudentResult?: (studentId: string, result: 'Đậu' | 'Trượt' | 'Chưa có') => void | Promise<unknown>;
  onSaveStudentScores?: (results: Array<{ studentId: string; score: number }>) => void | Promise<unknown>;
  onProgressRoute?: () => void | Promise<unknown>;
}

export const ExamCard: React.FC<ExamCardProps> = ({ 
  exam, 
  assignedStudents, 
  onDelete, 
  onEdit, 
  onAssignClick, 
  onUnassignStudent, 
  onUpdateStudentResult, onSaveStudentScores,
  onProgressRoute
}) => {
  const { userProfile: user } = useAuth();
  const entityLabel = useEntityLabel();
  const businessType = 'general';
  // The stored aggregate can be stale after changing assignments.
  const assignedStudentCount = assignedStudents.length;
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [validPreviewList, setValidPreviewList] = useState<PreviewStudent[]>([]);
  const [invalidPreviewList, setInvalidPreviewList] = useState<InvalidStudent[]>([]);
  const [rawResults, setRawResults] = useState<{ phone: string; overallResult: 'Đậu' | 'Trượt' | 'Chưa có' }[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [draftScores, setDraftScores] = useState<Record<string, string>>(() => Object.fromEntries((exam.results || []).filter((item) => typeof item.score === "number").map((item) => [item.studentId, String(item.score)])));
  const [isSavingScores, setIsSavingScores] = useState(false);

  React.useEffect(() => {
    setDraftScores(Object.fromEntries((exam.results || []).filter((item) => typeof item.score === "number").map((item) => [item.studentId, String(item.score)])));
  }, [exam.id]);

  const changedScores = assignedStudents.flatMap((student) => {
    const value = draftScores[student.id];
    const savedScore = exam.results?.find((item) => item.studentId === student.id)?.score;
    return value !== undefined && value !== "" && Number(value) !== savedScore ? [{ studentId: student.id, score: Number(value) }] : [];
  });
  const saveScores = async () => {
    if (!changedScores.length || !onSaveStudentScores) return;
    setIsSavingScores(true);
    try { await onSaveStudentScores(changedScores); }
    finally { setIsSavingScores(false); }
  };
  

  const handleUploadExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as (string | number | boolean | null | undefined)[][];

        if (rows.length < 2) {
          alert("File Excel rỗng hoặc thiếu dữ liệu.");
          return;
        }

        // Map columns
        const headers = rows[0].map(h => h ? String(h).trim().toLowerCase() : '');
        const phoneIdx = headers.findIndex(h => h.includes("điện thoại") || h.includes("sđt") || h.includes("phone"));
        const resultIdx = headers.findIndex(h => h.includes("kết quả") || h.includes("result") || h.includes("overall"));

        if (phoneIdx === -1 || resultIdx === -1) {
          const foundHeaders = headers.filter(Boolean).join(", ");
          alert(`Không tìm thấy các cột cần thiết ('Số điện thoại' và 'Kết quả thi') trong file Excel.\n\nCác cột tìm thấy trong file của bạn: ${foundHeaders || "Không có cột nào"}`);
          return;
        }

        const resultsList: { phone: string; overallResult: 'Đậu' | 'Trượt' | 'Chưa có' }[] = [];
        const importErrors: string[] = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0 || row.every(cell => cell === null || cell === undefined || String(cell).trim() === '')) {
            continue;
          }

          const phone = formatExcelPhone(row[phoneIdx]);
          let overallResult = row[resultIdx] ? String(row[resultIdx]).trim() : 'Chưa có';

          if (!phone) {
            importErrors.push(`Dòng ${i + 1}: Thiếu Số điện thoại.`);
            continue;
          }

          if (phone.includes("0987654321") || phone.includes("0912345678")) {
            continue;
          }

          const rawResult = overallResult.toLowerCase().trim();
          if (rawResult === 'đậu' || rawResult === 'pass') {
            overallResult = 'Đậu';
          } else if (rawResult === 'trượt' || rawResult === 'fail' || rawResult === 'rớt') {
            overallResult = 'Trượt';
          } else if (rawResult === 'chưa có' || rawResult === 'pending' || rawResult === '') {
            overallResult = 'Chưa có';
          } else {
            importErrors.push(`Dòng ${i + 1} (SĐT ${phone}): Kết quả thi "${overallResult}" không hợp lệ (chỉ chấp nhận: Đậu, Trượt, Chưa có).`);
            continue;
          }

          resultsList.push({
            phone,
            overallResult: overallResult as 'Đậu' | 'Trượt' | 'Chưa có'
          });
        }

        if (importErrors.length > 0 && resultsList.length === 0) {
          alert(`File Excel không hợp lệ. Chi tiết các dòng lỗi:\n- ${importErrors.join('\n- ')}`);
          return;
        }

        if (resultsList.length === 0) {
          alert("Không tìm thấy dòng dữ liệu nào hợp lệ trong file Excel.");
          return;
        }

        // Call validation API to get previews
        setIsImporting(true);
        try {
          interface ImportPreviewResponse {
            success: boolean;
            error?: string;
            valid?: PreviewStudent[];
            invalid?: InvalidStudent[];
          }
          const res = await apiFetch<ImportPreviewResponse>(`/exams/${exam.id}/import-results`, {
            method: 'POST',
            body: JSON.stringify({ results: resultsList, preview: true })
          });

          if (res.success) {
            // Include client-side format errors in the invalid list for previewing
            const clientInvalid = importErrors.map(err => ({
              phone: '—',
              fullName: 'Lỗi định dạng dòng',
              reason: err
            }));

            setValidPreviewList(res.valid || []);
            setInvalidPreviewList([...(res.invalid || []), ...clientInvalid]);
            setRawResults(resultsList);
            setIsPreviewOpen(true);
          } else {
            toast.error(res.error || "Không thể kiểm tra dữ liệu Excel.");
          }
        } catch (error: unknown) {
          console.error("Error previewing import:", error);
          const msg = error instanceof Error ? error.message : "Lỗi kết nối khi tải dữ liệu lên.";
          toast.error(msg);
        } finally {
          setIsImporting(false);
        }

      } catch (err) {
        console.error("Failed to process Excel file:", err);
        alert("Lỗi xử lý file Excel.");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; // Reset input element
  };

  const handleConfirmImport = async () => {
    setIsImporting(true);
    try {
      interface ConfirmImportResponse {
        success: boolean;
        error?: string;
        successCount?: number;
        failedCount?: number;
      }
      const res = await apiFetch<ConfirmImportResponse>(`/exams/${exam.id}/import-results`, {
        method: 'POST',
        body: JSON.stringify({ results: rawResults, preview: false })
      });

      if (res.success) {
        toast.success(`Đã cập nhật kết quả: ${res.successCount} thành công, ${res.failedCount} thất bại.`);
        window.dispatchEvent(new Event("student-mutation"));
        window.dispatchEvent(new Event("exam-mutation"));
        setIsPreviewOpen(false);
      } else {
        toast.error(res.error || "Nhập kết quả thi từ Excel thất bại.");
      }
    } catch (error: unknown) {
      console.error("Error confirming import:", error);
      const msg = error instanceof Error ? error.message : "Lỗi khi nhập kết quả thi.";
      toast.error(msg);
    } finally {
      setIsImporting(false);
    }
  };

  const showStudentRank = businessType !== 'general' && (!!exam.rank || assignedStudents.some(s => s.rank));

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow transition-all overflow-hidden"
    >
      <div className="p-2.5 sm:p-3 flex flex-col xl:flex-row xl:items-center justify-between gap-2.5 sm:gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900">{exam.name}</h3>
            <div className="flex flex-wrap items-center gap-1">
              {exam.rank && (
                <span className="px-1.5 py-0.2 bg-cyan-50 text-cyan-700 rounded text-[9px] font-bold border border-cyan-100">
                  {exam.rank}
                </span>
              )}
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-1.5 group">
              <div className="p-1 rounded bg-slate-50 group-hover:bg-slate-100 transition-colors border border-slate-100/50">
                <CalendarIcon className="w-3 h-3 text-slate-400" />
              </div>
              <div>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wide leading-none">Dự kiến</p>
                <p className="text-[11px] font-bold text-slate-700 mt-0.5">{exam.tentativeDate}</p>
              </div>
            </div>

            {exam.officialDate && (
              <div className="flex items-center gap-1.5 group">
                <div className="p-1 rounded bg-emerald-50 group-hover:bg-emerald-100 transition-colors border border-emerald-100/50">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                </div>
                <div>
                  <p className="text-[8px] font-bold text-emerald-400 uppercase tracking-wide leading-none">Chính thức</p>
                  <p className="text-[11px] font-bold text-emerald-600 mt-0.5">{exam.officialDate}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-1.5 group">
              <div className="p-1 rounded bg-slate-50 group-hover:bg-slate-100 transition-colors border border-slate-100/50">
                <Map className="w-3 h-3 text-slate-400" />
              </div>
              <div>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wide leading-none">Địa điểm</p>
                <p className="text-[11px] font-bold text-slate-700 mt-0.5 truncate max-w-[150px] sm:max-w-[250px]">{exam.location}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 pt-2.5 sm:pt-0 border-t sm:border-t-0 border-slate-50">
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <div className="flex-1 sm:flex-none px-2 py-1 bg-slate-50 rounded-lg text-center min-w-[50px] sm:min-w-[60px] border border-slate-100/50">
              <p className="text-sm sm:text-base font-extrabold text-slate-900 leading-none">{assignedStudentCount}</p>
              <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 mt-0.5 uppercase tracking-wide">{entityLabel.tabLabel}</p>
            </div>
              <div className="flex-1 sm:flex-none px-2 py-1 bg-cyan-50 rounded-lg text-center min-w-[65px] border border-cyan-100/30"><p className="text-sm sm:text-base font-extrabold text-cyan-700 leading-none">{(exam.results || []).filter((item) => typeof item.score === 'number').length}/{assignedStudentCount}</p><p className="text-[8px] sm:text-[9px] font-bold text-cyan-600 mt-0.5 uppercase tracking-wide">Đã chấm</p></div>
          </div>

          <div className="flex items-center gap-1 w-full sm:w-auto justify-end no-print">
            {onProgressRoute ? <button onClick={(event) => { event.stopPropagation(); void onProgressRoute(); }} title="Chuyển sang đánh giá lộ trình" className="p-1 rounded-md text-cyan-700 hover:bg-cyan-50 transition-all border border-cyan-200 bg-white shadow-sm"><Route className="w-3.5 h-3.5" /></button> : null}
            <button 
              onClick={(e) => { e.stopPropagation(); onAssignClick(); }}
              title={`Xếp ${entityLabel.singular}`}
              className="p-1 rounded-md text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 transition-all border border-slate-200 bg-white shadow-sm active:scale-95 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              title="Sửa đợt thi"
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all border border-slate-200 bg-white shadow-sm active:scale-95 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              title="Xóa đợt thi"
              className="p-1 rounded-md bg-rose-500 text-white hover:bg-rose-600 transition-all shadow-md shadow-rose-100 active:scale-95 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <div className="hidden sm:block w-px h-5 bg-slate-100 mx-0.5" />
            <button 
              onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
              title={isExpanded ? "Thu gọn" : `Xem ${entityLabel.singular}`}
              className={cn(
                "p-1 rounded-md text-slate-300 hover:text-slate-600 hover:bg-slate-50 transition-all border border-slate-100 active:scale-95 cursor-pointer",
                isExpanded && "bg-slate-50 text-slate-600 border-slate-200"
              )}
            >
              <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", isExpanded && "rotate-180")} />
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Student List */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
             initial={{ height: 0, opacity: 0 }}
             animate={{ height: "auto", opacity: 1 }}
             exit={{ height: 0, opacity: 0 }}
             transition={{ duration: 0.2 }}
             className="border-t border-slate-100 bg-slate-50/50 overflow-hidden"
          >
            <div className="p-3 space-y-2">
              <CustomFieldDetails moduleKey="exams" values={exam.customFields || {}} />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Danh sách {entityLabel.singular} đăng ký ({assignedStudents.length} {entityLabel.singular})
                  </h4>
                  <p className="text-[9px] text-slate-400 font-medium mt-0.5 max-w-md">
                    * File Excel nhập cần chứa các cột: <strong className="text-slate-500">Số điện thoại</strong> và <strong className="text-slate-500">Kết quả thi</strong> (Đậu / Trượt / Chưa có). Tải file mẫu bên cạnh để xem ví dụ.
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleDownloadTemplate(exam, assignedStudents)}
                    className="flex items-center gap-1 px-2 py-1 rounded-md bg-cyan-50 hover:bg-cyan-100 text-cyan-700 text-[10px] font-bold transition-all border border-cyan-100/50 cursor-pointer shadow-sm active:scale-95"
                  >
                    <Download className="w-3 h-3" />
                    Tải mẫu Excel
                  </button>
                  {assignedStudents.length > 0 && (
                    <button
                      onClick={() => handleExportResults(exam, assignedStudents, entityLabel.listTitle)}
                      className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold transition-all border border-blue-100/50 cursor-pointer shadow-sm active:scale-95"
                    >
                      <Download className="w-3 h-3" />
                      Xuất kết quả
                    </button>
                  )}
                  <label className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold transition-all border border-emerald-100/50 cursor-pointer shadow-sm active:scale-95">
                    <Upload className="w-3 h-3" />
                    Nhập từ Excel
                    <input
                      type="file"
                      accept=".xlsx, .xls"
                      onChange={handleUploadExcel}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {assignedStudents.length === 0 ? (
                <p className="text-xs text-slate-450 italic">Đợt thi này chưa xếp {entityLabel.singular} nào.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-100 bg-white shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/60 border-b border-slate-100">
                        <th className="px-2.5 py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-wider">{entityLabel.tabLabel}</th>
                        {showStudentRank && <th className="px-2.5 py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-wider text-center">Hạng</th>}
                        <th className="px-2.5 py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-wider">Trạng thái học</th>
                        <th className="px-2.5 py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-wider text-center">Kết quả</th>
                        <th className="px-2.5 py-1.5 text-right"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignedStudents.map((student) => {
                        const examEntry = student.exams?.find(e => e.id === exam.id);
                        const resultText = examEntry?.result?.overall || 'Chưa có';
                        const scoreEntry = exam.results?.find((item) => item.studentId === student.id);
                        
                        return (
                          <tr key={student.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-50 last:border-0">
                            <td className="px-2.5 py-1.5">
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-800">{student.fullName}</span>
                                <span className="text-[9px] font-medium text-slate-400 mt-0.5">{student.phone}</span>
                              </div>
                            </td>
                            {showStudentRank && (
                              <td className="px-2.5 py-1.5 text-center">
                                <span className="px-1.5 py-0.2 bg-cyan-50 text-cyan-600 rounded text-[9px] font-black uppercase">
                                  {student.rank || 'N/A'}
                                </span>
                              </td>
                            )}
                            <td className="px-2.5 py-1.5">
                              <span className={cn(
                                "px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase",
                                (Array.isArray(student.status) ? student.status.includes('Đã đậu') : student.status === 'Đã đậu') ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                                (Array.isArray(student.status) ? student.status.includes('Đang thi') : student.status === 'Đang thi') ? "bg-cyan-50 text-cyan-600 border border-cyan-100" :
                                "bg-slate-50 text-slate-500 border border-slate-100"
                              )}>
                                {Array.isArray(student.status) ? student.status.join(', ') : student.status}
                              </span>
                            </td>
                            <td className="px-2.5 py-1.5 text-center">
                              {exam.batchId ? <input type="number" min="0" max={exam.maxScore || 100} value={draftScores[student.id] ?? ""} onChange={(event) => setDraftScores((current) => ({ ...current, [student.id]: event.target.value }))} placeholder={`/${exam.maxScore || 100}`} className="h-8 w-20 rounded border border-cyan-200 bg-cyan-50 px-2 text-center text-xs font-bold text-cyan-800" /> :
                              <select
                                value={resultText}
                                onChange={async (e) => {
                                  const val = e.target.value as "Đậu" | "Trượt" | "Chưa có";
                                  onUpdateStudentResult?.(student.id, val);
                                }}
                                className={cn(
                                  "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase outline-none border cursor-pointer transition-all focus:ring-2",
                                  resultText === 'Đậu' ? "bg-emerald-50 text-emerald-600 border-emerald-100 focus:ring-emerald-500/10" :
                                  resultText === 'Trượt' ? "bg-rose-50 text-rose-600 border-rose-100 focus:ring-rose-500/10" :
                                  "bg-slate-50 text-slate-500 border-slate-200 focus:ring-slate-500/10"
                                )}
                              >
                                <option value="Chưa có" className="bg-white text-slate-700 font-bold uppercase">Chưa có</option>
                                <option value="Đậu" className="bg-white text-emerald-600 font-bold uppercase">Đậu</option>
                                <option value="Trượt" className="bg-white text-rose-600 font-bold uppercase">Trượt</option>
                              </select>
                              }
                            </td>
                            <td className="px-2.5 py-1.5 text-right">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (window.confirm(`Bạn có chắc chắn muốn xóa ${entityLabel.singular} ${student.fullName} khỏi đợt thi này?`)) {
                                    onUnassignStudent?.(student.id);
                                  }
                                }}
                                title="Xóa khỏi đợt thi"
                                className="p-1 rounded bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors cursor-pointer"
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {exam.batchId ? <div className="flex justify-end border-t border-slate-100 bg-slate-50 px-3 py-2"><button type="button" disabled={!changedScores.length || isSavingScores} onClick={() => void saveScores()} className="flex items-center gap-1.5 rounded-md bg-cyan-700 px-3 py-1.5 text-xs font-bold text-white transition-all shadow-sm disabled:cursor-not-allowed disabled:opacity-40"><CheckCircle2 className="w-3.5 h-3.5" />{isSavingScores ? "Đang lưu điểm..." : `Lưu toàn bộ điểm${changedScores.length ? ` (${changedScores.length} học viên)` : ""}`}</button></div> : null}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ExcelImportPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        validList={validPreviewList}
        invalidList={invalidPreviewList}
        onConfirm={handleConfirmImport}
        isSubmitting={isImporting}
      />
    </motion.div>
  );
}
