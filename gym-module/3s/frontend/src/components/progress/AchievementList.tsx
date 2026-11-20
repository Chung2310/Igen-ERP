import { Award, Trophy } from 'lucide-react';
import type { AchievementDto } from '../../types';
import ProgressEmptyState from './ProgressEmptyState';
import ProgressSection from './ProgressSection';

const labels = {
  MAX_WEIGHT: 'Mức tạ cao nhất',
  MAX_REPS: 'Số reps cao nhất',
  MAX_SET_VOLUME: 'Volume set cao nhất',
  ESTIMATED_1RM: 'Estimated 1RM',
  BODYWEIGHT_MAX_REPS: 'Số reps bodyweight cao nhất',
  BODYWEIGHT_MAX_ADDED_WEIGHT: 'Mức tạ thêm cao nhất',
  CARDIO_MAX_DISTANCE: 'Quãng đường cao nhất',
  CARDIO_MAX_DURATION: 'Thời lượng cao nhất',
  CARDIO_BEST_PACE: 'Pace tốt nhất',
  INTERVAL_MAX_ROUNDS: 'Số vòng cao nhất',
  MOBILITY_MAX_DURATION: 'Thời lượng cao nhất',
} as const;

export default function AchievementList({ achievements }: { achievements: AchievementDto[] }) {
  if (achievements.length === 0) {
    return (
      <ProgressEmptyState
        icon={Trophy}
        title="Chưa có thành tích"
        description="Các cột mốc mới sẽ xuất hiện khi khách hàng hoàn thành thêm buổi tập."
      />
    );
  }

  return (
    <ProgressSection
      title="Thành tích cá nhân"
      count={achievements.length}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {achievements.map((item) => (
          <article
            className="flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-4 transition-all hover:shadow-2xs hover:border-sky-300"
            key={`${item.exerciseName}-${item.kind}`}
          >
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-secondary">{labels[item.kind]}</p>
            <h3 className="mt-1 font-oswald text-xl font-bold uppercase text-primary">{item.exerciseName}</h3>
            <p className="mt-3 text-2xl font-black text-slate-900">
              {item.value.toLocaleString('vi-VN')}{item.unit ? ` ${item.unit}` : ''}
            </p>
          </article>
        ))}
      </div>
    </ProgressSection>
  );
}
