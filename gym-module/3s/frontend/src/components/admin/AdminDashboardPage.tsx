import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  RefreshCw,
  Users,
  UserCheck,
  AlertTriangle,
  Package,
  CheckCircle2,
  Filter,
  UserPlus,
  ShieldAlert,
  Award,
  ChevronRight,
  SlidersHorizontal
} from 'lucide-react';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { api } from '../../services/api';

interface PtWorkloadItem {
  ptId: string;
  fullName: string;
  username: string;
  activeCustomers: number;
  totalCustomers: number;
  activePackages: number;
}

interface RecentAlertItem {
  _id: string;
  title: string;
  reason: string;
  ruleKey: string;
  dueAt: string;
  customerName: string;
  ptName: string;
}

interface AdminDashboard {
  totalPts: number;
  totalCustomers: number;
  openAlerts: number;
  activePackages: number;
  customerStats?: {
    active: number;
    lead: number;
    inactive: number;
  };
  packageStats?: {
    totalSessions: number;
    remainingSessions: number;
    completedSessions: number;
  };
  ptWorkload?: PtWorkloadItem[];
  recentAlerts?: RecentAlertItem[];
  filters: Record<string, string>;
  sourcePaths: string[];
}

export default function AdminDashboardPage() {
  const [, setSearchParams] = useSearchParams();
  const [selectedPtId, setSelectedPtId] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [ptOptions, setPtOptions] = useState<Array<{ id: string; fullName: string; username: string }>>([]);

  useEffect(() => {
    let active = true;
    api.get<Array<{ _id: string; fullName?: string; username: string }>>('/api/users?role=PT')
      .then((res) => {
        if (active && Array.isArray(res.data)) {
          setPtOptions(res.data.map((u) => ({ id: u._id, fullName: u.fullName || u.username, username: u.username })));
        }
      })
      .catch(() => { });
    return () => { active = false; };
  }, []);

  const loader = useCallback(() => {
    const params = new URLSearchParams();
    if (selectedPtId) params.set('ptId', selectedPtId);
    if (selectedStatus) params.set('customerStatus', selectedStatus);
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate) params.set('toDate', toDate);
    const queryString = params.toString();
    const url = `/api/dashboard/admin${queryString ? `?${queryString}` : ''}`;
    return api.get<AdminDashboard>(url).then(({ data }) => data);
  }, [selectedPtId, selectedStatus, fromDate, toDate]);

  const resource = useAsyncResource(loader);

  const switchTab = (tab: string) => {
    setSearchParams({ tab });
  };

  const resetFilters = () => {
    setSelectedPtId('');
    setSelectedStatus('');
    setFromDate('');
    setToDate('');
  };

  const hasActiveFilters = Boolean(selectedPtId || selectedStatus || fromDate || toDate);

  const data = resource.data;
  const customerStats = data?.customerStats || { active: 0, lead: 0, inactive: 0 };
  const packageStats = data?.packageStats || { totalSessions: 0, remainingSessions: 0, completedSessions: 0 };
  const ptWorkload = data?.ptWorkload || [];
  const recentAlerts = data?.recentAlerts || [];

  const totalMembers = (customerStats.active + customerStats.lead + customerStats.inactive) || (data?.totalCustomers || 1);
  const activePercent = Math.round((customerStats.active / totalMembers) * 100) || 0;
  const leadPercent = Math.round((customerStats.lead / totalMembers) * 100) || 0;
  const inactivePercent = Math.round((customerStats.inactive / totalMembers) * 100) || 0;

  const sessionFulfillment = packageStats.totalSessions > 0
    ? Math.round((packageStats.completedSessions / packageStats.totalSessions) * 100)
    : 0;

  const metricCards = data ? [
    {
      label: 'PT đang hoạt động',
      value: data.totalPts,
      subValue: '100% Đạt chứng chỉ',
      icon: Users,
      iconBg: '#eff6ff',
      iconColor: '#2563eb',
      badgeBg: '#dbeafe',
      badgeColor: '#1e40af',
      accentColor: '#3b82f6',
    },
    {
      label: 'Khách hàng',
      value: data.totalCustomers,
      subValue: `${customerStats.active} Đang tập • ${customerStats.lead} Tiềm năng`,
      icon: UserCheck,
      iconBg: '#ecfdf5',
      iconColor: '#059669',
      badgeBg: '#d1fae5',
      badgeColor: '#065f46',
      accentColor: '#10b981',
    },
    {
      label: 'Gói tập đang hoạt động',
      value: data.activePackages,
      subValue: `${packageStats.completedSessions}/${packageStats.totalSessions || 0} buổi hoàn thành`,
      icon: Package,
      iconBg: '#eef2ff',
      iconColor: '#4f46e5',
      badgeBg: '#e0e7ff',
      badgeColor: '#3730a3',
      accentColor: '#6366f1',
    },
    {
      label: 'Cảnh báo đang mở',
      value: data.openAlerts,
      subValue: data.openAlerts > 0 ? 'Cần xử lý chăm sóc' : 'Hệ thống an toàn',
      icon: AlertTriangle,
      iconBg: '#fff1f2',
      iconColor: '#e11d48',
      badgeBg: data.openAlerts > 0 ? '#ffe4e6' : '#f1f5f9',
      badgeColor: data.openAlerts > 0 ? '#9f1239' : '#475569',
      accentColor: '#f43f5e',
    },
  ] : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '4px 0 20px' }}>

      {/* 1. Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 id="admin-dashboard-title" style={{ fontSize: '1.45rem', fontWeight: 800, color: '#00284a', margin: 0, fontFamily: "'Be Vietnam Pro', sans-serif" }}>
              Tổng quan hệ thống
            </h1>
            <span style={{ background: '#dcfce7', color: '#15803d', fontSize: '0.72rem', fontWeight: 700, padding: '3px 9px', borderRadius: '12px' }}>
              Trực tiếp
            </span>
          </div>
          <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '4px 0 0' }}>
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              style={{ padding: '7px 14px', fontSize: '0.8rem', fontWeight: 700, color: '#e11d48', background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '8px', cursor: 'pointer' }}
            >
              Xóa bộ lọc
            </button>
          )}
          <button
            onClick={() => void resource.refresh()}
            type="button"
            aria-label="Làm mới dữ liệu"
            title="Làm mới dữ liệu"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#ffffff', color: '#003b70', border: '1.5px solid #cbd5e1', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
          >
            <RefreshCw size={14} className={resource.status === 'loading' ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* 2. Filter Bar */}
      <div style={{ background: '#ffffff', padding: '18px 20px', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', fontWeight: 700, color: '#003b70', marginBottom: '12px' }}>
          <Filter size={15} color="#00a4e4" />
          <span>Bộ lọc dữ liệu nhanh:</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Huấn luyện viên</label>
            <select
              value={selectedPtId}
              onChange={(e) => setSelectedPtId(e.target.value)}
              style={{ width: '100%', height: '38px', padding: '0 10px', fontSize: '0.82rem', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#1e293b', outline: 'none' }}
            >
              <option value="">Tất cả Huấn luyện viên</option>
              {ptOptions.map((pt) => (
                <option key={pt.id} value={pt.id}>{pt.fullName} (@{pt.username})</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Trạng thái Hội viên</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={{ width: '100%', height: '38px', padding: '0 10px', fontSize: '0.82rem', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#1e293b', outline: 'none' }}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang tập (Active)</option>
              <option value="LEAD">Tiềm năng (Lead)</option>
              <option value="INACTIVE">Tạm dừng (Inactive)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Từ ngày</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              style={{ width: '100%', height: '38px', padding: '0 10px', fontSize: '0.82rem', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#1e293b', outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Đến ngày</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              style={{ width: '100%', height: '38px', padding: '0 10px', fontSize: '0.82rem', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#1e293b', outline: 'none' }}
            />
          </div>
        </div>
      </div>

      {/* Loading State */}
      {resource.status === 'loading' && !resource.data && (
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '48px 20px', textAlign: 'center', color: '#64748b' }}>
          <RefreshCw size={26} className="animate-spin" style={{ color: '#00a4e4', margin: '0 auto 12px' }} />
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#003b70' }}>Đang đồng bộ số liệu vận hành...</div>
          <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '4px' }}>Hệ thống đang kết nối trực tiếp dữ liệu thời gian thực</div>
        </div>
      )}

      {/* Error State */}
      {resource.status === 'error' && (
        <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '14px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertTriangle size={24} color="#e11d48" />
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#9f1239' }}>Không thể tải số liệu thống kê</div>
              <div style={{ fontSize: '0.78rem', color: '#be123c', marginTop: '2px' }}>Vui lòng kiểm tra lại kết nối mạng hoặc thử lại.</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void resource.refresh()}
            style={{ padding: '8px 18px', background: '#e11d48', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Main Content */}
      {data && (
        <>
          {/* 3. 4 Core Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            {metricCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  style={{
                    background: '#ffffff',
                    borderRadius: '14px',
                    padding: '18px 20px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: card.accentColor }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {card.label}
                      </div>
                      <div style={{ fontSize: '1.9rem', fontWeight: 900, color: '#00284a', margin: '4px 0 2px', lineHeight: 1.1, fontFamily: "'Be Vietnam Pro', sans-serif" }}>
                        {card.value}
                      </div>
                    </div>
                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: card.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={22} color={card.iconColor} />
                    </div>
                  </div>

                  <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                    <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, background: card.badgeBg, color: card.badgeColor }}>
                      {card.subValue}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 4. Analytics & Progress Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px' }}>

            {/* Customer Status Breakdown */}
            <div style={{ background: '#ffffff', borderRadius: '14px', padding: '20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#00284a', margin: 0 }}>
                    Cơ cấu Trạng thái Hội viên
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '2px 0 0' }}>Phân loại theo mức độ tương tác</p>
                </div>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#00a4e4', background: 'rgba(0,164,228,0.1)', padding: '4px 10px', borderRadius: '8px' }}>
                  {data.totalCustomers} Tổng số
                </span>
              </div>

              {/* Progress Bar */}
              <div style={{ height: '10px', width: '100%', background: '#f1f5f9', borderRadius: '10px', overflow: 'hidden', display: 'flex', marginBottom: '16px' }}>
                <div style={{ width: `${activePercent}%`, background: '#10b981', transition: 'width 0.5s' }} title={`Đang tập: ${activePercent}%`} />
                <div style={{ width: `${leadPercent}%`, background: '#f59e0b', transition: 'width 0.5s' }} title={`Tiềm năng: ${leadPercent}%`} />
                <div style={{ width: `${inactivePercent}%`, background: '#cbd5e1', transition: 'width 0.5s' }} title={`Tạm dừng: ${inactivePercent}%`} />
              </div>

              {/* Legend Boxes */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                <div style={{ background: '#ecfdf5', padding: '10px', borderRadius: '10px', border: '1px solid #d1fae5' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: 700, color: '#065f46' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} /> Đang tập
                  </div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#064e3b', margin: '4px 0 0' }}>{customerStats.active}</div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#059669' }}>{activePercent}% tổng số</div>
                </div>

                <div style={{ background: '#fffbeb', padding: '10px', borderRadius: '10px', border: '1px solid #fef3c7' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: 700, color: '#92400e' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b' }} /> Tiềm năng
                  </div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#78350f', margin: '4px 0 0' }}>{customerStats.lead}</div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#d97706' }}>{leadPercent}% tổng số</div>
                </div>

                <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: 700, color: '#475569' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#94a3b8' }} /> Tạm dừng
                  </div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#1e293b', margin: '4px 0 0' }}>{customerStats.inactive}</div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#64748b' }}>{inactivePercent}% tổng số</div>
                </div>
              </div>
            </div>

            {/* Package Fulfillment */}
            <div style={{ background: '#ffffff', borderRadius: '14px', padding: '20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#00284a', margin: 0 }}>
                    Tiến độ Thực hiện Buổi tập
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '2px 0 0' }}>Tổng khối lượng buổi tập toàn hệ thống</p>
                </div>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#4f46e5', background: '#eef2ff', padding: '4px 10px', borderRadius: '8px' }}>
                  {sessionFulfillment}% Hoàn thành
                </span>
              </div>

              {/* Progress Bar */}
              <div style={{ height: '10px', width: '100%', background: '#f1f5f9', borderRadius: '10px', overflow: 'hidden', display: 'flex', marginBottom: '16px' }}>
                <div style={{ width: `${sessionFulfillment}%`, background: 'linear-gradient(90deg, #3b82f6, #6366f1)', transition: 'width 0.5s' }} />
              </div>

              {/* Legend Boxes */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b' }}>Tổng số buổi</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0f172a', margin: '4px 0 0' }}>{packageStats.totalSessions}</div>
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Toàn hệ thống</div>
                </div>

                <div style={{ background: '#eff6ff', padding: '10px', borderRadius: '10px', border: '1px solid #dbeafe' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1e40af' }}>Đã tập luyện</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#1e3a8a', margin: '4px 0 0' }}>{packageStats.completedSessions}</div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#2563eb' }}>{sessionFulfillment}% hoàn tất</div>
                </div>

                <div style={{ background: '#f0fdf4', padding: '10px', borderRadius: '10px', border: '1px solid #dcfce7' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#166534' }}>Buổi còn lại</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#14532d', margin: '4px 0 0' }}>{packageStats.remainingSessions}</div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#16a34a' }}>{100 - sessionFulfillment}% chưa tập</div>
                </div>
              </div>
            </div>

          </div>

          {/* 5. PT Workload & Care Alerts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px' }}>

            {/* PT Workload Ranking */}
            <div style={{ background: '#ffffff', borderRadius: '14px', padding: '20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Award size={18} color="#f59e0b" />
                  <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#00284a', margin: 0 }}>
                    Tải công việc Đội ngũ HLV PT
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => switchTab('pts')}
                  style={{ background: 'none', border: 'none', color: '#00a4e4', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '2px' }}
                >
                  Xem chi tiết PT <ChevronRight size={14} />
                </button>
              </div>

              {ptWorkload.length === 0 ? (
                <div style={{ padding: '30px 0', textAlign: 'center', fontSize: '0.8rem', color: '#94a3b8' }}>
                  Chưa có dữ liệu phân bổ Huấn luyện viên
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {ptWorkload.slice(0, 5).map((pt, idx) => {
                    const maxCustomers = Math.max(...ptWorkload.map(p => p.activeCustomers), 1);
                    const workloadBar = Math.round((pt.activeCustomers / maxCustomers) * 100);
                    return (
                      <div key={pt.ptId} style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#e2e8f0', color: '#334155', fontSize: '0.7rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {idx + 1}
                            </span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>{pt.fullName}</span>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>@{pt.username}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669', background: '#ecfdf5', padding: '2px 8px', borderRadius: '6px' }}>
                              {pt.activeCustomers} Học viên
                            </span>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              {pt.activePackages} Gói
                            </span>
                          </div>
                        </div>
                        <div style={{ width: '100%', height: '5px', background: '#e2e8f0', borderRadius: '5px', overflow: 'hidden' }}>
                          <div style={{ width: `${workloadBar}%`, height: '100%', background: 'linear-gradient(90deg, #00a4e4, #003b70)', borderRadius: '5px' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Care Alerts */}
            <div style={{ background: '#ffffff', borderRadius: '14px', padding: '20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldAlert size={18} color="#e11d48" />
                  <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#00284a', margin: 0 }}>
                    Cảnh báo Chăm sóc Khách hàng
                  </h3>
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#e11d48', background: '#fff1f2', padding: '3px 9px', borderRadius: '12px' }}>
                  {data.openAlerts} Cần xử lý
                </span>
              </div>

              {recentAlerts.length === 0 ? (
                <div style={{ padding: '36px 0', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <CheckCircle2 size={32} color="#10b981" style={{ marginBottom: '8px' }} />
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>Hệ thống hoạt động an toàn</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>Tất cả hội viên đang được chăm sóc đúng quy trình</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {recentAlerts.map((alert) => (
                    <div
                      key={alert._id}
                      style={{ padding: '12px 14px', background: '#fff1f2', borderRadius: '10px', border: '1px solid #fecdd3', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#9f1239' }}>{alert.title}</span>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#e11d48', background: 'rgba(255,255,255,0.8)', padding: '1px 6px', borderRadius: '4px' }}>
                            {alert.customerName}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#475569', margin: '3px 0' }}>{alert.reason}</div>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                          PT: <strong style={{ color: '#334155' }}>{alert.ptName}</strong> • Hạn: {new Date(alert.dueAt).toLocaleDateString('vi-VN')}
                        </div>
                      </div>
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#e11d48', background: '#ffffff', border: '1px solid #fecdd3', padding: '3px 8px', borderRadius: '6px', whiteSpace: 'nowrap' }}>
                        Cần can thiệp
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* 6. Quick Actions */}
          <div style={{ background: '#001e3d', borderRadius: '14px', padding: '20px', color: 'white', boxShadow: '0 4px 16px rgba(0,30,61,0.15)' }}>
            <div style={{ marginBottom: '14px' }}>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                Lối tắt Quản trị Nhanh
              </h3>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '2px 0 0' }}>Truy cập tức thì các module quản lý chuyên sâu</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
              <button
                type="button"
                onClick={() => switchTab('pts')}
                style={{ padding: '14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', textAlign: 'left', cursor: 'pointer', color: 'white', display: 'flex', flexDirection: 'column', gap: '8px', transition: 'all 0.2s ease' }}
              >
                <UserPlus size={20} color="#38bdf8" />
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>Quản lý PT</div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Thêm & sửa HLV</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => switchTab('users')}
                style={{ padding: '14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', textAlign: 'left', cursor: 'pointer', color: 'white', display: 'flex', flexDirection: 'column', gap: '8px', transition: 'all 0.2s ease' }}
              >
                <Users size={20} color="#34d399" />
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>Toàn bộ Tài khoản</div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Phân quyền User</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => switchTab('packages')}
                style={{ padding: '14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', textAlign: 'left', cursor: 'pointer', color: 'white', display: 'flex', flexDirection: 'column', gap: '8px', transition: 'all 0.2s ease' }}
              >
                <Package size={20} color="#c084fc" />
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>Gói tập mẫu</div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Biểu giá & buổi tập</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => switchTab('flags')}
                style={{ padding: '14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', textAlign: 'left', cursor: 'pointer', color: 'white', display: 'flex', flexDirection: 'column', gap: '8px', transition: 'all 0.2s ease' }}
              >
                <SlidersHorizontal size={20} color="#fbbf24" />
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>Tính năng hệ thống</div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Feature Flags</div>
                </div>
              </button>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
