import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Dumbbell,
  Eye,
  FileText,
  HeartPulse,
  Image as ImageIcon,
  MessageSquare,
  Package,
  Pencil,
  Phone,
  Plus,
  Ruler,
  Salad,
  Shield,
  Sliders,
  Sparkles,
  Target,
  Trash2,
  User,
  UserPlus,
  Utensils,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import FormField from './FormField';
import StatusBadge from './StatusBadge';
import { useToast } from './ToastProvider';
import { api } from '../../services/api';
import { errorMessage } from '../../types';
import CustomerConsultationModal from './CustomerConsultationModal';
import CustomerPhotoModal from './CustomerPhotoModal';
import { CustomerTodayNutritionModal } from '../nutrition/CustomerTodayNutritionModal';
import PtPackageManagerModal from './PtPackageManagerModal';
import InBodyDetailModal from '../inbody/InBodyDetailModal';
import InBodyManualModal from '../inbody/InBodyManualModal';
import type { InBodyRecordData } from '../../types/inbody';
import CustomerWorkoutPlanTab from '../customers/CustomerWorkoutPlanTab';

export interface CustomerFullDetail {
  _id: string;
  fullName: string;
  phone: string;
  email?: string | null;
  dateOfBirth?: string | null;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  height?: number | null;
  initialWeight?: number | null;
  medicalNotes?: string;
  initialGoal?: string;
  internalNotes?: string;
  status: string;
  userId?: string | {
    _id?: string;
    id?: string;
    username?: string;
    email?: string | null;
    status?: 'ACTIVE' | 'LOCKED';
    role?: string;
    createdAt?: string;
  } | null;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

interface CustomerDetailModalProps {
  open: boolean;
  customer: { _id?: string; fullName?: string } | null;
  onClose: () => void;
  onEditCustomer?: (customer: CustomerFullDetail) => void;
  onGrantAccount?: (customer: CustomerFullDetail) => void;
}

type DetailTab = 'overview' | 'packages' | 'consultations' | 'photos' | 'plans' | 'nutrition' | 'workouts' | 'inbody';

export default function CustomerDetailModal({
  open,
  customer,
  onClose,
  onEditCustomer,
  onGrantAccount,
}: CustomerDetailModalProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [detail, setDetail] = useState<CustomerFullDetail | null>(null);
  const [loading, setLoading] = useState(false);

  // Sub-modal triggers
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [showConsultationModal, setShowConsultationModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedInbodyRecord, setSelectedInbodyRecord] = useState<InBodyRecordData | null>(null);
  const [showInbodyManualModal, setShowInbodyManualModal] = useState(false);

  // Summary counts
  const [packages, setPackages] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [inbodies, setInbodies] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [nutritionPlans, setNutritionPlans] = useState<any[]>([]);
  const [selectedRealtimePlan, setSelectedRealtimePlan] = useState<any | null>(null);

  // Drag-to-scroll & overflow scroll support for tabs
  const tabsContainerRef = useRef<HTMLDivElement | null>(null);
  const isDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const hasDraggedRef = useRef(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = tabsContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 6);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 6);
  }, []);

  useEffect(() => {
    const el = tabsContainerRef.current;
    if (!el) return;
    checkScroll();
    const handleResize = () => checkScroll();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [checkScroll, open]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const el = tabsContainerRef.current;
    if (!el) return;
    isDownRef.current = true;
    hasDraggedRef.current = false;
    startXRef.current = e.pageX - el.offsetLeft;
    scrollLeftRef.current = el.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDownRef.current) return;
    const el = tabsContainerRef.current;
    if (!el) return;
    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    const walk = (x - startXRef.current) * 1.5;
    if (Math.abs(walk) > 4) {
      hasDraggedRef.current = true;
    }
    el.scrollLeft = scrollLeftRef.current - walk;
    checkScroll();
  };

  const handleMouseUp = () => {
    isDownRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    const el = tabsContainerRef.current;
    if (!el) return;
    if (e.deltaY) {
      el.scrollLeft += e.deltaY;
      checkScroll();
    }
  };

  const scrollBy = (offset: number) => {
    const el = tabsContainerRef.current;
    if (!el) return;
    el.scrollBy({ left: offset, behavior: 'smooth' });
    setTimeout(checkScroll, 300);
  };

  const loadAll = async () => {
    if (!customer?._id) return;
    try {
      setLoading(true);
      const [resCustomer, resPackages, resConsultations, resPhotos, resInbody, resSessions, resNutrition] = await Promise.allSettled([
        api.get<CustomerFullDetail>(`/api/customers/${customer._id}`),
        api.get<any[]>(`/api/customers/${customer._id}/packages?limit=50`),
        api.get<any[]>(`/api/customers/${customer._id}/consultations?limit=50`),
        api.get<any[]>(`/api/customers/${customer._id}/photos?limit=50`),
        api.get<any[]>(`/api/inbody?customerId=${customer._id}&limit=50`),
        api.get<any>(`/api/workout-sessions?customerId=${customer._id}&limit=50`),
        api.get<any[]>(`/api/nutrition-plans?customerId=${customer._id}&limit=50`),
      ]);

      if (resCustomer.status === 'fulfilled' && resCustomer.value.data) {
        setDetail(resCustomer.value.data);
      }
      if (resPackages.status === 'fulfilled' && resPackages.value.data) {
        setPackages(resPackages.value.data);
      }
      if (resConsultations.status === 'fulfilled' && resConsultations.value.data) {
        setConsultations(resConsultations.value.data);
      }
      if (resPhotos.status === 'fulfilled' && resPhotos.value.data) {
        setPhotos(resPhotos.value.data);
      }
      if (resInbody.status === 'fulfilled' && resInbody.value.data) {
        setInbodies(resInbody.value.data);
      }
      if (resSessions.status === 'fulfilled' && resSessions.value.data) {
        setSessions(Array.isArray(resSessions.value.data) ? resSessions.value.data : resSessions.value.data?.items || []);
      }
      if (resNutrition.status === 'fulfilled' && resNutrition.value.data) {
        setNutritionPlans(Array.isArray(resNutrition.value.data) ? resNutrition.value.data : []);
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setActiveTab('overview');
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customer?._id]);

  const activePackage = useMemo(() => packages.find((p) => p.status === 'ACTIVE'), [packages]);

  const publishedNutritionPlans = useMemo(() => {
    return nutritionPlans.filter((p: any) => p.status === 'PUBLISHED');
  }, [nutritionPlans]);

  const userAccount = useMemo(() => {
    if (!detail?.userId) return null;
    if (typeof detail.userId === 'object' && detail.userId !== null && 'username' in detail.userId && detail.userId.username) {
      return detail.userId;
    }
    return null;
  }, [detail?.userId]);

  const hasAccount = Boolean(userAccount || (detail?.userId && typeof detail.userId === 'string'));

  const isSubModalOpen =
    showPackageModal ||
    showConsultationModal ||
    showPhotoModal ||
    Boolean(selectedInbodyRecord) ||
    showInbodyManualModal ||
    Boolean(selectedRealtimePlan);

  if (!open || !customer) return null;

  return (
    <>
      <div
        className="modal-backdrop customer-detail-modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-detail-title"
        style={{ display: isSubModalOpen ? 'none' : 'grid' }}
      >
        <div
          className="modal-content customer-detail-modal-box"
          style={{
            maxWidth: '1020px',
            width: '95%',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            padding: 0,
            overflow: 'hidden',
            borderRadius: '16px',
            background: '#ffffff',
          }}
        >
          {/* Header Profile Banner */}
          <div
            className="customer-detail-header"
            style={{
              background: 'linear-gradient(135deg, #00264d 0%, #003b70 50%, #005696 100%)',
              color: '#ffffff',
              padding: '24px 28px 0 28px',
              position: 'relative',
              flexShrink: 0,
            }}
          >
            {/* Circular Close Button with hover state */}
            <button
              type="button"
              className="icon-button"
              onClick={onClose}
              aria-label="Đóng"
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                zIndex: 10,
              }}
            >
              <X size={18} />
            </button>

            {/* Profile & Actions Row */}
            <div className="customer-detail-profile-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', paddingRight: '44px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  className="customer-detail-avatar"
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #00a4e4 0%, #0284c7 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.4rem',
                    fontWeight: 800,
                    color: '#ffffff',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                    border: '2px solid rgba(255,255,255,0.3)',
                    flexShrink: 0,
                  }}
                >
                  {detail?.fullName ? detail.fullName.charAt(0).toUpperCase() : customer.fullName?.charAt(0).toUpperCase() || 'K'}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h1 id="customer-detail-title" className="customer-detail-title" style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: '#ffffff' }}>
                      {detail?.fullName || customer.fullName}
                    </h1>
                    {detail?.status && <StatusBadge status={detail.status} />}
                    {userAccount ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          background: 'rgba(255, 255, 255, 0.18)',
                          border: '1px solid rgba(255, 255, 255, 0.35)',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          color: '#ffffff',
                        }}
                      >
                        <Shield size={11} style={{ color: '#38bdf8' }} />
                        @{userAccount.username}
                      </span>
                    ) : (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px dashed rgba(255, 255, 255, 0.25)',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.72rem',
                          color: '#bae6fd',
                        }}
                      >
                        Chưa cấp tài khoản
                      </span>
                    )}
                  </div>

                  <div className="customer-detail-meta" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px', fontSize: '0.84rem', color: '#f1f5f9', flexWrap: 'wrap' }}>
                    {detail?.phone && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ffffff', fontWeight: 600 }}>
                        <Phone size={13} style={{ color: '#38bdf8' }} /> {detail.phone}
                      </span>
                    )}
                    {detail?.email && (
                      <span style={{ color: '#e2e8f0' }}>{detail.email}</span>
                    )}
                    {detail?.gender && (
                      <span style={{ color: '#bae6fd', fontWeight: 600 }}>
                        {detail.gender === 'MALE' ? 'Nam' : detail.gender === 'FEMALE' ? 'Nữ' : 'Khác'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Action Buttons */}
              <div className="customer-detail-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {detail && onEditCustomer && (
                  <button
                    type="button"
                    className="button button-secondary"
                    style={{
                      background: 'rgba(255,255,255,0.18)',
                      color: '#ffffff',
                      border: '1px solid rgba(255,255,255,0.35)',
                      fontSize: '0.82rem',
                      padding: '7px 12px',
                      borderRadius: '8px',
                      fontWeight: 600,
                    }}
                    onClick={() => {
                      onClose();
                      onEditCustomer(detail);
                    }}
                  >
                    <Pencil size={13} style={{ marginRight: '4px' }} /> Sửa thông tin
                  </button>
                )}
              </div>
            </div>

            {/* Sub-tabs Navigation */}
            <div className="customer-detail-tabs" style={{ position: 'relative', marginTop: '18px' }}>
              {canScrollLeft && (
                <button
                  type="button"
                  onClick={() => scrollBy(-180)}
                  aria-label="Cuộn sang trái"
                  style={{
                    position: 'absolute',
                    left: '-12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: '#00264d',
                    border: '1px solid rgba(255, 255, 255, 0.35)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: 10,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  }}
                >
                  <ChevronLeft size={16} />
                </button>
              )}

              <div
                ref={tabsContainerRef}
                className="no-scrollbar"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                onScroll={checkScroll}
                style={{
                  display: 'flex',
                  gap: '4px',
                  overflowX: 'auto',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  paddingBottom: '0',
                  cursor: 'grab',
                  userSelect: 'none',
                }}
              >
                {[
                  { id: 'overview', label: 'Tổng quan & Hồ sơ', icon: User, count: null },
                  { id: 'packages', label: 'Gói tập PT', icon: Package, count: packages.length },
                  { id: 'consultations', label: 'Lịch sử tư vấn', icon: MessageSquare, count: consultations.length },
                  { id: 'photos', label: 'Ảnh Before / After', icon: Camera, count: photos.length },
                  { id: 'plans', label: 'Giáo án', icon: ClipboardList, count: null },
                  { id: 'nutrition', label: 'Thực đơn Dinh dưỡng', icon: Salad, count: nutritionPlans.length },
                  { id: 'workouts', label: 'Lịch sử tập luyện', icon: Dumbbell, count: sessions.length },
                  { id: 'inbody', label: 'InBody & Số đo', icon: Ruler, count: inbodies.length },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      className="customer-detail-tab-btn"
                      onClick={() => {
                        if (!hasDraggedRef.current) {
                          setActiveTab(tab.id as DetailTab);
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '10px 16px',
                        fontSize: '0.86rem',
                        fontWeight: active ? 800 : 600,
                        color: active ? '#003b70' : '#f1f5f9',
                        background: active ? '#f8fafc' : 'rgba(255, 255, 255, 0.08)',
                        border: 'none',
                        borderRadius: '10px 10px 0 0',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.15s ease',
                        boxShadow: active ? '0 -2px 8px rgba(0,0,0,0.06)' : 'none',
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={15} style={{ color: active ? '#0284c7' : '#7dd3fc' }} />
                      <span>{tab.label}</span>
                      {tab.count !== null && tab.count > 0 && (
                        <span
                          style={{
                            background: active ? '#e0f2fe' : 'rgba(255,255,255,0.2)',
                            color: active ? '#0284c7' : '#ffffff',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '10px',
                          }}
                        >
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {canScrollRight && (
                <button
                  type="button"
                  onClick={() => scrollBy(180)}
                  aria-label="Cuộn sang phải"
                  style={{
                    position: 'absolute',
                    right: '-12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: '#00264d',
                    border: '1px solid rgba(255, 255, 255, 0.35)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: 10,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  }}
                >
                  <ChevronRight size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Tab Content Body */}
          <div className="customer-detail-body" style={{ padding: '24px 28px', overflowY: 'auto', flex: 1, background: '#f8fafc' }}>
            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && detail && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Quick Stat Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div style={{ background: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Gói tập hiện tại</span>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#003b70', marginTop: '4px' }}>
                      {activePackage ? activePackage.name : 'Chưa có gói hoạt động'}
                    </div>
                    {activePackage && (
                      <small style={{ color: '#16a34a', fontWeight: 600 }}>
                        Còn {activePackage.remainingSessions}/{activePackage.totalSessions} buổi
                      </small>
                    )}
                  </div>

                  <div style={{ background: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Chiều cao & Cân nặng</span>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#003b70', marginTop: '4px' }}>
                      {detail.height ? `${detail.height} cm` : '—'} • {detail.initialWeight ? `${detail.initialWeight} kg` : '—'}
                    </div>
                    {detail.height && detail.initialWeight && (
                      <small style={{ color: '#64748b' }}>
                        BMI ban đầu: {(detail.initialWeight / Math.pow(detail.height / 100, 2)).toFixed(1)}
                      </small>
                    )}
                  </div>

                  <div style={{ background: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Tổng buổi đã tập</span>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#003b70', marginTop: '4px' }}>
                      {sessions.length} buổi tập
                    </div>
                    <small style={{ color: '#0284c7' }}>Lần gần nhất: {sessions[0]?.performedAt ? new Date(sessions[0].performedAt).toLocaleDateString('vi-VN') : '—'}</small>
                  </div>
                </div>

                {/* App Account Section */}
                {userAccount ? (
                  <div
                    style={{
                      background: 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)',
                      padding: '18px 20px',
                      borderRadius: '12px',
                      border: '1px solid #bae6fd',
                      boxShadow: '0 2px 8px rgba(2, 132, 199, 0.05)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Shield size={16} style={{ color: '#0284c7' }} />
                        </div>
                        <div>
                          <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800, color: '#003b70' }}>Tài khoản đăng nhập ứng dụng</h3>
                          <span style={{ fontSize: '0.76rem', color: '#64748b' }}>Học viên dùng tài khoản này để đăng nhập vào cổng Customer Portal</span>
                        </div>
                      </div>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '3px 10px',
                          borderRadius: '20px',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          background: userAccount.status === 'LOCKED' ? '#fee2e2' : '#dcfce7',
                          color: userAccount.status === 'LOCKED' ? '#991b1b' : '#166534',
                          border: `1px solid ${userAccount.status === 'LOCKED' ? '#fca5a5' : '#86efac'}`,
                        }}
                      >
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: userAccount.status === 'LOCKED' ? '#ef4444' : '#22c55e' }} />
                        {userAccount.status === 'LOCKED' ? 'Tài khoản đã khóa' : 'Đang hoạt động'}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', background: '#ffffff', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>Tên đăng nhập</span>
                        <strong style={{ fontSize: '0.94rem', color: '#0284c7', marginTop: '2px', display: 'block' }}>@{userAccount.username}</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>Email đăng nhập</span>
                        <span style={{ fontSize: '0.88rem', color: '#1e293b', marginTop: '2px', display: 'block', fontWeight: 500 }}>{userAccount.email || detail.email || 'Chưa cập nhật'}</span>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>Quyền hạn</span>
                        <span style={{ fontSize: '0.88rem', color: '#0f172a', marginTop: '2px', display: 'block', fontWeight: 600 }}>Hội viên (CUSTOMER)</span>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>Cổng truy cập</span>
                        <span style={{ fontSize: '0.88rem', color: '#0284c7', marginTop: '2px', display: 'block', fontWeight: 600 }}>/me (Hành trình của tôi)</span>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Goal & Notes Section */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#003b70' }}>
                      <Target size={18} style={{ color: '#0284c7' }} />
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Mục tiêu tập luyện</h3>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                      {detail.initialGoal || 'Chưa thiết lập mục tiêu ban đầu.'}
                    </p>
                  </div>

                  <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#e11d48' }}>
                      <HeartPulse size={18} />
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>Lưu ý sức khỏe & Bệnh lý</h3>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                      {detail.medicalNotes || 'Không có tiền sử bệnh lý hoặc chấn thương đặc biệt.'}
                    </p>
                  </div>
                </div>

                {/* Internal PT Notes */}
                <div style={{ background: '#fefce8', padding: '18px 20px', borderRadius: '12px', border: '1px solid #fef08a' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#854d0e' }}>
                    <FileText size={17} />
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Ghi chú nội bộ của PT</h3>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.88rem', color: '#713f12', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                    {detail.internalNotes || 'Chưa có ghi chú nội bộ.'}
                  </p>
                </div>
              </div>
            )}

            {/* TAB 2: PACKAGES */}
            {activeTab === 'packages' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#003b70' }}>Quản lý gói tập PT</h3>
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => setShowPackageModal(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Plus size={16} /> Mở trình quản lý gói PT
                  </button>
                </div>

                {packages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', background: '#fff', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                    <Package size={36} style={{ color: '#94a3b8', margin: '0 auto 10px' }} />
                    <p style={{ color: '#64748b', margin: 0 }}>Khách hàng chưa có gói tập PT nào.</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                    {packages.map((pkg) => (
                      <div
                        key={pkg._id}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '12px',
                          padding: '18px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                          <strong style={{ fontSize: '1.05rem', color: '#003b70' }}>{pkg.name}</strong>
                          <StatusBadge status={pkg.status} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.86rem', color: '#475569' }}>
                          <div>Tổng số buổi: <strong>{pkg.totalSessions}</strong></div>
                          <div>Đã sử dụng: <strong style={{ color: '#e11d48' }}>{pkg.usedSessions || (pkg.totalSessions - pkg.remainingSessions)}</strong> buổi</div>
                          <div>Còn lại: <strong style={{ color: '#16a34a', fontSize: '1rem' }}>{pkg.remainingSessions}</strong> buổi</div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                            Thời hạn: {pkg.startDate ? new Date(pkg.startDate).toLocaleDateString('vi-VN') : ''} - {pkg.endDate ? new Date(pkg.endDate).toLocaleDateString('vi-VN') : ''}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: CONSULTATIONS */}
            {activeTab === 'consultations' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#003b70' }}>Lịch sử tư vấn ({consultations.length})</h3>
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => setShowConsultationModal(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Plus size={16} /> Thêm / Quản lý tư vấn
                  </button>
                </div>

                {consultations.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', background: '#fff', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                    <MessageSquare size={36} style={{ color: '#94a3b8', margin: '0 auto 10px' }} />
                    <p style={{ color: '#64748b', margin: 0 }}>Chưa có buổi tư vấn nào được ghi nhận.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {consultations.map((item) => (
                      <div key={item._id} style={{ background: '#ffffff', padding: '16px 20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <strong style={{ fontSize: '1rem', color: '#003b70' }}>{item.topic}</strong>
                          <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar size={13} /> {item.consultationDate ? new Date(item.consultationDate).toLocaleDateString('vi-VN') : '—'}
                          </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.86rem' }}>
                          <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px' }}>
                            <span style={{ fontWeight: 600, color: '#475569', display: 'block' }}>Thể trạng:</span>
                            <p style={{ margin: '4px 0 0', color: '#1e293b' }}>{item.currentCondition}</p>
                          </div>
                          <div style={{ background: '#f0fdf4', padding: '10px 12px', borderRadius: '8px', borderLeft: '3px solid #16a34a' }}>
                            <span style={{ fontWeight: 600, color: '#15803d', display: 'block' }}>Lời khuyên PT:</span>
                            <p style={{ margin: '4px 0 0', color: '#1e293b' }}>{item.advice}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: PHOTOS BEFORE / AFTER */}
            {activeTab === 'photos' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#003b70' }}>Ảnh Before / After ({photos.length})</h3>
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => setShowPhotoModal(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Camera size={16} /> Quản lý & So sánh Before/After
                  </button>
                </div>

                {photos.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', background: '#fff', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                    <Camera size={36} style={{ color: '#94a3b8', margin: '0 auto 10px' }} />
                    <p style={{ color: '#64748b', margin: 0 }}>Chưa có ảnh tiến độ Before / After.</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px' }}>
                    {photos.map((item) => (
                      <div key={item._id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                        <div style={{ height: '180px', background: '#000', position: 'relative' }}>
                          <img src={item.photoUrl} alt={item.stage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <span style={{ position: 'absolute', top: '6px', left: '6px', background: item.stage === 'BEFORE' ? '#e0f2fe' : item.stage === 'AFTER' ? '#dcfce7' : '#f3e8ff', color: item.stage === 'BEFORE' ? '#0369a1' : item.stage === 'AFTER' ? '#15803d' : '#7c3aed', fontSize: '0.7rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px' }}>
                            {item.stage}
                          </span>
                        </div>
                        <div style={{ padding: '8px 10px', fontSize: '0.8rem', color: '#64748b' }}>
                          <div>{item.takenDate ? new Date(item.takenDate).toLocaleDateString('vi-VN') : ''}</div>
                          {item.weight && <strong style={{ color: '#0f172a' }}>{item.weight} kg</strong>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'plans' && customer?._id && (
              <CustomerWorkoutPlanTab customerId={customer._id} customerName={detail?.fullName || customer.fullName || 'Khách hàng'} />
            )}

            {/* TAB: THỰC ĐƠN DINH DƯỠNG */}
            {activeTab === 'nutrition' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#003b70' }}>
                    Kế hoạch Thực đơn Dinh dưỡng ({publishedNutritionPlans.length})
                  </h3>
                  {publishedNutritionPlans.length > 0 && (
                    <button
                      type="button"
                      className="button button-primary"
                      onClick={() => setSelectedRealtimePlan(publishedNutritionPlans[0])}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.84rem',
                        background: '#0284c7',
                      }}
                    >
                      <Utensils size={15} /> Xem Hôm Nay Ăn Gì
                    </button>
                  )}
                </div>

                {publishedNutritionPlans.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', background: '#fff', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                    <Salad size={36} style={{ color: '#94a3b8', margin: '0 auto 10px' }} />
                    <p style={{ color: '#64748b', margin: '0 0 12px' }}>
                      Học viên chưa có thực đơn dinh dưỡng nào được công bố áp dụng.
                    </p>
                    <button
                      type="button"
                      className="button button-primary"
                      onClick={() => {
                        onClose();
                        navigate('/pt/nutrition');
                      }}
                    >
                      Thiết kế thực đơn ngay
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {publishedNutritionPlans.map((plan: any) => (
                      <div
                        key={plan._id}
                        onClick={() => setSelectedRealtimePlan(plan)}
                        style={{
                          background: '#ffffff',
                          borderRadius: '12px',
                          border: '1px solid #e2e8f0',
                          padding: '16px 20px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '14px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <div style={{ flex: '1 1 280px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <strong style={{ color: '#003b70', fontSize: '1rem' }}>{plan.title || 'Thực đơn Dinh dưỡng'}</strong>
                            <span style={{
                              background: '#ecfdf5',
                              color: '#059669',
                              border: '1px solid #a7f3d0',
                              padding: '2px 8px',
                              borderRadius: '9999px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                            }}>
                              Đã công bố
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.82rem', color: '#475569', flexWrap: 'wrap', marginTop: '6px' }}>
                            {plan.targetCalories && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#e11d48', fontWeight: 700 }}>
                                <span>🔥</span> {plan.targetCalories.toLocaleString()} kcal/ngày
                              </span>
                            )}
                            {plan.macros && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem' }}>
                                <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                                  Protein: {plan.macros.protein}g
                                </span>
                                <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                                  Carbs: {plan.macros.carbs}g
                                </span>
                                <span style={{ background: '#fce7f3', color: '#9d174d', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                                  Fat: {plan.macros.fat}g
                                </span>
                              </span>
                            )}
                            <span style={{ color: '#94a3b8', fontSize: '0.74rem' }}>
                              Tạo: {plan.createdAt ? new Date(plan.createdAt).toLocaleDateString('vi-VN') : '—'}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            className="button button-primary"
                            style={{
                              fontSize: '0.82rem',
                              padding: '7px 16px',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              background: '#0284c7',
                              cursor: 'pointer',
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRealtimePlan(plan);
                            }}
                          >
                            <Utensils size={14} /> Xem Hôm Nay Ăn Gì
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: WORKOUTS */}
            {activeTab === 'workouts' && (
              <div>
                <h3 style={{ margin: '0 0 16px', fontSize: '1.05rem', fontWeight: 700, color: '#003b70' }}>Lịch sử tập luyện ({sessions.length} buổi)</h3>
                {sessions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', background: '#fff', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                    <Dumbbell size={36} style={{ color: '#94a3b8', margin: '0 auto 10px' }} />
                    <p style={{ color: '#64748b', margin: 0 }}>Chưa có buổi tập nào được check-in.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {sessions.map((s, idx) => (
                      <div key={s._id || idx} style={{ background: '#fff', padding: '14px 18px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong style={{ color: '#003b70', fontSize: '0.95rem' }}>{s.planSnapshot?.title || `Buổi tập #${s.sessionIndex + 1 || idx + 1}`}</strong>
                          <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px' }}>
                            Ngày tập: {s.performedAt ? new Date(s.performedAt).toLocaleDateString('vi-VN') : '—'}
                            {s.notes && ` • Ghi chú: ${s.notes}`}
                          </div>
                        </div>
                        <StatusBadge status={s.attendance || 'COMPLETED'} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 6: INBODY */}
            {activeTab === 'inbody' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#003b70' }}>
                    Lịch sử đo InBody & Chỉ số ({inbodies.length})
                  </h3>
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => setShowInbodyManualModal(true)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem' }}
                  >
                    <Plus size={15} /> Thêm kết quả InBody
                  </button>
                </div>

                {inbodies.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', background: '#fff', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                    <Ruler size={36} style={{ color: '#94a3b8', margin: '0 auto 10px' }} />
                    <p style={{ color: '#64748b', margin: 0 }}>Chưa có bản ghi InBody nào.</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
                    {inbodies.map((record) => (
                      <div
                        key={record._id}
                        onClick={() => setSelectedInbodyRecord(record)}
                        style={{
                          background: '#fff',
                          padding: '16px',
                          borderRadius: '12px',
                          border: '1px solid #e2e8f0',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#0284c7';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#e2e8f0';
                          e.currentTarget.style.transform = 'none';
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <strong style={{ color: '#003b70' }}>
                            {record.measurementDate ? new Date(record.measurementDate).toLocaleDateString('vi-VN') : '—'}
                          </strong>
                          <StatusBadge status={record.status} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.86rem', color: '#475569' }}>
                          <div>Cân nặng: <strong>{record.weight} kg</strong></div>
                          <div>% Mỡ (BodyFat): <strong>{record.bodyFatPercentage}%</strong></div>
                          <div>Khối lượng cơ: <strong>{record.muscleMass} kg</strong></div>
                          {record.visceralFatLevel != null && (
                            <div>Mỡ nội tạng: <strong>Level {record.visceralFatLevel}</strong></div>
                          )}
                        </div>
                        <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: '#0284c7', fontWeight: 600 }}>
                          <span>🔍 Bấm xem phân tích chi tiết</span>
                          <ChevronRight size={14} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sub-modals rendered cleanly without double backdrop */}
      <PtPackageManagerModal
        open={showPackageModal}
        customer={detail || customer}
        onClose={() => {
          setShowPackageModal(false);
          loadAll();
        }}
      />

      <CustomerConsultationModal
        open={showConsultationModal}
        customer={detail || customer}
        onClose={() => {
          setShowConsultationModal(false);
          loadAll();
        }}
      />

      <CustomerPhotoModal
        open={showPhotoModal}
        customer={detail || customer}
        onClose={() => {
          setShowPhotoModal(false);
          loadAll();
        }}
      />

      <InBodyDetailModal
        open={Boolean(selectedInbodyRecord)}
        record={selectedInbodyRecord}
        customerMeta={{
          fullName: detail?.fullName || customer?.fullName,
          gender: detail?.gender,
          phone: detail?.phone,
          height: detail?.height || undefined,
        }}
        onClose={() => setSelectedInbodyRecord(null)}
        onEdit={(rec) => {
          setSelectedInbodyRecord(null);
          setShowInbodyManualModal(true);
        }}
        onStatusChanged={() => {
          loadAll();
        }}
      />

      <InBodyManualModal
        open={showInbodyManualModal}
        defaultCustomerId={detail?._id || customer?._id || ''}
        onClose={() => setShowInbodyManualModal(false)}
        onSaved={() => {
          setShowInbodyManualModal(false);
          loadAll();
        }}
      />

      {/* MODAL THỰC ĐƠN DINH DƯỠNG HÔM NAY (THỜI GIAN THỰC) */}
      {selectedRealtimePlan && (
        <CustomerTodayNutritionModal
          plan={selectedRealtimePlan}
          customerName={detail?.fullName || customer?.fullName}
          onClose={() => setSelectedRealtimePlan(null)}
        />
      )}
    </>
  );
}
