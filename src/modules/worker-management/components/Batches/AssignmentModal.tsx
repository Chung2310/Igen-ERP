import React, { useState, useEffect, useRef } from "react";
import {
  X,
  FileText,
  Plus,
  Calendar,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Trash2,
  Paperclip,
  Check,
  Award,
  Users,
  Clock,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { apiFetch } from "../../lib/api";
import { useEntityLabel } from "../../hooks/useEntityLabel";
import { toast } from "../../../../pages/Toast";
import { socketService } from "../../../../services/socketService";
import { Batch, Student } from "../../types";
import { getBatchPageCopy } from "../../config/workerRecruitmentCopy";

interface IAttachment {
  name: string;
  url: string;
  type: string;
}

interface IAssignment {
  _id: string;
  title: string;
  description?: string;
  dueDate?: string;
  attachments?: IAttachment[];
  createdAt: string;
}

interface ISubmission {
  _id: string;
  assignmentId: string;
  studentId: string;
  attachments: IAttachment[];
  studentNotes?: string;
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

export function AssignmentModal({
  isOpen,
  batch,
  students,
  onClose,
}: AssignmentModalProps) {
  const entityLabel = useEntityLabel();
  const copy = getBatchPageCopy(entityLabel.preset);
  const isWorker = entityLabel.preset === "worker";
  const assignmentName = isWorker ? "nhiệm vụ" : "bài tập";
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [grading, setGrading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [assignments, setAssignments] = useState<IAssignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] =
    useState<IAssignment | null>(null);
  const [submissions, setSubmissions] = useState<ISubmission[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    null,
  );

  // Form State for creating assignment
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newAttachments, setNewAttachments] = useState<IAttachment[]>([]);

  // Form State for grading
  const [score, setScore] = useState<number | string>("");
  const [feedback, setFeedback] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchAssignments();
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
        toast.info(
          `Có ${entityLabel.singular} vừa cập nhật minh chứng ${assignmentName}.`,
        );
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

        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (error) => reject(error);
        });

        const data = await apiFetch("/media/upload", {
          method: "POST",
          body: JSON.stringify({
            file: base64,
            folder: "igen_erp/assignments",
          }),
        });
        if (!data?.url) {
          throw new Error(data?.message || "Không thể tải tệp lên server.");
        }
        setNewAttachments((prev) => [
          ...prev,
          {
            name: file.name,
            url: data.url,
            type: file.type,
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

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      toast.error(`Vui lòng nhập tiêu đề ${assignmentName}.`);
      return;
    }

    setCreating(true);
    try {
      const res = await apiFetch("/assignments", {
        method: "POST",
        body: JSON.stringify({
          title: newTitle,
          description: newDescription,
          dueDate: newDueDate || undefined,
          attachments: newAttachments,
          batchId: batch.id,
        }),
      });

      if (res && res.success) {
        toast.success(
          `Giao ${assignmentName} mới và gửi email thông báo ${entityLabel.singular} thành công!`,
        );
        setShowCreateForm(false);
        setNewTitle("");
        setNewDescription("");
        setNewDueDate("");
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

    if (
      score === "" ||
      isNaN(Number(score)) ||
      Number(score) < 0 ||
      Number(score) > 10
    ) {
      toast.error("Điểm số phải là số trong khoảng 0 đến 10.");
      return;
    }

    setGrading(true);
    try {
      const res = await apiFetch(
        `/assignments/${selectedAssignment._id}/students/${selectedStudentId}/grade`,
        {
          method: "POST",
          body: JSON.stringify({
            score: Number(score),
            feedback,
          }),
        },
      );

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
                {copy.entityName}:{" "}
                <span className="text-indigo-600">{batch.code}</span> •{" "}
                {copy.courseLabel}: {batch.courseTitle}
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
                {isWorker ? "Nhiệm vụ" : "Bài tập"} đã giao (
                {assignments.length})
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
                <form
                  onSubmit={handleCreateAssignment}
                  className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-3.5"
                >
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <span className="text-[10px] font-extrabold text-indigo-600 uppercase">
                      Giao {assignmentName} mới
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="text-slate-400 hover:text-slate-600 text-xs font-semibold cursor-pointer"
                    >
                      Hủy
                    </button>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Tiêu đề *
                    </label>
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
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Mô tả/Yêu cầu
                    </label>
                    <textarea
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      placeholder={`Mô tả chi tiết yêu cầu ${assignmentName}...`}
                      rows={3}
                      className="w-full rounded-xl border border-slate-200 py-2 px-3 text-xs outline-none focus:border-indigo-500 transition placeholder-slate-400 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Hạn nộp
                    </label>
                    <input
                      type="datetime-local"
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 py-2 px-3 text-xs outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  {/* Attachment creation */}
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Tài liệu đính kèm
                    </label>
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
                      {uploading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Paperclip className="h-3.5 w-3.5" />
                      )}
                      Đính kèm đề bài
                    </button>
                    {newAttachments.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {newAttachments.map((f, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between bg-slate-50 border border-slate-100 p-2 rounded-lg text-[10px] min-w-0"
                          >
                            <span className="truncate font-semibold text-slate-650 max-w-[150px]">
                              {f.name}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setNewAttachments((prev) =>
                                  prev.filter((_, idx) => idx !== i),
                                )
                              }
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
                    {creating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    Xác nhận giao bài
                  </button>
                </form>
              ) : loading ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin text-indigo-600 mb-2" />
                  <span className="text-[10px] font-semibold">
                    Đang tải {assignmentName}...
                  </span>
                </div>
              ) : assignments.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <p className="text-xs">Chưa giao {assignmentName} nào.</p>
                </div>
              ) : (
                assignments.map((a) => (
                  <button
                    key={a._id}
                    onClick={() => {
                      setSelectedAssignment(a);
                      setSelectedStudentId(null);
                    }}
                    className={cn(
                      "w-full text-left p-3.5 rounded-2xl border transition-all flex items-center justify-between group",
                      selectedAssignment?._id === a._id
                        ? "bg-indigo-50 border-indigo-200 text-indigo-900 shadow-sm"
                        : "bg-white border-slate-100 hover:border-indigo-200 hover:bg-slate-50/30 text-slate-700",
                    )}
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-extrabold text-xs truncate leading-snug">
                        {a.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 text-[9px] font-bold text-slate-400">
                        <span className="flex items-center gap-0.5">
                          <Calendar className="h-3 w-3" />{" "}
                          {new Date(a.createdAt).toLocaleDateString("vi-VN")}
                        </span>
                        {a.dueDate && (
                          <span className="flex items-center gap-0.5 text-rose-500">
                            <Clock className="h-3 w-3" />{" "}
                            {new Date(a.dueDate).toLocaleDateString("vi-VN")}
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
                {entityLabel.tabLabel} trong {copy.entityNameLower} (
                {batchStudents.length})
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {!selectedAssignment ? (
                <div className="text-center py-20 text-slate-450">
                  <FileText className="h-10 w-10 text-slate-200 mx-auto mb-2" />
                  <p className="text-xs">
                    Vui lòng chọn một {assignmentName} để xem trạng thái minh
                    chứng.
                  </p>
                </div>
              ) : (
                batchStudents.map((student) => {
                  const sub = submissions.find(
                    (s) => s.studentId === student.id,
                  );
                  const isSubmitted =
                    sub &&
                    (sub.status === "submitted" ||
                      sub.status === "graded" ||
                      sub.status === "late");
                  const isGraded = sub && sub.status === "graded";
                  const isLate = sub && sub.status === "late";

                  return (
                    <button
                      key={student.id}
                      onClick={() => {
                        setSelectedStudentId(student.id);
                        setScore(sub?.score ?? "");
                        setFeedback(sub?.feedback ?? "");
                      }}
                      className={cn(
                        "w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between",
                        selectedStudentId === student.id
                          ? "bg-slate-50 border-slate-300 text-slate-900 shadow-sm"
                          : "bg-white border-slate-100 hover:border-slate-200 text-slate-700",
                      )}
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-bold text-xs truncate">
                          {student.fullName}
                        </p>
                        <p className="text-[9px] text-slate-450 truncate mt-0.5">
                          {student.email}
                        </p>
                      </div>

                      <div className="shrink-0 flex items-center">
                        {isGraded ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-emerald-50 text-[9px] font-black text-emerald-600 border border-emerald-100">
                            {sub.score}/10
                          </span>
                        ) : isSubmitted ? (
                          <span
                            className={cn(
                              "inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-[9px] font-black border",
                              isLate
                                ? "bg-amber-50 text-amber-600 border-amber-100"
                                : "bg-indigo-50 text-indigo-600 border-indigo-100",
                            )}
                          >
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
                  <p className="text-xs">
                    Chọn {entityLabel.singular} để bắt đầu duyệt minh chứng và
                    chấm điểm.
                  </p>
                </div>
              ) : (
                (() => {
                  const studentInfo = batchStudents.find(
                    (s) => s.id === selectedStudentId,
                  );
                  const sub = submissions.find(
                    (s) => s.studentId === selectedStudentId,
                  );

                  return (
                    <div className="space-y-5 text-xs text-slate-700">
                      {/* Student Info card */}
                      <div className="bg-white border border-slate-150 rounded-2xl p-3.5 space-y-1">
                        <p className="font-extrabold text-slate-800 text-sm">
                          {studentInfo?.fullName}
                        </p>
                        <p className="text-slate-450 text-[10px]">
                          {studentInfo?.email}
                        </p>
                      </div>

                      {/* Submission attachments */}
                      {sub ? (
                        <div className="space-y-4">
                          {/* Attachments */}
                          <div className="space-y-2">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                              Tệp minh chứng đã nộp
                            </span>
                            <div className="space-y-1.5">
                              {sub.attachments && sub.attachments.length > 0 ? (
                                sub.attachments.map((file, idx) => (
                                  <a
                                    key={idx}
                                    href={file.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-between p-2.5 rounded-xl border border-slate-150 hover:border-indigo-500 hover:text-indigo-650 bg-white transition group"
                                  >
                                    <span className="truncate font-semibold max-w-[190px]">
                                      {file.name}
                                    </span>
                                    <ExternalLink className="h-3 w-3 shrink-0 text-slate-400 group-hover:text-indigo-600 transition" />
                                  </a>
                                ))
                              ) : (
                                <p className="text-[11px] text-slate-400 italic">
                                  Không có file đính kèm.
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Student notes */}
                          <div className="space-y-1 bg-white border border-slate-150 p-3 rounded-2xl">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                              Ghi chú của {entityLabel.singular}
                            </span>
                            <p className="text-slate-650 italic text-[11px] leading-relaxed whitespace-pre-wrap">
                              {sub.studentNotes || "Không có ghi chú thêm."}
                            </p>
                          </div>

                          {/* Grading Form */}
                          <form
                            onSubmit={handleGradeSubmission}
                            className="bg-white border border-slate-150 p-4 rounded-2xl space-y-4 shadow-sm"
                          >
                            <div className="flex items-center gap-1 text-[10px] font-extrabold text-indigo-600 uppercase border-b pb-2">
                              <Award className="h-3.5 w-3.5" /> Chấm điểm & Nhận
                              xét
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-450 uppercase mb-1">
                                Điểm số (Thang điểm 10) *
                              </label>
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                max="10"
                                required
                                value={score}
                                onChange={(e) => setScore(e.target.value)}
                                placeholder="Ví dụ: 8.5"
                                className="w-full rounded-xl border border-slate-200 py-2 px-3 text-xs outline-none focus:border-indigo-500 transition"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-450 uppercase mb-1">
                                Nhận xét bài làm
                              </label>
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
                              {grading ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Check className="h-3.5 w-3.5" />
                              )}
                              Lưu kết quả chấm
                            </button>
                          </form>
                        </div>
                      ) : (
                        <div className="p-8 text-center bg-white border border-slate-150 rounded-2xl flex flex-col items-center justify-center">
                          <Clock className="h-10 w-10 text-slate-200 mb-2" />
                          <p className="text-[11px] text-slate-400 font-medium">
                            {entityLabel.titleCase} này chưa nộp minh chứng{" "}
                            {assignmentName}.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
