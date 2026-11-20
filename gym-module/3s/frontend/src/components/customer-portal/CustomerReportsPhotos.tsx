import { useCallback, useRef, useState } from 'react';
import type { CustomerJourneyDto } from '../../types';
import ProgressSnapshot from '../progress/ProgressSnapshot';
import TrackingAnalytics from '../progress/TrackingAnalytics';
import CustomerProgressAchievements from './CustomerProgressAchievements';
import CustomerProgressPhotoGallery from './CustomerProgressPhotoGallery';
import CustomerProgressReportSection from './CustomerProgressReportSection';
import ProgressPhotoLightbox from './ProgressPhotoLightbox';

interface CustomerReportsPhotosProps {
  journey: CustomerJourneyDto;
}

const filters = ['ALL', 'REPORTS', 'PHOTOS', 'ACHIEVEMENTS'] as const;
type Filter = typeof filters[number];

export default function CustomerReportsPhotos({ journey }: CustomerReportsPhotosProps) {
  const reports = [...(journey.reports || [])].sort(
    (left, right) => new Date(right.periodEnd).getTime() - new Date(left.periodEnd).getTime(),
  );
  const photos = journey.photos || [];
  const achievements = journey.analytics?.achievements || [];
  const [activeFilter, setActiveFilter] = useState<Filter>('ALL');
  const [selectedPhoto, setSelectedPhoto] = useState({ url: '', alt: '' });
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const openPhoto = useCallback((url: string, alt: string, trigger: HTMLButtonElement) => {
    triggerRef.current = trigger;
    setSelectedPhoto({ url, alt });
  }, []);

  const closePhoto = useCallback(() => {
    setSelectedPhoto({ url: '', alt: '' });
    triggerRef.current?.focus();
  }, []);

  const filterLabels: Record<Filter, string> = {
    ALL: 'Tất cả',
    REPORTS: `Báo cáo (${reports.length})`,
    PHOTOS: `Ảnh (${photos.length})`,
    ACHIEVEMENTS: `Thành tích (${achievements.length})`,
  };

  return (
    <div className="space-y-6 font-montserrat">
      <ProgressSnapshot analytics={journey.analytics} />
      <TrackingAnalytics analytics={journey.analytics.tracking} />

      <CustomerProgressReportSection reports={reports} featured />

      <div
        className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-100/80 p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Lọc dữ liệu tiến độ"
      >
        {filters.map((filter) => (
          <button
            type="button"
            className={activeFilter === filter
              ? 'min-h-11 shrink-0 rounded-xl bg-white px-4 text-sm font-bold text-primary shadow-[0_3px_10px_rgba(0,59,112,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary'
              : 'min-h-11 shrink-0 rounded-xl px-4 text-sm font-semibold text-slate-600 transition hover:bg-white/70 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary motion-reduce:transition-none'}
            role="tab"
            aria-selected={activeFilter === filter}
            key={filter}
            onClick={() => setActiveFilter(filter)}
          >
            {filterLabels[filter]}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {(activeFilter === 'ALL' || activeFilter === 'REPORTS') && reports.length > 1 && (
          <CustomerProgressReportSection reports={reports.slice(1)} />
        )}
        {(activeFilter === 'ALL' || activeFilter === 'PHOTOS') && (
          <CustomerProgressPhotoGallery photos={photos} onOpenPhoto={openPhoto} />
        )}
        {(activeFilter === 'ALL' || activeFilter === 'ACHIEVEMENTS') && (
          <CustomerProgressAchievements achievements={achievements} />
        )}
      </div>

      <ProgressPhotoLightbox
        open={Boolean(selectedPhoto.url)}
        imageUrl={selectedPhoto.url}
        imageAlt={selectedPhoto.alt}
        onClose={closePhoto}
      />
    </div>
  );
}
