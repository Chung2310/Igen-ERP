import React, { useState, useEffect, useRef } from "react";
import {
  UploadCloud,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Trash2,
  Paperclip,
  Check,
  X,
  File
} from "lucide-react";
import { toast } from "./Toast";


interface IAttachment {
  name: string;
  url: string;
  type: string;
  uploadToken?: string;
}

interface IAssignment {
  _id: string;
  title: string;
  description?: string;
  dueDate?: string;
  attachments?: IAttachment[];
}

interface IStudent {
  _id: string;
  fullName: string;
  email: string;
}

interface ISubmission {
  _id?: string;
  attachments?: IAttachment[];
  studentNotes?: string;
  status?: string;
  score?: number;
  feedback?: string;
  submittedAt?: string;
}

export default function SubmitProofPage() {
  const token = new URLSearchParams(window.location.search).get("token");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [assignment, setAssignment] = useState<IAssignment | null>(null);
  const [student, setStudent] = useState<IStudent | null>(null);
  const [submission, setSubmission] = useState<ISubmission | null>(null);

  const [studentNotes, setStudentNotes] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<IAttachment[]>([]);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    fetchDetail();
  }, [token]);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/assignments/public/detail?token=${encodeURIComponent(token || "")}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Không thể tải thông tin bài tập.");
      }

      setAssignment(json.data.assignment);
      setStudent(json.data.student);
      setSubmission(json.data.submission);

      if (json.data.submission) {
        setStudentNotes(json.data.submission.studentNotes || "");
        setUploadedFiles(json.data.submission.attachments || []);
      }
    } catch (error: any) {
      toast.error(error.message || "Lỗi khi tải thông tin.");
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await uploadFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await uploadFiles(Array.from(e.target.files));
    }
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });

  const uploadFiles = async (files: File[]) => {
    setUploading(true);
    try {
      for (const file of files) {
        if (file.size > 20 * 1024 * 1024) {
          toast.error(`Tệp "${file.name}" vượt quá giới hạn dung lượng 20MB.`);
          continue;
        }

        const base64 = await fileToBase64(file);

        const response = await fetch(`/api/v1/assignments/public/upload?token=${encodeURIComponent(token || "")}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file: base64,
            fileName: file.name,
            mimeType: file.type,
            size: file.size,
          }),
        });

        const data = await response.json();
        if (!response.ok || !data.success || !data.url) {
          throw new Error(data.error || `Tải tệp ${file.name} thất bại.`);
        }
        setUploadedFiles((prev) => [
          ...prev,
          {
            name: file.name,
            url: data.url,
            type: file.type,
            uploadToken: data.uploadToken,
          },
        ]);
        toast.success(`Đã tải lên "${file.name}" thành công.`);
      }
    } catch (err: any) {
      toast.error(err.message || "Có lỗi xảy ra khi tải lên.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
    toast.success("Đã xóa file đính kèm.");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadedFiles.length === 0) {
      toast.error("Vui lòng tải lên ít nhất 1 tệp minh chứng bài làm.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/v1/assignments/public/submit?token=${encodeURIComponent(token || "")}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentNotes,
          attachments: uploadedFiles,
        }),
      });

      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error || "Gửi minh chứng thất bại.");
      }

      toast.success("Nộp minh chứng bài làm thành công!");
      fetchDetail();
    } catch (err: any) {
      toast.error(err.message || "Gửi minh chứng thất bại.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelSubmission = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn hủy nộp minh chứng này? Hành động này sẽ xóa toàn bộ bài làm hiện tại của bạn.")) {
      return;
    }

    setCancelling(true);
    try {
      const response = await fetch(`/api/v1/assignments/public/cancel?token=${encodeURIComponent(token || "")}`, {
        method: "POST",
      });

      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error || "Hủy nộp thất bại.");
      }

      toast.success("Đã hủy nộp minh chứng thành công.");
      setUploadedFiles([]);
      setStudentNotes("");
      fetchDetail();
    } catch (err: any) {
      toast.error(err.message || "Hủy nộp thất bại.");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
        <p className="mt-4 text-sm font-semibold text-slate-500">Đang tải thông tin bài tập...</p>
      </div>
    );
  }

  if (!token || !assignment || !student) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md text-center bg-white p-8 rounded-3xl border border-slate-200/80 shadow-xl">
          <AlertTriangle className="h-16 w-16 text-rose-500 mx-auto mb-4 animate-bounce" />
          <h2 className="text-xl font-extrabold text-slate-800">Liên kết không hợp lệ</h2>
          <p className="text-xs text-slate-500 mt-2.5 leading-relaxed">
            Đường dẫn nộp bài tập này đã hết hạn, không chính xác hoặc đã bị xóa khỏi hệ thống. Vui lòng kiểm tra lại email hoặc liên hệ với giảng viên của bạn.
          </p>
        </div>
      </div>
    );
  }

  const isSubmitted = submission && (submission.status === "submitted" || submission.status === "graded" || submission.status === "late");
  const isGraded = submission && submission.status === "graded";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50/50 px-3 py-6 font-sans sm:px-6 sm:py-12 lg:px-8">
      <div className="relative w-full max-w-3xl space-y-6 overflow-hidden rounded-3xl border border-slate-200/60 bg-white/70 p-4 shadow-2xl backdrop-blur-md sm:space-y-8 sm:p-6 md:p-10">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-violet-500/5 pointer-events-none" />

        {/* Status Alert Bar */}
        {isSubmitted && (
          <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs font-semibold ${isGraded ? "bg-emerald-50 border-emerald-250 text-emerald-800" : "bg-indigo-50 border-indigo-250 text-indigo-800"}`}>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 shrink-0" />
              <span>
                {isGraded
                  ? `Đã chấm điểm: ${submission.score}/10`
                  : `Đã ghi nhận bài nộp vào lúc ${new Date(submission.submittedAt || "").toLocaleString("vi-VN")}`}
              </span>
            </div>
            {!isGraded && (
              <button
                type="button"
                onClick={handleCancelSubmission}
                disabled={cancelling}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/50 rounded-xl transition flex items-center gap-1 active:scale-95 disabled:opacity-50"
              >
                {cancelling ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                Hủy Nộp Bài
              </button>
            )}
          </div>
        )}

        {/* Assignment info */}
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
            Nhiệm vụ Học viên
          </span>
          <h1 className="mt-3 text-2xl font-extrabold text-slate-800 leading-tight">
            {assignment.title}
          </h1>
          <p className="mt-1.5 text-xs text-slate-450">
            Học viên: <strong className="text-slate-700">{student.fullName}</strong> ({student.email})
          </p>

          <div className="mt-6 border border-slate-100 bg-slate-50/50 rounded-2xl p-4 text-xs text-slate-600 space-y-3">
            <div>
              <span className="font-bold text-slate-700 uppercase tracking-wide text-[10px] text-slate-400 block mb-1">Mô tả & Yêu cầu</span>
              <div className="whitespace-pre-line leading-relaxed">{assignment.description || "Không có mô tả thêm."}</div>
            </div>
            {assignment.dueDate && (
              <div className="border-t border-slate-200/60 pt-3 flex items-center justify-between text-slate-500">
                <span>Hạn chót nộp bài:</span>
                <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-100">
                  {new Date(assignment.dueDate).toLocaleString("vi-VN")}
                </span>
              </div>
            )}
            {assignment.attachments && assignment.attachments.length > 0 && (
              <div className="border-t border-slate-200/60 pt-3">
                <span className="font-bold text-slate-700 uppercase tracking-wide text-[10px] text-slate-400 block mb-2">Tài liệu đính kèm đề bài</span>
                <div className="flex flex-wrap gap-2">
                  {assignment.attachments.map((file, idx) => (
                    <a
                      key={idx}
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-indigo-500 hover:text-indigo-600 rounded-xl transition text-slate-600"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      <span className="max-w-[150px] truncate font-medium">{file.name}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Submission Feedback from Instructor */}
        {isGraded && submission.feedback && (
          <div className="p-4 bg-amber-50/80 border border-amber-250/50 rounded-2xl text-xs space-y-1.5">
            <span className="font-bold text-amber-800 uppercase text-[10px] tracking-wide block">Nhận xét của Giảng viên:</span>
            <p className="text-amber-900 italic font-medium leading-relaxed">"{submission.feedback}"</p>
          </div>
        )}

        {/* Upload Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Tải lên minh chứng bài làm *</label>

            {/* Dropzone container */}
            {!isGraded && (
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex cursor-pointer select-none flex-col items-center justify-center rounded-3xl border-2 border-dashed p-5 text-center transition-all duration-300 sm:p-8 ${
                  dragActive
                    ? "border-indigo-500 bg-indigo-50/30 scale-[0.99] shadow-inner"
                    : "border-slate-200 hover:border-indigo-400 hover:bg-slate-50/50 bg-white"
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  multiple
                  className="hidden"
                />
                {uploading ? (
                  <>
                    <Loader2 className="h-10 w-10 animate-spin text-indigo-650 mb-3" />
                    <span className="text-sm font-semibold text-indigo-600 animate-pulse">Đang tải tệp lên hệ thống lưu trữ...</span>
                  </>
                ) : (
                  <>
                    <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
                      <UploadCloud className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-bold text-slate-700">Kéo thả các tệp hoặc nhấp để chọn</p>
                    <p className="text-[10px] text-slate-400 mt-1 leading-normal">Hỗ trợ tải lên nhiều file cùng lúc. Giới hạn 20MB trên mỗi tệp.</p>
                  </>
                )}
              </div>
            )}

            {/* Uploaded Attachments View */}
            {uploadedFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Danh sách minh chứng ({uploadedFiles.length})</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {uploadedFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-2xl border border-slate-100 bg-slate-50/50 text-xs min-w-0"
                    >
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 min-w-0 flex-1 hover:text-indigo-600 transition"
                      >
                        <File className="h-4 w-4 text-slate-450 shrink-0" />
                        <span className="truncate font-semibold text-slate-750">{file.name}</span>
                      </a>
                      {!isGraded && (
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition hover:bg-rose-50 rounded-lg ml-2"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Student Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Ghi chú gửi Giảng viên (Không bắt buộc)</label>
            <textarea
              value={studentNotes}
              onChange={(e) => setStudentNotes(e.target.value)}
              disabled={isGraded}
              rows={4}
              placeholder="Nhập ghi chú hoặc câu trả lời của bạn gửi giảng viên..."
              className="w-full rounded-2xl border border-slate-200 bg-white py-3 px-4 text-xs leading-relaxed outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition disabled:bg-slate-50 disabled:text-slate-450 placeholder-slate-400"
            />
          </div>

          {/* Submit buttons */}
          {!isGraded && (
            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
              <button
                type="submit"
                disabled={submitting || uploading || uploadedFiles.length === 0}
                className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl text-xs font-extrabold shadow-md hover:shadow-lg hover:shadow-indigo-200/60 active:scale-95 transition disabled:opacity-50 disabled:active:scale-100 flex items-center gap-2"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {isSubmitted ? "Cập Nhật Minh Chứng" : "Nộp Minh Chứng Bài Làm"}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
