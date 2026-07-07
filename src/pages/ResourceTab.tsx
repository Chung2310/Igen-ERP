import React, { useState } from "react";
import { FolderTree, HardDrive } from "lucide-react";
import type { ResourceSubTabType } from "../types";
import { FileExplorer } from "../components/resource/FileExplorer";
import { DriveDocuments } from "../components/resource/DriveDocuments";

const SUB_TABS: Array<{ value: ResourceSubTabType; label: string; icon: React.ElementType }> = [
  { value: "TÀI LIỆU KHÁC", label: "Tài liệu khác", icon: FolderTree },
  { value: "GOOGLE DRIVE", label: "Google Drive", icon: HardDrive },
];

export default function ResourceTab() {
  const [subTab, setSubTab] = useState<ResourceSubTabType>("TÀI LIỆU KHÁC");

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-5 shrink-0">
        <h1 className="text-2xl font-black tracking-tight text-slate-800">Quản lý tài nguyên</h1>
        <p className="text-sm text-slate-500">Lưu trữ, sắp xếp tài liệu nội bộ và liên kết Google Drive của doanh nghiệp.</p>
      </div>

      {/* Sub-tab switcher */}
      <div className="mb-5 flex shrink-0 gap-1 rounded-2xl bg-slate-100 p-1 w-fit">
        {SUB_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = subTab === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setSubTab(tab.value)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                active ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Nội dung */}
      <div className="min-h-0 flex-1 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
        {subTab === "TÀI LIỆU KHÁC" ? <FileExplorer /> : <DriveDocuments />}
      </div>
    </div>
  );
}
