import {
  Activity,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Flame,
  HeartPulse,
  Map,
  MapPin,
  Phone,
  Ruler,
  Salad,
  Sparkles,
  Target,
  TrendingUp,
  User as UserIcon,
} from 'lucide-react';
import type { CustomerJourneyDto } from '../../types';

interface CustomerOverviewProps {
  journey: CustomerJourneyDto;
  onNavigateTab: (tab: string) => void;
}

export default function CustomerOverview({ journey, onNavigateTab }: CustomerOverviewProps) {
  const { customer, analytics, plans, roadmaps, nutritionPlans, inbodyRecords, calendar, sessions } = journey;
  const activePackage = customer?.activePackage || (customer?.packages && customer.packages[0]);
  const assignedPt = customer?.assignedPt;

  // Active workout plan
  const activePlan = plans?.active || (plans?.published && plans.published[0]);
  // Active nutrition plan
  const activeNutrition = nutritionPlans && nutritionPlans.length > 0 ? nutritionPlans[0] : null;
  // Active roadmap
  const activeRoadmap = roadmaps && roadmaps.length > 0 ? roadmaps[0] : null;
  // Latest inbody record
  const latestInbody = inbodyRecords && inbodyRecords.length > 0 ? inbodyRecords[0] : null;

  // Next upcoming calendar event
  const now = new Date();
  const upcomingEvents = (calendar || [])
    .filter((e) => e.startsAt && new Date(String(e.startsAt)) >= now)
    .sort((a, b) => new Date(String(a.startsAt)).getTime() - new Date(String(b.startsAt)).getTime());
  const nextEvent = upcomingEvents[0];

  // Most recent completed session
  const recentSession = sessions && sessions.length > 0 ? sessions[0] : null;

  // Package progress calculation
  const totalPkg = activePackage?.totalSessions || 0;
  const usedPkg = activePackage?.usedSessions || 0;
  const remainPkg = activePackage?.remainingSessions ?? Math.max(0, totalPkg - usedPkg);
  const pkgPercent = totalPkg > 0 ? Math.min(100, Math.round((usedPkg / totalPkg) * 100)) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── 1. HERO BANNER ── */}
      <div
        style={{
          background: 'linear-gradient(90deg, #003b70 0%, #0369a1 100%)',
          borderRadius: '16px',
          padding: '20px 24px',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          boxShadow: '0 4px 14px rgba(0, 59, 112, 0.15)',
        }}
      >
        <div style={{ maxWidth: '640px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.15)', padding: '3px 10px', borderRadius: '12px', fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', color: '#bae6fd', marginBottom: '8px' }}>
            <Sparkles size={12} color="#38bdf8" />
            <span>Học viên 3S Wellness VIP</span>
          </div>
          <h1 style={{ margin: '0 0 6px', fontSize: '1.45rem', fontWeight: 800, color: '#ffffff', lineHeight: 1.25 }}>
            Xin chào, {customer?.fullName || 'Hội viên'}!
          </h1>
          <p style={{ margin: 0, fontSize: '0.86rem', color: '#e0f2fe', lineHeight: 1.5 }}>
            Chào mừng bạn quay lại hệ thống. Huấn luyện viên đã thiết lập lộ trình và kế hoạch tập luyện riêng biệt để giúp bạn đạt được vóc dáng tối ưu.
          </p>
        </div>

        {/* Streak highlight */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.12)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '12px',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'rgba(245, 158, 11, 0.25)',
              color: '#fde047',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Flame size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#bae6fd', fontWeight: 700, display: 'block' }}>
              Chuỗi tập luyện
            </span>
            <strong style={{ fontSize: '1.15rem', color: '#ffffff', fontWeight: 800 }}>
              {analytics?.streakWeeks || 0} TUẦN LIÊN TỤC
            </strong>
          </div>
        </div>
      </div>

      {/* ── 2. PT & PACKAGE & GOAL METADATA CARDS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
        {/* PT Card */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '12px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <UserIcon size={14} color="#0284c7" /> Huấn luyện viên phụ trách
              </span>
              <span style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={11} /> Đồng hành 1-1
              </span>
            </div>

            {assignedPt ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '12px' }}>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #003b70 0%, #0284c7 100%)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '1rem',
                    flexShrink: 0,
                    overflow: 'hidden',
                  }}
                >
                  {assignedPt.avatarUrl ? (
                    <img src={assignedPt.avatarUrl} alt={assignedPt.fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    assignedPt.fullName.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0f172a' }}>
                    {assignedPt.fullName}
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#64748b' }}>Personal Trainer @ 3S Gym</p>
                  {assignedPt.phone && (
                    <a
                      href={`tel:${assignedPt.phone}`}
                      style={{ marginTop: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: 600, color: '#0284c7', textDecoration: 'none' }}
                    >
                      <Phone size={11} /> {assignedPt.phone}
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ padding: '16px 0', textAlign: 'center', fontSize: '0.84rem', color: '#64748b' }}>
                Chưa phân công PT riêng. Vui lòng liên hệ ban quản lý.
              </div>
            )}
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px 12px', fontSize: '0.78rem', color: '#475569' }}>
            <strong style={{ color: '#0f172a' }}>Ghi chú mục tiêu:</strong>{' '}
            {customer?.initialGoal || 'Tăng cơ, giảm mỡ & nâng cao thể lực toàn diện'}
          </div>
        </div>

        {/* Package Card */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '12px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Award size={14} color="#0284c7" /> Gói tập của bạn
              </span>
              <span style={{ background: '#eff6ff', color: '#0284c7', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700 }}>
                {activePackage?.status === 'ACTIVE' ? 'Đang hoạt động' : activePackage?.status || 'Tiêu chuẩn'}
              </span>
            </div>

            <div style={{ marginTop: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0f172a' }}>
                {activePackage?.name || 'Gói Huấn Luyện 1-1'}
              </h3>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '8px' }}>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Tiến độ số buổi tập:</span>
                <strong style={{ fontSize: '0.92rem', color: '#003b70' }}>
                  {usedPkg} / {totalPkg || '∞'} buổi
                </strong>
              </div>

              {/* Progress bar */}
              <div style={{ marginTop: '6px', height: '8px', width: '100%', borderRadius: '4px', background: '#f1f5f9', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    borderRadius: '4px',
                    background: 'linear-gradient(90deg, #0284c7 0%, #003b70 100%)',
                    width: `${totalPkg > 0 ? pkgPercent : 100}%`,
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem', color: '#64748b', marginTop: '6px' }}>
                <span>Đã tập: {usedPkg} buổi ({pkgPercent}%)</span>
                <strong style={{ color: '#15803d' }}>Còn lại: {remainPkg} buổi</strong>
              </div>
            </div>
          </div>

          {activePackage?.endDate && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#64748b', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
              <Clock size={12} color="#94a3b8" />
              <span>Hạn sử dụng: {new Date(activePackage.endDate).toLocaleDateString('vi-VN')}</span>
            </div>
          )}
        </div>

        {/* Goal & Body Composition Summary */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '12px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Target size={14} color="#d97706" /> Mục tiêu & Thể trạng
              </span>
              <button
                type="button"
                onClick={() => onNavigateTab('inbody')}
                style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '2px' }}
              >
                Chi tiết <ChevronRight size={12} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginTop: '10px' }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '8px 10px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>Cân nặng ban đầu</span>
                <strong style={{ fontSize: '1rem', color: '#0f172a' }}>
                  {customer?.initialWeight ? `${customer.initialWeight} kg` : '--'}
                </strong>
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '8px 10px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>Chiều cao</span>
                <strong style={{ fontSize: '1rem', color: '#0f172a' }}>
                  {customer?.height ? `${customer.height} cm` : '--'}
                </strong>
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '8px 10px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>Điểm InBody gần nhất</span>
                <strong style={{ fontSize: '1rem', color: '#0284c7' }}>
                  {latestInbody?.inbodyScore ? `${latestInbody.inbodyScore} / 100` : '--'}
                </strong>
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '8px 10px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>Tỷ lệ mỡ hiện tại</span>
                <strong style={{ fontSize: '1rem', color: '#15803d' }}>
                  {latestInbody?.bodyFatPercentage ? `${latestInbody.bodyFatPercentage}%` : '--'}
                </strong>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem', color: '#94a3b8', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
            <span>Giới tính: {customer?.gender === 'MALE' ? 'Nam' : customer?.gender === 'FEMALE' ? 'Nữ' : 'Khác'}</span>
            <span>Mã HV: #{customer?._id?.slice(-6).toUpperCase()}</span>
          </div>
        </div>
      </div>

      {/* ── 3. JOURNEY ANALYTICS KPI OVERVIEW ── */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '14px',
          padding: '18px 20px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
        }}
      >
        <h2 style={{ margin: '0 0 14px', fontSize: '0.98rem', fontWeight: 800, color: '#003b70', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={18} color="#0284c7" /> Chỉ Số Hiệu Quả Tập Luyện
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 16px', textAlign: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', display: 'block' }}>
              Tỷ lệ chuyên cần
            </span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>
              {analytics?.attendance?.rate != null ? `${analytics.attendance.rate}%` : '100%'}
            </div>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              Có mặt: {analytics?.attendance?.present || sessions?.length || 0} buổi
            </span>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 16px', textAlign: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', display: 'block' }}>
              Tổng buổi tập
            </span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#003b70', margin: '4px 0' }}>
              {(analytics?.totalSessions ?? sessions?.length ?? 0).toLocaleString('vi-VN')} buổi
            </div>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Trong toàn bộ hành trình</span>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 16px', textAlign: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', display: 'block' }}>
              Cường độ RPE TB
            </span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>
              {analytics?.averageRpe != null ? `${analytics.averageRpe} / 10` : '8.0 / 10'}
            </div>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Mức nỗ lực bài tập</span>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 16px', textAlign: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', display: 'block' }}>
              Kỷ lục đạt được
            </span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#d97706', margin: '4px 0' }}>
              {analytics?.achievements?.length || 0} PRs
            </div>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Kỷ lục cá nhân mới</span>
          </div>
        </div>
      </div>

      {/* ── 4. PT PUBLISHED PROGRAM SHORTCUTS ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h2 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#003b70', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} color="#0284c7" /> Chương Trình PT Đang Áp Dụng Cho Bạn
          </h2>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Cập nhật theo thời gian thực từ PT</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
          {/* Workout plan shortcut */}
          <div
            onClick={() => onNavigateTab('workouts')}
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '16px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '10px',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.06)';
              e.currentTarget.style.borderColor = '#0284c7';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.borderColor = '#e2e8f0';
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#eff6ff', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BookOpen size={18} />
                </div>
                <span style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', padding: '1px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 700 }}>
                  {activePlan ? 'Đang áp dụng' : 'Đang cập nhật'}
                </span>
              </div>
              <h3 style={{ margin: '10px 0 4px', fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>
                {String(activePlan?.title || 'Giáo án tập luyện cá nhân')}
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b', lineHeight: 1.4 }}>
                {activePlan ? 'Xem lịch tập các ngày, bài tập, số hiệp, số lần và mức tạ.' : 'PT đang hoàn thiện giáo án mới cho bạn.'}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '8px', fontSize: '0.76rem', fontWeight: 700, color: '#0284c7' }}>
              <span>Xem giáo án</span>
              <ChevronRight size={14} />
            </div>
          </div>

          {/* Nutrition plan shortcut */}
          <div
            onClick={() => onNavigateTab('nutrition')}
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '16px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '10px',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.06)';
              e.currentTarget.style.borderColor = '#16a34a';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.borderColor = '#e2e8f0';
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Salad size={18} />
                </div>
                <span style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', padding: '1px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 700 }}>
                  {activeNutrition ? `${activeNutrition.targetCalories} kcal` : 'Đang cập nhật'}
                </span>
              </div>
              <h3 style={{ margin: '10px 0 4px', fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>
                {String(activeNutrition?.title || 'Thực đơn & Kế hoạch Calo')}
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b', lineHeight: 1.4 }}>
                {activeNutrition ? `${Array.isArray(activeNutrition.menu) && activeNutrition.menu.length > 0 ? ((activeNutrition.menu[0] as any)?.days ? ((activeNutrition.menu[0] as any).days[0]?.meals?.length || 0) : activeNutrition.menu.length) : 0} bữa/ngày: P: ${activeNutrition.macros?.protein || 0}g, C: ${activeNutrition.macros?.carbs || 0}g, F: ${activeNutrition.macros?.fat || 0}g.` : 'PT sẽ thiết lập thực đơn chi tiết cho từng bữa ăn.'}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '8px', fontSize: '0.76rem', fontWeight: 700, color: '#16a34a' }}>
              <span>Xem thực đơn</span>
              <ChevronRight size={14} />
            </div>
          </div>

          {/* Roadmap shortcut */}
          <div
            onClick={() => onNavigateTab('roadmap')}
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '16px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '10px',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.06)';
              e.currentTarget.style.borderColor = '#6366f1';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.borderColor = '#e2e8f0';
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#eef2ff', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Map size={18} />
                </div>
                <span style={{ background: '#eef2ff', color: '#4f46e5', border: '1px solid #c7d2fe', padding: '1px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 700 }}>
                  {activeRoadmap ? `${activeRoadmap.phases?.length || 0} Giai đoạn` : 'Đang cập nhật'}
                </span>
              </div>
              <h3 style={{ margin: '10px 0 4px', fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>
                {String(activeRoadmap?.title || 'Lộ trình huấn luyện cá nhân')}
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b', lineHeight: 1.4 }}>
                {activeRoadmap ? 'Chiến lược dài hạn, các giai đoạn tăng cơ siết mỡ và mốc kiểm tra.' : 'PT đang xây dựng lộ trình từng giai đoạn.'}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '8px', fontSize: '0.76rem', fontWeight: 700, color: '#6366f1' }}>
              <span>Xem lộ trình</span>
              <ChevronRight size={14} />
            </div>
          </div>

          {/* InBody shortcut */}
          <div
            onClick={() => onNavigateTab('inbody')}
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '16px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '10px',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.06)';
              e.currentTarget.style.borderColor = '#e11d48';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.borderColor = '#e2e8f0';
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#fff1f2', color: '#e11d48', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Ruler size={18} />
                </div>
                <span style={{ background: '#fff1f2', color: '#be123c', border: '1px solid #fecdd3', padding: '1px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 700 }}>
                  {inbodyRecords && inbodyRecords.length > 0 ? `${inbodyRecords.length} Phiếu đo` : 'Chưa có'}
                </span>
              </div>
              <h3 style={{ margin: '10px 0 4px', fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>
                Chỉ số InBody & Mục tiêu
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b', lineHeight: 1.4 }}>
                {latestInbody ? `Đo gần nhất ngày ${new Date(latestInbody.measurementDate).toLocaleDateString('vi-VN')}` : 'Theo dõi chỉ số cơ, mỡ và biểu đồ tiến độ.'}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '8px', fontSize: '0.76rem', fontWeight: 700, color: '#e11d48' }}>
              <span>Xem chỉ số</span>
              <ChevronRight size={14} />
            </div>
          </div>
        </div>
      </div>

      {/* ── 5. UPCOMING APPOINTMENTS & RECENT WORKOUTS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        {/* Next Appointment Card */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={14} color="#0284c7" /> Lịch tập sắp tới
              </span>
              <button
                type="button"
                onClick={() => onNavigateTab('sessions')}
                style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Toàn bộ lịch →
              </button>
            </div>

            {nextEvent ? (
              <div style={{ marginTop: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <strong style={{ fontSize: '0.9rem', color: '#003b70' }}>{String(nextEvent.title || 'Buổi tập cùng PT')}</strong>
                  {nextEvent.startsAt && (
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a' }}>
                      {new Date(String(nextEvent.startsAt)).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                {nextEvent.startsAt && (
                  <div style={{ fontSize: '0.76rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                    <Clock size={12} color="#0284c7" />
                    <span>
                      {new Date(String(nextEvent.startsAt)).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </span>
                  </div>
                )}
                {nextEvent.location && (
                  <div style={{ fontSize: '0.76rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                    <MapPin size={12} color="#94a3b8" />
                    <span>{String(nextEvent.location)}</span>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: '24px 0', textAlign: 'center', color: '#64748b', fontSize: '0.84rem' }}>
                Chưa có lịch hẹn mới. Hãy trao đổi với PT để sắp xếp lịch tập nhé!
              </div>
            )}
          </div>
        </div>

        {/* Recent Session Card */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <TrendingUp size={14} color="#15803d" /> Buổi tập gần nhất
              </span>
              <button
                type="button"
                onClick={() => onNavigateTab('sessions')}
                style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Xem nhật ký →
              </button>
            </div>

            {recentSession ? (
              <div style={{ marginTop: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>
                    {recentSession.planSnapshot?.title || 'Buổi tập gần nhất'}
                  </strong>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {new Date(recentSession.performedAt).toLocaleDateString('vi-VN')}
                  </span>
                </div>
                <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '2px' }}>
                  Đã hoàn thành {recentSession.exerciseLogs?.length || 0} bài tập
                </div>
                {recentSession.notes && (
                  <p style={{ margin: '6px 0 0', fontSize: '0.76rem', color: '#334155', fontStyle: 'italic' }}>
                    &ldquo;{recentSession.notes}&rdquo;
                  </p>
                )}
              </div>
            ) : (
              <div style={{ padding: '24px 0', textAlign: 'center', color: '#64748b', fontSize: '0.84rem' }}>
                Chưa có nhật ký buổi tập nào được ghi nhận.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
