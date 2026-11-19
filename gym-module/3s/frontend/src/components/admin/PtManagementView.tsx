import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Users,
  Plus,
  RefreshCw,
  Search,
  X,
  RotateCcw,
  LayoutGrid,
  List,
  Pencil,
  Trash2,
  Eye,
  Award,
  Phone,
  Mail,
  Calendar,
  MapPin,
  Clock,
  CheckCircle2,
  ShieldAlert,
  Filter,
} from 'lucide-react';
import DataList, { type DataColumn } from '../ui/DataList';
import Pagination from '../ui/Pagination';
import StatusBadge from '../ui/StatusBadge';
import ConfirmModal from '../ui/ConfirmModal';
import PtFormModal, { type PtRecord } from '../ui/PtFormModal';
import { useToast } from '../ui/ToastProvider';
import { api } from '../../services/api';
import type { PaginationMeta } from '../../types';
import { errorMessage } from '../../types';

export default function PtManagementView() {
  const toast = useToast();
  const [pts, setPts] = useState<PtRecord[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, totalPages: 0 });
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');
  const [appliedStatus, setAppliedStatus] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [formPt, setFormPt] = useState<PtRecord | null | undefined>(undefined);
  const [detailPt, setDetailPt] = useState<PtRecord | null>(null);
  const [deletePt, setDeletePt] = useState<PtRecord | null>(null);
  const [loading, setLoading] = useState(false);

  const loadPts = useCallback(
    async (page = 1, kw = appliedKeyword, st = appliedStatus) => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          page: String(page),
          limit: '18',
          role: 'PT',
        });
        if (kw.trim()) params.set('keyword', kw.trim());
        if (st) params.set('status', st);

        const result = await api.get<PtRecord[]>(`/api/users?${params.toString()}`);
        setPts(result.data || []);
        if (result.meta) setMeta(result.meta);
      } catch (error) {
        toast.error(errorMessage(error));
      } finally {
        setLoading(false);
      }
    },
    [appliedKeyword, appliedStatus, toast],
  );

  useEffect(() => {
    void loadPts(1, '', '');
  }, []);

  const handleApplyFilters = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAppliedKeyword(keyword);
    setAppliedStatus(statusFilter);
    void loadPts(1, keyword, statusFilter);
  };

  const handleDeletePt = async () => {
    if (!deletePt) return;
    const ptId = deletePt._id || deletePt.id;
    try {
      const result = await api.delete(`/api/users/${ptId}`);
      toast.success(result.message || 'Xóa huấn luyện viên thành công.');
      setDeletePt(null);
      void loadPts(meta.page || 1);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const handleResetFilters = () => {
    setKeyword('');
    setStatusFilter('');
    setAppliedKeyword('');
    setAppliedStatus('');
    void loadPts(1, '', '');
  };

  const hasActiveFilters = Boolean(appliedKeyword || appliedStatus || keyword || statusFilter);

  // Quick stats calculation
  const stats = useMemo(() => {
    const total = pts.length;
    const active = pts.filter((p) => p.status === 'ACTIVE').length;
    const locked = pts.filter((p) => p.status === 'LOCKED' || p.status === 'INACTIVE').length;
    const avgExp =
      total > 0
        ? (pts.reduce((acc, p) => acc + (Number(p.yearsOfExperience) || 0), 0) / total).toFixed(1)
        : '0';
    return { total, active, locked, avgExp };
  }, [pts]);

  const columns: DataColumn<PtRecord>[] = [
    {
      key: 'fullName',
      label: 'Huấn luyện viên',
      render: (item) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center">
            {item.avatarUrl ? (
              <img src={item.avatarUrl} alt={item.fullName} className="w-full h-full object-cover" />
            ) : (
              <Users size={18} className="text-slate-400" />
            )}
          </div>
          <div>
            <div className="font-bold text-[#003b70] text-sm">{item.fullName || 'Chưa đặt tên'}</div>
            <div className="text-xs text-slate-500">@{item.username}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'specialization',
      label: 'Chuyên môn & Kinh nghiệm',
      render: (item) => (
        <div>
          <div className="font-medium text-slate-800 text-xs flex items-center gap-1.5">
            <Award size={13} className="text-sky-600 shrink-0" />
            <span>{item.specialization || 'Thể hình & Thể lực'}</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {item.yearsOfExperience ? `${item.yearsOfExperience} năm kinh nghiệm` : 'Mới tham gia'}
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      label: 'Liên hệ',
      render: (item) => (
        <div className="text-xs">
          <div className="text-slate-700 font-medium">{item.phone || '—'}</div>
          {item.email && <div className="text-slate-400 text-[11px]">{item.email}</div>}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (item) => <StatusBadge status={item.status} />,
    },
  ];

  return (
    <div className="pt-view-container">
      {/* Top Header */}
      <div className="pt-view-header">
        <div>
          <h2 className="text-xl font-bold text-[#003b70] m-0 tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <Users size={20} className="shrink-0" />
            </div>
            <span>Quản lý Huấn luyện viên</span>
          </h2>
        </div>
        <button
          className="button button-primary"
          type="button"
          onClick={() => setFormPt({ username: '', fullName: '', status: 'ACTIVE' })}
        >
          <Plus size={18} /> Thêm Huấn luyện viên
        </button>
      </div>

      {/* Metrics Banner */}
      <div className="pt-metrics-banner">
        <div className="pt-metric-card">
          <div>
            <div className="pt-metric-label">Tổng số PT</div>
            <div className="pt-metric-val text-[#003b70]">{stats.total}</div>
            <div className="pt-metric-sub text-sky-600">Biên chế 3S Gym</div>
          </div>
          <div className="pt-metric-icon bg-sky-50 text-sky-600">
            <Users size={20} />
          </div>
        </div>

        <div className="pt-metric-card">
          <div>
            <div className="pt-metric-label">Đang hoạt động</div>
            <div className="pt-metric-val text-emerald-600">{stats.active}</div>
            <div className="pt-metric-sub text-emerald-600">Sẵn sàng nhận khách</div>
          </div>
          <div className="pt-metric-icon bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="pt-metric-card">
          <div>
            <div className="pt-metric-label">Đã tạm khóa</div>
            <div className="pt-metric-val text-rose-600">{stats.locked}</div>
            <div className="pt-metric-sub text-rose-500">{stats.locked > 0 ? 'Cần kiểm tra' : 'Hồ sơ chuẩn'}</div>
          </div>
          <div className="pt-metric-icon bg-rose-50 text-rose-600">
            <ShieldAlert size={20} />
          </div>
        </div>

        <div className="pt-metric-card">
          <div>
            <div className="pt-metric-label">Kinh nghiệm TB</div>
            <div className="pt-metric-val text-[#003b70]">
              {stats.avgExp} <span className="text-xs font-semibold text-slate-400">năm</span>
            </div>
            <div className="pt-metric-sub text-amber-600">Chuyên môn cao</div>
          </div>
          <div className="pt-metric-icon bg-amber-50 text-amber-600">
            <Clock size={20} />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col gap-4">
        {/* Filter Toolbar & View Switcher */}
        <div className="pt-toolbar">
          <form
            onSubmit={handleApplyFilters}
            className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[260px]"
          >
            {/* Search Input */}
            <div className="relative min-w-[220px] max-w-[360px] flex-1">
              <Search
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10"
              />
              <input
                aria-label="Tìm kiếm PT"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Tìm theo tên, SĐT, email, chuyên môn..."
                style={{ paddingLeft: '38px' }}
                className="w-full h-10 pr-9 text-xs bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-sky-500 rounded-xl outline-none focus:ring-2 focus:ring-sky-500/15 transition-all text-slate-800 placeholder:text-slate-400 font-medium"
              />
              {keyword && (
                <button
                  type="button"
                  onClick={() => setKeyword('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full z-10"
                  aria-label="Xóa từ khóa tìm kiếm"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Status Select */}
            <select
              aria-label="Lọc trạng thái PT"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 px-3.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 outline-none cursor-pointer focus:border-sky-500 focus:bg-white transition-all font-medium shrink-0"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="LOCKED">Đã khóa</option>
              <option value="INACTIVE">Ngừng hoạt động</option>
            </select>

            <button
              className="shrink-0 whitespace-nowrap inline-flex items-center justify-center gap-2 h-10 px-5 rounded-xl bg-[#003b70] hover:bg-[#00264d] text-white text-xs font-bold transition-all cursor-pointer shadow-2xs min-w-[88px]"
              type="submit"
              disabled={loading}
              title="Thực hiện lọc"
            >
              {loading ? (
                <RefreshCw size={14} className="animate-spin shrink-0" />
              ) : (
                <Filter size={14} className="shrink-0" />
              )}
              <span>{loading ? 'Đang lọc...' : 'Lọc'}</span>
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                className="shrink-0 whitespace-nowrap inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-slate-200 text-slate-700 hover:text-slate-900 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer min-w-[90px]"
                onClick={handleResetFilters}
                title="Xóa toàn bộ bộ lọc"
              >
                <RotateCcw size={13} className="shrink-0" />
                <span>Đặt lại</span>
              </button>
            )}
          </form>

          {/* View Mode Toggle - Icon Only with Tooltips */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 gap-1 h-10 shrink-0">
            <button
              type="button"
              className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all cursor-pointer ${viewMode === 'grid'
                ? 'bg-white text-[#003b70] shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
                }`}
              onClick={() => setViewMode('grid')}
              title="Dạng thẻ"
              aria-label="Dạng thẻ"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              type="button"
              className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all cursor-pointer ${viewMode === 'table'
                ? 'bg-white text-[#003b70] shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
                }`}
              onClick={() => setViewMode('table')}
              title="Dạng bảng"
              aria-label="Dạng bảng"
            >
              <List size={16} />
            </button>
          </div>
        </div>

        {/* Content Display */}
        {pts.length === 0 && !loading ? (
          <div className="py-14 px-4 text-center border border-dashed border-slate-200 rounded-2xl bg-white">
            <div className="w-13 h-13 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto mb-3 shadow-2xs">
              <Users size={24} />
            </div>
            <h3 className="text-sm font-bold text-slate-800 mb-1">Chưa tìm thấy Huấn luyện viên nào</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4 leading-relaxed">
              {hasActiveFilters
                ? 'Không có PT nào khớp với điều kiện lọc hiện tại. Hãy thử tìm kiếm với từ khóa khác.'
                : 'Hệ thống chưa có hồ sơ Huấn luyện viên nào. Hãy thêm PT mới ngay bây giờ.'}
            </p>
            {hasActiveFilters ? (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-4.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                onClick={handleResetFilters}
              >
                <RotateCcw size={14} />
                <span>Xóa bộ lọc</span>
              </button>
            ) : (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                onClick={() => setFormPt({ username: '', fullName: '', status: 'ACTIVE' })}
              >
                <Plus size={16} />
                <span>Thêm PT đầu tiên</span>
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          /* Bento Cards Grid View */
          <div className="pt-grid">
            {pts.map((pt) => {
              const certificatesList = Array.isArray(pt.certificates)
                ? pt.certificates
                : typeof pt.certificates === 'string' && pt.certificates
                  ? pt.certificates.split('\n').filter(Boolean)
                  : [];

              return (
                <article key={pt._id || pt.id} className="pt-card group">
                  {/* Card Header & Avatar */}
                  <div className="pt-card-body">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-100 border border-slate-200/90 shrink-0 flex items-center justify-center shadow-2xs">
                          {pt.avatarUrl ? (
                            <img src={pt.avatarUrl} alt={pt.fullName} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-[#003b70] to-[#00a4e4] text-white font-bold flex items-center justify-center text-sm font-['Oswald']">
                              {(pt.fullName || pt.username || 'PT').slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <span
                            className={`absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full border-2 border-white ${pt.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-rose-500'
                              }`}
                            title={pt.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã khóa'}
                          />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-[#003b70] text-sm group-hover:text-sky-600 transition-colors leading-snug truncate">
                            {pt.fullName || 'Chưa đặt tên'}
                          </h3>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">@{pt.username}</div>
                        </div>
                      </div>
                      <div className="shrink-0">
                        <StatusBadge status={pt.status} />
                      </div>
                    </div>

                    {/* Specialization & Experience Tags */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200/60 text-sky-800 text-[11px] font-bold">
                        <Award size={13} className="shrink-0 text-sky-600" />
                        <span>{pt.specialization || 'Huấn luyện tổng quát'}</span>
                      </span>
                      {pt.yearsOfExperience !== undefined && Number(pt.yearsOfExperience) > 0 && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200/60 text-amber-800 text-[11px] font-bold">
                          <Clock size={12} className="shrink-0 text-amber-600" />
                          <span>{pt.yearsOfExperience} năm KN</span>
                        </span>
                      )}
                    </div>

                    {/* Bio Snippet */}
                    {pt.bio && (
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                        {pt.bio}
                      </p>
                    )}

                    {/* Certificates Chips */}
                    {certificatesList.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {certificatesList.slice(0, 2).map((cert, idx) => (
                          <span
                            key={idx}
                            className="inline-block px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold truncate max-w-[170px]"
                            title={cert}
                          >
                            {cert}
                          </span>
                        ))}
                        {certificatesList.length > 2 && (
                          <span className="text-[11px] font-bold text-slate-400 pl-0.5">
                            +{certificatesList.length - 2}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Contact Info */}
                    <div className="space-y-1.5 pt-2.5 border-t border-slate-100 text-xs text-slate-600">
                      {pt.phone && (
                        <div className="flex items-center gap-2">
                          <Phone size={13} className="text-slate-400 shrink-0" />
                          <a href={`tel:${pt.phone}`} className="hover:text-sky-600 font-semibold transition-colors truncate">
                            {pt.phone}
                          </a>
                        </div>
                      )}
                      {pt.email && (
                        <div className="flex items-center gap-2">
                          <Mail size={13} className="text-slate-400 shrink-0" />
                          <a href={`mailto:${pt.email}`} className="hover:text-sky-600 transition-colors truncate text-slate-500 font-medium">
                            {pt.email}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="pt-card-footer">
                    <button
                      type="button"
                      className="h-9 px-4 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all cursor-pointer shadow-2xs inline-flex items-center justify-center gap-2 shrink-0 whitespace-nowrap min-w-[120px]"
                      onClick={() => setDetailPt(pt)}
                    >
                      <Eye size={14} className="text-slate-500 shrink-0" />
                      <span>Xem chi tiết</span>
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        className="h-9 px-3.5 rounded-xl text-xs font-bold text-sky-800 bg-sky-50 border border-sky-200/80 hover:bg-sky-100 hover:border-sky-300 transition-all cursor-pointer shadow-2xs inline-flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap min-w-[66px]"
                        onClick={() => setFormPt(pt)}
                      >
                        <Pencil size={13} className="shrink-0" />
                        <span>Sửa</span>
                      </button>
                      <button
                        type="button"
                        className="h-9 px-3.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200/80 hover:bg-rose-100 hover:border-rose-300 transition-all cursor-pointer shadow-2xs inline-flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap min-w-[66px]"
                        onClick={() => setDeletePt(pt)}
                      >
                        <Trash2 size={13} className="shrink-0" />
                        <span>Xóa</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          /* High-Density Table View */
          <div className="bg-white rounded-xl border border-slate-200/90 overflow-hidden shadow-2xs p-4">
            <DataList<PtRecord>
              items={pts}
              columns={columns}
              renderActions={(item) => (
                <div className="flex items-center gap-2 justify-end">
                  <button
                    className="h-8 px-3.5 inline-flex items-center justify-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                    type="button"
                    onClick={() => setDetailPt(item)}
                  >
                    <Eye size={13} className="shrink-0" /> <span>Chi tiết</span>
                  </button>
                  <button
                    className="h-8 px-3 inline-flex items-center justify-center gap-1 text-xs font-bold text-sky-800 bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors cursor-pointer border border-sky-200/60 shrink-0 whitespace-nowrap min-w-[58px]"
                    type="button"
                    onClick={() => setFormPt(item)}
                  >
                    <Pencil size={12} className="shrink-0" /> <span>Sửa</span>
                  </button>
                  <button
                    className="h-8 px-3 inline-flex items-center justify-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer border border-rose-200/60 shrink-0 whitespace-nowrap min-w-[58px]"
                    type="button"
                    onClick={() => setDeletePt(item)}
                  >
                    <Trash2 size={12} className="shrink-0" /> <span>Xóa</span>
                  </button>
                </div>
              )}
            />
          </div>
        )}

        <Pagination
          page={meta.page || 1}
          totalPages={meta.totalPages || 0}
          onPageChange={loadPts}
        />
      </div>

      {/* Form Modal (Create / Edit) */}
      <PtFormModal
        open={formPt !== undefined}
        pt={formPt}
        onClose={() => setFormPt(undefined)}
        onSaved={() => {
          setFormPt(undefined);
          void loadPts(meta.page || 1);
        }}
      />

      {/* PT Profile Detail Modal */}
      {detailPt && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setDetailPt(null)}>
          <div
            className="pt-detail-modal"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="pt-detail-header">
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <div className="w-15 h-15 rounded-2xl overflow-hidden bg-white/15 border-2 border-white/40 shrink-0 flex items-center justify-center shadow-md">
                  {detailPt.avatarUrl ? (
                    <img src={detailPt.avatarUrl} alt={detailPt.fullName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-white/20 text-white font-bold flex items-center justify-center text-xl font-['Oswald']">
                      {(detailPt.fullName || detailPt.username || 'PT').slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-xl font-bold m-0 leading-tight truncate text-white">
                      {detailPt.fullName || 'Huấn luyện viên'}
                    </h2>
                    <StatusBadge status={detailPt.status} />
                  </div>
                  <div className="text-xs text-sky-100 font-mono mt-1">@{detailPt.username}</div>
                </div>
              </div>
              <button
                type="button"
                className="w-8 h-8 rounded-full bg-black/15 hover:bg-black/25 text-white/90 hover:text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
                onClick={() => setDetailPt(null)}
                aria-label="Đóng"
              >
                <X size={17} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="pt-detail-body">
              {/* Specialization Hero Card */}
              <div className="pt-detail-hero-card">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-sky-700 flex items-center gap-1.5 mb-1">
                    <Award size={14} className="text-sky-600 shrink-0" />
                    <span>Chuyên môn đào tạo</span>
                  </div>
                  <div className="font-bold text-[#003b70] text-sm leading-snug">
                    {detailPt.specialization || 'Huấn luyện viên thể hình tổng quát'}
                  </div>
                </div>
                {detailPt.yearsOfExperience !== undefined && Number(detailPt.yearsOfExperience) > 0 && (
                  <div className="shrink-0 bg-white border border-sky-200/80 px-3.5 py-1.5 rounded-xl shadow-2xs text-center min-w-[76px]">
                    <div className="text-sm font-extrabold text-[#003b70] font-['Oswald'] leading-tight">
                      {detailPt.yearsOfExperience} Năm
                    </div>
                    <div className="text-[10px] text-slate-500 font-semibold mt-0.5">Kinh nghiệm</div>
                  </div>
                )}
              </div>

              {/* Bio Section */}
              {detailPt.bio && (
                <div>
                  <div className="pt-detail-section-title">
                    <Users size={14} className="text-slate-500 shrink-0" />
                    <span>Giới thiệu bản thân</span>
                  </div>
                  <div className="pt-detail-bio-box">
                    {detailPt.bio}
                  </div>
                </div>
              )}

              {/* Certificates Section */}
              <div>
                <div className="pt-detail-section-title">
                  <Award size={14} className="text-slate-500 shrink-0" />
                  <span>Bằng cấp & Chứng chỉ đào tạo</span>
                </div>
                {detailPt.certificates && (Array.isArray(detailPt.certificates) ? detailPt.certificates.length > 0 : Boolean(detailPt.certificates)) ? (
                  <div className="pt-detail-chips">
                    {(Array.isArray(detailPt.certificates) ? detailPt.certificates : String(detailPt.certificates).split('\n')).map(
                      (cert, idx) => (
                        <div key={idx} className="pt-detail-chip">
                          <Award size={12} className="text-sky-600 shrink-0" />
                          <span>{cert}</span>
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  <div className="text-slate-400 italic bg-slate-50 p-3.5 rounded-xl border border-dashed border-slate-200 text-xs">
                    Chưa cập nhật chứng chỉ chuyên môn.
                  </div>
                )}
              </div>

              {/* Contact & Personal Info Grid */}
              <div>
                <div className="pt-detail-section-title">
                  <Phone size={14} className="text-slate-500 shrink-0" />
                  <span>Thông tin liên hệ & Hồ sơ cá nhân</span>
                </div>
                <div className="pt-detail-grid">
                  <div className="pt-detail-info-card">
                    <div className="text-[11px] font-bold text-slate-400 mb-1 flex items-center gap-1.5">
                      <Phone size={12} className="text-sky-600" /> SỐ ĐIỆN THOẠI
                    </div>
                    <div className="text-slate-800 font-semibold text-xs">{detailPt.phone || '—'}</div>
                  </div>
                  <div className="pt-detail-info-card">
                    <div className="text-[11px] font-bold text-slate-400 mb-1 flex items-center gap-1.5">
                      <Mail size={12} className="text-sky-600" /> EMAIL
                    </div>
                    <div className="text-slate-800 font-semibold text-xs truncate" title={detailPt.email || ''}>
                      {detailPt.email || '—'}
                    </div>
                  </div>
                  {detailPt.address && (
                    <div className="pt-detail-info-card col-span-2">
                      <div className="text-[11px] font-bold text-slate-400 mb-1 flex items-center gap-1.5">
                        <MapPin size={12} className="text-sky-600" /> ĐỊA CHỈ LIÊN HỆ
                      </div>
                      <div className="text-slate-800 font-semibold text-xs">{detailPt.address}</div>
                    </div>
                  )}
                  {detailPt.dateOfBirth && (
                    <div className="pt-detail-info-card">
                      <div className="text-[11px] font-bold text-slate-400 mb-1 flex items-center gap-1.5">
                        <Calendar size={12} className="text-sky-600" /> NGÀY SINH
                      </div>
                      <div className="text-slate-800 font-semibold text-xs">
                        {new Date(detailPt.dateOfBirth).toLocaleDateString('vi-VN')}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-detail-footer">
              <button
                type="button"
                className="h-10 px-5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer min-w-[84px]"
                onClick={() => setDetailPt(null)}
              >
                Đóng
              </button>
              <button
                type="button"
                className="h-10 px-5 rounded-xl bg-[#003b70] hover:bg-[#00264d] text-white text-xs font-bold transition-all inline-flex items-center justify-center gap-2 shadow-2xs cursor-pointer min-w-[145px]"
                onClick={() => {
                  const pt = detailPt;
                  setDetailPt(null);
                  setFormPt(pt);
                }}
              >
                <Pencil size={13} className="shrink-0" />
                <span>Chỉnh sửa hồ sơ</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={Boolean(deletePt)}
        title="Xóa tài khoản Huấn luyện viên?"
        description={`Bạn có chắc chắn muốn xóa tài khoản PT "${deletePt?.fullName || deletePt?.username}". PT chỉ nên xóa khi đã hoàn tất chuyển giao toàn bộ khách hàng sang PT khác.`}
        danger
        confirmLabel="Xóa PT vĩnh viễn"
        onClose={() => setDeletePt(null)}
        onConfirm={handleDeletePt}
      />
    </div>
  );
}

