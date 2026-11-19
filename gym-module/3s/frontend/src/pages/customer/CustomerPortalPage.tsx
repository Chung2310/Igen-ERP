import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useToast } from '../../components/ui/ToastProvider';
import { api } from '../../services/api';
import { errorMessage, type CustomerJourneyDto } from '../../types';

import CustomerOverview from '../../components/customer-portal/CustomerOverview';
import CustomerWorkouts from '../../components/customer-portal/CustomerWorkouts';
import CustomerNutrition from '../../components/customer-portal/CustomerNutrition';
import CustomerRoadmap from '../../components/customer-portal/CustomerRoadmap';
import CustomerInBodyGoals from '../../components/customer-portal/CustomerInBodyGoals';
import CustomerSessions from '../../components/customer-portal/CustomerSessions';
import CustomerReportsPhotos from '../../components/customer-portal/CustomerReportsPhotos';

export type CustomerTabKey =
  | 'overview'
  | 'workouts'
  | 'nutrition'
  | 'roadmap'
  | 'inbody'
  | 'sessions'
  | 'progress';

interface PageMeta {
  title: string;
  subtitle: string;
}

const tabMeta: Record<CustomerTabKey, PageMeta> = {
  overview: {
    title: 'Hành trình của tôi',
    subtitle: 'Lịch tập, kết quả từng buổi và toàn bộ tiến độ của bạn.',
  },
  workouts: {
    title: 'Giáo án tập luyện',
    subtitle: 'Chi tiết các ngày tập, danh sách bài tập, số hiệp, số lần và kỹ thuật từ PT.',
  },
  nutrition: {
    title: 'Kế hoạch Dinh dưỡng',
    subtitle: 'Mục tiêu calo hàng ngày, tỷ lệ đa lượng Protein / Carbs / Fat và thực đơn chi tiết.',
  },
  roadmap: {
    title: 'Lộ trình phát triển',
    subtitle: 'Kế hoạch dài hạn theo từng giai đoạn (Phases) và trọng tâm từng tuần từ Huấn luyện viên.',
  },
  inbody: {
    title: 'Chỉ số & Mục tiêu',
    subtitle: 'Theo dõi kết quả đo InBody, sự thay đổi cơ/mỡ và tiến độ đạt mục tiêu.',
  },
  sessions: {
    title: 'Lịch & Buổi tập',
    subtitle: 'Lịch hẹn tập luyện sắp tới với PT và nhật ký chi tiết các buổi tập đã hoàn thành.',
  },
  progress: {
    title: 'Tiến độ & Báo cáo',
    subtitle: 'Báo cáo định kỳ từ Huấn luyện viên, album ảnh tiến độ cơ thể và kỷ lục cá nhân.',
  },
};

export default function CustomerPortalPage() {
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [journey, setJourney] = useState<CustomerJourneyDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Derive active tab from URL pathname
  const pathname = location.pathname.toLowerCase().replace(/\/+$/, '');
  let activeTab: CustomerTabKey = 'overview';
  if (pathname.endsWith('/workouts')) activeTab = 'workouts';
  else if (pathname.endsWith('/nutrition')) activeTab = 'nutrition';
  else if (pathname.endsWith('/roadmap')) activeTab = 'roadmap';
  else if (pathname.endsWith('/inbody')) activeTab = 'inbody';
  else if (pathname.endsWith('/sessions')) activeTab = 'sessions';
  else if (pathname.endsWith('/progress')) activeTab = 'progress';

  const loadJourney = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const result = await api.get<CustomerJourneyDto>('/api/me/journey');
      setJourney(result.data);
      if (isRefresh) {
        toast.success('Đã cập nhật dữ liệu mới nhất từ PT.');
      }
    } catch (error: unknown) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadJourney();
  }, [loadJourney]);

  const handleTabChange = (tab: string) => {
    navigate(tab === 'overview' ? '/me' : `/me/${tab}`);
  };

  const currentMeta = tabMeta[activeTab] || tabMeta.overview;

  if (loading && !journey) {
    return (
      <div className="flex min-h-[350px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-primary">
          <RefreshCw size={24} className="animate-spin" />
        </div>
        <h3 className="mt-4 font-oswald text-xl font-bold uppercase text-slate-800">
          Đang tải dữ liệu của bạn...
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Hệ thống đang đồng bộ dữ liệu từ Huấn luyện viên phụ trách.
        </p>
      </div>
    );
  }

  if (!journey) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs">
        <h3 className="font-oswald text-xl font-bold uppercase text-slate-900">
          Không thể tải dữ liệu hành trình
        </h3>
        <p className="mt-2 text-xs text-slate-500">
          Đã có lỗi xảy ra trong quá trình truy vấn dữ liệu học viên. Vui lòng thử lại.
        </p>
        <button
          type="button"
          onClick={() => void loadJourney()}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white transition hover:bg-primary/90"
        >
          <RefreshCw size={14} />
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Clean Single Page Header matching PT standard */}
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="font-oswald text-3xl font-bold uppercase tracking-wide text-primary">
            {currentMeta.title}
          </h1>
        </div>

        <button
          type="button"
          onClick={() => void loadJourney(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:opacity-50 md:self-auto"
          title="Làm mới dữ liệu từ Huấn luyện viên"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin text-primary' : ''} />
          <span>{refreshing ? 'Đang đồng bộ...' : 'Làm mới dữ liệu'}</span>
        </button>
      </header>

      {/* Dedicated Page View for Active Tab */}
      {activeTab === 'overview' && (
        <CustomerOverview journey={journey} onNavigateTab={handleTabChange} />
      )}
      {activeTab === 'workouts' && <CustomerWorkouts journey={journey} />}
      {activeTab === 'nutrition' && <CustomerNutrition journey={journey} />}
      {activeTab === 'roadmap' && <CustomerRoadmap journey={journey} />}
      {activeTab === 'inbody' && <CustomerInBodyGoals journey={journey} />}
      {activeTab === 'sessions' && <CustomerSessions journey={journey} />}
      {activeTab === 'progress' && <CustomerReportsPhotos journey={journey} />}
    </div>
  );
}
