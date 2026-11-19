import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  AlertTriangle,
  Activity,
  CheckCircle2,
  Search,
  X,
  TrendingUp,
  HeartPulse,
  Ruler,
  RefreshCw,
  Trophy,
  HelpCircle,
  Clock,
  ArrowUpRight,
  Sparkles,
  ShieldAlert,
  Utensils,
  Moon,
  ClipboardCheck,
} from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../components/ui/ToastProvider';
import { errorMessage } from '../../types';

interface MeasurementItem {
  measuredAt?: string;
  weight?: number;
  bodyFatPercentage?: number;
  muscleMass?: number;
}

interface CustomerRow {
  customerId: string;
  fullName: string;
  phone?: string;
  initialGoal?: string;
  initialWeight?: number | null;
  dataStatus: 'READY' | 'INSUFFICIENT_DATA';
  rank: number | null;
  score: number | null;
  scoreBreakdown: { measurementTrend: number; careRisk: number } | null;
  progressCategory: 'GOOD' | 'SLOW' | 'POOR' | 'INSUFFICIENT_DATA';
  sourcePath: string;
  measurementCount: number;
  firstMeasurement?: MeasurementItem | null;
  latestMeasurement?: MeasurementItem | null;
  changes?: {
    bodyFatChange: number; // positive is fat loss
    muscleChange: number; // positive is muscle gain
    weightChange: number;
    daysBetween: number;
  } | null;
  openAlerts?: number;
  riskFactors?: string[];
  improvementTips?: string[];
}

interface PtDashboardData {
  totalCustomers: number;
  openAlerts: number;
  goodProgressCount: number;
  slowProgressCount: number;
  poorProgressCount: number;
  customers: CustomerRow[];
}

