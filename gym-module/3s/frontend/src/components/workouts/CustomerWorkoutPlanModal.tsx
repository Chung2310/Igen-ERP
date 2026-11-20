import ContentFormModal, { type ContentItem } from '../ui/ContentFormModal';
import type { CustomerWorkoutPlan, CustomerWorkoutPlanDraft } from '../../types/workout';

interface Props { open: boolean; item?: CustomerWorkoutPlan | null; initialDraft?: CustomerWorkoutPlanDraft | null; onClose: () => void; onSaved: () => void }

export default function CustomerWorkoutPlanModal({ open, item = null, initialDraft = null, onClose, onSaved }: Props) {
  return <ContentFormModal className="module-modal workout-customer-plan-form" open={open} resource="workout-plans" item={(item || initialDraft) as ContentItem | null} onClose={onClose} onSaved={onSaved} />;
}
