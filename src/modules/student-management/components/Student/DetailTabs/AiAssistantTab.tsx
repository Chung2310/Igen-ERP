import React from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Student } from '../../../types';
import { useEntityLabel } from '../../../hooks/useEntityLabel';

interface AiAssistantTabProps {
  student: Student;
  analysis: string | null;
  setAnalysis: React.Dispatch<React.SetStateAction<string | null>>;
  loading: boolean;
  handleAnalyze: () => Promise<void>;
}

export function AiAssistantTab({
  analysis,
  setAnalysis,
  loading,
  handleAnalyze
}: AiAssistantTabProps) {
  const entityLabel = useEntityLabel();
  return (
    <div className="space-y-6">
      <div className="p-8 sm:p-12 rounded-[2.5rem] bg-slate-900 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-5 scale-150 rotate-12 group-hover:opacity-10 transition-opacity">
          <Sparkles className="w-48 h-48" />
        </div>
        
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-purple-500/20 flex items-center justify-center mb-6">
            <Sparkles className="w-8 h-8 text-purple-400" />
          </div>
          
          <h3 className="text-xl sm:text-2xl font-bold text-white mb-4">Trợ lý AI Phân tích Lộ trình</h3>
          <p className="text-slate-400 max-w-lg mb-8 text-sm sm:text-base leading-relaxed">
            Phân tích hồ sơ và đưa ra tư vấn lộ trình học tập, thi sát hạch tối ưu dựa trên khu vực và hạng bằng của {entityLabel.singular}.
          </p>

          {!analysis ? (
            <button
              onClick={handleAnalyze}
              disabled={loading}
              className="flex items-center gap-3 px-8 py-4 bg-white text-slate-900 hover:bg-slate-100 rounded-2xl font-bold transition-all disabled:opacity-50 active:scale-95"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5 text-purple-500" />}
              {loading ? "Đang phân tích dữ liệu..." : "Phân tích hồ sơ ngay"}
            </button>
          ) : (
            <div className="w-full text-left bg-white/5 backdrop-blur-sm p-6 sm:p-8 rounded-3xl border border-white/10 animate-in fade-in zoom-in duration-500">
              <div className="text-slate-200 whitespace-pre-wrap leading-relaxed prose prose-invert max-w-none text-sm sm:text-base">
                {analysis}
              </div>
              <button
                onClick={() => setAnalysis(null)}
                className="mt-8 text-xs font-bold uppercase tracking-widest text-purple-400 hover:text-purple-300 transition-colors"
              >
                Làm mới phân tích
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
