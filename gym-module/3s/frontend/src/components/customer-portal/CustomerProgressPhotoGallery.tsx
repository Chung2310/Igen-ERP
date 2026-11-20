import { Camera } from 'lucide-react';
import type { CustomerJourneyDto } from '../../types';
import ProgressEmptyState from '../progress/ProgressEmptyState';
import ProgressSection from '../progress/ProgressSection';

export interface CustomerProgressPhotoGalleryProps {
  photos: CustomerJourneyDto['photos'];
  onOpenPhoto: (photoUrl: string, alt: string, trigger: HTMLButtonElement) => void;
}

export default function CustomerProgressPhotoGallery({ photos, onOpenPhoto }: CustomerProgressPhotoGalleryProps) {
  return (
    <ProgressSection
      title="Ảnh tiến độ"
      description="So sánh vóc dáng qua các mốc được ghi nhận cùng huấn luyện viên."
      count={photos.length}
    >
      {photos.length === 0 ? (
        <ProgressEmptyState
          icon={Camera}
          title="Chưa có ảnh tiến độ"
          description="Ảnh Before, Progress và After sẽ xuất hiện tại đây khi được cập nhật."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo) => {
            const stage = String(photo.stage || 'Tiến độ');
            const photoUrl = String(photo.photoUrl || '');
            const alt = `Ảnh tiến độ ${stage}`;
            return (
              <button
                type="button"
                className="group relative aspect-[3/4] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 text-left shadow-[0_8px_24px_rgba(0,59,112,0.06)] transition hover:-translate-y-1 hover:border-secondary/40 hover:shadow-[0_14px_32px_rgba(0,59,112,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none"
                aria-label={`Mở ảnh tiến độ ${stage}`}
                key={String(photo._id)}
                onClick={(event) => onOpenPhoto(photoUrl, alt, event.currentTarget)}
              >
                <img className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03] motion-reduce:transition-none" src={photoUrl} alt={alt} />
                <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-slate-950/80 to-transparent p-4 pt-16 text-white">
                  <span className="rounded-md bg-secondary/90 px-2 py-1 text-xs font-bold uppercase tracking-wide">{stage}</span>
                  {photo.takenDate && (
                    <time className="text-xs font-semibold text-slate-100" dateTime={String(photo.takenDate)}>
                      {new Date(String(photo.takenDate)).toLocaleDateString('vi-VN')}
                    </time>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </ProgressSection>
  );
}
