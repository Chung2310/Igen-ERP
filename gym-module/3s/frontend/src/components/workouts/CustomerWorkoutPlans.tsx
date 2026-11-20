import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import { errorMessage } from '../../types';
import { useToast } from '../ui/ToastProvider';
import CustomerWorkoutPlanPanel from './CustomerWorkoutPlanPanel';
import type { WorkoutTemplate } from './WorkoutTemplateList';
import { workoutTemplateToDraft } from '../../services/workoutPlanMapper';
import type { CustomerWorkoutPlanDraft } from '../../types/workout';

export default function CustomerWorkoutPlans() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [draft, setDraft] = useState<CustomerWorkoutPlanDraft | null>(null);
  const templateId = searchParams.get('templateId');

  useEffect(() => {
    if (!templateId) return;

    let active = true;
    api.get<WorkoutTemplate>(`/api/workout-templates/${encodeURIComponent(templateId)}`)
      .then(({ data }) => {
        if (active) setDraft(workoutTemplateToDraft(data));
      })
      .catch((error: unknown) => {
        if (active) toast.error(errorMessage(error));
      })
      .finally(() => {
        if (active) setSearchParams({}, { replace: true });
      });

    return () => {
      active = false;
    };
  }, [setSearchParams, templateId, toast]);

  return (
    <section className="module-page workout-customer-plans" aria-label="Giáo án khách hàng">
      <header className="module-header workout-customer-plan-header">
        <div>
          <p className="workout-eyebrow">Client programming</p>
          <h1 className="module-heading">Giáo án khách hàng</h1>
        </div>
      </header>

      <CustomerWorkoutPlanPanel initialDraft={draft} />
    </section>
  );
}
