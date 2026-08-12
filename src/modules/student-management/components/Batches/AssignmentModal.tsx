import React, { useState, useEffect, useRef } from "react";
import {
  X,
  FileText,
  Plus,
  Calendar,
  Loader2,
  Paperclip,
  Check,
  Award,
  Users,
  Clock,
  Eye,
  ChevronRight
} from "lucide-react";
import { cn } from "../../lib/utils";
import { apiFetch } from "../../lib/api";
import { useEntityLabel } from "../../hooks/useEntityLabel";
import { toast } from "../../../../pages/Toast";
import { socketService } from "../../../../services/socketService";
import { Batch, Student } from "../../types";
import { getBatchPageCopy } from "../../config/workerRecruitmentCopy";
import { getStudentQualityThresholds } from "../../api/studentQuality.api";
import { FilePreviewModal } from "../../../../components/resource/FilePreviewModal";
import { authService } from "../../../../services/authService";

interface IAttachment {
  name: string;
  url: string;
  type: string;
  uploadToken?: string;
}

const DUE_TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hour = String(Math.floor(index / 2)).padStart(2, "0");
  const minute = index % 2 ? "30" : "00";
  return `${hour}:${minute}`;
});

interface IAssignment {
  _id: string;
  title: string;
  description?: string;
  dueDate?: string;
  maxScore: number;
  attachments?: IAttachment[];
  createdAt: string;
}

interface ISubmission {
  _id: string;
  assignmentId: string;
  studentId: string;
  attachments: IAttachment[];
  studentNotes?: string;
  submissionSource?: "student" | "staff";
  submittedByUserId?: string;
  status: "submitted" | "graded" | "late";
  score?: number;
  feedback?: string;
  submittedAt: string;
  gradedAt?: string;
}

interface AssignmentModalProps {
  isOpen: boolean;
  batch: Batch;
  students: Student[];
  onClose: () => void;
}

