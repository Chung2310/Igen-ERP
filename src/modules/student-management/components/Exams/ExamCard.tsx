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
import { CustomFieldDetails } from '../../../shared/custom-fields/CustomFieldDetails';
import { useEntityLabel } from '../../hooks/useEntityLabel';
import { authService } from '../../../../services/authService';
import { RoadmapPicker } from '../ui/RoadmapPicker';

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
  resourceCompanyCode?: string;
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
  resourceCompanyCode,
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
  const [importSourceFile, setImportSourceFile] = useState<File | null>(null);
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
            setImportSourceFile(file);
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
      if (!importSourceFile) throw new Error('Không tìm thấy file Excel nguồn để nhập.');
      if (user?.role === 'superadmin' && !resourceCompanyCode) {
        throw new Error('Vui lòng chọn một công ty trước khi nhập kết quả kỳ thi.');
      }
      const uploadCompanyCode = resourceCompanyCode || user?.companyCode;
      const uploaded = await authService.uploadManagedFile(importSourceFile, 'import.exam', uploadCompanyCode);
      const res = await apiFetch<ConfirmImportResponse>(`/exams/${exam.id}/import-results`, {
        method: 'POST',
        body: JSON.stringify({
          results: rawResults,
          preview: false,
          companyCode: uploadCompanyCode,
          importUpload: { uploadToken: uploaded.uploadToken, fileName: importSourceFile.name },
        })
      });

      if (res.success) {
        toast.success(`Đã cập nhật kết quả: ${res.successCount} thành công, ${res.failedCount} thất bại.`);
        window.dispatchEvent(new Event("student-mutation"));
        window.dispatchEvent(new Event("exam-mutation"));
        window.dispatchEvent(new Event("batch-mutation"));
        setIsPreviewOpen(false);
        setImportSourceFile(null);
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
      className="overflow-visible"
    >
      <div className="grid grid-cols-2 items-center gap-x-3 gap-y-2 px-1 py-2.5 sm:grid-cols-3 xl:grid-cols-[minmax(220px,2fr)_minmax(100px,0.8fr)_minmax(100px,0.8fr)_minmax(110px,1fr)_minmax(140px,1fr)_auto] xl:gap-x-5">
        <div className="col-span-2 min-w-0 sm:col-span-3 xl:col-span-1">
          <h3 className="truncate text-sm font-medium text-slate-900" title={exam.name}>{exam.name}</h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
            {exam.rank && <span>{exam.rank}</span>}
            <span>Đạt ≥ {exam.passScore ?? Math.ceil((exam.maxScore || 100) / 2)}/{exam.maxScore || 100}</span>
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <div className="min-w-0 text-xs"><p className="text-slate-500">Dự kiến</p><p className="whitespace-nowrap text-slate-700">{exam.tentativeDate}</p></div>
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          <CheckCircle2 className={cn("h-3.5 w-3.5 shrink-0", exam.officialDate ? "text-brand-primary" : "text-slate-300")} />
          <div className="min-w-0 text-xs"><p className="text-slate-500">Chính thức</p><p className={cn("whitespace-nowrap", exam.officialDate ? "text-brand-primary" : "text-slate-400")}>{exam.officialDate || '—'}</p></div>
        </div>
        <div className="col-span-2 flex min-w-0 items-center gap-1.5 sm:col-span-1">
          <Map className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="truncate text-xs text-slate-700" title={exam.location}>{exam.location}</span>
        </div>
        <div className="flex items-center gap-3 whitespace-nowrap text-xs">
          <span><span className="font-medium text-slate-800">{assignedStudentCount}</span> <span className="text-slate-500">{entityLabel.tabLabel}</span></span>
          <span><span className="font-medium text-brand-primary">{(exam.results || []).filter((item) => typeof item.score === 'number').length}/{assignedStudentCount}</span> <span className="text-slate-500">Đã chấm</span></span>
        </div>
        <div className="no-print flex items-center justify-end gap-0.5">
          {onProgressRoute && <button type="button" onClick={(event) => { event.stopPropagation(); void onProgressRoute(); }} title="Chuyển sang đánh giá lộ trình" aria-label="Chuyển sang đánh giá lộ trình" className="flex h-7 w-7 items-center justify-center rounded-md text-brand-primary hover:bg-sky-50"><Route className="h-4 w-4" /></button>}
          <button type="button" onClick={(event) => { event.stopPropagation(); onAssignClick(); }} title={`Xếp ${entityLabel.singular}`} aria-label={`Xếp ${entityLabel.singular}`} className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-sky-50 hover:text-brand-primary"><UserPlus className="h-4 w-4" /></button>
          <button type="button" onClick={(event) => { event.stopPropagation(); onEdit(); }} title="Sửa đợt thi" aria-label="Sửa đợt thi" className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"><Edit3 className="h-4 w-4" /></button>
          <button type="button" onClick={(event) => { event.stopPropagation(); onDelete(); }} title="Xóa đợt thi" aria-label="Xóa đợt thi" className="flex h-7 w-7 items-center justify-center rounded-md text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
          <button type="button" onClick={(event) => { event.stopPropagation(); setIsExpanded(!isExpanded); }} title={isExpanded ? "Thu gọn" : `Xem ${entityLabel.singular}`} aria-label={isExpanded ? "Thu gọn" : `Xem ${entityLabel.singular}`} aria-expanded={isExpanded} className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"><ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isExpanded && "rotate-180")} /></button>
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
             className="overflow-hidden border-t border-slate-100 bg-white"
          >
            <div className="p-3 space-y-2">
              <CustomFieldDetails moduleKey="exams" values={exam.customFields || {}} />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-medium text-slate-600">
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
                <div className="overflow-x-auto sm:overflow-visible rounded-lg border border-sky-100 bg-white shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/60 border-b border-slate-100">
                        <th className="px-2.5 py-1.5 text-xs font-medium text-slate-600">{entityLabel.tabLabel}</th>
                        {showStudentRank && <th className="px-2.5 py-1.5 text-xs font-medium text-slate-600 text-center">Hạng</th>}
                        <th className="px-2.5 py-1.5 text-xs font-medium text-slate-600">Trạng thái học</th>
                        <th className="px-2.5 py-1.5 text-xs font-medium text-slate-600 text-center">Kết quả</th>
                        <th className="px-2.5 py-1.5 text-right"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignedStudents.map((student) => {
                        const examEntry = student.exams?.find(e => e.id === exam.id);
                        const scoreEntry = exam.results?.find((item) => item.studentId === student.id);
                        const resultText = scoreEntry?.outcome === "Đậu" || scoreEntry?.outcome === "Trượt"
                          ? scoreEntry.outcome
                          : (typeof scoreEntry?.score === "number" ? (scoreEntry.score >= (exam.passScore ?? Math.ceil((exam.maxScore || 100) / 2)) ? 'Đậu' : 'Trượt') : examEntry?.result?.overall || 'Chưa có');
                        
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
                                <span className="px-1.5 py-0.2 bg-cyan-50 text-cyan-600 rounded text-xs font-medium">
                                  {student.rank || 'N/A'}
                                </span>
                              </td>
                            )}
                            <td className="px-2.5 py-1.5">
                              <span className={cn(
                                "px-1.5 py-0.2 rounded text-xs font-medium",
                                (Array.isArray(student.status) ? student.status.includes('Đã đậu') : student.status === 'Đã đậu') ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                                (Array.isArray(student.status) ? student.status.includes('Đang thi') : student.status === 'Đang thi') ? "bg-cyan-50 text-cyan-600 border border-cyan-100" :
                                "bg-slate-50 text-slate-500 border border-slate-100"
                              )}>
                                {Array.isArray(student.status) ? student.status.join(', ') : student.status}
                              </span>
                            </td>
                            <td className="px-2.5 py-1.5 text-center">
                              {exam.batchId ? <div className="flex flex-col items-center gap-1"><input type="number" min="0" max={exam.maxScore || 100} value={draftScores[student.id] ?? ""} onChange={(event) => setDraftScores((current) => ({ ...current, [student.id]: event.target.value }))} placeholder={`/${exam.maxScore || 100}`} className="h-8 w-20 rounded border border-cyan-200 bg-cyan-50 px-2 text-center text-xs font-bold text-cyan-800" /><span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold", resultText === 'Đậu' ? "bg-emerald-50 text-emerald-700" : resultText === 'Trượt' ? "bg-rose-50 text-rose-700" : "bg-slate-50 text-slate-500")}>{resultText}</span></div> :
                              <div className="min-w-28">
                                <RoadmapPicker value={resultText} placeholder="Chưa có" allowClear={false} options={[{ value: 'Chưa có', label: 'Chưa có' }, { value: 'Đậu', label: 'Đậu' }, { value: 'Trượt', label: 'Trượt' }]} onChange={(value) => onUpdateStudentResult?.(student.id, value as 'Đậu' | 'Trượt' | 'Chưa có')} />
                              </div>
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
