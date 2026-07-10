import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Upload, Download, AlertCircle,
  CheckCircle2, Loader2, AlertTriangle, Play
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { apiFetch } from '../../lib/api';
import { toast } from '../../../../pages/Toast';
import { useAuth } from '../../../../context/AuthContext';

interface ImportStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  selectedCenter?: string;
}

interface ParsedStudent {
  fullName: string;
  phone: string;
  rank: string;
  fee: string;
  paidAmount?: number;
  birthday?: string;
  idCard?: string;
  email?: string;
  referral?: string;
  address?: string;
  enrollmentDate?: string;
}

interface ValidationRow {
  rowNum: number;
  data: ParsedStudent;
  isValid: boolean;
  errors: string[];
}

const DATE_PATTERN = /^([0-2][0-9]|3[0-1])\/(0[1-9]|1[0-2])\/\d{4}$/;

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

export function ImportStudentModal({ isOpen, onClose, onSuccess, selectedCenter }: ImportStudentModalProps) {
  const { userProfile: user } = useAuth();
  const businessType = 'general';
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [validationRows, setValidationRows] = useState<ValidationRow[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [importResult, setImportResult] = useState<{
    success: boolean;
    importedCount: number;
    skippedCount: number;
    errors: { row: number; name: string; phone: string; reason: string }[];
  } | null>(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    try {
      let headers: string[] = [];
      let data: string[][] = [];
      let cols: { wch: number }[] = [];

      headers = [
        'Họ và tên', 'Số điện thoại', 'Học phí', 'Đã đóng', 'Còn nợ',
        'Ngày sinh', 'CCCD / CMND', 'Email', 'Người giới thiệu', 'Địa chỉ', 'Ngày nhập học'
      ];
      data = [
        ['Nguyễn Văn A', '0912345678', '1.000.000', '1.000.000', '0', '25/12/1995', '123456789012', 'nva@gmail.com', 'Trần Văn B', '123 Đường Lê Lợi, Q.1', '15/06/2026'],
        ['Trần Thị B', '0987654321', '3.500.000', '0', '3.500.000', '10/05/2000', '987654321098', 'ttb@gmail.com', '', '456 Đường Nguyễn Huệ, H.Hóc Môn', '20/06/2026']
      ];
      cols = [
        { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
        { wch: 12 }, { wch: 18 }, { wch: 22 }, { wch: 18 }, { wch: 35 }, { wch: 16 }
      ];

      const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
      ws['!cols'] = cols;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Danh sách học viên');
      // ownerId/centerId are intentionally excluded: the server resolves the center automatically.
      const guide = XLSX.utils.aoa_to_sheet([
        ['L\u01b0u \u00fd'],
        ['Kh\u00f4ng c\u1ea7n nh\u1eadp ownerId, centerId ho\u1eb7c m\u00e3 trung t\u00e2m. H\u1ec7 th\u1ed1ng t\u1ef1 g\u00e1n trung t\u00e2m khi nh\u1eadp d\u1eef li\u1ec7u.'],
      ]);
      guide['!cols'] = [{ wch: 110 }];
      XLSX.utils.book_append_sheet(wb, guide, 'Huong dan');
      XLSX.writeFile(wb, `mau_import_hoc_vien_${businessType}.xlsx`);
      toast.success('Đã tải xuống file mẫu thành công!');
    } catch (error) {
      console.error('Error downloading template:', error);
      toast.error('Lỗi khi tải file mẫu.');
    }
  };

  const mapHeaders = (row: unknown[]): Record<string, number> => {
    const map: Record<string, number> = {};
    row.forEach((cell, idx) => {
      if (!cell) return;
      const val = String(cell).trim().toLowerCase();
      if (val.includes('họ và tên') || val.includes('họ tên') || val === 'tên') map.fullName = idx;
      else if (val.includes('số điện thoại') || val.includes('điện thoại') || val === 'sdt') map.phone = idx;
      else if (val.includes('hạng bằng') || val.includes('hạng') || val === 'hang' || val.includes('khóa học') || val.includes('khoa hoc')) map.rank = idx;
      else if (val.includes('học phí') || val.includes('hoc phi')) map.fee = idx;
      else if (val.includes('đã đóng') || val.includes('da dong') || val === 'dong') map.paidAmount = idx;
      else if (val.includes('ngày sinh') || val.includes('ngay sinh') || val === 'năm sinh') map.birthday = idx;
      else if (val.includes('cccd') || val.includes('cmnd') || val.includes('định danh')) map.idCard = idx;
      else if (val.includes('email')) map.email = idx;
      else if (val.includes('người giới thiệu') || val.includes('giới thiệu')) map.referral = idx;
      else if (val.includes('địa chỉ') || val.includes('dia chi') || val.includes('nơi ở')) map.address = idx;
      else if (val.includes('ngày nhập học') || val.includes('ngay nhap hoc') || val.includes('nhập học')) map.enrollmentDate = idx;
    });
    return map;
  };

  const processFile = (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls') && !file.name.endsWith('.csv')) {
      setErrorMsg('Vui lòng chọn file Excel đúng định dạng (.xlsx, .xls, .csv)');
      return;
    }

    setFileName(file.name);
    setErrorMsg(null);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const arrayBuffer = e.target?.result;
        if (!arrayBuffer) return;

        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1 });

        if (rows.length < 2) {
          setErrorMsg('File Excel không có dữ liệu hoặc thiếu tiêu đề cột.');
          return;
        }

        const headerMap = mapHeaders(rows[0]);
        const missingHeaders = [];
        if (headerMap.fullName === undefined) missingHeaders.push('Họ và tên');
        if (headerMap.phone === undefined) missingHeaders.push('Số điện thoại');
        // Cột "Hạng bằng" chỉ dành cho ngành lái xe — không còn bắt buộc

        if (missingHeaders.length > 0) {
          setErrorMsg(`File thiếu các cột bắt buộc sau: ${missingHeaders.join(', ')}`);
          return;
        }

        const validationResults: ValidationRow[] = [];
        const seenPhones = new Set<string>();

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.every(cell => cell === null || cell === undefined || String(cell).trim() === '')) {
            continue;
          }

          const getCellValue = (field: string): string => {
            const idx = headerMap[field];
            if (idx === undefined || row[idx] === undefined || row[idx] === null) return '';
            return String(row[idx]).trim();
          };

          const feeNum = parseInt(getCellValue('fee').replace(/\D/g, ''), 10) || 0;
          const paidAmount = parseInt(getCellValue('paidAmount').replace(/\D/g, ''), 10) || 0;
          const studentData: ParsedStudent = {
            fullName: getCellValue('fullName'),
            phone: formatExcelPhone(getCellValue('phone')),
            rank: getCellValue('rank').toUpperCase(),
            fee: feeNum > 0 ? feeNum.toLocaleString('vi-VN') : '0',
            paidAmount,
            birthday: getCellValue('birthday'),
            idCard: getCellValue('idCard'),
            email: getCellValue('email'),
            referral: getCellValue('referral'),
            address: getCellValue('address'),
            enrollmentDate: getCellValue('enrollmentDate'),
          };

          const errors: string[] = [];
          if (!studentData.fullName) errors.push('Họ tên không được trống');
          if (!studentData.phone) errors.push('Số điện thoại không được trống');
          else if (seenPhones.has(studentData.phone)) errors.push('SĐT bị trùng lặp trong file');
          else seenPhones.add(studentData.phone);
          if (paidAmount > feeNum) errors.push(`Số tiền đã đóng (${paidAmount.toLocaleString('vi-VN')}đ) không được vượt quá học phí (${studentData.fee}đ)`);

          // Hạng bằng là tùy chọn tự do, không cần kiểm tra thuộc danh sách cố định lái xe nữa

          if (studentData.enrollmentDate && !DATE_PATTERN.test(studentData.enrollmentDate)) {
            errors.push('Ngày nhập học không đúng định dạng DD/MM/YYYY');
          }

          validationResults.push({ rowNum: i + 1, data: studentData, isValid: errors.length === 0, errors });
        }

        if (validationResults.length === 0) setErrorMsg('Không tìm thấy học viên hợp lệ nào trong file.');
        else setValidationRows(validationResults);
      } catch (error) {
        console.error('Error parsing file:', error);
        setErrorMsg('Lỗi khi đọc file Excel. Vui lòng kiểm tra lại cấu trúc file.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    const validData = validationRows.filter(r => r.isValid).map(r => r.data);
    if (validData.length === 0) {
      const message = totalErrors > 0
        ? `Có ${totalErrors} dòng không hợp lệ. Vui lòng sửa lỗi trước khi nhập.`
        : 'Không có dòng dữ liệu hợp lệ nào để nhập.';
      setErrorMsg(message);
      toast.warning(message);
      return;
    }

    setIsUploading(true);
    setErrorMsg(null);
    try {
      const centerQuery = user?.role === 'superadmin' && selectedCenter && selectedCenter !== 'all'
        ? `?centerId=${encodeURIComponent(selectedCenter)}`
        : '';
      const res = await apiFetch(`/students/bulk${centerQuery}`, {
        method: 'POST',
        body: JSON.stringify({ students: validData }),
      });

      if (res.success) {
        setImportResult({
          success: true,
          importedCount: res.importedCount,
          skippedCount: res.skippedCount,
          errors: res.errors || []
        });
        window.dispatchEvent(new Event('student-mutation'));
        toast.success(`Đã nhập thành công ${res.importedCount} học viên!`);

        if (res.errors?.length === 0 && res.skippedCount === 0) {
          setTimeout(() => {
            handleReset();
            onSuccess();
            onClose();
          }, 1500);
        }
      }
    } catch (error: unknown) {
      console.error('Error importing bulk students:', error);
      setErrorMsg(error instanceof Error ? error.message : 'Lỗi khi gửi yêu cầu nhập học viên.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setValidationRows([]);
    setFileName('');
    setErrorMsg(null);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const totalValid = validationRows.filter(r => r.isValid).length;
  const totalErrors = validationRows.filter(r => !r.isValid).length;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !isUploading && onClose()}
          className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 30 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        >
          <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100 flex-shrink-0">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Nhập danh sách học viên</h2>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Hỗ trợ định dạng file Excel (.xlsx, .xls, .csv)</p>
            </div>
            <button onClick={onClose} disabled={isUploading} className="p-2 rounded-full hover:bg-slate-100 transition-colors disabled:opacity-50">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 min-h-[300px]">
            {errorMsg && (
              <div className="p-4 mb-6 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-rose-800">Phát hiện lỗi</h4>
                  <p className="text-xs font-semibold text-rose-600 mt-1">{errorMsg}</p>
                </div>
                <button onClick={() => setErrorMsg(null)} className="p-1 hover:bg-rose-100 rounded-lg text-rose-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {importResult ? (
              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 text-center py-6">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto border border-emerald-100 shadow-sm shadow-emerald-50">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Kết quả nhập dữ liệu</h3>
                  <p className="text-slate-500 text-sm mt-1">Đã xử lý xong danh sách học viên từ file <strong>{fileName}</strong></p>
                </div>
                <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                    <span className="text-2xl font-black text-emerald-600">{importResult.importedCount}</span>
                    <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">Học viên mới đã tạo</p>
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                    <span className="text-2xl font-black text-amber-500">{importResult.skippedCount}</span>
                    <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">Dòng bị bỏ qua/Lỗi</p>
                  </div>
                </div>
              </motion.div>
            ) : validationRows.length === 0 ? (
              <div className="space-y-6">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files.length > 0) processFile(e.dataTransfer.files[0]);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-all flex flex-col items-center justify-center group ${isDragging ? 'border-brand-primary bg-cyan-50/30' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/30'}`}
                >
                  <input type="file" ref={fileInputRef} onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])} className="hidden" accept=".xlsx,.xls,.csv" />
                  <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:scale-105 group-hover:text-brand-primary transition-all duration-300 shadow-sm">
                    <Upload className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-700 mt-4">Kéo & thả file Excel của bạn vào đây</h3>
                  <p className="text-xs text-slate-400 mt-1">hoặc click để chọn file từ máy tính của bạn</p>
                </div>
                <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-white rounded-xl border border-slate-100 text-brand-primary shrink-0">
                      <Download className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Chưa có file mẫu?</h4>
                      <p className="text-xs text-slate-500 mt-0.5">Tải ngay file mẫu chuẩn của hệ thống để nhập dữ liệu chính xác và không bị lỗi.</p>
                    </div>
                  </div>
                  <button onClick={handleDownloadTemplate} className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all shrink-0 shadow-sm">
                    Tải file mẫu (.xlsx)
                  </button>
                </div>
              </div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tên file:</span>
                    <span className="text-sm font-bold text-slate-800">{fileName}</span>
                  </div>
                  <div className="flex items-center gap-6 text-xs font-bold">
                    <div className="flex items-center gap-2 text-emerald-600">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span>{totalValid} Hợp lệ</span>
                    </div>
                    {totalErrors > 0 && (
                      <div className="flex items-center gap-2 text-rose-500">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                        <span>{totalErrors} Lỗi</span>
                      </div>
                    )}
                    <button onClick={handleReset} className="text-slate-400 hover:text-slate-600 transition-colors">Đặt lại</button>
                  </div>
                </div>

                <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm bg-white">
                  <div className="overflow-x-auto max-h-[350px] no-scrollbar">
                    <table className="w-full text-left text-xs min-w-[900px]">
                      <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-3 text-slate-400 font-bold text-center w-12">Dòng</th>
                          <th className="px-4 py-3 text-slate-400 font-bold w-40">Họ và tên</th>
                          <th className="px-4 py-3 text-slate-400 font-bold w-32">Số điện thoại</th>

                          <th className="px-3 py-3 text-slate-400 font-bold w-24">Học phí</th>
                          <th className="px-3 py-3 text-slate-400 font-bold w-24">Đã đóng</th>
                          <th className="px-3 py-3 text-slate-400 font-bold w-28">Ngày nhập học</th>
                          <th className="px-4 py-3 text-slate-400 font-bold">Trạng thái / Chi tiết lỗi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {validationRows.map((row) => (
                          <tr key={row.rowNum} className={`hover:bg-slate-50/50 ${!row.isValid ? 'bg-rose-50/10' : ''}`}>
                            <td className="px-4 py-3 text-slate-400 text-center font-bold">{row.rowNum}</td>
                            <td className="px-4 py-3 font-bold text-slate-800">{row.data.fullName || <span className="text-slate-300 italic">Trống</span>}</td>
                            <td className="px-4 py-3 text-slate-600">{row.data.phone || <span className="text-slate-300 italic">Trống</span>}</td>

                            <td className="px-3 py-3 text-slate-600 font-semibold">{row.data.fee}đ</td>
                            <td className="px-3 py-3 text-emerald-600 font-semibold">{(row.data.paidAmount || 0).toLocaleString('vi-VN')}đ</td>
                            <td className="px-3 py-3 text-slate-600 font-semibold">{row.data.enrollmentDate || <span className="text-slate-300 italic">Không có</span>}</td>
                            <td className="px-4 py-3">
                              {row.isValid ? (
                                <div className="flex items-center gap-1.5 text-emerald-600 font-bold">
                                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                  <span>Hợp lệ</span>
                                </div>
                              ) : (
                                <div className="flex items-start gap-1.5 text-rose-500 font-semibold">
                                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                  <span className="leading-tight">{row.errors.join('; ')}</span>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {!importResult && (
            <div className="flex items-center justify-end gap-4 px-8 py-5 border-t border-slate-100 flex-shrink-0">
              <button type="button" onClick={onClose} disabled={isUploading} className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50">Hủy</button>
              {validationRows.length > 0 && (
                <button onClick={handleImport} disabled={isUploading} className="flex items-center gap-2 px-6 py-3 bg-brand-primary hover:bg-brand-primary/95 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-100 transition-all hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 disabled:hover:translate-y-0">
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  {isUploading ? 'Đang nhập dữ liệu...' : totalValid > 0 ? `Nhập ${totalValid} học viên hợp lệ` : 'Kiểm tra lỗi trước khi nhập'}
                </button>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
