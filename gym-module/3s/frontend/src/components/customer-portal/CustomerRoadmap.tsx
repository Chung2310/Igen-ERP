import { Map, Sparkles, User as UserIcon } from 'lucide-react';
import type { CustomerJourneyDto } from '../../types';
import type { Roadmap } from '../../types/roadmap';
import RoadmapDetailView from '../roadmap/RoadmapDetailView';

interface CustomerRoadmapProps {
  journey: CustomerJourneyDto;
}

export default function CustomerRoadmap({ journey }: CustomerRoadmapProps) {
  const { roadmaps } = journey;
  const activeRoadmap = roadmaps && roadmaps.length > 0 ? roadmaps[0] : null;

  if (!activeRoadmap) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-xs">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 mb-3">
          <Map size={30} />
        </div>
        <h3 className="font-oswald text-xl font-bold uppercase text-slate-800">
          Chưa có lộ trình công bố
        </h3>
        <p className="mt-2 max-w-md text-xs text-slate-500 leading-relaxed">
          Huấn luyện viên đang xây dựng lộ trình chi tiết theo từng giai đoạn và mốc đánh giá cho bạn. Vui lòng kiểm tra lại sau!
        </p>
      </div>
    );
  }

  // Map journey roadmap to Roadmap type expected by RoadmapDetailView
  const roadmapData: Roadmap = {
    _id: activeRoadmap._id || '',
    customerId: activeRoadmap.customerId || '',
    title: activeRoadmap.title || '',
    strategy: activeRoadmap.strategy,
    phases: activeRoadmap.phases || [],
    status: (activeRoadmap.status as 'DRAFT' | 'PUBLISHED') || 'PUBLISHED',
    version: activeRoadmap.version || 1,
    baseline: (activeRoadmap as any).baseline,
  };

  return (
    <div className="space-y-5">
      {/* Compact Roadmap Title Bar */}
      <div className="bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 rounded-xl p-3.5 sm:px-5 sm:py-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center text-white shrink-0">
            <Sparkles className="w-5 h-5 text-sky-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-full font-bold">
                Lộ trình cá nhân hóa
              </span>
              {journey.customer?.assignedPt?.fullName && (
                <span className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1">
                  <UserIcon className="w-3 h-3" /> {journey.customer.assignedPt.fullName}
                </span>
              )}
            </div>
            <h2 className="m-0 mt-1 text-base sm:text-lg font-extrabold text-primary break-words">
              {roadmapData.title}
            </h2>
          </div>
        </div>
      </div>

      {/* Reuse the exact same detail view from PT side */}
      <RoadmapDetailView roadmap={roadmapData} />
    </div>
  );
}
