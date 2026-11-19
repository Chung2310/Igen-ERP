import { useCallback, useEffect, useState } from 'react';
import { Zap, SlidersHorizontal } from 'lucide-react';
import FeatureFlagModal, { type FeatureFlagItem } from '../../components/ui/FeatureFlagModal';
import RoleBadge from '../../components/ui/RoleBadge';
import { useToast } from '../../components/ui/ToastProvider';
import { api } from '../../services/api';
import { errorMessage, type UserRole } from '../../types';

const defaultFeatureDefinitions: Record<string, { name: string; description: string }> = {
  OCR_INBODY: {
    name: 'Quét phiếu InBody tự động',
    description: 'Tự động nhận diện và trích xuất các chỉ số InBody từ ảnh chụp của học viên.',
  },
  NUTRITION_AI: {
    name: 'Dinh dưỡng & Thực đơn AI',
    description: 'Tính toán calories, macros và gợi ý kế hoạch bữa ăn cá nhân hóa.',
  },
  ROADMAP: {
    name: 'Lộ trình Huấn luyện (Roadmap)',
    description: 'Thiết kế các giai đoạn tập luyện mục tiêu có cấu trúc tuần tự.',
  },
  EXERCISE_LIBRARY: {
    name: 'Thư viện bài tập & Giáo án',
    description: 'Quản lý thư viện bài tập, giáo án riêng của PT và giáo án cá nhân hóa cho khách hàng.',
  },
  CARE: {
    name: 'Chăm sóc & Cảnh báo (Care)',
    description: 'Quản lý tác vụ chăm sóc khách hàng, nhắc nhở và hàng đợi Today.',
  },
  PT_ASSISTANT: {
    name: 'Trợ lý PT Thông minh',
    description: 'Hỗ trợ gợi ý giáo án, giải đáp thắc mắc chuyên môn trong quá trình huấn luyện.',
  },
  PROGRESS: {
    name: 'Theo dõi Tiến độ Tập luyện',
    description: 'Ghi nhận buổi tập, lịch sử check-in và biểu đồ tiến bộ hình thể.',
  },
  DASHBOARD: {
    name: 'Bảng Điều khiển Vận hành',
    description: 'Tổng quan các chỉ số hoạt động, gói tập và cảnh báo hệ thống.',
  },
};

export default function FeatureFlagsView() {
  const toast = useToast();
  const [flags, setFlags] = useState<FeatureFlagItem[]>([]);
  const [selectedFlag, setSelectedFlag] = useState<FeatureFlagItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const loadFlags = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError('');
      const result = await api.get<FeatureFlagItem[]>('/api/features');
      const items = result.data.map((flag) => ({
        ...flag,
        name: defaultFeatureDefinitions[flag.key]?.name || flag.key,
        description: defaultFeatureDefinitions[flag.key]?.description || '',
      }));
      setFlags(items);
    } catch (error) {
      setFlags([]);
      setLoadError(errorMessage(error));
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadFlags();
  }, [loadFlags]);

  const handleToggle = async (flag: FeatureFlagItem, event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      const nextState = !flag.enabled;
      await api.patch(`/api/features/${flag.key}`, {
        enabled: nextState,
        roles: flag.roles,
        pilotUserIds: flag.pilotUserIds || [],
      });
      setFlags((current) =>
        current.map((f) => (f.key === flag.key ? { ...f, enabled: nextState } : f))
      );
      toast.success(`Đã ${nextState ? 'bật' : 'tắt'} tính năng ${flag.name || flag.key}`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <div className="feature-flags-view">
      <div className="pt-view-header">
        <div>
          <h2 className="text-xl font-bold text-[#003b70] m-0 tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <SlidersHorizontal size={20} className="shrink-0" />
            </div>
            <span>Quản lý Tính năng Hệ thống (Feature Flags)</span>
          </h2>
          <p className="text-xs text-slate-500 m-0 mt-1 leading-relaxed">
          </p>
        </div>
      </div>

      {loading && <p role="status">Đang tải cấu hình tính năng…</p>}
      {loadError && <div role="alert"><p>{loadError}</p><button type="button" onClick={() => void loadFlags()}>Thử lại</button></div>}
      <div className="feature-flag-grid">
        {flags.map((flag) => (
          <article className="feature-flag-card" key={flag.key}>
            <div>
              <div className="feature-flag-header">
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <div className={`p-1.5 rounded-lg shrink-0 ${flag.enabled ? 'bg-sky-50 text-sky-600' : 'bg-slate-100 text-slate-400'}`}>
                    <Zap size={16} />
                  </div>
                  <h3 className="feature-flag-title truncate" title={flag.name}>{flag.name}</h3>
                </div>
                <label className="toggle-switch shrink-0" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    disabled={loading}
                    checked={flag.enabled}
                    onChange={() => { }}
                    onClick={(e) => handleToggle(flag, e)}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

              <p className="feature-flag-desc">{flag.description}</p>

              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-semibold text-slate-400">Mã:</span>
                <code className="text-[11px] font-mono bg-slate-100 px-2 py-0.5 rounded-md text-[#003b70] font-bold">
                  {flag.key}
                </code>
              </div>
            </div>

            <div className="feature-flag-footer">
              <div className="flex items-center gap-1.5 flex-wrap">
                {flag.roles.map((role) => (
                  <RoleBadge key={role} role={role as UserRole} />
                ))}
              </div>
              <button
                type="button"
                className="h-8.5 px-3 rounded-lg text-xs font-bold text-[#003b70] bg-sky-50 border border-sky-200/80 hover:bg-sky-100 transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
                disabled={loading}
                onClick={() => setSelectedFlag(flag)}
              >
                <SlidersHorizontal size={13} className="shrink-0" />
                <span>Cấu hình</span>
              </button>
            </div>
          </article>
        ))}
      </div>

      <FeatureFlagModal
        open={Boolean(selectedFlag)}
        feature={selectedFlag}
        onClose={() => setSelectedFlag(null)}
        onSaved={() => {
          setSelectedFlag(null);
          loadFlags();
        }}
      />
    </div>
  );
}
