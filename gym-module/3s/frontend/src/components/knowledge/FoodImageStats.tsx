import React from 'react';
import { ImageIcon, Sparkles, UploadCloud } from 'lucide-react';
import type { FoodImageSummary } from '../../types/knowledge';

interface FoodImageStatsProps {
  summary: FoodImageSummary | null;
}

export const FoodImageStats: React.FC<FoodImageStatsProps> = ({ summary }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-6">
      {/* 1. Tổng số món */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Tổng số món trong kho
            </div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">
              {summary?.totalImages || 0} món
            </div>
          </div>
          <div className="bg-blue-50 text-blue-600 p-2.5 rounded-xl">
            <ImageIcon size={20} />
          </div>
        </div>
      </div>

      {/* 2. Món AI đã tạo */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Món do AI tạo
            </div>
            <div className="text-2xl font-extrabold text-purple-700 mt-1">
              {summary?.aiCount || 0} món
            </div>
          </div>
          <div className="bg-purple-50 text-purple-600 p-2.5 rounded-xl">
            <Sparkles size={20} />
          </div>
        </div>
      </div>

      {/* 3. Món tải lên từ máy */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Món tải lên từ máy
            </div>
            <div className="text-2xl font-extrabold text-emerald-600 mt-1">
              {summary?.uploadCount || 0} món
            </div>
          </div>
          <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-xl">
            <UploadCloud size={20} />
          </div>
        </div>
      </div>
    </div>
  );
};
