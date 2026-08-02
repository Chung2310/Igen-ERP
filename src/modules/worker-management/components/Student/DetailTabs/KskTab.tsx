import React from "react";
import {
  AlertCircle,
  Check,
  Clock,
  Loader2,
  Save,
  FileText,
  Upload,
  Bookmark,
  File,
  Trash2,
} from "lucide-react";
import { Student } from "../../../types";
import { cn, toInputDate } from "../../../lib/utils";
import { useEntityLabel } from "../../../hooks/useEntityLabel";

type HealthCheckFile = NonNullable<Student["healthCheckFiles"]>[number];

interface KskData {
  status: string;
  date: string;
  notes: string;
  files: HealthCheckFile[];
}

interface KskTabProps {
  student: Student;
  kskData: KskData;
  setKskData: React.Dispatch<React.SetStateAction<KskData>>;
  isUpdatingKSK: boolean;
  handleUpdateKSK: () => Promise<void>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  isUploadingFile: boolean;
  removeFile: (index: number) => void;
}

export function KskTab({
  kskData,
  setKskData,
  isUpdatingKSK,
  handleUpdateKSK,
  handleFileUpload,
  isUploadingFile,
  removeFile,
}: KskTabProps) {
  const entityLabel = useEntityLabel();
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column: Status & Info */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-cyan-500" /> Trạng thái KSK
          </h3>

          <div className="space-y-4">
            <button
              onClick={() =>
                setKskData((prev) => ({ ...prev, status: "Completed" }))
              }
              className={cn(
                "w-full flex items-center justify-between p-4 rounded-2xl border transition-all",
                kskData.status === "Completed"
                  ? "bg-emerald-50 border-emerald-200 ring-2 ring-emerald-500/10"
                  : "bg-white border-slate-100 hover:border-slate-200",
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    kskData.status === "Completed"
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-50 text-slate-400",
                  )}
                >
                  <Check className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p
                    className={cn(
                      "text-sm font-bold",
                      kskData.status === "Completed"
                        ? "text-emerald-700"
                        : "text-slate-600",
                    )}
                  >
                    Đã khám xong
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium">
                    {entityLabel.titleCase} đã hoàn tất thủ tục
                  </p>
                </div>
              </div>
              {kskData.status === "Completed" && (
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
              )}
            </button>

            <button
              onClick={() =>
                setKskData((prev) => ({ ...prev, status: "Pending" }))
              }
              className={cn(
                "w-full flex items-center justify-between p-4 rounded-2xl border transition-all",
                kskData.status === "Pending"
                  ? "bg-amber-50 border-amber-200 ring-2 ring-amber-500/10"
                  : "bg-white border-slate-100 hover:border-slate-200",
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    kskData.status === "Pending"
                      ? "bg-amber-500 text-white"
                      : "bg-slate-50 text-slate-400",
                  )}
                >
                  <Clock className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p
                    className={cn(
                      "text-sm font-bold",
                      kskData.status === "Pending"
                        ? "text-amber-700"
                        : "text-slate-600",
                    )}
                  >
                    Đang chờ khám
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Chưa có kết quả khám SK
                  </p>
                </div>
              </div>
              {kskData.status === "Pending" && (
                <div className="w-2 h-2 rounded-full bg-amber-500" />
              )}
            </button>
          </div>

          <div className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Ngày khám thực tế
              </label>
              <input
                type="date"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-cyan-500/5 focus:border-cyan-500 transition-all"
                value={toInputDate(kskData.date)}
                onChange={(e) => {
                  setKskData((prev) => ({ ...prev, date: e.target.value }));
                }}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Ghi chú sức khỏe
              </label>
              <textarea
                rows={3}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium outline-none focus:ring-4 focus:ring-cyan-500/5 focus:border-cyan-500 transition-all resize-none"
                placeholder="Tình trạng thị lực, thính lực..."
                value={kskData.notes}
                onChange={(e) =>
                  setKskData((prev) => ({ ...prev, notes: e.target.value }))
                }
              />
            </div>
          </div>

          <button
            onClick={handleUpdateKSK}
            disabled={isUpdatingKSK}
            className="w-full mt-6 py-3 bg-cyan-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-cyan-100 hover:bg-cyan-700 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isUpdatingKSK ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Lưu thông tin KSK
          </button>
        </div>
      </div>

      {/* Right Column: Files & Upload */}
      <div className="lg:col-span-2 flex flex-col space-y-6">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-500" /> Tài liệu & Giấy tờ
              khám
            </h3>
            <span className="text-[10px] font-bold text-cyan-600 bg-cyan-50 px-2 py-1 rounded-md">
              {kskData.files.length} Tệp tin
            </span>
          </div>

          {/* Dropzone Simulation */}
          <label className="relative flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 rounded-[2rem] hover:bg-slate-50 transition-all cursor-pointer group mb-6">
            <input
              type="file"
              multiple
              disabled={isUploadingFile}
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={handleFileUpload}
            />
            <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              {isUploadingFile ? (
                <Loader2 className="w-6 h-6 text-cyan-500 animate-spin" />
              ) : (
                <Upload className="w-6 h-6 text-cyan-500" />
              )}
            </div>
            <p className="text-sm font-bold text-slate-700">
              {isUploadingFile
                ? "Đang tải tệp lên..."
                : "Tải lên giấy khám sức khỏe"}
            </p>
            <p className="text-[10px] text-slate-400 font-medium mt-1">
              Hỗ trợ định dạng JPG, PNG, PDF (Tối đa 5MB)
            </p>
          </label>

          {/* Files List */}
          <div className="flex-1 overflow-y-auto min-h-[200px] space-y-3">
            {kskData.files.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 opacity-40">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
                  <Bookmark className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-xs font-bold text-slate-400 italic">
                  Chưa có tài liệu nào được tải lên.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {kskData.files.map((file, idx) => (
                  <div
                    key={idx}
                    className="group relative flex items-center gap-4 p-3 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-white hover:shadow-md transition-all"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center shrink-0">
                      {file.type.includes("image") ? (
                        <img
                          src={file.url}
                          alt=""
                          className="w-full h-full object-cover rounded-xl"
                        />
                      ) : (
                        <File className="w-5 h-5 text-cyan-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold text-slate-700 truncate">
                        {file.name}
                      </p>
                      <p className="text-[9px] text-slate-400 font-medium">
                        Đã tải lên:{" "}
                        {new Date(file.uploadedAt).toLocaleDateString("vi-VN")}
                      </p>
                    </div>
                    <button
                      onClick={() => removeFile(idx)}
                      className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-500 hover:text-white"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      className="absolute inset-0 ring-offset-2 focus:ring-2 ring-cyan-500 rounded-2xl outline-none"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