export function AssignmentModal({ isOpen, batch, students, onClose }: AssignmentModalProps) {
  const entityLabel = useEntityLabel();
  const copy = getBatchPageCopy(entityLabel.preset);
  const isWorker = entityLabel.preset === "worker";
  const assignmentName = isWorker ? "nhiệm vụ" : "bài tập";
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [grading, setGrading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [assignments, setAssignments] = useState<IAssignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<IAssignment | null>(null);
  const [submissions, setSubmissions] = useState<ISubmission[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [manualAttachments, setManualAttachments] = useState<IAttachment[]>([]);
  const [previewFile, setPreviewFile] = useState<IAttachment | null>(null);
  const [manualNotes, setManualNotes] = useState("");
  const [manualSubmitting, setManualSubmitting] = useState(false);

  // Form State for creating assignment
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newMaxScore, setNewMaxScore] = useState("10");
  const [isTimeMenuOpen, setIsTimeMenuOpen] = useState(false);
  const dueDatePart = newDueDate.slice(0, 10);
  const dueTimePart = newDueDate.slice(11, 16) || "20:00";
  const updateDueDate = (date: string, time = dueTimePart) => setNewDueDate(date ? `${date}T${time || "20:00"}` : "");
  const setQuickDueDate = (offsetDays: number) => {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    const localDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    updateDueDate(localDate, "20:00");
  };
  const [newAttachments, setNewAttachments] = useState<IAttachment[]>([]);

  // Form State for grading
  const [score, setScore] = useState<number | string>("");
  const [feedback, setFeedback] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const manualFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchAssignments();
      void getStudentQualityThresholds().then((settings) => setNewMaxScore(String(settings.assignmentMaxScore || 10))).catch(() => undefined);
    }
  }, [isOpen, batch.id]);

  useEffect(() => {
    if (selectedAssignment) {
      fetchSubmissions(selectedAssignment._id);
    } else {
      setSubmissions([]);
      setSelectedStudentId(null);
    }
  }, [selectedAssignment]);

  // Real-time socket event listening
  useEffect(() => {
    if (!isOpen) return;

    const unsubscribe = socketService.on("submission_updated", (data: any) => {
      // Check if it belongs to current active assignment
      if (selectedAssignment && data.assignmentId === selectedAssignment._id) {
        toast.info(`Có ${entityLabel.singular} vừa cập nhật minh chứng ${assignmentName}.`);
        fetchSubmissions(selectedAssignment._id);
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isOpen, selectedAssignment]);

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/assignments?batchId=${batch.id}`);
      if (res && res.success) {
        setAssignments(res.data);
      }
    } catch (err: any) {
      toast.error(err.message || `Không thể tải danh sách ${assignmentName}.`);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubmissions = async (assignmentId: string) => {
    try {
      const res = await apiFetch(`/assignments/${assignmentId}/submissions`);
      if (res && res.success) {
        setSubmissions(res.data);
      }
    } catch (err: any) {
      toast.error(err.message || "Không thể tải bài nộp.");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setUploading(true);
      try {
        const file = e.target.files[0];
        if (file.size > 20 * 1024 * 1024) {
          toast.error("Dung lượng tệp đính kèm không vượt quá 20MB.");
          return;
        }

        const data = await authService.uploadManagedFile(file, "student.assignment");
        setNewAttachments((prev) => [
          ...prev,
          {
            name: file.name,
            url: data.url,
            type: file.type,
            uploadToken: data.uploadToken,
          },
        ]);
        toast.success(`Tải lên thành công: ${file.name}`);
      } catch (err: any) {
        toast.error(err.message || "Lỗi tải tệp.");
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    }
  };

  const handleManualProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error("Dung lượng tệp đính kèm không vượt quá 20MB.");
      const data = await authService.uploadManagedFile(file, "student.submission");
      setManualAttachments((current) => [...current, { name: file.name, url: data.url, type: file.type, uploadToken: data.uploadToken }]);
    } catch (err: any) { toast.error(err.message || "Lỗi tải minh chứng."); }
    finally { setUploading(false); if (manualFileInputRef.current) manualFileInputRef.current.value = ""; }
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      toast.error(`Vui lòng nhập tiêu đề ${assignmentName}.`);
      return;
    }

    if (newDueDate && !/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(newDueDate)) {
      toast.error("Giờ hạn nộp cần theo định dạng HH:MM, ví dụ 14:30.");
      return;
    }

    // `datetime-local` không có múi giờ. Chuyển thành ISO trước khi gửi để API
    // nhận đúng thời điểm người dùng đã chọn, đồng thời báo rõ thay vì để Joi trả
    // về lỗi chung "Dữ liệu không hợp lệ" khi hạn đã qua.
    const dueDate = newDueDate ? new Date(newDueDate) : null;
    if (dueDate && (!Number.isFinite(dueDate.getTime()) || dueDate.getTime() <= Date.now())) {
      toast.error("Hạn nộp phải là thời gian trong tương lai. Hãy chọn lại ngày hoặc giờ hạn nộp.");
      return;
    }

    setCreating(true);
    try {
      const res = await apiFetch("/assignments", {
        method: "POST",
        body: JSON.stringify({
          title: newTitle,
          description: newDescription,
          dueDate: dueDate?.toISOString(),
          maxScore: Number(newMaxScore),
          attachments: newAttachments,
          batchId: batch.id,
        }),
      });

      if (res && res.success) {
        toast.success(`Giao ${assignmentName} mới và gửi email thông báo ${entityLabel.singular} thành công!`);
        setShowCreateForm(false);
        setNewTitle("");
        setNewDescription("");
        setNewDueDate("");
        setNewMaxScore("10");
        setNewAttachments([]);
        fetchAssignments();
      }
    } catch (err: any) {
      toast.error(err.message || `Lỗi khi giao ${assignmentName}.`);
    } finally {
      setCreating(false);
    }
  };

  const handleGradeSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignment || !selectedStudentId) return;

    const maxScore = selectedAssignment.maxScore || 10;
    if (score === "" || isNaN(Number(score)) || Number(score) < 0 || Number(score) > maxScore) {
      toast.error(`Điểm số phải là số trong khoảng 0 đến ${maxScore}.`);
      return;
    }

    setGrading(true);
    try {
      const res = await apiFetch(`/assignments/${selectedAssignment._id}/students/${selectedStudentId}/grade`, {
        method: "POST",
        body: JSON.stringify({
          score: Number(score),
          feedback,
        }),
      });

      if (res && res.success) {
        toast.success("Chấm điểm bài nộp thành công.");
        setScore("");
        setFeedback("");
        setSelectedStudentId(null);
        fetchSubmissions(selectedAssignment._id);
      }
    } catch (err: any) {
      toast.error(err.message || "Lỗi khi chấm điểm.");
    } finally {
      setGrading(false);
    }
  };

  const handleStaffSubmit = async () => {
    if (!selectedAssignment || !selectedStudentId || !manualAttachments.length) { toast.warning("Hãy tải lên ít nhất một minh chứng bài làm."); return; }
    setManualSubmitting(true);
    try {
      await apiFetch(`/assignments/${selectedAssignment._id}/students/${selectedStudentId}/submit`, { method: "POST", body: JSON.stringify({ attachments: manualAttachments, studentNotes: manualNotes }) });
      toast.success("Đã lưu bài nộp hộ học viên. Bạn có thể chấm điểm ngay.");
      setManualAttachments([]); setManualNotes("");
      await fetchSubmissions(selectedAssignment._id);
    } catch (err: any) { toast.error(err.message || "Không thể lưu bài nộp hộ."); }
    finally { setManualSubmitting(false); }
  };

  if (!isOpen) return null;

  // Lọc học viên thuộc lớp
  const batchStudents = students.filter((s) => batch.learnerIds.includes(s.id));

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans text-left animate-in fade-in duration-200">
      <div className="bg-white border border-slate-100 rounded-3xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-205">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-indigo-50 text-indigo-650 flex items-center justify-center">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wide">
                {isWorker ? "Nhiệm vụ & Minh chứng" : "Bài tập & Minh chứng"}
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                {copy.entityName}: <span className="text-indigo-600">{batch.code}</span> • {copy.courseLabel}: {batch.courseTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left Column: Assignment list & Creator */}
          <div className="w-1/3 border-r border-slate-100 flex flex-col bg-slate-50/20">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                {isWorker ? "Nhiệm vụ" : "Bài tập"} đã giao ({assignments.length})
              </span>
              {!showCreateForm && (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black flex items-center gap-1 transition active:scale-95 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" /> Giao bài
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {showCreateForm ? (
                /* Form giao bài mới */
                <form onSubmit={handleCreateAssignment} className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-3.5">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <span className="text-[10px] font-extrabold text-indigo-600 uppercase">Giao {assignmentName} mới</span>
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="text-slate-400 hover:text-slate-600 text-xs font-semibold cursor-pointer"
                    >
                      Hủy
                    </button>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tiêu đề *</label>
                    <input
                      type="text"
                      required
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="Ví dụ: Hoàn thiện CRUD sản phẩm..."
                      className="w-full rounded-xl border border-slate-200 py-2 px-3 text-xs outline-none focus:border-indigo-500 transition placeholder-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Mô tả/Yêu cầu</label>
                    <textarea
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      placeholder={`Mô tả chi tiết yêu cầu ${assignmentName}...`}
                      rows={3}
                      className="w-full rounded-xl border border-slate-200 py-2 px-3 text-xs outline-none focus:border-indigo-500 transition placeholder-slate-400 resize-none"
                    />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between"><label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Hạn nộp</label><button type="button" onClick={() => setNewDueDate("")} className="text-[10px] font-semibold text-slate-400 hover:text-slate-600">Không đặt hạn</button></div>
                    <div className="grid grid-cols-[1fr_92px] gap-2">
                      <label className="relative"><Calendar className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" /><input type="date" value={dueDatePart} onChange={(e) => updateDueDate(e.target.value)} className="w-full rounded-xl border border-slate-200 py-2 pl-8 pr-2 text-xs outline-none transition focus:border-indigo-500" /></label>
                      <label className="relative"><Clock className="pointer-events-none absolute left-2 top-3 h-3.5 w-3.5 text-slate-400" /><input type="text" value={dueTimePart} disabled={!dueDatePart} inputMode="numeric" placeholder="20:00" onFocus={() => setIsTimeMenuOpen(true)} onBlur={() => window.setTimeout(() => setIsTimeMenuOpen(false), 150)} onChange={(e) => { updateDueDate(dueDatePart, e.target.value); setIsTimeMenuOpen(true); }} className="w-full rounded-xl border border-slate-200 py-2 pl-7 pr-1 text-xs outline-none transition focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-300" aria-label="Giờ hạn nộp" title="Nhập giờ theo định dạng HH:MM" />{isTimeMenuOpen && dueDatePart ? <div className="absolute right-0 top-[calc(100%+4px)] z-30 max-h-44 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">{DUE_TIME_OPTIONS.filter((time) => time.includes(dueTimePart)).map((time) => <button key={time} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { updateDueDate(dueDatePart, time); setIsTimeMenuOpen(false); }} className="block w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700">{time}</button>)}</div> : null}</label>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5"><button type="button" onClick={() => setQuickDueDate(0)} className="rounded-md border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-500 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700">Hôm nay · 20:00</button><button type="button" onClick={() => setQuickDueDate(1)} className="rounded-md border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-500 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700">Ngày mai · 20:00</button></div>
                  </div>
                  <div>
                    <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-slate-400">Thang điểm bài tập</label>
                    <input type="number" min="1" max="10000" required value={newMaxScore} onChange={(event) => setNewMaxScore(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none transition focus:border-indigo-500" />
                    <p className="mt-1 text-[10px] text-slate-400">Mặc định theo cấu hình trung tâm; có thể đổi riêng cho bài này.</p>
                  </div>

                  {/* Attachment creation */}
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tài liệu đính kèm</label>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-full flex items-center justify-center gap-1.5 py-2 border border-dashed border-slate-300 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
                      Đính kèm đề bài
                    </button>
                    {newAttachments.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {newAttachments.map((f, i) => (
                          <div key={i} className="flex items-center justify-between bg-slate-50 border border-slate-100 p-2 rounded-lg text-[10px] min-w-0">
                            <button type="button" onClick={() => setPreviewFile(f)} className="flex min-w-0 items-center gap-1 truncate text-left font-semibold text-slate-650 hover:text-indigo-600" title="Xem trước"><span className="truncate max-w-[150px]">{f.name}</span><Eye className="h-3 w-3 shrink-0" /></button>
                            <button
                              type="button"
                              onClick={() => setNewAttachments(prev => prev.filter((_, idx) => idx !== i))}
                              className="text-rose-500 hover:text-rose-700 ml-1 cursor-pointer"
                            >
                              Xóa
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={creating || uploading}
                    className="w-full py-2.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1 transition shadow-md active:scale-95 disabled:opacity-50 disabled:active:scale-100 cursor-pointer"
                  >
                    {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Xác nhận giao bài
                  </button>
                </form>
              ) : loading ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin text-indigo-600 mb-2" />
                  <span className="text-[10px] font-semibold">Đang tải {assignmentName}...</span>
                </div>
              ) : assignments.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <p className="text-xs">Chưa giao {assignmentName} nào.</p>
                </div>
              ) : (
                assignments.map((a) => (
                  <button
                    key={a._id}
                    onClick={() => { setSelectedAssignment(a); setSelectedStudentId(null); }}
                    className={cn(
                      "w-full text-left p-3.5 rounded-2xl border transition-all flex items-center justify-between group",
                      selectedAssignment?._id === a._id
                        ? "bg-indigo-50 border-indigo-200 text-indigo-900 shadow-sm"
                        : "bg-white border-slate-100 hover:border-indigo-200 hover:bg-slate-50/30 text-slate-700"
                    )}
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-extrabold text-xs truncate leading-snug">{a.title}</p>
                      <div className="flex items-center gap-2 mt-1.5 text-[9px] font-bold text-slate-400">
                        <span className="flex items-center gap-0.5">
                          <Calendar className="h-3 w-3" /> {new Date(a.createdAt).toLocaleDateString("vi-VN")}
                        </span>
                        {a.dueDate && (
                          <span className="flex items-center gap-0.5 text-rose-500">
                            <Clock className="h-3 w-3" /> {new Date(a.dueDate).toLocaleDateString("vi-VN")}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-350 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Center Column: Submission List of Selected Assignment */}
          <div className="w-1/3 border-r border-slate-100 flex flex-col bg-white">
            <div className="p-4 border-b border-slate-100 bg-slate-50/10">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                <Users className="h-3.5 w-3.5 text-indigo-500" />
                {entityLabel.tabLabel} trong {copy.entityNameLower} ({batchStudents.length})
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {!selectedAssignment ? (
                <div className="text-center py-20 text-slate-450">
                  <FileText className="h-10 w-10 text-slate-200 mx-auto mb-2" />
                  <p className="text-xs">Vui lòng chọn một {assignmentName} để xem trạng thái minh chứng.</p>
                </div>
              ) : (
                batchStudents.map((student) => {
                  const sub = submissions.find((s) => s.studentId === student.id);
                  const isSubmitted = sub && (sub.status === "submitted" || sub.status === "graded" || sub.status === "late");
                  const isGraded = sub && sub.status === "graded";
                  const isLate = sub && sub.status === "late";

                  return (
                    <button
                      key={student.id}
                      onClick={() => { setSelectedStudentId(student.id); setScore(sub?.score ?? ""); setFeedback(sub?.feedback ?? ""); setManualAttachments([]); setManualNotes(""); }}
                      className={cn(
                        "w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between",
                        selectedStudentId === student.id
                          ? "bg-slate-50 border-slate-300 text-slate-900 shadow-sm"
                          : "bg-white border-slate-100 hover:border-slate-200 text-slate-700"
                      )}
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-bold text-xs truncate">{student.fullName}</p>
                        <p className="text-[9px] text-slate-450 truncate mt-0.5">{student.email}</p>
                      </div>

                      <div className="shrink-0 flex items-center">
                        {isGraded ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-emerald-50 text-[9px] font-black text-emerald-600 border border-emerald-100">
                            {sub.score}/{selectedAssignment?.maxScore || 10}
                          </span>
                        ) : isSubmitted ? (
                          <span className={cn(
                            "inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-[9px] font-black border",
                            isLate 
                              ? "bg-amber-50 text-amber-600 border-amber-100" 
                              : "bg-indigo-50 text-indigo-600 border-indigo-100"
                          )}>
                            {isLate ? "Nộp muộn" : "Đã nộp"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-slate-50 text-[9px] font-bold text-slate-400 border border-slate-100">
                            Chưa nộp
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Submission details & grading */}
          <div className="w-1/3 flex flex-col bg-slate-50/20">
            <div className="p-4 border-b border-slate-100 bg-slate-50/10">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                Chi tiết & Chấm điểm
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {!selectedAssignment || !selectedStudentId ? (
                <div className="text-center py-20 text-slate-450 h-full flex flex-col items-center justify-center">
                  <Award className="h-10 w-10 text-slate-200 mb-2" />
                  <p className="text-xs">Chọn {entityLabel.singular} để bắt đầu duyệt minh chứng và chấm điểm.</p>
                </div>
              ) : (() => {
                const studentInfo = batchStudents.find((s) => s.id === selectedStudentId);
                const sub = submissions.find((s) => s.studentId === selectedStudentId);

                return (
                  <div className="space-y-5 text-xs text-slate-700">
                    
                    {/* Student Info card */}
                    <div className="bg-white border border-slate-150 rounded-2xl p-3.5 space-y-1">
                      <p className="font-extrabold text-slate-800 text-sm">{studentInfo?.fullName}</p>
                      <p className="text-slate-450 text-[10px]">{studentInfo?.email}</p>
                    </div>

                    {selectedAssignment.attachments?.length ? (
                      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-3">
                        <span className="mb-2 block text-[10px] font-black uppercase tracking-wider text-indigo-500">Tài liệu bài tập</span>
                        <div className="space-y-1">
                          {selectedAssignment.attachments.map((file, index) => (
                            <button key={`${file.url}-${index}`} type="button" onClick={() => setPreviewFile(file)} className="flex w-full items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-2 text-left text-[10px] font-semibold text-slate-700 hover:text-indigo-600">
                              <span className="truncate">{file.name}</span><span className="flex shrink-0 items-center gap-1 text-indigo-500"><Eye className="h-3 w-3" />Xem</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {/* Submission attachments */}
                    {sub ? (
                      <div className="space-y-4">
                        {sub.submissionSource === "staff" ? <span className="inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-700">Nhân viên nộp hộ</span> : null}
                        
                        {/* Attachments */}
                        <div className="space-y-2">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Tệp minh chứng đã nộp</span>
                          <div className="space-y-1.5">
                            {sub.attachments && sub.attachments.length > 0 ? (
                              sub.attachments.map((file, idx) => (
                                <button
                                  type="button"
                                  key={idx}
                                  onClick={() => setPreviewFile(file)}
                                  className="flex items-center justify-between p-2.5 rounded-xl border border-slate-150 hover:border-indigo-500 hover:text-indigo-650 bg-white transition group"
                                >
                                  <span className="truncate font-semibold max-w-[190px]">{file.name}</span>
                                  <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 group-hover:text-indigo-600"><Eye className="h-3 w-3" />Xem</span>
                                </button>
                              ))
                            ) : (
                              <p className="text-[11px] text-slate-400 italic">Không có file đính kèm.</p>
                            )}
                          </div>
                        </div>

                        {/* Student notes */}
                        <div className="space-y-1 bg-white border border-slate-150 p-3 rounded-2xl">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Ghi chú của {entityLabel.singular}</span>
                          <p className="text-slate-650 italic text-[11px] leading-relaxed whitespace-pre-wrap">{sub.studentNotes || "Không có ghi chú thêm."}</p>
                        </div>

                        {/* Grading Form */}
                        <form onSubmit={handleGradeSubmission} className="bg-white border border-slate-150 p-4 rounded-2xl space-y-4 shadow-sm">
                          <div className="flex items-center gap-1 text-[10px] font-extrabold text-indigo-600 uppercase border-b pb-2">
                            <Award className="h-3.5 w-3.5" /> Chấm điểm & Nhận xét
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-slate-450 uppercase mb-1">Điểm số (Thang điểm {selectedAssignment.maxScore || 10}) *</label>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max={selectedAssignment.maxScore || 10}
                              required
                              value={score}
                              onChange={(e) => setScore(e.target.value)}
                              placeholder={`Ví dụ: ${Math.min(8.5, selectedAssignment.maxScore || 10)}`}
                              className="w-full rounded-xl border border-slate-200 py-2 px-3 text-xs outline-none focus:border-indigo-500 transition"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-slate-450 uppercase mb-1">Nhận xét bài làm</label>
                            <textarea
                              value={feedback}
                              onChange={(e) => setFeedback(e.target.value)}
                              placeholder="Viết nhận xét của bạn..."
                              rows={3}
                              className="w-full rounded-xl border border-slate-200 py-2 px-3 text-xs outline-none focus:border-indigo-500 transition resize-none placeholder-slate-400"
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={grading}
                            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1 transition shadow-md active:scale-95 disabled:opacity-50"
                          >
                            {grading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            Lưu kết quả chấm
                          </button>
                        </form>

                      </div>
                    ) : (
                      <div className="p-8 text-center bg-white border border-slate-150 rounded-2xl flex flex-col items-center justify-center">
                        <Clock className="h-10 w-10 text-slate-200 mb-2" />
                        <input ref={manualFileInputRef} type="file" onChange={handleManualProofUpload} className="hidden" />
                        <p className="mb-3 text-[11px] text-slate-500">Nhân viên có thể tải bài làm nhận trực tiếp và lưu hộ học viên.</p>
                        <button type="button" onClick={() => manualFileInputRef.current?.click()} disabled={uploading} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-indigo-300 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">{uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}Tải minh chứng bài làm</button>
                        {manualAttachments.length ? <div className="mt-2 w-full space-y-1">{manualAttachments.map((file, index) => <div key={`${file.url}-${index}`} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1.5 text-[10px]"><button type="button" onClick={() => setPreviewFile(file)} className="flex min-w-0 items-center gap-1 truncate text-left font-semibold text-slate-600 hover:text-indigo-600" title="Xem trước"><span className="truncate">{file.name}</span><Eye className="h-3 w-3 shrink-0" /></button><button type="button" onClick={() => setManualAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="text-rose-500">Bỏ</button></div>)}</div> : null}
                        <textarea value={manualNotes} onChange={(event) => setManualNotes(event.target.value)} rows={2} placeholder="Ghi chú khi nhận bài (không bắt buộc)" className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-500" />
                        <button type="button" onClick={() => void handleStaffSubmit()} disabled={manualSubmitting || !manualAttachments.length} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-2 text-xs font-bold text-white disabled:opacity-50">{manualSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}Lưu bài nộp hộ</button>
                        <p className="text-[11px] text-slate-400 font-medium">{entityLabel.titleCase} này chưa nộp minh chứng {assignmentName}.</p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

        </div>

      </div>
      <FilePreviewModal
        item={previewFile ? {
          _id: `assignment-proof-${previewFile.url}`,
          companyCode: "",
          section: "local",
          type: "file",
          name: previewFile.name,
          parentId: null,
          fileUrl: previewFile.url,
          mimeType: previewFile.type,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } : null}
        onClose={() => setPreviewFile(null)}
        hideDownload
        hideShare
      />
    </div>
  );
}
