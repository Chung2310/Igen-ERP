/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, @typescript-eslint/no-unused-vars */
import React, { useState, useEffect } from "react";
import {
  Briefcase,
  MapPin,
  Phone,
  Mail,
  Plus,
  Search,
  CheckCircle,
  Clock,
  ExternalLink,
  ChevronRight,
  Users,
  Activity,
  Trash2,
  X,
  Calendar,
  AlertCircle,
  Tag,
  User,
  Target,
  RefreshCw,
  Paperclip,
  Mic,
  Square,
  Link2,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Video
} from "lucide-react";
import { EmployeeNode, UserProfile, HRTask, Project, TaskHistoryEntry, TaskAttachment } from "../../types";
import { getAccessToken } from "../../services/authService";
import { socketService } from "../../services/socketService";
import { toast } from "../../pages/Toast";
import { getApiErrorMessage } from "../../utils/errorMessage";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { DateTimeInput24 } from "../common/TimeInput24";
import { HrFormSelect } from "./HrFormSelect";
import { KanbanProjectSummary } from "./KanbanProjectSummary";
import { mergeSavedProject, updateProjectProgressFromTasks, shouldApplyProjectResponse } from "./kanbanProjectState";
import { calculateEstimatedHours } from "./kanbanTaskTime";
import KanbanMonthlyKpiView from "./KanbanMonthlyKpiView";

interface KanbanTabProps {
  userProfile: any;
  selectedCompanyCode: string;
  employees: EmployeeNode[];
  isManager: boolean;
  usersList: UserProfile[];
  activeBranchId?: string;
}

type KanbanViewTab = "By project" | "Board" | "All tasks" | "Monthly KPI";

const isUrl = (str?: string): boolean => {
  if (!str) return false;
  return str.startsWith("http://") || str.startsWith("https://") || str.startsWith("data:image/") || str.startsWith("/");
};

const getLocalDatetimeString = (date = new Date()) => {
  const tzOffset = date.getTimezoneOffset() * 60000; // in ms
  const localISOTime = (new Date(date.getTime() - tzOffset)).toISOString().slice(0, 16);
  return localISOTime;
};

const DEFAULT_TASK_CATEGORY = "Hướng dẫn nhân viên mới";

function formatTaskCategory(category?: string): string {
  return !category || category === "Onboarding" ? DEFAULT_TASK_CATEGORY : category;
}

// ================== ĐÍNH KÈM FILE VÀO TASK ==================

let attIdCounter = 0;
const genAttachmentId = () =>
  `att_${Date.now().toString(36)}_${(attIdCounter++).toString(36)}`;

const detectAttachmentType = (mime: string): TaskAttachment["type"] => {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "file";
};

