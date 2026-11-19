import { useId, useState, type ReactNode } from 'react';
import { CalendarDays, Camera, ClipboardList, Clock3, Dumbbell, MapPin } from 'lucide-react';
import type { CustomerJourneyDto } from '../../types';
import AchievementList from '../progress/AchievementList';
import ProgressCharts from '../progress/ProgressCharts';
import ProgressEmptyState from '../progress/ProgressEmptyState';
import ProgressOverview from '../progress/ProgressOverview';
import ProgressSection from '../progress/ProgressSection';
import WorkoutSessionDetail from '../progress/WorkoutSessionDetail';
import CustomerProgress from './CustomerProgress';

const tabs = [
  'Tổng quan',
  'Lịch & buổi tập',
  'Chỉ số cơ thể',
  'Thành tích',
  'Ảnh tiến độ',
  'Giáo án',
  'Báo cáo',
] as const;

type JourneyTab = typeof tabs[number];

function SchedulePanel({ journey }: { journey: CustomerJourneyDto }) {
  const now = Date.now();
  const upcomingEvents = journey.calendar
    .filter((event) => {
      const startsAt = event.startsAt ? new Date(event.startsAt).getTime() : Number.NaN;
      return Number.isFinite(startsAt)
        && startsAt >= now
        && event.status !== 'COMPLETED'
        && event.status !== 'CANCELLED';
    })
    .sort((left, right) => new Date(String(left.startsAt)).getTime() - new Date(String(right.startsAt)).getTime());

  return (
    <div className="space-y-4">
      <ProgressSection
        title="Lịch sắp tới"
        count={upcomingEvents.length}
      >
        {upcomingEvents.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {upcomingEvents.map((event) => {
              const startsAt = new Date(String(event.startsAt));

              return (
                <article
                  className="rounded-xl border border-sky-200 bg-sky-50/60 p-4"
                  key={String(event._id)}
                >
                  <div className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-secondary ring-1 ring-sky-200">
                      <CalendarDays size={19} aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-bold leading-6 text-slate-900">{String(event.title || 'Buổi tập cùng PT')}</h3>
                      <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-primary">
                        <Clock3 size={14} className="shrink-0" aria-hidden="true" />
                        <span>
                          {startsAt.toLocaleDateString('vi-VN', {
                            weekday: 'long',
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                          {' · '}
                          {startsAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </p>
                      {event.location && (
                        <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-600">
                          <MapPin size={14} className="shrink-0" aria-hidden="true" />
                          <span>{event.location}</span>
                        </p>
                      )}
                      {event.notes && <p className="mt-2 text-sm leading-6 text-slate-600">{event.notes}</p>}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <ProgressEmptyState
            icon={CalendarDays}
            title="Chưa có lịch sắp tới"
            description="Lịch hẹn mới sẽ xuất hiện tại đây sau khi PT sắp xếp."
          />
        )}
      </ProgressSection>

      <ProgressSection
        title="Buổi đã tập"
        count={journey.sessions.length}
      >
        {journey.sessions.length > 0 ? (
          <div className="space-y-3">
            {journey.sessions.map((session) => (
              <WorkoutSessionDetail session={session} key={session._id} />
            ))}
          </div>
        ) : (
          <ProgressEmptyState
            icon={Dumbbell}
            title="Chưa có buổi tập"
            description="Buổi tập đầu tiên sẽ xuất hiện sau khi PT ghi nhận."
          />
        )}
      </ProgressSection>
    </div>
  );
}

function PhotosPanel({ journey }: { journey: CustomerJourneyDto }) {
  return (
    <ProgressSection
      title="Ảnh tiến độ"
      count={journey.photos.length}
    >
      {journey.photos.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {journey.photos.map((photo) => (
            <img
              className="aspect-[3/4] w-full rounded-2xl object-cover ring-1 ring-slate-200"
              src={String(photo.photoUrl)}
              alt={`Ảnh tiến độ ${String(photo.stage)}`}
              key={String(photo._id)}
            />
          ))}
        </div>
      ) : (
        <ProgressEmptyState
          icon={Camera}
          title="Chưa có ảnh tiến độ"
          description="Ảnh Before, Progress và After sẽ xuất hiện tại đây."
        />
      )}
    </ProgressSection>
  );
}

function PlansPanel({ journey }: { journey: CustomerJourneyDto }) {
  const hasPlans = Boolean(journey.plans.active) || journey.plans.history.length > 0;

  return (
    <ProgressSection
      title="Giáo án"
      description="Giáo án đang áp dụng và lịch sử giáo án của khách hàng."
    >
      {hasPlans ? (
        <div className="space-y-3">
          {journey.plans.active && (
            <article className="rounded-xl border border-sky-200 bg-sky-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-secondary">Đang áp dụng</p>
              <h3 className="mt-1 font-oswald text-xl font-bold uppercase text-primary">
                {String(journey.plans.active.title)}
              </h3>
            </article>
          )}
          {journey.plans.history.map((plan) => (
            <article
              className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"
              key={String(plan._id)}
            >
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Đã lưu trữ</p>
              <h3 className="mt-1 font-bold text-slate-900">{String(plan.title)}</h3>
            </article>
          ))}
        </div>
      ) : (
        <ProgressEmptyState
          icon={ClipboardList}
          title="Chưa có giáo án"
          description="Giáo án sẽ xuất hiện sau khi được gán cho khách hàng."
        />
      )}
    </ProgressSection>
  );
}

function JourneyPanel({
  activeTab,
  journey,
  reportComposer,
  dailyReportContent,
}: {
  activeTab: JourneyTab;
  journey: CustomerJourneyDto;
  reportComposer?: ReactNode;
  dailyReportContent?: ReactNode;
}) {
  if (activeTab === 'Tổng quan') return <ProgressOverview analytics={journey.analytics} />;
  if (activeTab === 'Lịch & buổi tập') return <SchedulePanel journey={journey} />;
  if (activeTab === 'Chỉ số cơ thể') return <ProgressCharts measurements={journey.measurements} />;
  if (activeTab === 'Thành tích') return <AchievementList achievements={journey.analytics.achievements} />;
  if (activeTab === 'Ảnh tiến độ') return <PhotosPanel journey={journey} />;
  if (activeTab === 'Giáo án') return <PlansPanel journey={journey} />;
  return (
    <div className="space-y-4">
      {reportComposer}
      {dailyReportContent}
      <CustomerProgress reports={journey.reports} />
    </div>
  );
}

export default function CustomerJourney({
  journey,
  reportComposer,
  dailyReportContent,
}: {
  journey: CustomerJourneyDto;
  reportComposer?: ReactNode;
  dailyReportContent?: ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<JourneyTab>('Tổng quan');
  const tabsId = useId();
  const activeIndex = tabs.indexOf(activeTab);

  return (
    <section className="space-y-4 font-montserrat">
      <div
        className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-100/80 p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Chi tiết tiến độ khách hàng"
      >
        {tabs.map((tab, index) => (
          <button
            id={`${tabsId}-tab-${index}`}
            type="button"
            className={activeTab === tab
              ? 'min-h-11 shrink-0 whitespace-nowrap rounded-xl bg-white px-4 text-sm font-bold text-primary shadow-[0_3px_10px_rgba(0,59,112,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary'
              : 'min-h-11 shrink-0 whitespace-nowrap rounded-xl px-4 text-sm font-semibold text-slate-600 transition hover:bg-white/70 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary motion-reduce:transition-none'}
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`${tabsId}-panel-${index}`}
            key={tab}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div
        id={`${tabsId}-panel-${activeIndex}`}
        className="min-w-0"
        role="tabpanel"
        aria-labelledby={`${tabsId}-tab-${activeIndex}`}
      >
        <JourneyPanel
          activeTab={activeTab}
          journey={journey}
          reportComposer={reportComposer}
          dailyReportContent={dailyReportContent}
        />
      </div>
    </section>
  );
}