export default function PtDashboardPage() {
  const toast = useToast();
  const [data, setData] = useState<PtDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<'ALL' | 'GOOD' | 'SLOW' | 'POOR' | 'INSUFFICIENT_DATA'>('ALL');

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.get<PtDashboardData>('/api/dashboard/pt');
      setData(res.data);
    } catch (error: unknown) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  // Filtered customer list for Section 1
  const filteredCustomers = useMemo(() => {
    if (!data?.customers) return [];
    return data.customers.filter((c) => {
      const matchSearch =
        !search.trim() ||
        c.fullName.toLowerCase().includes(search.toLowerCase()) ||
        c.customerId.toLowerCase().includes(search.toLowerCase());
      const matchCategory =
        filterCategory === 'ALL' || c.progressCategory === filterCategory;
      return matchSearch && matchCategory;
    });
  }, [data, search, filterCategory]);

  // Section 2: Top 3-5 Transformers (best progress score & changes)
  const topTransformers = useMemo(() => {
    if (!data?.customers) return [];
    return data.customers
      .filter((c) => c.dataStatus === 'READY' && c.changes && (c.score ?? 0) >= 50)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 4);
  }, [data]);

  // Section 3: Attention Needed Customers (Slow or Poor progress, or open alerts)
  const attentionCustomers = useMemo(() => {
    if (!data?.customers) return [];
    return data.customers.filter(
      (c) =>
        c.progressCategory === 'POOR' ||
        c.progressCategory === 'SLOW' ||
        (c.openAlerts && c.openAlerts > 0) ||
        (c.changes && (c.changes.bodyFatChange < 0 || c.changes.muscleChange < 0)),
    );
  }, [data]);

  const getRankBadgeInfo = (index: number) => {
    switch (index) {
      case 0:
        return {
          title: 'Top 1 Biến đổi ngoạn mục',
          icon: '🥇',
          bg: '#fef9c3',
          border: '#fde047',
          color: '#854d0e',
        };
      case 1:
        return {
          title: 'Top 2 Tăng cơ giảm mỡ',
          icon: '🥈',
          bg: '#f1f5f9',
          border: '#cbd5e1',
          color: '#334155',
        };
      case 2:
        return {
          title: 'Top 3 Bứt phá thể lực',
          icon: '🥉',
          bg: '#ffedd5',
          border: '#fdba74',
          color: '#9a3412',
        };
      default:
        return {
          title: `Top ${index + 1} Phong độ cao`,
          icon: '⭐',
          bg: '#f0f9ff',
          border: '#bae6fd',
          color: '#0369a1',
        };
    }
  };

  return (
    <div className="pt-dash-container">
      {/* Header */}
      <div className="pt-dash-header">
        <div className="pt-dash-title-wrap">
          <h1 className="pt-dash-title">
            <Activity size={24} className="text-sky-500" />
            <span>Bảng điều khiển Huấn luyện viên</span>
          </h1>
        </div>
        <button
          type="button"
          onClick={loadDashboard}
          disabled={loading}
          className="button button-secondary"
          style={{ minHeight: '38px', height: '38px', padding: '0 16px', fontSize: '0.82rem' }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Làm mới số liệu</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* PHẦN 1: KHÁCH HÀNG CỦA TÔI (MY CUSTOMERS & BF-AT STATUS) */}
      {/* ========================================================================= */}
      <section className="pt-dash-section">
        <div className="pt-section-header">
          <div className="pt-section-title-wrap">
            <h2 className="pt-section-title">
              <Users size={20} className="text-[#003b70]" />
              <span>KHÁCH HÀNG CỦA TÔI</span>
            </h2>
          </div>
        </div>

        {/* 4 Metrics Cards */}
        <div className="pt-dash-metrics-4">
          {/* Total Customers */}
          <div className="pt-dash-metric-card">
            <div className="pt-dash-metric-info">
              <span className="pt-dash-metric-label">👥 Tổng khách quản lý</span>
              <div className="pt-dash-metric-val" style={{ color: '#003b70' }}>
                {data?.totalCustomers ?? '—'}
                <span className="pt-dash-metric-unit">học viên</span>
              </div>
            </div>
            <div className="pt-dash-metric-icon" style={{ background: '#f0f9ff', color: '#0284c7' }}>
              <Users size={24} />
            </div>
            <div className="pt-dash-metric-stripe" style={{ background: '#0284c7' }} />
          </div>

          {/* Good Progress */}
          <div className="pt-dash-metric-card">
            <div className="pt-dash-metric-info">
              <span className="pt-dash-metric-label">🟢 Tiến bộ tốt</span>
              <div className="pt-dash-metric-val" style={{ color: '#16a34a' }}>
                {data?.goodProgressCount ?? 0}
                <span className="pt-dash-metric-unit">khách</span>
              </div>
            </div>
            <div className="pt-dash-metric-icon" style={{ background: '#f0fdf4', color: '#16a34a' }}>
              <TrendingUp size={24} />
            </div>
            <div className="pt-dash-metric-stripe" style={{ background: '#16a34a' }} />
          </div>

          {/* Slow Progress */}
          <div className="pt-dash-metric-card">
            <div className="pt-dash-metric-info">
              <span className="pt-dash-metric-label">🟡 Tiến bộ chậm</span>
              <div className="pt-dash-metric-val" style={{ color: '#d97706' }}>
                {data?.slowProgressCount ?? 0}
                <span className="pt-dash-metric-unit">khách</span>
              </div>
            </div>
            <div className="pt-dash-metric-icon" style={{ background: '#fffbeb', color: '#d97706' }}>
              <Clock size={24} />
            </div>
            <div className="pt-dash-metric-stripe" style={{ background: '#d97706' }} />
          </div>

          {/* Poor Progress / Risk */}
          <div className="pt-dash-metric-card">
            <div className="pt-dash-metric-info">
              <span className="pt-dash-metric-label">🔴 Kết quả không tốt</span>
              <div className="pt-dash-metric-val" style={{ color: '#dc2626' }}>
                {data?.poorProgressCount ?? 0}
                <span className="pt-dash-metric-unit">cần xử lý</span>
              </div>
            </div>
            <div className="pt-dash-metric-icon" style={{ background: '#fef2f2', color: '#dc2626' }}>
              <AlertTriangle size={24} />
            </div>
            <div className="pt-dash-metric-stripe" style={{ background: '#dc2626' }} />
          </div>
        </div>

        {/* Customer Table Container */}
        <div className="pt-dash-main-card">
          {/* Toolbar */}
          <div className="pt-dash-toolbar">
            <div className="pt-dash-search-box">
              <Search size={15} className="pt-dash-search-icon" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo tên học viên hoặc mã..."
                className="pt-dash-search-input"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="pt-dash-search-clear"
                  aria-label="Xóa tìm kiếm"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter Chips */}
            <div className="pt-dash-filter-chips">
              <button
                type="button"
                className={`pt-dash-filter-btn ${filterCategory === 'ALL' ? 'active' : ''}`}
                onClick={() => setFilterCategory('ALL')}
              >
                Tất cả ({data?.customers?.length || 0})
              </button>
              <button
                type="button"
                className={`pt-dash-filter-btn ${filterCategory === 'GOOD' ? 'active filter-good' : ''}`}
                onClick={() => setFilterCategory('GOOD')}
              >
                🟢 Tiến bộ tốt ({data?.goodProgressCount || 0})
              </button>
              <button
                type="button"
                className={`pt-dash-filter-btn ${filterCategory === 'SLOW' ? 'active filter-slow' : ''}`}
                onClick={() => setFilterCategory('SLOW')}
              >
                🟡 Tiến bộ chậm ({data?.slowProgressCount || 0})
              </button>
              <button
                type="button"
                className={`pt-dash-filter-btn ${filterCategory === 'POOR' ? 'active filter-poor' : ''}`}
                onClick={() => setFilterCategory('POOR')}
              >
                🔴 Cần quan tâm ({data?.poorProgressCount || 0})
              </button>
              <button
                type="button"
                className={`pt-dash-filter-btn ${filterCategory === 'INSUFFICIENT_DATA' ? 'active filter-insufficient' : ''}`}
                onClick={() => setFilterCategory('INSUFFICIENT_DATA')}
              >
                ⚪ Chưa đủ dữ liệu InBody
              </button>
            </div>
          </div>

          {/* Table Content */}
          {loading ? (
            <div className="pt-dash-empty-state">
              <RefreshCw size={26} className="animate-spin text-sky-600" />
              <p className="pt-dash-empty-title">Đang tải dữ liệu học viên...</p>
              <p className="pt-dash-empty-desc">Vui lòng chờ trong giây lát</p>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="pt-dash-empty-state">
              <div className="pt-dash-empty-icon">
                <Users size={26} />
              </div>
              <h3 className="pt-dash-empty-title">Chưa có dữ liệu học viên phù hợp</h3>
              <p className="pt-dash-empty-desc">
                {search || filterCategory !== 'ALL'
                  ? 'Không tìm thấy học viên nào khớp với bộ lọc hiện tại.'
                  : 'Bạn hiện chưa có học viên nào được phân công trong hệ thống.'}
              </p>
            </div>
          ) : (
            <div className="pt-dash-table-wrap">
              <table className="pt-dash-table">
                <thead>
                  <tr>
                    <th>Học viên &amp; Mục tiêu</th>
                    <th>Trạng thái BF-AT</th>
                    <th>Biến đổi Cơ / Mỡ (Δ)</th>
                    <th>Điểm tiến độ</th>
                    <th style={{ textAlign: 'right' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((c) => (
                    <tr key={c.customerId}>
                      {/* Customer & Goal */}
                      <td>
                        <div style={{ fontWeight: 700, color: '#003b70', fontSize: '0.88rem' }}>
                          {c.fullName}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
                          🎯 Mục tiêu: {c.initialGoal || 'Cải thiện thể lực'}
                        </div>
                      </td>

                      {/* Data Status */}
                      <td>
                        {c.dataStatus === 'INSUFFICIENT_DATA' || c.progressCategory === 'INSUFFICIENT_DATA' ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '12px', background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', fontWeight: 700, fontSize: '0.72rem' }}>
                            <span>⚪</span>
                            <span>Cần ≥ 2 lần InBody</span>
                          </span>
                        ) : c.progressCategory === 'GOOD' ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '12px', background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', fontWeight: 700, fontSize: '0.72rem' }}>
                            <span>🟢</span>
                            <span>Tiến bộ tốt</span>
                          </span>
                        ) : c.progressCategory === 'SLOW' ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '12px', background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', fontWeight: 700, fontSize: '0.72rem' }}>
                            <span>🟡</span>
                            <span>Tiến bộ chậm</span>
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '12px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', fontWeight: 700, fontSize: '0.72rem' }}>
                            <span>🔴</span>
                            <span>Cần quan tâm</span>
                          </span>
                        )}
                      </td>

                      {/* Changes (Delta Body Fat / Muscle) */}
                      <td>
                        {c.changes ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.74rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ color: '#64748b' }}>Mỡ:</span>
                              <strong style={{ color: c.changes.bodyFatChange > 0 ? '#16a34a' : c.changes.bodyFatChange < 0 ? '#dc2626' : '#64748b' }}>
                                {c.changes.bodyFatChange > 0 ? `-${c.changes.bodyFatChange}%` : c.changes.bodyFatChange < 0 ? `+${Math.abs(c.changes.bodyFatChange)}%` : '0%'}
                              </strong>
                              <span style={{ color: '#64748b', marginLeft: '6px' }}>Cơ:</span>
                              <strong style={{ color: c.changes.muscleChange > 0 ? '#16a34a' : c.changes.muscleChange < 0 ? '#dc2626' : '#64748b' }}>
                                {c.changes.muscleChange > 0 ? `+${c.changes.muscleChange} kg` : `${c.changes.muscleChange} kg`}
                              </strong>
                            </div>
                            <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                              ({c.changes.daysBetween} ngày · {c.measurementCount} lần đo)
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.74rem' }}>
                            Chưa đủ dữ liệu InBody đối chiếu
                          </span>
                        )}
                      </td>

                      {/* Progress Score */}
                      <td>
                        {c.score !== null ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '65px', background: '#f1f5f9', borderRadius: '999px', height: '8px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                              <div
                                style={{
                                  width: `${Math.min(100, Math.max(0, c.score))}%`,
                                  height: '100%',
                                  borderRadius: '999px',
                                  background: c.score >= 70 ? '#22c55e' : c.score >= 50 ? '#0ea5e9' : '#ef4444',
                                }}
                              />
                            </div>
                            <span style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.78rem', fontFamily: 'Oswald, sans-serif' }}>
                              {c.score}/100
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.78rem' }}>—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                          <Link
                            to="/pt/inbody"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '8px', fontSize: '0.74rem', fontWeight: 700, color: '#003b70', background: '#f0f9ff', border: '1px solid #bae6fd', textDecoration: 'none' }}
                            title="Xem kết quả InBody"
                          >
                            <Ruler size={12} />
                            <span>InBody</span>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* PHẦN 2: KẾT QUẢ NỔI BẬT - TOP THAY ĐỔI THEO MỤC TIÊU */}
      {/* ========================================================================= */}
      <section className="pt-dash-section">
        <div className="pt-section-header">
          <div className="pt-section-title-wrap">
            <h2 className="pt-section-title">
              <Trophy size={20} className="text-amber-500" />
              <span>KẾT QUẢ NỔI BẬT - TOP THAY ĐỔI THEO MỤC TIÊU</span>
            </h2>

          </div>
        </div>

        {topTransformers.length === 0 ? (
          <div className="pt-dash-main-card" style={{ padding: '36px 24px', textAlign: 'center' }}>
            <Sparkles size={32} style={{ color: '#f59e0b', margin: '0 auto 8px' }} />
            <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#1e293b', margin: '0 0 4px' }}>
              Chưa có học viên nào lọt vào Top nổi bật
            </h3>
            <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>
              Cập nhật thêm dữ liệu đo InBody các lần tiếp theo để hệ thống tự động tính toán và vinh danh.
            </p>
          </div>
        ) : (
          <div className="pt-top-grid">
            {topTransformers.map((c, index) => {
              const badge = getRankBadgeInfo(index);
              return (
                <div key={c.customerId} className="pt-top-card">
                  {/* Top Header */}
                  <div className="pt-top-header">
                    <span
                      className="pt-top-rank-badge"
                      style={{ background: badge.bg, border: `1px solid ${badge.border}`, color: badge.color }}
                    >
                      <span>{badge.icon}</span>
                      <span>{badge.title}</span>
                    </span>
                    <span style={{ fontWeight: 800, color: '#003b70', fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem' }}>
                      {c.score}/100 điểm
                    </span>
                  </div>

                  {/* Top Body */}
                  <div className="pt-top-body">
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#003b70', margin: '0 0 4px' }}>
                        {c.fullName}
                      </h3>
                      <div style={{ fontSize: '0.76rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>🎯 Mục tiêu ban đầu:</span>
                        <strong style={{ color: '#0284c7' }}>{c.initialGoal || 'Tăng cơ giảm mỡ'}</strong>
                      </div>
                    </div>

                    {/* Stats Comparison Grid */}
                    <div className="pt-top-stats-grid">
                      {/* Body Fat Delta */}
                      <div className="pt-stat-item">
                        <span className="pt-stat-label">Body Fat</span>
                        <span className="pt-stat-val" style={{ color: '#16a34a' }}>
                          {c.changes && c.changes.bodyFatChange > 0 ? `-${c.changes.bodyFatChange}%` : '0%'}
                        </span>
                        <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                          {c.firstMeasurement?.bodyFatPercentage}% → {c.latestMeasurement?.bodyFatPercentage}%
                        </span>
                      </div>

                      {/* Muscle Mass Delta */}
                      <div className="pt-stat-item">
                        <span className="pt-stat-label">Khối lượng cơ</span>
                        <span className="pt-stat-val" style={{ color: '#0284c7' }}>
                          {c.changes && c.changes.muscleChange > 0 ? `+${c.changes.muscleChange}kg` : '0kg'}
                        </span>
                        <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                          {c.firstMeasurement?.muscleMass}kg → {c.latestMeasurement?.muscleMass}kg
                        </span>
                      </div>

                      {/* Weight Delta */}
                      <div className="pt-stat-item">
                        <span className="pt-stat-label">Cân nặng</span>
                        <span className="pt-stat-val" style={{ color: '#003b70' }}>
                          {c.changes && c.changes.weightChange !== 0 ? `${c.changes.weightChange > 0 ? '+' : ''}${c.changes.weightChange}kg` : '0kg'}
                        </span>
                        <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                          {c.firstMeasurement?.weight}kg → {c.latestMeasurement?.weight}kg
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Top Footer */}
                  <div className="pt-top-footer">
                    <span>
                      ⏱️ Thời gian: <strong>{c.changes?.daysBetween} ngày</strong> ({c.measurementCount} lần đo)
                    </span>
                    <Link
                      to="/pt/inbody"
                      style={{ color: '#0284c7', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                    >
                      <span>Xem lộ trình</span>
                      <ArrowUpRight size={13} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* PHẦN 3: CẢNH BÁO: CẦN QUAN TÂM */}
      {/* ========================================================================= */}
      <section className="pt-dash-section">
        <div className="pt-section-header">
          <div className="pt-section-title-wrap">
            <h2 className="pt-section-title">
              <ShieldAlert size={20} className="text-rose-600" />
              <span>CẢNH BÁO: HỌC VIÊN CẦN QUAN TÂM &amp; KHÔNG THAY ĐỔI</span>
            </h2>

          </div>
        </div>

        {attentionCustomers.length === 0 ? (
          <div className="pt-dash-main-card" style={{ padding: '36px 24px', textAlign: 'center' }}>
            <CheckCircle2 size={32} style={{ color: '#16a34a', margin: '0 auto 8px' }} />
            <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#1e293b', margin: '0 0 4px' }}>
              Tuyệt vời! Không có học viên nào bị cảnh báo nghiêm trọng
            </h3>

          </div>
        ) : (
          <div className="pt-alert-grid">
            {attentionCustomers.map((c) => (
              <div key={c.customerId} className="pt-alert-card">
                {/* Alert Header */}
                <div className="pt-alert-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <AlertTriangle size={16} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#991b1b', margin: 0 }}>
                        {c.fullName}
                      </h3>
                      <span style={{ fontSize: '0.72rem', color: '#b45309' }}>
                        🎯 Mục tiêu: {c.initialGoal || 'Cải thiện vóc dáng'}
                      </span>
                    </div>
                  </div>
                  <span style={{ padding: '3px 8px', borderRadius: '8px', background: '#fef2f2', color: '#dc2626', fontWeight: 800, fontSize: '0.72rem', border: '1px solid #fecaca' }}>
                    {c.progressCategory === 'POOR' ? 'Kết quả tệ' : 'Tiến bộ chậm'}
                  </span>
                </div>

                {/* Alert Body Tinh Gọn */}
                {c.improvementTips && c.improvementTips.length > 0 ? (
                  <div style={{ padding: '10px 18px', flex: 1 }}>
                    <div style={{ background: '#f0fdf4', border: '1px solid #dcfce7', borderRadius: '8px', padding: '8px 12px', fontSize: '0.78rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Sparkles size={13} color="#16a34a" className="shrink-0" />
                      <span>{c.improvementTips[0]}</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ flex: 1 }} />
                )}

                {/* Alert Footer Thoáng Đãng */}
                <div style={{ padding: '12px 18px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>
                    {c.openAlerts ? `⚠️ Cảnh báo tiến độ` : 'ℹ️ Cần theo dõi thêm'}
                  </span>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <Link
                      to="/pt/inbody"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 14px', borderRadius: '8px', fontSize: '0.76rem', fontWeight: 700, color: '#fff', background: '#003b70', textDecoration: 'none', border: '0', transition: 'all 0.15s ease' }}
                    >
                      <Ruler size={13} />
                      <span>Đo InBody</span>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
