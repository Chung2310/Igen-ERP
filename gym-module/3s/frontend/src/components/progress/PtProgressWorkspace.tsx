import { useState } from 'react';
import { Camera, Dumbbell, FileText, Phone, Ruler, UserRound } from 'lucide-react';
import type { CustomerJourneyDto } from '../../types';
import WorkoutSessionLogger, { type WorkoutLoggerActivePlan } from './WorkoutSessionLogger';
import WorkoutSessionDetail from './WorkoutSessionDetail';
import MeasurementForm from './MeasurementForm';
import ProgressCharts from './ProgressCharts';
import AchievementList from './AchievementList';
import ProgressReportGenerator from './ProgressReportGenerator';
import ProgressEmptyState from './ProgressEmptyState';
import ProgressSnapshot from './ProgressSnapshot';
import ProgressSection from './ProgressSection';

const tabs = ['Tổng quan', 'Buổi tập', 'Chỉ số cơ thể', 'Thành tích', 'Ảnh tiến độ', 'Giáo án', 'Báo cáo'] as const;
type Tab = typeof tabs[number];
const primaryActionClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(0,59,112,0.16)] transition duration-200 hover:-translate-y-0.5 hover:bg-primary/90 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none';
const quickActionClass = 'group inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition duration-200 hover:-translate-y-0.5 hover:border-secondary/40 hover:bg-sky-50 hover:text-primary active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none';

export default function PtProgressWorkspace({
  journey,
  onRefresh,
}: {
  journey: CustomerJourneyDto;
  onRefresh: () => void;
}) {
  const [tab, setTab] = useState<Tab>('Tổng quan');
  const activePlan = journey.plans.active as unknown as WorkoutLoggerActivePlan | null;

  return (
    <section className="space-y-6 font-montserrat">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-secondary ring-1 ring-inset ring-sky-100" aria-hidden="true">
            <UserRound size={22} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Đang theo dõi</p>
            <h2 className="truncate font-oswald text-2xl font-bold uppercase tracking-tight text-primary sm:text-3xl">
              {journey.customer.fullName}
            </h2>
            {journey.customer.phone && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                <Phone size={13} aria-hidden="true" />
                {journey.customer.phone}
              </p>
            )}
          </div>
        </div>
        <button type="button" className={primaryActionClass} onClick={() => setTab('Buổi tập')}>
          <Dumbbell size={17} aria-hidden="true" />
          Ghi nhận buổi tập
        </button>
      </div>

      <ProgressSnapshot analytics={journey.analytics} />

      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" className={quickActionClass} onClick={() => setTab('Chỉ số cơ thể')}>
          <Ruler size={17} className="text-secondary" aria-hidden="true" />
          Nhập số đo
        </button>
        <button type="button" className={quickActionClass} onClick={() => setTab('Báo cáo')}>
          <FileText size={17} className="text-secondary" aria-hidden="true" />
          Tạo báo cáo
        </button>
      </div>

      <div
        className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-100/80 p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Khu vực tiến độ"
      >
        {tabs.map((item) => (
          <button
            type="button"
            className={tab === item
              ? 'min-h-11 shrink-0 whitespace-nowrap rounded-xl bg-white px-4 text-sm font-bold text-primary shadow-[0_3px_10px_rgba(0,59,112,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary'
              : 'min-h-11 shrink-0 whitespace-nowrap rounded-xl px-4 text-sm font-semibold text-slate-600 transition hover:bg-white/70 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary motion-reduce:transition-none'}
            role="tab"
            aria-selected={tab === item}
            key={item}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === 'Tổng quan' && (
        <ProgressSection
          title="Dữ liệu hành trình"
          description="Toàn bộ dữ liệu đã được ghi nhận cho khách hàng này."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Buổi tập', value: journey.sessions.length },
              { label: 'Lần đo', value: journey.measurements.length },
              { label: 'Ảnh tiến độ', value: journey.photos.length },
              { label: 'Báo cáo', value: journey.reports.length },
            ].map((item) => (
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-4" key={item.label}>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{item.label}</p>
                <p className="mt-2 font-oswald text-3xl font-bold text-primary">{item.value}</p>
              </article>
            ))}
          </div>
        </ProgressSection>
      )}
      {tab === 'Buổi tập' && (
        <div className="space-y-4">
          <WorkoutSessionLogger
            customerId={journey.customer._id}
            customerName={journey.customer.fullName}
            activePlan={activePlan}
            previousSessions={journey.sessions}
            onSaved={onRefresh}
          />
          {journey.sessions.map((session) => <WorkoutSessionDetail session={session} key={session._id} />)}
        </div>
      )}
      {tab === 'Chỉ số cơ thể' && (
        <div className="space-y-4">
          <MeasurementForm customerId={journey.customer._id} onSaved={onRefresh} />
          <ProgressCharts measurements={journey.measurements} />
        </div>
      )}
      {tab === 'Thành tích' && <AchievementList achievements={journey.analytics.achievements} />}
      {tab === 'Ảnh tiến độ' && (
        journey.photos.length > 0
          ? (
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
          )
          : (
            <ProgressEmptyState
              icon={Camera}
              title="Chưa có ảnh tiến độ"
              description="Ảnh Before, Progress và After sẽ xuất hiện tại đây khi được cập nhật."
            />
          )
      )}
      {tab === 'Giáo án' && (
        <div className="space-y-3">
          <h2 className="font-oswald text-2xl font-bold uppercase text-primary">
            {String(activePlan?.title || 'Chưa có giáo án')}
          </h2>
          {journey.plans.history.map((plan) => (
            <article className="rounded-xl border border-slate-200 bg-white p-4" key={String(plan._id)}>
              {String(plan.title)}
            </article>
          ))}
        </div>
      )}
      {tab === 'Báo cáo' && <ProgressReportGenerator customerId={journey.customer._id} onSaved={onRefresh} />}
    </section>
  );
}
