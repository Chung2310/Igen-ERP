import { useState } from 'react';
import CustomerWorkoutPlanPanel from '../../components/workouts/CustomerWorkoutPlanPanel';
import WorkoutBuilder from '../../components/workouts/WorkoutBuilder';
import WorkoutTemplateList, { type WorkoutTemplate } from '../../components/workouts/WorkoutTemplateList';
import { workoutTemplateToDraft } from '../../services/workoutPlanMapper';
import type { CustomerWorkoutPlanDraft } from '../../types/workout';

export default function WorkoutPlansPage() {
  const [tab, setTab] = useState<'templates' | 'customers'>('templates');
  const [templateRefresh, setTemplateRefresh] = useState(0);
  const [editing, setEditing] = useState<WorkoutTemplate | null>(null);
  const [customerDraft, setCustomerDraft] = useState<CustomerWorkoutPlanDraft | null>(null);

  const assign = (template: WorkoutTemplate) => {
    setCustomerDraft(workoutTemplateToDraft(template));
    setTab('customers');
  };

  return (
    <section>
      <div className="section-header">
        <h1 style={{ margin: 0 }}>Giáo án</h1>
      </div>
      <div className="browser-tabs" role="tablist" aria-label="Quản lý giáo án">
        <button type="button" role="tab" aria-selected={tab === 'templates'} onClick={() => setTab('templates')}>
          Giáo án mẫu
        </button>
        <button type="button" role="tab" aria-selected={tab === 'customers'} onClick={() => setTab('customers')}>
          Giáo án khách hàng
        </button>
      </div>
      <div role="tabpanel">
        {tab === 'templates' ? (
          <>
            <WorkoutBuilder
              template={editing}
              onSaved={() => {
                setEditing(null);
                setTemplateRefresh((value) => value + 1);
              }}
            />
            <WorkoutTemplateList refreshKey={templateRefresh} onEdit={setEditing} onAssign={assign} />
          </>
        ) : (
          <CustomerWorkoutPlanPanel initialDraft={customerDraft} onDraftConsumed={() => setCustomerDraft(null)} />
        )}
      </div>
    </section>
  );
}
