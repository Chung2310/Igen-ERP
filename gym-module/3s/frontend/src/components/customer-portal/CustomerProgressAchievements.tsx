import { Trophy } from 'lucide-react';
import type { AchievementDto } from '../../types';
import ProgressEmptyState from '../progress/ProgressEmptyState';
import ProgressSection from '../progress/ProgressSection';

export interface CustomerProgressAchievementsProps {
  achievements: AchievementDto[];
}

const labels: Record<AchievementDto['kind'], string> = {
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
};

export default function CustomerProgressAchievements({ achievements }: CustomerProgressAchievementsProps) {
  return (
    <ProgressSection
      title="Thành tích cá nhân"
      description="Những cột mốc nổi bật trong hành trình tập luyện."
      count={achievements.length}
    >
      {achievements.length === 0 ? (
        <ProgressEmptyState
          icon={Trophy}
          title="Chưa có thành tích"
          description="Hãy tiếp tục duy trì lịch tập để mở khóa những cột mốc đầu tiên."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {achievements.map((achievement) => (
            <article className="rounded-xl border border-amber-200 bg-amber-50/60 p-4" key={`${achievement.exerciseName}-${achievement.kind}`}>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-700">{labels[achievement.kind]}</p>
              <h3 className="mt-1 font-oswald text-xl font-bold uppercase text-primary">{achievement.exerciseName}</h3>
              <p className="mt-3 text-2xl font-black text-slate-900">
                {achievement.value.toLocaleString('vi-VN')}{achievement.unit ? ` ${achievement.unit}` : ''}
              </p>
              <time className="mt-2 block text-xs text-slate-500" dateTime={achievement.achievedAt}>
                {new Date(achievement.achievedAt).toLocaleDateString('vi-VN')}
              </time>
            </article>
          ))}
        </div>
      )}
    </ProgressSection>
  );
}
