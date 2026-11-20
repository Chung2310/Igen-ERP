import { ClipboardList } from 'lucide-react';
import type { CustomerJourneyDto, CustomerProgressOverview } from '../../types/progress';
import ProgressEmptyState from './ProgressEmptyState';
import ProgressModal from './ProgressModal';
import WorkoutSessionLogger, { type WorkoutLoggerActivePlan } from './WorkoutSessionLogger';

export default function WorkoutSessionModal({
  item,
  journey,
  loading,
  onClose,
  onSaved,
}: {
  item: CustomerProgressOverview | null;
  journey: CustomerJourneyDto | null;
  loading: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const activePlan = journey?.plans.active as unknown as WorkoutLoggerActivePlan | null | undefined;
  return (
    <ProgressModal
      open={Boolean(item)}
      title={`Ghi nhận buổi tập · ${item?.customer.fullName || ''}`}
      description="Ghi kết quả theo giáo án, chỉ số cơ thể và ảnh để theo dõi tiến độ sau mỗi buổi tập."
      loading={loading}
      onClose={onClose}
    >
      {journey ? (
        <WorkoutSessionLogger
          customerId={journey.customer._id}
          customerName={item?.customer.fullName || journey.customer.fullName}
          activePlan={activePlan || null}
          previousSessions={journey.sessions}
          onSaved={onSaved}
          onClose={onClose}
        />
      ) : (
        <ProgressEmptyState
          icon={ClipboardList}
          title="Không tải được giáo án"
          description="Hãy thử đóng cửa sổ và tải lại dữ liệu học viên."
        />
      )}
    </ProgressModal>
  );
}