const formatBytes = (bytes?: number) => {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** Đẩy file lên Cloudinary qua media relay sẵn có của server, trả về URL công khai */
const uploadToMediaRelay = async (file: File | Blob, fileName: string): Promise<{ url: string; uploadToken: string }> => {
  const base64Data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const res = await fetch("/api/v1/media/upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getAccessToken()}`,
    },
    body: JSON.stringify({
      file: base64Data,
      sourceType: "hr.kanban",
      fileName,
      mimeType: file.type,
      size: file.size,
    }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new Error(j?.message || j?.error || `Tải "${fileName}" lên lưu trữ thất bại.`);
  }
  const { url, uploadToken } = await res.json();
  if (!url) throw new Error(`Tải "${fileName}" lên lưu trữ thất bại.`);
  if (!uploadToken) throw new Error(`Upload token missing for "${fileName}".`);
  return { url, uploadToken };
};

const ATTACHMENT_ICONS: Record<TaskAttachment["type"], React.ReactNode> = {
  image: <ImageIcon className="h-3.5 w-3.5 text-emerald-500" />,
  video: <Film className="h-3.5 w-3.5 text-rose-500" />,
  audio: <Music className="h-3.5 w-3.5 text-purple-500" />,
  file: <FileText className="h-3.5 w-3.5 text-sky-500" />,
  link: <Link2 className="h-3.5 w-3.5 text-indigo-500" />,
};

/**
 * Khối chỉnh sửa file đính kèm dùng chung cho modal task và modal giao việc
 * theo quy trình: upload file (ảnh/video/tài liệu…), ghi âm trực tiếp, thêm link.
 */
export function AttachmentEditor({
  attachments,
  onChange,
}: {
  attachments: TaskAttachment[];
  onChange: (next: TaskAttachment[]) => void;
}) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
  const [videoRecorder, setVideoRecorder] = useState<MediaRecorder | null>(null);
  const [linkDraft, setLinkDraft] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    const oversize = list.find((f) => f.size > 25 * 1024 * 1024);
    if (oversize) {
      toast.warning(`File "${oversize.name}" vượt quá 25MB.`);
      return;
    }
    setUploading(true);
    try {
      const uploaded: TaskAttachment[] = [];
      for (const f of list) {
        const { url, uploadToken } = await uploadToMediaRelay(f, f.name);
        uploaded.push({
          id: genAttachmentId(),
          name: f.name,
          url,
          type: detectAttachmentType(f.type),
          size: f.size,
          uploadToken,
        });
      }
      onChange([...attachments, ...uploaded]);
      toast.success(`Đã đính kèm ${uploaded.length} file.`);
    } catch (err: any) {
      console.error("Lỗi upload file đính kèm:", err);
      toast.error(err?.message || "Không thể tải file lên.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
        if (blob.size === 0) return;
        setUploading(true);
        try {
          const name = `Ghi âm ${new Date().toLocaleString("vi-VN")}.webm`;
          const { url, uploadToken } = await uploadToMediaRelay(blob, name);
          onChange([
            ...attachments,
            { id: genAttachmentId(), name, url, type: "audio", size: blob.size, uploadToken },
          ]);
          toast.success("Đã đính kèm bản ghi âm.");
        } catch (err: any) {
          console.error("Lỗi upload ghi âm:", err);
          toast.error(err?.message || "Không thể tải bản ghi âm lên.");
        } finally {
          setUploading(false);
        }
      };
      mr.start();
      setRecorder(mr);
    } catch (err) {
      console.error("Không thể truy cập micro:", err);
      toast.error("Không thể truy cập micro. Hãy kiểm tra quyền trình duyệt.");
    }
  };

  const startVideoRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: mr.mimeType || "video/webm" });
        if (!blob.size) return;
        setUploading(true);
        try {
          const name = `Ghi hình ${new Date().toLocaleString("vi-VN")}.webm`;
          const { url, uploadToken } = await uploadToMediaRelay(blob, name);
          onChange([...attachments, { id: genAttachmentId(), name, url, type: "video", size: blob.size, uploadToken }]);
          toast.success("Đã đính kèm bản ghi hình.");
        } catch (err: any) {
          toast.error(err?.message || "Không thể tải bản ghi hình lên.");
        } finally { setUploading(false); }
      };
      mr.start();
      setVideoRecorder(mr);
    } catch (err) {
      console.error("Không thể truy cập camera:", err);
      toast.error("Không thể truy cập camera và micro. Hãy kiểm tra quyền trình duyệt.");
    }
  };
  const stopRecording = () => {
    recorder?.stop();
    setRecorder(null);
  };

  const addLink = () => {
    const raw = (linkDraft || "").trim();
    if (!raw) {
      setLinkDraft(null);
      return;
    }
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    let name = url;
    try {
      name = new URL(url).hostname + new URL(url).pathname;
    } catch {
      /* giữ nguyên name = url */
    }
    onChange([...attachments, { id: genAttachmentId(), name, url, type: "link" }]);
    setLinkDraft(null);
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {attachments.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-2 rounded-lg border border-gray-150 bg-slate-50 px-2.5 py-1.5 text-xs"
            >
              <span className="shrink-0">{ATTACHMENT_ICONS[att.type]}</span>
              {att.type === "audio" ? (
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <span className="truncate text-slate-600 max-w-[40%]">{att.name}</span>
                  <audio src={att.url} controls className="h-7 flex-1 min-w-0" />
                </div>
              ) : (
                <a
                  href={att.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 truncate text-slate-600 hover:text-[#007EB8] hover:underline"
                  title={att.name}
                >
                  {att.name}
                </a>
              )}
              {att.size ? (
                <span className="shrink-0 text-[10px] text-slate-400">{formatBytes(att.size)}</span>
              ) : null}
              <button
                type="button"
                onClick={() => onChange(attachments.filter((x) => x.id !== att.id))}
                className="shrink-0 rounded p-0.5 text-slate-300 hover:bg-red-50 hover:text-red-500 cursor-pointer"
                title="Gỡ đính kèm"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {linkDraft !== null ? (
        <div className="flex gap-1.5 mb-2">
          <input
            autoFocus
            value={linkDraft}
            onChange={(e) => setLinkDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addLink();
              if (e.key === "Escape") setLinkDraft(null);
            }}
            placeholder="https://… (Drive, Notion, tài liệu…) rồi Enter"
            className="flex-1 px-3 py-1.5 bg-white border border-gray-200 text-slate-800 placeholder-gray-300 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 rounded-lg text-xs"
          />
          <button
            type="button"
            onClick={addLink}
            className="px-3 rounded-lg bg-[#00ADFC] text-white hover:bg-[#0095d9] text-xs font-normal cursor-pointer"
          >
            Thêm
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1 rounded-lg border border-[#DCE7F4] px-2.5 py-1.5 text-xs font-normal text-slate-600 hover:bg-[#F5FAFE] disabled:opacity-50 cursor-pointer"
          title="Đính kèm hình ảnh, video, tài liệu…"
        >
          <Paperclip className="h-3.5 w-3.5" /> Tệp / Ảnh / Video
        </button>
        {recorder ? (
          <button
            type="button"
            onClick={stopRecording}
            className="flex items-center gap-1 rounded-lg border border-red-300 bg-red-50 px-2.5 py-1.5 text-xs font-normal text-red-600 animate-pulse cursor-pointer"
            title="Dừng và lưu bản ghi âm"
          >
            <Square className="h-3.5 w-3.5 fill-red-600" /> Dừng ghi âm
          </button>
        ) : (
          <button
            type="button"
            onClick={startRecording}
            disabled={uploading}
            className="flex items-center gap-1 rounded-lg border border-[#DCE7F4] px-2.5 py-1.5 text-xs font-normal text-slate-600 hover:bg-[#F5FAFE] disabled:opacity-50 cursor-pointer"
            title="Ghi âm trực tiếp"
          >
            <Mic className="h-3.5 w-3.5" /> Ghi âm
          </button>
        )}
        {videoRecorder ? (
          <button type="button" onClick={() => { videoRecorder.stop(); setVideoRecorder(null); }} className="flex items-center gap-1 rounded-lg border border-red-300 bg-red-50 px-2.5 py-1.5 text-xs font-normal text-red-600 animate-pulse cursor-pointer" title="Dừng và lưu bản ghi hình">
            <Square className="h-3.5 w-3.5 fill-red-600" /> Dừng ghi hình
          </button>
        ) : (
          <button type="button" onClick={startVideoRecording} disabled={uploading || !!recorder} className="flex items-center gap-1 rounded-lg border border-[#DCE7F4] px-2.5 py-1.5 text-xs font-normal text-slate-600 hover:bg-[#F5FAFE] disabled:opacity-50 cursor-pointer" title="Ghi hình trực tiếp bằng camera">
            <Video className="h-3.5 w-3.5" /> Ghi hình
          </button>
        )}
        <button
          type="button"
          onClick={() => setLinkDraft(linkDraft === null ? "" : null)}
          disabled={uploading}
          className="flex items-center gap-1 rounded-lg border border-[#DCE7F4] px-2.5 py-1.5 text-xs font-normal text-slate-600 hover:bg-[#F5FAFE] disabled:opacity-50 cursor-pointer"
          title="Đính kèm đường dẫn tài liệu"
        >
          <Link2 className="h-3.5 w-3.5" /> Thêm link
        </button>
        {uploading && (
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Đang tải lên…
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Các trường bắt buộc phải điền trước khi đánh dấu Hoàn thành —
 * đảm bảo task Done luôn đủ dữ liệu để tính KPI và truy vết.
 */
type DoneFieldKey = "description" | "dueDate" | "startTime" | "estTime";

const getMissingDoneFields = (info: {
  description?: string;
  dueDate?: string;
  startTime?: string;
  estTime?: number;
}): { key: DoneFieldKey; label: string }[] => {
  const missing: { key: DoneFieldKey; label: string }[] = [];
  if (!info.description || !info.description.trim()) missing.push({ key: "description", label: "Mô tả công việc" });
  const due = (info.dueDate || "").trim();
  if (!due || due === "Chưa cập nhật") missing.push({ key: "dueDate", label: "Hạn chót" });
  if (!info.startTime) missing.push({ key: "startTime", label: "Ngày giờ bắt đầu" });
  if (!info.estTime || info.estTime <= 0) missing.push({ key: "estTime", label: "Số giờ phải làm" });
  return missing;
};

const calculateKPI = (task: HRTask) => {
  if (!task.startTime || !task.endTime || !task.estTime) return null;
  const start = new Date(task.startTime).getTime();
  const end = new Date(task.endTime).getTime();
  if (isNaN(start) || isNaN(end) || end < start) return null;

  const actualHours = (end - start) / (1000 * 60 * 60);
  const estHours = task.estTime;

  if (actualHours <= estHours) {
    return {
      status: "ontime",
      text: "Đúng tiến độ (Đạt KPI)",
      diff: Number((estHours - actualHours).toFixed(1)),
    };
  } else {
    return {
      status: "late",
      text: `Trễ tiến độ (Trễ ${(actualHours - estHours).toFixed(1)}h)`,
      diff: Number((actualHours - estHours).toFixed(1)),
    };
  }
};

const renderAvatar = (avatar: string, sizeClasses: string = "w-8 h-8", textClass: string = "text-base") => {
  if (isUrl(avatar)) {
    return (
      <div className={`${sizeClasses} rounded-full overflow-hidden shrink-0 flex items-center justify-center border border-gray-150`}>
        <img src={avatar} className="w-full h-full object-cover" alt="Avatar nhân sự" />
      </div>
    );
  }
  return (
    <div className={`${sizeClasses} bg-slate-50 rounded-full shrink-0 flex items-center justify-center border border-gray-100 select-none`}>
      <span className={textClass}>{avatar || "👤"}</span>
    </div>
  );
};

const formatDatetime = (dtStr?: string) => {
  if (!dtStr) return "-";
  try {
    const d = new Date(dtStr);
    if (isNaN(d.getTime())) return dtStr;
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${hours}:${minutes} ${day}/${month}/${year}`;
  } catch {
    return dtStr;
  }
};

function TaskTable({
  tasks,
  showProjectColumn = false,
  projects,
  onSelectTask
}: {
  tasks: HRTask[];
  showProjectColumn?: boolean;
  projects: Project[];
  onSelectTask: (task: HRTask) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[#DCE7F4] bg-white">
        <table className={`w-full border-collapse text-left text-[11px] [&_th]:border-r [&_td]:border-r [&_th]:border-[#E5EDF5] [&_td]:border-[#EAF0F6] [&_th:last-child]:border-r-0 [&_td:last-child]:border-r-0 ${showProjectColumn ? "min-w-[1180px]" : "min-w-[1080px]"}`}>
        <thead>
          <tr className="select-none border-b border-[#DCE7F4] bg-[#F5FAFE] font-medium text-slate-600">
            <th className="w-[146px] px-2 py-2.5">Công việc</th>
            {showProjectColumn && <th className="w-[96px] px-2 py-2.5">Dự án</th>}
            <th className="w-[86px] px-2 py-2.5">Phân loại</th>
            <th className="w-[68px] px-2 py-2.5">Ưu tiên</th>
            <th className="w-[82px] px-2 py-2.5">Trạng thái</th>
            <th className="w-[92px] px-2 py-2.5">Giao cho</th>
            <th className="w-[108px] px-2 py-2.5">Hạn chót</th>
            <th className="w-[108px] px-2 py-2.5">Bắt đầu</th>
            <th className="w-[108px] px-2 py-2.5">Kết thúc</th>
            <th className="w-[52px] px-2 py-2.5 text-center">Dự tính</th>
            <th className="w-[52px] px-2 py-2.5 text-center">Thực tế</th>
            <th className="w-[96px] px-2 py-2.5">Đánh giá KPI</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#EAF0F6] bg-white">
          {tasks.length === 0 ? (
            <tr>
              <td colSpan={showProjectColumn ? 12 : 11} className="text-center py-8 text-gray-450 italic bg-white">
                Không có công việc nào.
              </td>
            </tr>
          ) : (
            tasks.map((task) => {
              const kpi = calculateKPI(task);
              return (
                <tr
                  key={task.id}
                  onClick={() => onSelectTask(task)}
                  className="hover:bg-slate-50/70 cursor-pointer transition-colors bg-white"
                >
                  {/* Công việc */}
                  <td className="px-2 py-2 text-slate-800">
                    <div className="flex max-w-[146px] items-start gap-1.5">
                      <div className="mt-0.5 shrink-0">
                        {task.status === "Done" || task.status === "done" ? (
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-[11px] text-slate-850" title={task.title}>
                          {task.title}
                        </div>
                        <div className="text-[10px] text-gray-400 truncate mt-0.5" title={task.description}>
                          {task.description || "Không có mô tả chi tiết."}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Dự án (Optional) */}
                  {showProjectColumn && (
                    <td className="max-w-[96px] truncate px-2 py-2 text-slate-500" title={projects.find(p => p.id === task.projectId)?.name || "Không có dự án"}>
                      {projects.find(p => p.id === task.projectId)?.name || "-"}
                    </td>
                  )}

                  {/* Phân loại */}
                  <td className="px-2 py-2 font-sans text-[#007EB8]">
                    {formatTaskCategory(task.category)}
                  </td>

                  {/* Ưu tiên */}
                  <td className="select-none px-2 py-2">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium border whitespace-nowrap ${task.priority === "High" ? "bg-rose-50 text-rose-700 border-rose-200" :
                      task.priority === "Low" ? "bg-slate-100 text-slate-500 border-gray-250" : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}>
                      {task.priority === "High" ? "Cao" : task.priority === "Low" ? "Thấp" : "Trung bình"}
                    </span>
                  </td>

                  {/* Trạng thái */}
                  <td className="select-none px-2 py-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border whitespace-nowrap ${task.status === "Done" || task.status === "done" ? "bg-emerald-50 text-emerald-700 border-emerald-250" :
                      task.status === "Review/Testing" ? "bg-indigo-50 text-indigo-700 border-indigo-200" :
                        task.status === "In Progress" || task.status === "doing" ? "bg-sky-50 text-sky-700 border-sky-200" : "bg-slate-100 text-slate-500 border-gray-250"
                      }`}>
                      {task.status === "Done" || task.status === "done" ? "Đã xong" :
                        task.status === "Review/Testing" ? "Kiểm tra" :
                          task.status === "In Progress" || task.status === "doing" ? "Đang làm" : "Chưa làm"}
                    </span>
                  </td>

                  {/* Giao cho */}
                  <td className="px-2 py-2">
                    <div className="flex max-w-[92px] items-center gap-1">
                      {renderAvatar(task.assigneeAvatar || "👨‍💻", "w-5 h-5", "text-[10px]")}
                      <span className="truncate text-slate-700" title={task.assignee}>{task.assignee}</span>
                    </div>
                  </td>

                  {/* Hạn chót */}
                  <td className="whitespace-nowrap px-2 py-2 text-[10px] tabular-nums text-gray-650">{formatDatetime(task.dueDate)}</td>

                  {/* Bắt đầu */}
                  <td className="whitespace-nowrap px-2 py-2 text-[10px] tabular-nums text-gray-650">{formatDatetime(task.startTime)}</td>

                  {/* Kết thúc */}
                  <td className="whitespace-nowrap px-2 py-2 text-[10px] tabular-nums text-gray-650">{formatDatetime(task.endTime)}</td>

                  {/* Dự tính */}
                  <td className="px-2 py-2 text-center tabular-nums text-slate-700">{task.estTime ?? 0}h</td>

                  {/* Thực tế */}
                  <td className="px-2 py-2 text-center tabular-nums text-slate-700">{task.actualTime ?? 0}h</td>

                  {/* Đánh giá KPI */}
                  <td className="select-none px-2 py-2">
                    {!kpi ? (
                      <span className="text-gray-400 italic text-[10px]">-</span>
                    ) : kpi.status === "ontime" ? (
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold rounded text-[10px]" title={kpi.text}>
                        ✓ Đúng hạn
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded font-bold text-[10px]" title={kpi.text}>
                        ⚠️ Trễ {kpi.diff}h
                      </span>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function KanbanTab({
  userProfile,
  selectedCompanyCode,
  employees,
  isManager,
  usersList,
  activeBranchId,
}: KanbanTabProps) {
  const [tasks, setTasks] = useState<HRTask[]>([]);
  const tasksRef = React.useRef<HRTask[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [kanbanViewTab, setKanbanViewTab] = useState<KanbanViewTab>("By project");
  const tabRefs = React.useRef<Partial<Record<KanbanViewTab, HTMLButtonElement | null>>>({});
  const [selectedKanbanTask, setSelectedKanbanTask] = useState<HRTask | null>(null);
  // Mở modal với trạng thái "Done" chọn sẵn (khi đổi trạng thái nhanh nhưng thiếu thông tin)
  const [presetDoneOnOpen, setPresetDoneOnOpen] = useState(false);
  // Popover "Hoàn thành nhanh": chỉ hỏi đúng các trường còn thiếu để đánh Done
  const [quickDone, setQuickDone] = useState<{
    task: HRTask;
    missing: { key: DoneFieldKey; label: string }[];
  } | null>(null);
  const [qdFields, setQdFields] = useState<{
    description: string;
    dueDate: string;
    startTime: string;
    estTime: number | "";
  }>({ description: "", dueDate: "", startTime: "", estTime: "" });
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeletingTask, setIsDeletingTask] = useState(false);
  const [isDeletingProject, setIsDeletingProject] = useState(false);

  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectStatus, setNewProjectStatus] = useState<Project["status"]>("not_started");
  const [newProjectPriority, setNewProjectPriority] = useState<Project["priority"]>("medium");
  const [newProjectStartAt, setNewProjectStartAt] = useState("");
  const [newProjectDueAt, setNewProjectDueAt] = useState("");
  const [newProjectAttachments, setNewProjectAttachments] = useState<TaskAttachment[]>([]);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);

  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const projectRequestGeneration = React.useRef(0);

  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAssigneeUid, setEditAssigneeUid] = useState("");
  const [editStatus, setEditStatus] = useState<"Not Started" | "In Progress" | "Review/Testing" | "Done" | "Archived">("Not Started");
  const [editPriority, setEditPriority] = useState<"High" | "Medium" | "Low">("Medium");
  const [editDueDate, setEditDueDate] = useState("");

  // New Notion Task fields
  const [editProjectId, setEditProjectId] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editEstTime, setEditEstTime] = useState<number | "">("");
  const [editActualTime, setEditActualTime] = useState<number | "">("");
  const [editTags, setEditTags] = useState("");
  const [editLinkNote, setEditLinkNote] = useState("");
  const [editAttachments, setEditAttachments] = useState<TaskAttachment[]>([]);
  const [taskHistory, setTaskHistory] = useState<TaskHistoryEntry[]>([]);
  const [editCategory, setEditCategory] = useState<string>(DEFAULT_TASK_CATEGORY);

  const [kanbanFilter, setKanbanFilter] = useState<string | null>(null);

  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  const applyTaskMutation = (updateTasks: (current: HRTask[]) => HRTask[], affectedProjectIds: Array<string | undefined>) => {
    const nextTasks = updateTasks(tasksRef.current);
    tasksRef.current = nextTasks;
    setTasks(nextTasks);
    setProjects((currentProjects) => updateProjectProgressFromTasks(currentProjects, nextTasks, affectedProjectIds));
    void fetchProjects();
  };

  const fetchTasks = React.useCallback(async () => {
    if (!selectedCompanyCode) return;
    try {
      const url = activeBranchId
        ? `/api/v1/kanban/tasks?branchId=${activeBranchId}`
        : "/api/v1/kanban/tasks";
      const res = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${getAccessToken()}`,
        },
      });
      if (!res.ok) {
        throw new Error("Không thể tải danh sách công việc");
      }
      const json = await res.json();
      const tasksData: HRTask[] = (json.data || []).map((item: any) => ({
        ...item,
        id: item._id,
      })) as HRTask[];
      tasksRef.current = tasksData;
      setTasks(tasksData);
    } catch (error) {
      console.error("Lỗi khi tải danh sách công việc:", error);
    }
  }, [selectedCompanyCode, activeBranchId]);

  const fetchProjects = React.useCallback(async () => {
    if (!selectedCompanyCode) return;
    const requestGeneration = ++projectRequestGeneration.current;
    try {
      const url = activeBranchId
        ? `/api/v1/kanban/projects?branchId=${activeBranchId}`
        : "/api/v1/kanban/projects";
      const res = await fetch(url, {
        cache: "no-store",
        headers: {
          "Authorization": `Bearer ${getAccessToken()}`,
        },
      });
      if (!res.ok) {
        throw new Error("Không thể tải danh sách dự án");
      }
      const json = await res.json();
      if (!shouldApplyProjectResponse(requestGeneration, projectRequestGeneration.current)) return;
      const projData: Project[] = (json.data || []).map((item: any) => ({
        ...item,
        id: item._id,
      }));
      setProjects(projData.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()));

      setExpandedProjects((current) => {
        if (Object.keys(current).length > 0) return current;
        return Object.fromEntries([...projData.map((project) => [project.id, true]), ["unassigned", true]]);
      });
    } catch (error) {
      console.error("Lỗi khi tải danh sách dự án:", error);
    }
  }, [selectedCompanyCode, activeBranchId]);

  useEffect(() => {
    if (selectedCompanyCode) {
      fetchTasks();
      fetchProjects();
    }
  }, [selectedCompanyCode, fetchTasks, fetchProjects]);

  // Realtime: quy trình vừa sinh task mới cho chính mình → tải lại và báo
  useEffect(() => {
    const off = socketService.on("kanban:task-created", (data: any) => {
      fetchTasks();
      fetchProjects();
      toast.success(
        `Bạn có task mới từ quy trình «${data?.workflowName || ""}»: ${data?.title || ""}`
      );
    });
    const offTaskUpdated = socketService.on("kanban:task-updated", fetchProjects);
    const offTaskDeleted = socketService.on("kanban:task-deleted", fetchProjects);
    const offProjectUpdated = socketService.on("kanban:project-updated", fetchProjects);
    return () => { off(); offTaskUpdated(); offTaskDeleted(); offProjectUpdated(); };
  }, [fetchTasks, fetchProjects, selectedCompanyCode]);

  // Deep-link từ tab Quy trình: mở modal chi tiết đúng task được trỏ tới
  useEffect(() => {
    const targetId = sessionStorage.getItem("targetKanbanTaskId");
    if (targetId && tasks.length > 0) {
      const target = tasks.find((t) => t.id === targetId);
      if (target) {
        setSelectedKanbanTask(target);
        sessionStorage.removeItem("targetKanbanTaskId");
      }
    }
  }, [tasks]);

  useEffect(() => {
    if (selectedKanbanTask) {
      setEditTitle(selectedKanbanTask.title || "");
      setEditDescription(selectedKanbanTask.description || "");
      setEditAssigneeUid(selectedKanbanTask.assigneeUid || "");

      let initialStatus = selectedKanbanTask.status || "Not Started";
      if (initialStatus === "todo") initialStatus = "Not Started";
      else if (initialStatus === "doing") initialStatus = "In Progress";
      else if (initialStatus === "done") initialStatus = "Done";
      setEditStatus(initialStatus as any);

      let initialPriority = selectedKanbanTask.priority || "Medium";
      if (initialPriority === "Cao") initialPriority = "High";
      else if (initialPriority === "Trung bình") initialPriority = "Medium";
      else if (initialPriority === "Thấp") initialPriority = "Low";
      setEditPriority(initialPriority as any);

      setEditDueDate(selectedKanbanTask.dueDate || "");

      setEditProjectId(selectedKanbanTask.projectId || "");
      setEditStartTime(selectedKanbanTask.startTime || "");
      setEditEndTime(selectedKanbanTask.endTime || "");
      setEditEstTime(selectedKanbanTask.estTime ?? "");
      setEditActualTime(selectedKanbanTask.actualTime ?? "");
      setEditTags(selectedKanbanTask.tags ? selectedKanbanTask.tags.join(", ") : "");
      setEditLinkNote(selectedKanbanTask.linkNote || "");
      setEditAttachments(selectedKanbanTask.attachments || []);
      setTaskHistory(selectedKanbanTask.history || []);
      setEditCategory(formatTaskCategory(selectedKanbanTask.category));
    }
  }, [selectedKanbanTask]);

  useEffect(() => {
    if (selectedKanbanTask && presetDoneOnOpen) {
      setEditStatus("Done");
      setPresetDoneOnOpen(false);
    }
  }, [selectedKanbanTask, presetDoneOnOpen]);

  // Tự động gán thời gian hoàn thành khi chuyển trạng thái sang Done
  useEffect(() => {
    if (editStatus === "Done" && editStartTime && !editEndTime) {
      setEditEndTime(getLocalDatetimeString());
    }
  }, [editStatus, editStartTime, editEndTime]);

  // Tự động ghi thời gian bắt đầu khi chuyển sang Đang làm (tự thu thập thay vì bắt điền tay)
  useEffect(() => {
    if (editStatus === "In Progress" && !editStartTime) {
      setEditStartTime(getLocalDatetimeString());
    }
  }, [editStatus, editStartTime]);

  // Tự động tính số giờ phải làm từ khoảng thời gian người dùng đã chọn
  useEffect(() => {
    setEditEstTime(calculateEstimatedHours(editStartTime, editDueDate));
  }, [editStartTime, editDueDate]);

  // Tự động tính số giờ thực tế khi có ngày giờ Bắt đầu và Kết thúc
  useEffect(() => {
    if (editStartTime && editEndTime) {
      const start = new Date(editStartTime).getTime();
      const end = new Date(editEndTime).getTime();
      if (!isNaN(start) && !isNaN(end) && end >= start) {
        const diffHours = Number(((end - start) / (1000 * 60 * 60)).toFixed(1));
        setEditActualTime(diffHours);
      } else {
        setEditActualTime("");
      }
    }
  }, [editStartTime, editEndTime]);

  const getDynamicKPI = () => {
    if (!editStartTime || !editEndTime || !editEstTime) return null;
    const start = new Date(editStartTime).getTime();
    const end = new Date(editEndTime).getTime();
    if (isNaN(start) || isNaN(end) || end < start) return null;

    const actualHours = (end - start) / (1000 * 60 * 60);
    const estHours = Number(editEstTime);

    if (actualHours <= estHours) {
      return {
        status: "ontime",
        text: "Đúng tiến độ (Đạt KPI)",
        diff: Number((estHours - actualHours).toFixed(1)),
      };
    } else {
      return {
        status: "late",
        text: `Trễ tiến độ (Trễ ${(actualHours - estHours).toFixed(1)} giờ)`,
        diff: Number((actualHours - estHours).toFixed(1)),
      };
    }
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKanbanTask) return;

    if (editTitle.trim() === "") {
      toast.warning("Vui lòng nhập tiêu đề công việc!");
      return;
    }

    const assignedEmp = employees.find(emp => emp.id === editAssigneeUid);
    if (!assignedEmp) {
      toast.error("Nhân sự được giao việc không hợp lệ!");
      return;
    }

    // Đánh dấu Hoàn thành → bắt buộc điền đầy đủ thông tin
    if (editStatus === "Done") {
      const missing = getMissingDoneFields({
        description: editDescription,
        dueDate: editDueDate,
        startTime: editStartTime,
        estTime: editEstTime === "" ? 0 : Number(editEstTime),
      });
      if (missing.length > 0) {
        toast.warning(`Để đánh dấu Hoàn thành, vui lòng điền đầy đủ: ${missing.map((m) => m.label).join(", ")}.`);
        return;
      }
    }

    try {
      const compCode = selectedCompanyCode || userProfile?.companyCode || "SYSTEM";
      const creatorUid = userProfile?.uid || "";
      const userName = userProfile?.displayName || userProfile?.email || "Thành viên";

      const parsedTags = editTags.split(",")
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const estNum = editEstTime === "" ? 0 : Number(editEstTime);
      const actNum = editActualTime === "" ? 0 : Number(editActualTime);

      let finalEndTime = editEndTime;
      let finalActualTime = actNum;
      if (editStatus === "Done" && editStartTime && !editEndTime) {
        finalEndTime = getLocalDatetimeString();
        const start = new Date(editStartTime).getTime();
        const end = new Date(finalEndTime).getTime();
        if (!isNaN(start) && !isNaN(end) && end >= start) {
          finalActualTime = Number(((end - start) / (1000 * 60 * 60)).toFixed(1));
        }
      }

      if (selectedKanbanTask.id === "new") {
        const initialHistory = [
          {
            time: new Date().toLocaleString("vi-VN"),
            user: userName,
            action: "Tạo công việc mới"
          }
        ];

        const newTaskDoc = {
          title: editTitle.trim(),
          description: editDescription.trim(),
          assigneeUid: editAssigneeUid,
          assignee: assignedEmp.name,
          assigneeAvatar: assignedEmp.avatar || "👨‍💻",
          dueDate: editDueDate.trim() || "Chưa cập nhật",
          priority: editPriority,
          status: editStatus,
          companyCode: compCode,
          creatorUid: creatorUid,
          createdAt: new Date().toISOString(),

          projectId: editProjectId,
          branchId: activeBranchId || undefined,
          startTime: editStartTime,
          endTime: finalEndTime,
          estTime: estNum,
          actualTime: finalActualTime,
          tags: parsedTags,
          linkNote: editLinkNote.trim(),
          attachments: editAttachments,
          history: initialHistory,
          category: editCategory
        };

        const res = await fetch("/api/v1/kanban/tasks", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${getAccessToken()}`,
          },
          body: JSON.stringify(newTaskDoc),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || "Tạo công việc thất bại");
        }

        const json = await res.json();
        const createdTask = {
          ...newTaskDoc,
          id: json.data._id,
        } as HRTask;

        toast.success("Đã thêm công việc thành công!");
        applyTaskMutation((current) => [...current, createdTask], [createdTask.projectId]);
      } else {
        const changes: string[] = [];
        if ((selectedKanbanTask.title || "") !== editTitle.trim()) {
          changes.push(`Đổi tên việc: "${selectedKanbanTask.title || 'Trống'}" → "${editTitle.trim()}"`);
        }
        if ((selectedKanbanTask.status || "") !== editStatus) {
          changes.push(`Đổi trạng thái: "${selectedKanbanTask.status}" → "${editStatus}"`);
        }
        if ((selectedKanbanTask.priority || "") !== editPriority) {
          changes.push(`Đổi độ ưu tiên: "${selectedKanbanTask.priority}" → "${editPriority}"`);
        }
        if ((selectedKanbanTask.assigneeUid || "") !== editAssigneeUid) {
          changes.push(`Đổi người thực hiện: "${selectedKanbanTask.assignee || 'Chưa phân công'}" → "${assignedEmp.name}"`);
        }
        if ((selectedKanbanTask.projectId || "") !== editProjectId) {
          const oldProj = projects.find(p => p.id === selectedKanbanTask.projectId)?.name || "Không có dự án";
          const newProj = projects.find(p => p.id === editProjectId)?.name || "Không có dự án";
          changes.push(`Chuyển dự án: "${oldProj}" → "${newProj}"`);
        }
        if ((selectedKanbanTask.dueDate || "") !== editDueDate.trim()) {
          changes.push(`Sửa hạn chót: "${selectedKanbanTask.dueDate || 'Chưa thiết lập'}" → "${editDueDate.trim() || 'Chưa thiết lập'}"`);
        }
        if ((selectedKanbanTask.startTime || "") !== editStartTime) {
          changes.push(`Sửa TG bắt đầu: "${selectedKanbanTask.startTime || 'Chưa thiết lập'}" → "${editStartTime || 'Chưa thiết lập'}"`);
        }
        if ((selectedKanbanTask.endTime || "") !== editEndTime) {
          changes.push(`Sửa TG kết thúc: "${selectedKanbanTask.endTime || 'Chưa thiết lập'}" → "${editEndTime || 'Chưa thiết lập'}"`);
        }
        if ((selectedKanbanTask.estTime ?? 0) !== estNum) {
          changes.push(`Sửa giờ dự tính: ${selectedKanbanTask.estTime ?? 0}h → ${estNum}h`);
        }
        if ((selectedKanbanTask.actualTime ?? 0) !== actNum) {
          changes.push(`Sửa giờ thực tế: ${selectedKanbanTask.actualTime ?? 0}h → ${actNum}h`);
        }
        if ((selectedKanbanTask.linkNote || "") !== editLinkNote.trim()) {
          changes.push(`Cập nhật link ghi chú`);
        }
        if (JSON.stringify(selectedKanbanTask.attachments || []) !== JSON.stringify(editAttachments)) {
          changes.push(`Cập nhật ${editAttachments.length} tệp đính kèm`);
        }
        if (formatTaskCategory(selectedKanbanTask.category) !== editCategory) {
          changes.push(`Đổi phân loại: "${formatTaskCategory(selectedKanbanTask.category)}" → "${editCategory}"`);
        }

        const updatedHistory = [
          ...(selectedKanbanTask.history || []),
          ...(changes.length > 0 ? [{
            time: new Date().toLocaleString("vi-VN"),
            user: userName,
            action: changes.join(", ")
          }] : [])
        ];

        const updatedFields = {
          title: editTitle.trim(),
          description: editDescription.trim(),
          assigneeUid: editAssigneeUid,
          assignee: assignedEmp.name,
          assigneeAvatar: assignedEmp.avatar || "👨‍💻",
          dueDate: editDueDate.trim() || "Chưa cập nhật",
          priority: editPriority,
          status: editStatus,
          projectId: editProjectId,
          startTime: editStartTime,
          endTime: finalEndTime,
          estTime: estNum,
          actualTime: finalActualTime,
          tags: parsedTags,
          linkNote: editLinkNote.trim(),
          attachments: editAttachments,
          history: updatedHistory,
          category: editCategory
        };

        const res = await fetch(`/api/v1/kanban/tasks/${selectedKanbanTask.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${getAccessToken()}`,
          },
          body: JSON.stringify(updatedFields),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || "Cập nhật công việc thất bại");
        }

        toast.success("Đã lưu thay đổi công việc!");
        applyTaskMutation((current) => current.map(t => t.id === selectedKanbanTask.id ? { ...t, ...updatedFields } as HRTask : t), [selectedKanbanTask.projectId, updatedFields.projectId]);
      }
      setSelectedKanbanTask(null);
    } catch (error: any) {
      console.error("Lỗi khi lưu công việc:", error);
      toast.error(error.message || "Không thể lưu thay đổi. Vui lòng kiểm tra quyền hạn.");
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newProjectName.trim() === "") {
      toast.warning("Vui lòng nhập tên dự án!");
      return;
    }
    try {
      const compCode = selectedCompanyCode || userProfile?.companyCode || "SYSTEM";
      const newProj = {
        name: newProjectName.trim(),
        companyCode: compCode,
        branchId: activeBranchId || undefined,
        creatorUid: userProfile?.uid || "",
        status: newProjectStatus,
        priority: newProjectPriority,
        startAt: editingProjectId ? (newProjectStartAt || null) : (newProjectStartAt || undefined),
        dueAt: editingProjectId ? (newProjectDueAt || null) : (newProjectDueAt || undefined),
        attachments: newProjectAttachments,
        createdAt: new Date().toISOString()
      };

      const res = await fetch(editingProjectId ? `/api/v1/kanban/projects/${editingProjectId}` : "/api/v1/kanban/projects", {
        method: editingProjectId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify(newProj),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Tạo dự án thất bại");
      }

      const json = await res.json();
      ++projectRequestGeneration.current;
      const createdProj = { ...json.data, id: json.data._id };

      toast.success(editingProjectId ? "Đã cập nhật dự án!" : "Đã tạo dự án mới thành công!");
      setProjects(prev => mergeSavedProject(prev, json.data, editingProjectId));
      setExpandedProjects(prev => ({ ...prev, [createdProj.id]: true }));
      setNewProjectName("");
      setNewProjectStatus("not_started"); setNewProjectPriority("medium"); setNewProjectStartAt(""); setNewProjectDueAt(""); setNewProjectAttachments([]);
      setEditingProjectId(null);
      setIsNewProjectModalOpen(false);
    } catch (error: any) {
      console.error("Lỗi khi tạo dự án:", error);
      toast.error(error.message || "Không thể tạo dự án. Vui lòng thử lại.");
    }
  };

  const moveTaskStatus = async (id: string, newStatus: "Not Started" | "In Progress" | "Review/Testing" | "Done" | "Archived") => {
    try {
      const taskObj = tasks.find(t => t.id === id);
      const userName = userProfile?.displayName || userProfile?.email || "Thành viên";
      const oldStatus = taskObj?.status || "Not Started";
      const updatedHistory = [
        ...(taskObj?.history || []),
        {
          time: new Date().toLocaleString("vi-VN"),
          user: userName,
          action: `Đổi trạng thái: "${oldStatus}" → "${newStatus}"`
        }
      ];

      let endTimeUpdate = undefined;
      let actualTimeUpdate = undefined;
      let startTimeUpdate = undefined;

      // Bắt đầu làm → tự ghi thời gian bắt đầu (không bắt người dùng điền tay)
      if (newStatus === "In Progress" && taskObj) {
        if (!taskObj.startTime) startTimeUpdate = getLocalDatetimeString();
      }

      if (newStatus === "Done" && taskObj) {
        // Thiếu thông tin → mở popover hoàn thành nhanh, chỉ hỏi đúng trường còn thiếu
        const missing = getMissingDoneFields(taskObj);
        if (missing.length > 0) {
          setQdFields({
            description: "",
            dueDate: "",
            startTime: getLocalDatetimeString(),
            estTime: "",
          });
          setQuickDone({ task: taskObj, missing });
          return;
        }
        if (taskObj.startTime && !taskObj.endTime) {
          endTimeUpdate = getLocalDatetimeString();
          const start = new Date(taskObj.startTime).getTime();
          const end = new Date(endTimeUpdate).getTime();
          if (!isNaN(start) && !isNaN(end) && end >= start) {
            actualTimeUpdate = Number(((end - start) / (1000 * 60 * 60)).toFixed(1));
          }
        }
      }

      const updateData: any = {
        status: newStatus,
        history: updatedHistory
      };
      if (endTimeUpdate !== undefined) updateData.endTime = endTimeUpdate;
      if (actualTimeUpdate !== undefined) updateData.actualTime = actualTimeUpdate;
      if (startTimeUpdate !== undefined) updateData.startTime = startTimeUpdate;

      const res = await fetch(`/api/v1/kanban/tasks/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify(updateData),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Cập nhật trạng thái thất bại");
      }

      applyTaskMutation((current) => current.map(t => t.id === id ? { ...t, ...updateData } : t), [taskObj?.projectId]);
      toast.success("Đã cập nhật trạng thái công việc!");
    } catch (error: any) {
      console.error("Lỗi khi cập nhật trạng thái công việc:", error);
      toast.error(error.message || "Không thể cập nhật trạng thái. Vui lòng thử lại.");
    }
  };

  // Gộp giá trị đã có của task với phần vừa điền trong popover rồi đánh Done
  const submitQuickDone = async () => {
    if (!quickDone) return;
    const t = quickDone.task;
    const merged = {
      description: t.description && t.description.trim() ? t.description : qdFields.description.trim(),
      dueDate:
        (t.dueDate || "").trim() && (t.dueDate || "").trim() !== "Chưa cập nhật"
          ? t.dueDate
          : qdFields.dueDate,
      startTime: t.startTime || qdFields.startTime,
      estTime:
        t.estTime && t.estTime > 0
          ? t.estTime
          : qdFields.estTime === ""
            ? 0
            : Number(qdFields.estTime),
    };
    const stillMissing = getMissingDoneFields(merged);
    if (stillMissing.length > 0) {
      toast.warning(`Vui lòng điền: ${stillMissing.map((m) => m.label).join(", ")}.`);
      return;
    }

    try {
      const userName = userProfile?.displayName || userProfile?.email || "Thành viên";
      const endTime = t.endTime || getLocalDatetimeString();
      let actualTime = t.actualTime || 0;
      const start = new Date(merged.startTime).getTime();
      const end = new Date(endTime).getTime();
      if (!isNaN(start) && !isNaN(end) && end >= start) {
        actualTime = Number(((end - start) / (1000 * 60 * 60)).toFixed(1));
      }

      const updateData: any = {
        ...merged,
        status: "Done",
        endTime,
        actualTime,
        history: [
          ...(t.history || []),
          {
            time: new Date().toLocaleString("vi-VN"),
            user: userName,
            action: `Đổi trạng thái: "${t.status}" → "Done" (hoàn thành nhanh)`,
          },
        ],
      };

      const res = await fetch(`/api/v1/kanban/tasks/${t.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify(updateData),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Cập nhật trạng thái thất bại");
      }

      applyTaskMutation((current) => current.map(x => (x.id === t.id ? { ...x, ...updateData } : x)), [t.projectId]);
      setQuickDone(null);
      toast.success("Đã hoàn thành công việc!");
    } catch (error) {
      console.error("Lỗi khi hoàn thành nhanh:", error);
      toast.error(getApiErrorMessage(error, "Không thể hoàn thành công việc. Vui lòng thử lại."));
    }
  };

  // Modal đang chọn status Done → tính live các trường còn thiếu để highlight
  const doneMissing =
    selectedKanbanTask && editStatus === "Done"
      ? getMissingDoneFields({
        description: editDescription,
        dueDate: editDueDate,
        startTime: editStartTime,
        estTime: editEstTime === "" ? 0 : Number(editEstTime),
      })
      : [];
  const missingKeySet = new Set(doneMissing.map((m) => m.key));
  const missingCls = (key: DoneFieldKey, base: string) =>
    missingKeySet.has(key) ? `${base} !border-rose-400 !bg-rose-50/60` : base;

  const deleteTask = (id: string) => {
    setTaskToDelete(id);
    return false;
  };

  const executeDeleteTask = async (id: string) => {
    setIsDeletingTask(true);
    try {
      const res = await fetch(`/api/v1/kanban/tasks/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${getAccessToken()}`,
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Xóa công việc thất bại");
      }

      const deletedTask = tasksRef.current.find((task) => task.id === id);
      applyTaskMutation((current) => current.filter(t => t.id !== id), [deletedTask?.projectId]);
      toast.success("Đã xóa công việc thành công!");
      return true;
    } catch (error: any) {
      console.error("Lỗi khi xóa công việc:", error);
      toast.error(error.message || "Không thể xóa công việc. Chỉ quản lý mới có quyền.");
      return false;
    } finally {
      setIsDeletingTask(false);
    }
  };

  const deleteProject = (id: string, name: string) => {
    setProjectToDelete({ id, name });
  };

  const executeDeleteProject = async (id: string) => {
    setIsDeletingProject(true);
    try {
      const res = await fetch(`/api/v1/kanban/projects/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${getAccessToken()}`,
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Xóa dự án thất bại");
      }

      setProjects(prev => prev.filter(p => p.id !== id));
      // Task thuộc dự án đã được server gỡ projectId → cập nhật local để hiện về nhóm "Chưa phân loại"
      const nextTasks = tasksRef.current.map(t => (t.projectId === id ? { ...t, projectId: "" } : t));
      tasksRef.current = nextTasks;
      setTasks(nextTasks);
      toast.success("Đã xóa dự án thành công!");
    } catch (error: any) {
      console.error("Lỗi khi xóa dự án:", error);
      toast.error(error.message || "Không thể xóa dự án. Vui lòng kiểm tra quyền hạn.");
    } finally {
      setIsDeletingProject(false);
    }
  };

  const visibleTasks = React.useMemo(() => {
    let list = tasks;
    if (kanbanFilter) {
      list = list.filter((t) => t.assignee.toLowerCase() === kanbanFilter.toLowerCase());
    }
    return list;
  }, [tasks, kanbanFilter]);

  const selectKanbanViewTab = (view: KanbanViewTab) => {
    setKanbanViewTab(view);
    requestAnimationFrame(() => {
      tabRefs.current[view]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    });
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto p-3 sm:p-4" id="hr_tab_content">
        <div className="space-y-4 rounded-2xl bg-white p-3 text-left text-slate-800 sm:p-4" id="job_delegation_kanban">
          {/* Header section */}
          <div className="flex flex-col gap-3 rounded-2xl border border-[#DCE7F4] bg-white p-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
              <h2 data-testid="kanban-header-title" className="shrink-0 whitespace-nowrap text-lg font-medium font-sans text-slate-800">Công việc</h2>

              {/* Tab buttons */}
              <div className="min-w-0 select-none">
                <div
                  data-testid="kanban-view-tabs"
                  className="flex min-w-0 gap-0.5 overflow-x-auto rounded-xl border border-[#DCE7F4] bg-[#F5FAFE] p-1 text-xs font-normal scrollbar-none"
                >
                  {(["By project", "Board", "All tasks", "Monthly KPI"] as const).map((vt) => (
                    <button
                      key={vt}
                      ref={(element) => {
                        tabRefs.current[vt] = element;
                      }}
                      onClick={() => selectKanbanViewTab(vt)}
                      className={`whitespace-nowrap px-2.5 py-1.5 rounded-lg transition-all cursor-pointer shrink-0 ${
                        kanbanViewTab === vt
                          ? "bg-white text-[#007EB8] shadow-xs font-medium"
                          : "text-slate-600 hover:text-[#007EB8]"
                      }`}
                    >
                      {vt === "By project" ? "Theo dự án" :
                        vt === "Board" ? "Bảng công việc" : vt === "All tasks" ? "Tất cả công việc" : "KPI tháng"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Filter and Add Task controls */}
            <div data-testid="kanban-header-controls" className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-end">
              <div data-testid="kanban-person-filter" className="w-full min-w-40 text-xs sm:w-44">
                <HrFormSelect
                  value={kanbanFilter || ""}
                  onChange={(value) => setKanbanFilter(value || null)}
                  label="Lọc nhân sự"
                  options={[{ value: "", label: "Lọc nhân sự" }, ...employees.map(emp => ({ value: emp.name, label: emp.name }))]}
                />
              </div>

              {isManager && (
                <div data-testid="kanban-manager-actions" className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setEditingProjectId(null); setNewProjectName(""); setNewProjectStatus("not_started"); setNewProjectPriority("medium"); setNewProjectStartAt(""); setNewProjectDueAt(""); setNewProjectAttachments([]); setIsNewProjectModalOpen(true); }}
                    className="flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-[#DCE7F4] px-3 py-2 text-xs font-medium text-[#007EB8] transition-all hover:bg-[#E8F7FF] active:scale-95 cursor-pointer"
                  >
                    <Target className="h-4 w-4" />
                    Tạo dự án & lĩnh vực
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (employees.length === 0) {
                        toast.warning("Vui lòng thêm nhân viên trước khi giao việc!");
                        return;
                      }
                      setSelectedKanbanTask({
                        id: "new",
                        title: "",
                        description: "",
                        assigneeUid: employees[0]?.id || "",
                        assignee: employees[0]?.name || "",
                        assigneeAvatar: employees[0]?.avatar || "👨‍💻",
                        dueDate: "",
                        priority: "Medium",
                        status: "Not Started",
                        companyCode: selectedCompanyCode,
                        creatorUid: userProfile?.uid || "",
                        createdAt: new Date().toISOString(),
                        projectId: "",
                        tags: [],
                        linkNote: "",
                        history: [],
                        category: DEFAULT_TASK_CATEGORY
                      });
                    }}
                    className="flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-[#00ADFC] hover:bg-[#0095d9] active:bg-[#0085c2] px-3 py-2 text-xs font-medium text-white shadow-xs transition-all cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    Giao việc mới
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Tab 1: Project-grouped tasks list (Notion-style toggle) */}
          {kanbanViewTab === "By project" && (
            <div className="space-y-4">
              {projects.length === 0 && tasks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#DCE7F4] bg-[#F8FCFF] px-4 py-16 text-center text-slate-500 select-none">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E8F7FF] text-[#00ADFC]"><Briefcase className="h-7 w-7" /></div>
                  <p className="text-base font-medium text-slate-800">Chưa có dự án và công việc nào</p>
                  {isManager && <p className="text-sm mt-1">Dùng “Tạo dự án & Lĩnh vực” hoặc “Giao việc mới” để bắt đầu.</p>}
                </div>
              ) : (
                <>
                  {/* Collapsible Project items */}
                  {projects.map((proj) => {
                    const projTasks = visibleTasks.filter(t => t.projectId === proj.id);
                    const isExpanded = !!expandedProjects[proj.id];

                    return (
                      <div key={proj.id} className="border border-[#DCE7F4] rounded-2xl overflow-hidden shadow-2xs">
                        {/* Project Header toggle bar */}
                        <div
                          onClick={() => setExpandedProjects(p => ({ ...p, [proj.id]: !isExpanded }))}
                          className="bg-[#F5FAFE] px-5 py-3.5 flex items-center justify-between cursor-pointer select-none hover:bg-[#E8F7FF] transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <ChevronRight className={`h-4.5 w-4.5 text-slate-550 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                            <Target className="h-4 w-4 text-[#00ADFC] shrink-0" />
                            <div className="min-w-0 flex-1"><h3 className="font-medium text-slate-800 text-sm truncate">{proj.name}</h3><KanbanProjectSummary project={proj} /></div>
                            <span className="px-2 py-0.5 bg-[#E8F7FF] border border-[#B8E8FF] text-[#007EB8] text-xs rounded-full">
                              {projTasks.length} việc
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-[10px] text-gray-400 font-medium">
                            <span>Tạo ngày: {new Date(proj.createdAt).toLocaleDateString("vi-VN")}</span>
                            {isManager && (
                              <><button type="button" onClick={(e) => { e.stopPropagation(); setEditingProjectId(proj.id); setNewProjectName(proj.name); setNewProjectStatus(proj.status || "not_started"); setNewProjectPriority(proj.priority || "medium"); setNewProjectStartAt(proj.startAt ? getLocalDatetimeString(new Date(proj.startAt)) : ""); setNewProjectDueAt(proj.dueAt ? getLocalDatetimeString(new Date(proj.dueAt)) : ""); setNewProjectAttachments(proj.attachments || []); setIsNewProjectModalOpen(true); }} className="p-1.5 rounded-lg text-[#007EB8] hover:bg-[#E8F7FF]" title="Sửa dự án"><FileText className="h-3.5 w-3.5" /></button><button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteProject(proj.id, proj.name);
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                title="Xóa dự án"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button></>
                            )}
                          </div>
                        </div>

                        {/* Project Tasks Body */}
                        {isExpanded && (
                          <div className="p-3 bg-white border-t border-gray-150 max-h-[400px] overflow-y-auto">
                            <TaskTable
                              tasks={projTasks}
                              showProjectColumn={false}
                              projects={projects}
                              onSelectTask={setSelectedKanbanTask}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Unassigned Projects block */}
                  <div className="border border-[#DCE7F4] rounded-2xl overflow-hidden shadow-2xs">
                    <div
                      onClick={() => setExpandedProjects(p => ({ ...p, unassigned: !expandedProjects.unassigned }))}
                      className="bg-[#F5FAFE] px-5 py-3.5 flex items-center justify-between cursor-pointer select-none hover:bg-[#E8F7FF] transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <ChevronRight className={`h-4.5 w-4.5 text-slate-550 transition-transform ${expandedProjects.unassigned ? "rotate-90" : ""}`} />
                        <Tag className="h-4 w-4 text-slate-500 shrink-0" />
                        <h3 className="font-medium text-slate-700 text-sm">Công việc không thuộc dự án</h3>
                        <span className="px-2 py-0.5 bg-white text-[#007EB8] text-xs rounded-full">
                          {visibleTasks.filter(t => !t.projectId).length} việc
                        </span>
                      </div>
                    </div>
                    {expandedProjects.unassigned && (
                      <div className="p-4 bg-white border-t border-gray-150 max-h-[400px] overflow-y-auto">
                        <TaskTable
                          tasks={visibleTasks.filter(t => !t.projectId)}
                          showProjectColumn={false}
                          projects={projects}
                          onSelectTask={setSelectedKanbanTask}
                        />
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Tab 2: Standard Kanban Board grid */}
          {kanbanViewTab === "Board" && (
            <div className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-2 xl:grid-cols-4" id="kanban_board_columns">
              {/* Column 1: Not Started */}
              <div className="bg-[#F8FCFF] p-3 border border-[#DCE7F4] rounded-2xl flex flex-col h-full min-h-40">
                <div className="flex justify-between items-center mb-3 select-none">
                  <span className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    Chưa bắt đầu
                  </span>
                  <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded-full text-xs font-medium">
                    {visibleTasks.filter(t => t.status === "Not Started" || t.status === "todo").length}
                  </span>
                </div>
                <div className="space-y-3.5 flex-1 overflow-y-auto max-h-[50vh] pr-1">
                  {!visibleTasks.some(t => t.status === "Not Started" || t.status === "todo") && <p className="pt-5 text-center text-xs text-slate-400">Chưa có công việc</p>}
                  {visibleTasks.filter(t => t.status === "Not Started" || t.status === "todo").map(task => (
                    <KanbanCard
                      key={task.id}
                      task={task}
                      onMove={(newSt) => moveTaskStatus(task.id, newSt)}
                      onDelete={() => deleteTask(task.id)}
                      canDelete={isManager || task.creatorUid === userProfile?.uid}
                      onClick={() => setSelectedKanbanTask(task)}
                      projects={projects}
                    />
                  ))}
                </div>
              </div>

              {/* Column 2: In Progress */}
              <div className="bg-[#F8FCFF] p-3 border border-[#DCE7F4] rounded-2xl flex flex-col h-full min-h-40">
                <div className="flex justify-between items-center mb-3 select-none">
                  <span className="text-sm font-medium text-[#007EB8] flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 text-[#00ADFC] animate-spin" />
                    Đang thực hiện
                  </span>
                  <span className="px-2 py-0.5 bg-[#E8F7FF] text-[#007EB8] rounded-full text-xs font-medium">
                    {visibleTasks.filter(t => t.status === "In Progress" || t.status === "doing").length}
                  </span>
                </div>
                <div className="space-y-3.5 flex-1 overflow-y-auto max-h-[50vh] pr-1">
                  {!visibleTasks.some(t => t.status === "In Progress" || t.status === "doing") && <p className="pt-5 text-center text-xs text-slate-400">Chưa có công việc</p>}
                  {visibleTasks.filter(t => t.status === "In Progress" || t.status === "doing").map(task => (
                    <KanbanCard
                      key={task.id}
                      task={task}
                      onMove={(newSt) => moveTaskStatus(task.id, newSt)}
                      onDelete={() => deleteTask(task.id)}
                      canDelete={isManager || task.creatorUid === userProfile?.uid}
                      onClick={() => setSelectedKanbanTask(task)}
                      projects={projects}
                    />
                  ))}
                </div>
              </div>

              {/* Column 3: Review / Testing */}
              <div className="bg-[#F8FCFF] p-3 border border-[#DCE7F4] rounded-2xl flex flex-col h-full min-h-40">
                <div className="flex justify-between items-center mb-3 select-none">
                  <span className="text-sm font-medium text-amber-700 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                    Đang kiểm thử
                  </span>
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                    {visibleTasks.filter(t => t.status === "Review/Testing").length}
                  </span>
                </div>
                <div className="space-y-3.5 flex-1 overflow-y-auto max-h-[50vh] pr-1">
                  {!visibleTasks.some(t => t.status === "Review/Testing") && <p className="pt-5 text-center text-xs text-slate-400">Chưa có công việc</p>}
                  {visibleTasks.filter(t => t.status === "Review/Testing").map(task => (
                    <KanbanCard
                      key={task.id}
                      task={task}
                      onMove={(newSt) => moveTaskStatus(task.id, newSt)}
                      onDelete={() => deleteTask(task.id)}
                      canDelete={isManager || task.creatorUid === userProfile?.uid}
                      onClick={() => setSelectedKanbanTask(task)}
                      projects={projects}
                    />
                  ))}
                </div>
              </div>

              {/* Column 4: Done */}
              <div className="bg-[#F8FCFF] p-3 border border-[#DCE7F4] rounded-2xl flex flex-col h-full min-h-40">
                <div className="flex justify-between items-center mb-3 select-none">
                  <span className="text-sm font-medium text-emerald-700 flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                    Đã hoàn thành
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                    {visibleTasks.filter(t => t.status === "Done" || t.status === "done").length}
                  </span>
                </div>
                <div className="space-y-3.5 flex-1 overflow-y-auto max-h-[50vh] pr-1">
                  {!visibleTasks.some(t => t.status === "Done" || t.status === "done") && <p className="pt-5 text-center text-xs text-slate-400">Chưa có công việc</p>}
                  {visibleTasks.filter(t => t.status === "Done" || t.status === "done").map(task => (
                    <KanbanCard
                      key={task.id}
                      task={task}
                      onMove={(newSt) => moveTaskStatus(task.id, newSt)}
                      onDelete={() => deleteTask(task.id)}
                      canDelete={isManager || task.creatorUid === userProfile?.uid}
                      onClick={() => setSelectedKanbanTask(task)}
                      projects={projects}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Detailed Tasks List View */}
          {kanbanViewTab === "All tasks" && (
            <TaskTable
              tasks={visibleTasks}
              showProjectColumn={true}
              projects={projects}
              onSelectTask={setSelectedKanbanTask}
            />
          )}

          {kanbanViewTab === "Monthly KPI" && (
            <KanbanMonthlyKpiView activeBranchId={activeBranchId} />
          )}

        </div>
      </div>

      {/* POPOVER HOÀN THÀNH NHANH — chỉ hỏi đúng các trường còn thiếu */}
      {quickDone && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center z-50 p-4"
          onClick={() => setQuickDone(null)}
        >
          <div
            className="bg-white border border-[#DCE7F4] text-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 text-left font-sans max-h-[90dvh] overflow-y-auto overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="text-lg font-medium text-slate-800">Hoàn thành công việc</h3>
              <button
                onClick={() => setQuickDone(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-500 text-white hover:bg-rose-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mb-4 line-clamp-1">{quickDone.task.title}</p>
            <p className="text-sm text-slate-500 mb-3">
              Chỉ còn thiếu {quickDone.missing.length} thông tin để hoàn thành:
            </p>
            <div className="space-y-3 text-xs">
              {quickDone.missing.some((m) => m.key === "description") && (
                <div>
                  <label className="block text-slate-600 mb-1">Mô tả công việc</label>
                  <textarea
                    value={qdFields.description}
                    onChange={(e) => setQdFields((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Kết quả / nội dung đã thực hiện..."
                    className="w-full p-2.5 bg-white border border-[#DCE7F4] focus:border-[#00ADFC] rounded-xl outline-none resize-none min-h-[64px]"
                    autoFocus
                  />
                </div>
              )}
              {quickDone.missing.some((m) => m.key === "dueDate") && (
                <div>
                  <label className="block text-slate-600 mb-1">Hạn chót</label>
                  <DateTimeInput24
                    value={qdFields.dueDate}
                    onChange={(v) => setQdFields((f) => ({ ...f, dueDate: v }))}
                    className="w-full"
                  />
                </div>
              )}
              {quickDone.missing.some((m) => m.key === "startTime") && (
                <div>
                  <label className="block text-slate-600 mb-1">Ngày giờ bắt đầu</label>
                  <DateTimeInput24
                    value={qdFields.startTime}
                    onChange={(v) => setQdFields((f) => ({ ...f, startTime: v }))}
                    className="w-full"
                  />
                </div>
              )}
              {quickDone.missing.some((m) => m.key === "estTime") && (
                <div>
                  <label className="block text-slate-600 mb-1">Số giờ phải làm (h)</label>
                  <input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={qdFields.estTime}
                    onChange={(e) =>
                      setQdFields((f) => ({
                        ...f,
                        estTime: e.target.value === "" ? "" : Number(e.target.value),
                      }))
                    }
                    placeholder="VD: 4"
                    className="w-full p-2.5 bg-white border border-[#DCE7F4] focus:border-[#00ADFC] rounded-xl outline-none"
                  />
                </div>
              )}
            </div>
            <div className="mt-5 flex items-center justify-between gap-2 text-sm font-medium">
              <button
                onClick={() => {
                  const t = quickDone.task;
                  setQuickDone(null);
                  setPresetDoneOnOpen(true);
                  setSelectedKanbanTask(t);
                }}
                className="text-[#007EB8] hover:text-[#00ADFC]"
              >
                Mở chi tiết đầy đủ…
              </button>
              <button
                onClick={submitQuickDone}
                className="px-4 py-2 rounded-xl text-white bg-[#00ADFC] hover:bg-[#0095d9] transition-all active:scale-95 flex items-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" /> Hoàn thành
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NOTION TASK DETAIL MODAL */}
      {selectedKanbanTask && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-[#DCE7F4] text-slate-800 rounded-2xl shadow-2xl w-full max-w-6xl relative text-left flex flex-col max-h-[calc(100dvh-2rem)] overflow-hidden font-sans">
            {/* Top Breadcrumb and Close */}
            <div className="flex shrink-0 justify-between items-center border-b border-[#E8F0F8] px-5 py-3 text-sm text-slate-500 select-none">
              <div className="flex items-center gap-1">
                <span className="text-gray-500">Nhân sự</span>
                <ChevronRight className="h-3 w-3 text-gray-450" />
                <span className="text-gray-500">Bảng giao việc</span>
                <ChevronRight className="h-3 w-3 text-gray-450" />
                <span className="text-[#007EB8]">{editCategory || DEFAULT_TASK_CATEGORY}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedKanbanTask(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-500 text-white hover:bg-rose-600 cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">

            {/* Editable Title Input */}
            <div className="mb-3">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Tiêu đề công việc..."
                className="w-full rounded-xl border border-[#DCE7F4] bg-white px-3 py-2.5 text-lg font-normal text-slate-800 placeholder-slate-400 outline-none focus:border-[#00ADFC] focus:ring-2 focus:ring-[#00ADFC]/15 font-sans"
              />
            </div>

            {/* Notion properties matrix table */}
            <div className="grid grid-cols-1 gap-3 border-b border-[#E8F0F8] pb-3 text-sm md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2 lg:contents">
                <div className="flex items-center gap-4">
                  <span className="w-24 text-slate-600 select-none flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-[#00ADFC]" /> Giao cho</span>
                  <div className="min-w-0 flex-1"><HrFormSelect value={editAssigneeUid} onChange={setEditAssigneeUid} label="Giao cho" options={employees.map(emp => ({ value: emp.id, label: emp.name }))} /></div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="w-24 text-slate-600 select-none flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-[#00ADFC]" /> Trạng thái</span>
                  <div className="min-w-0 flex-1"><HrFormSelect value={editStatus} onChange={(value) => setEditStatus(value as typeof editStatus)} label="Trạng thái" options={[{ value: "Not Started", label: "Chưa bắt đầu" }, { value: "In Progress", label: "Đang thực hiện" }, { value: "Review/Testing", label: "Đang kiểm thử" }, { value: "Done", label: "Đã hoàn thành" }]} /></div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="w-24 text-slate-600 select-none flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5 text-[#00ADFC]" /> Độ ưu tiên</span>
                  <div className="min-w-0 flex-1"><HrFormSelect value={editPriority} onChange={(value) => setEditPriority(value as typeof editPriority)} label="Độ ưu tiên" options={[{ value: "High", label: "Cao" }, { value: "Medium", label: "Trung bình" }, { value: "Low", label: "Thấp" }]} /></div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="w-24 text-slate-600 select-none flex items-center gap-1.5"><Tag className="w-3.5 h-3.5 text-[#00ADFC]" /> Phân loại</span>
                  <input
                    type="text"
                    list="task-category-options"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    placeholder="Ví dụ: Hướng dẫn nhân viên mới, Tiếp thị, Kỹ thuật..."
                    className="min-w-0 flex-1 rounded-xl border border-[#DCE7F4] bg-white px-3 py-2 text-sm outline-none focus:border-[#00ADFC] focus:ring-2 focus:ring-[#00ADFC]/15 transition-all"
                  />
                  <datalist id="task-category-options">
                    <option value={DEFAULT_TASK_CATEGORY} />
                    <option value="Đào tạo" />
                    <option value="Tuyển dụng" />
                    <option value="Văn hóa" />
                  </datalist>
                </div>
              </div>

              <div className="space-y-2 lg:contents">
                <div className="flex items-center gap-4">
                  <span className="w-24 text-slate-600 select-none flex items-center gap-1.5"><Target className="w-3.5 h-3.5 text-[#00ADFC]" /> Thuộc dự án</span>
                  <div className="min-w-0 flex-1"><HrFormSelect value={editProjectId} onChange={setEditProjectId} label="Thuộc dự án" options={[{ value: "", label: "Không gán dự án" }, ...projects.map(p => ({ value: p.id, label: p.name }))]} /></div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="w-24 text-slate-600 select-none flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-[#00ADFC]" /> Hạn chót</span>
                  <DateTimeInput24
                    value={editDueDate}
                    onChange={setEditDueDate}
                    className={missingCls("dueDate", "min-w-0 flex-1")}
                  />
                </div>

                <div className="flex items-center gap-4">
                  <span className="w-24 text-slate-600 select-none flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-[#00ADFC]" /> Bắt đầu</span>
                  <DateTimeInput24
                    value={editStartTime}
                    onChange={setEditStartTime}
                    className={missingCls("startTime", "min-w-0 flex-1")}
                  />
                </div>

                <div className="flex items-center gap-4">
                  <span className="w-24 text-slate-600 select-none flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-[#00ADFC]" /> Kết thúc</span>
                  <DateTimeInput24
                    value={editEndTime}
                    onChange={setEditEndTime}
                    className="min-w-0 flex-1"
                  />
                </div>

                <div className="flex items-center gap-4">
                  <span className="w-24 text-slate-600 select-none flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-[#00ADFC]" /> Số giờ (h)</span>
                  <div className="flex-1 flex gap-2">
                    <input
                      type="number"
                      placeholder="Số giờ phải làm"
                      value={editEstTime}
                      onChange={(e) => setEditEstTime(e.target.value === "" ? "" : Number(e.target.value))}
                      className={missingCls("estTime", "w-1/2 rounded-xl border border-[#DCE7F4] bg-white px-3 py-2 text-sm outline-none focus:border-[#00ADFC]")}
                    />
                    <input
                      type="number"
                      placeholder="Thực tế"
                      value={editActualTime}
                      onChange={(e) => setEditActualTime(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-1/2 rounded-xl border border-[#DCE7F4] bg-white px-3 py-2 text-sm outline-none focus:border-[#00ADFC]"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="w-24 text-slate-600 select-none flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-[#00ADFC]" /> Đánh giá KPI</span>
                  <div className="flex-1">
                    {(() => {
                      const kpi = getDynamicKPI();
                      if (!kpi) return <span className="text-gray-450 italic text-[10px]">Chưa đủ dữ liệu tính KPI</span>;
                      return kpi.status === "ontime" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-250 font-bold rounded-lg text-[10px]">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          {kpi.text}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-250 font-bold rounded-lg text-[10px]">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                          {kpi.text}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {/* Additional meta fields (Tags & Link note) */}
            <div className="grid grid-cols-1 gap-3 border-b border-[#E8F0F8] py-3 text-xs md:grid-cols-2">
              <div>
                <label className="mb-1.5 flex items-center gap-1 text-slate-600 select-none"><Tag className="w-3.5 h-3.5 text-[#00ADFC]" /> Nhãn (cách nhau bằng dấu phẩy)</label>
                <input
                  type="text"
                  placeholder="Ví dụ: máy chủ, kết nối, bảo mật"
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  className="w-full rounded-xl border border-[#DCE7F4] bg-white px-3 py-2 outline-none focus:border-[#00ADFC] focus:ring-2 focus:ring-[#00ADFC]/15"
                />
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-1 text-slate-600 select-none"><ExternalLink className="w-3.5 h-3.5 text-[#00ADFC]" /> Link ghi chú / Tài liệu đính kèm</label>
                <input
                  type="text"
                  placeholder="Ví dụ: http://notion.so/igen-plan"
                  value={editLinkNote}
                  onChange={(e) => setEditLinkNote(e.target.value)}
                  className="w-full rounded-xl border border-[#DCE7F4] bg-white px-3 py-2 outline-none focus:border-[#00ADFC] focus:ring-2 focus:ring-[#00ADFC]/15"
                />
              </div>
            </div>

            <div className="border-b border-[#E8F0F8] py-3 text-xs">
              <label className="mb-2 flex items-center gap-1 text-slate-600 select-none"><Paperclip className="w-3.5 h-3.5 text-[#00ADFC]" /> Tệp, ảnh, video, ghi âm và liên kết</label>
              <AttachmentEditor attachments={editAttachments} onChange={setEditAttachments} />
            </div>
            {/* Description field */}
            <div className="flex flex-col py-3 text-xs">
              <label className="block text-slate-600 mb-1.5 select-none">Mô tả công việc chi tiết</label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Nhập ghi chú chi tiết cho nhân viên thực hiện..."
                className={missingCls("description", "w-full p-3 bg-white border border-[#DCE7F4] focus:border-[#00ADFC] focus:ring-2 focus:ring-[#00ADFC]/15 rounded-xl outline-none resize-y min-h-[72px] h-[76px]")}
              />
            </div>

            {/* Task history log */}
            {selectedKanbanTask.id !== "new" && taskHistory.length > 0 && (
              <div className="border-t border-[#E8F0F8] pt-2 max-h-[90px] overflow-y-auto text-[10px]">
                <span className="block font-medium text-slate-600 mb-2 select-none">Nhật ký thay đổi ({taskHistory.length})</span>
                <div className="space-y-1.5 font-mono text-slate-500 text-left">
                  {taskHistory.slice().reverse().map((hist, hidx) => (
                    <div key={hidx} className="flex gap-2">
                      <span className="text-gray-400">[{hist.time}]</span>
                      <strong className="text-indigo-650 shrink-0">{hist.user}:</strong>
                      <span className="truncate">{hist.action}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Creator information */}
            {selectedKanbanTask.id !== "new" && (
              <div className="pt-2 text-[10px] text-gray-400 select-none text-right font-medium">
                Giao bởi:{" "}
                <strong>
                  {usersList.find(u => u.uid === selectedKanbanTask.creatorUid)?.displayName ||
                    usersList.find(u => u.uid === selectedKanbanTask.creatorUid)?.email ||
                    "Quản trị viên"}
                </strong>{" "}
                · Vào lúc: {new Date(selectedKanbanTask.createdAt || "").toLocaleString("vi-VN")}
              </div>
            )}

            {/* Cảnh báo cố định khi chọn Hoàn thành mà còn thiếu thông tin */}
            {doneMissing.length > 0 && (
              <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-600">
                Để đánh dấu Hoàn thành, cần điền: {doneMissing.map((m) => m.label).join(", ")}
              </div>
            )}

            </div>

            {/* Action buttons */}
            <div className="flex shrink-0 items-center justify-between border-t border-[#E8F0F8] bg-white px-5 py-3 text-sm font-normal">
              <div>
                {selectedKanbanTask.id !== "new" && (isManager || selectedKanbanTask.creatorUid === userProfile?.uid) && (
                  <button
                    type="button"
                    onClick={() => {
                      setTaskToDelete(selectedKanbanTask.id);
                    }}
                    className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl cursor-pointer transition-all active:scale-95 flex items-center gap-1.5 font-sans"
                  >
                    <Trash2 className="w-4 h-4" />
                    Xóa công việc
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedKanbanTask(null)}
                  className="px-4 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl bg-white cursor-pointer transition-all active:scale-95 font-sans"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={(e) => handleSaveTask(e)}
                  className="px-5 py-2 bg-[#00ADFC] hover:bg-[#0095d9] text-white rounded-xl shadow-xs cursor-pointer transition-all active:scale-95 font-sans"
                >
                  {selectedKanbanTask.id === "new" ? "Tạo công việc" : "Lưu thay đổi"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NEW PROJECT MODAL */}
      {isNewProjectModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center z-50 p-4">
          <form onSubmit={handleCreateProject} className="bg-white border border-[#DCE7F4] rounded-2xl shadow-xl w-full max-w-xl p-6 relative text-left space-y-5 max-h-[90dvh] overflow-y-auto overscroll-contain">
            <div className="flex justify-between items-center pb-4 border-b border-[#E8F0F8]">
              <h4 className="font-normal text-slate-800 text-lg font-sans flex items-center gap-2">
                <Target className="h-5 w-5 text-[#00ADFC]" />
                {editingProjectId ? "Cập nhật dự án" : "Tạo dự án mới"}
              </h4>
              <button
                type="button"
                onClick={() => setIsNewProjectModalOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-500 text-white hover:bg-rose-600 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <label className="block font-normal text-slate-600 mb-1.5 font-sans">Tên dự án *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Thiết kế Landing Page"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#DCE7F4] text-slate-800 placeholder-slate-400 outline-none focus:border-[#00ADFC] focus:ring-2 focus:ring-[#00ADFC]/15 rounded-xl font-sans"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="mb-1.5 block text-slate-600">Trạng thái</label><HrFormSelect value={newProjectStatus} onChange={(value) => setNewProjectStatus(value as Project["status"])} label="Trạng thái dự án" options={[{ value: "not_started", label: "Chưa bắt đầu" }, { value: "in_progress", label: "Đang thực hiện" }, { value: "paused", label: "Tạm dừng" }, { value: "cancelled", label: "Đã hủy" }]} /></div>
                <div><label className="mb-1.5 block text-slate-600">Độ ưu tiên</label><HrFormSelect value={newProjectPriority} onChange={(value) => setNewProjectPriority(value as Project["priority"])} label="Độ ưu tiên dự án" options={[{ value: "low", label: "Thấp" }, { value: "medium", label: "Trung bình" }, { value: "high", label: "Cao" }, { value: "urgent", label: "Khẩn cấp" }]} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="mb-1.5 block text-slate-600">Thời gian bắt đầu</label><DateTimeInput24 value={newProjectStartAt} onChange={setNewProjectStartAt} className="w-full" /></div>
                <div><label className="mb-1.5 block text-slate-600">Hạn cuối</label><DateTimeInput24 value={newProjectDueAt} onChange={setNewProjectDueAt} className="w-full" /></div>
              </div>
              <div><label className="block text-slate-600 mb-1.5">Tài liệu</label><AttachmentEditor attachments={newProjectAttachments} onChange={setNewProjectAttachments} /></div>
            </div>

            <div className="pt-4 border-t border-[#E8F0F8] flex justify-end gap-3 text-sm font-normal">
              <button
                type="button"
                onClick={() => setIsNewProjectModalOpen(false)}
                className="px-4 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl bg-white cursor-pointer transition-all active:scale-95 font-sans"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[#00ADFC] hover:bg-[#0095d9] text-white rounded-xl cursor-pointer transition-all active:scale-95 font-sans"
              >
                Lưu dự án
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        isOpen={taskToDelete !== null}
        appearance="erp"
        showCancel={false}
        title="Xóa công việc"
        confirmLabel="Xóa công việc"
        description="Bạn có chắc chắn muốn xóa công việc này? Hành động này không thể hoàn tác và tất cả dữ liệu liên quan đến công việc sẽ bị xóa vĩnh viễn."
        onClose={() => setTaskToDelete(null)}
        onConfirm={async () => {
          if (taskToDelete) {
            const success = await executeDeleteTask(taskToDelete);
            if (success) {
              if (selectedKanbanTask && selectedKanbanTask.id === taskToDelete) {
                setSelectedKanbanTask(null);
              }
            }
            setTaskToDelete(null);
          }
        }}
        isSubmitting={isDeletingTask}
        tone="danger"
      />

      <ConfirmDialog
        isOpen={projectToDelete !== null}
        appearance="erp"
        showCancel={false}
        title="Xóa dự án"
        confirmLabel="Xóa dự án"
        description={`Bạn có chắc chắn muốn xóa dự án "${projectToDelete?.name}"? Các công việc thuộc dự án này sẽ được tự động chuyển về nhóm "Chưa phân loại".`}
        onClose={() => setProjectToDelete(null)}
        onConfirm={async () => {
          if (projectToDelete) {
            await executeDeleteProject(projectToDelete.id);
            setProjectToDelete(null);
          }
        }}
        isSubmitting={isDeletingProject}
        tone="danger"
      />
    </>
  );
}

// Kanban Card sub-component
function KanbanCard({
  task,
  onMove,
  onDelete,
  canDelete,
  onClick,
  projects,
}: {
  key?: any;
  task: HRTask;
  onMove: (status: "Not Started" | "In Progress" | "Review/Testing" | "Done" | "Archived") => void;
  onDelete: () => void;
  canDelete: boolean;
  onClick: () => void;
  projects: Project[];
}) {
  return (
    <div
      onClick={onClick}
      className="p-4 bg-white border border-[#DCE7F4] rounded-2xl shadow-2xs hover:shadow-md hover:border-[#00ADFC] transition-all duration-300 text-left cursor-pointer group space-y-3"
    >
      <div className="space-y-1.5">
        <div className="flex justify-between items-start gap-2 select-none">
          <span className={`px-2 py-0.5 rounded-lg text-[11px] font-medium border ${task.priority === "High" ? "bg-rose-50 text-rose-700 border-rose-200" :
            task.priority === "Low" ? "bg-slate-100 text-slate-500 border-gray-250" : "bg-amber-50 text-amber-705 text-amber-700 border-amber-205 border-amber-200"
            }`}>
            {task.priority === "High" ? "Cao" : task.priority === "Low" ? "Thấp" : "Trung bình"}
          </span>
          <span className="text-[11px] font-normal text-[#007EB8] bg-[#E8F7FF] border border-[#B8E8FF] px-2 py-0.5 rounded-lg">
            {formatTaskCategory(task.category)}
          </span>
        </div>
        <h4 className="font-medium text-sm text-slate-800 leading-snug group-hover:text-[#007EB8] transition-colors line-clamp-2">{task.title}</h4>
      </div>

      <div className="space-y-1.5 text-xs text-slate-500">
        <p className="line-clamp-2 leading-relaxed">{task.description || "Không có mô tả chi tiết."}</p>
        {task.projectId && (
          <div className="flex items-center gap-1 text-xs text-slate-600 select-none">
            <Target className="w-3 h-3 text-[#00ADFC] shrink-0" />
            <span className="truncate">{projects.find(p => p.id === task.projectId)?.name || "Không có dự án"}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-gray-100 pt-2.5 text-[10px]">
        <div className="flex items-center gap-1.5">
          {renderAvatar(task.assigneeAvatar || "👨‍💻", "w-6 h-6", "text-xs")}
          <span className="text-slate-650 font-semibold">{task.assignee}</span>
        </div>
        <span className="text-gray-400 font-mono font-medium">Hạn: {formatDatetime(task.dueDate)}</span>
      </div>

      {/* Show KPI Badge on Card if available */}
      {(() => {
        const kpi = calculateKPI(task);
        if (!kpi) return null;
        return (
          <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[10px]">
            <span className="text-gray-400 font-medium">Đánh giá KPI:</span>
            {kpi.status === "ontime" ? (
              <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-205 border-emerald-200 rounded font-bold text-[9px] flex items-center gap-0.5">
                ✓ Đúng hạn
              </span>
            ) : (
              <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-250 rounded font-bold text-[9px] flex items-center gap-0.5">
                ⚠️ Trễ {kpi.diff}h
              </span>
            )}
          </div>
        );
      })()}

      {/* Interactive transition buttons - visible on hover */}
      <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        {canDelete ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="text-rose-650 hover:text-rose-800 text-[10px] font-extrabold font-mono transition-colors cursor-pointer"
          >
            Xóa bỏ
          </button>
        ) : (
          <div />
        )}
        <div className="flex gap-2">
          {task.status !== "Not Started" && task.status !== "todo" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const currentStatus = task.status;
                let prevStatus: "Not Started" | "In Progress" | "Review/Testing" | "Done" = "Not Started";
                if (currentStatus === "In Progress" || currentStatus === "doing") prevStatus = "Not Started";
                else if (currentStatus === "Review/Testing") prevStatus = "In Progress";
                else if (currentStatus === "Done" || currentStatus === "done") prevStatus = "Review/Testing";
                onMove(prevStatus);
              }}
              className="px-2 py-0.5 bg-slate-50 hover:bg-slate-100 border border-gray-200 text-slate-650 hover:text-slate-800 rounded-lg text-[9px] font-bold cursor-pointer"
            >
              ←
            </button>
          )}
          {task.status !== "Done" && task.status !== "done" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const currentStatus = task.status;
                let nextStatus: "Not Started" | "In Progress" | "Review/Testing" | "Done" = "Done";
                if (currentStatus === "Not Started" || currentStatus === "todo") nextStatus = "In Progress";
                else if (currentStatus === "In Progress" || currentStatus === "doing") nextStatus = "Review/Testing";
                else if (currentStatus === "Review/Testing") nextStatus = "Done";
                onMove(nextStatus);
              }}
              className="px-2 py-0.5 bg-[#00ADFC] hover:bg-[#0095d9] text-white rounded-lg text-xs font-medium cursor-pointer"
            >
              →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
