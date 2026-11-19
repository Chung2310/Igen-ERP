import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, Dumbbell, Plus } from 'lucide-react';
import ExerciseLibraryPage from '../../pages/pt/ExerciseLibraryPage';
import WorkoutTemplateList from './WorkoutTemplateList';
import AiWorkoutWizard from './AiWorkoutWizard';
import { api } from '../../services/api';

export default function MyWorkoutPlans() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const refreshKey = 0;
  const [aiOpen, setAiOpen] = useState(false);
  const [customers, setCustomers] = useState<Array<{ _id: string; fullName: string; phone: string }>>([]);
  useEffect(() => { if (aiOpen) void api.get<Array<{ _id: string; fullName: string; phone: string }>>('/api/customers?page=1&limit=100').then((result) => setCustomers(result.data)).catch(() => setCustomers([])); }, [aiOpen]);
  const activeTab = searchParams.get('tab') === 'exercises' ? 'exercises' : 'plans';
  const selectTab = (tab: 'plans' | 'exercises') => setSearchParams({ tab });
  const openCreate = () => navigate('/pt/my-workout-plans/new');

  return (
    <section className="module-page workout-page" aria-label="Quản lý giáo án">
      <header className="module-header workout-header">
        <div>
          <h1 className="module-heading">Giáo án của tôi</h1>
        </div>
        {activeTab === 'plans' && <div className="module-actions">
          <button type="button" className="button button-secondary" onClick={() => setAiOpen(true)}>Tạo bằng AI</button>
          <button type="button" className="button button-primary" onClick={openCreate}><Plus size={18} aria-hidden="true" /> Tạo giáo án</button>
        </div>}
      </header>

      <div className="workout-tabs" role="tablist" aria-label="Không gian giáo án">
        <button
          id="workout-tab-plans"
          type="button"
          role="tab"
          aria-selected={activeTab === 'plans'}
          aria-controls="workout-panel-plans"
          className={activeTab === 'plans' ? 'is-active' : ''}
          onClick={() => selectTab('plans')}
        >
          <BookOpen size={14} aria-hidden="true" /> Giáo án của tôi
        </button>
        <button
          id="workout-tab-exercises"
          type="button"
          role="tab"
          aria-selected={activeTab === 'exercises'}
          aria-controls="workout-panel-exercises"
          className={activeTab === 'exercises' ? 'is-active' : ''}
          onClick={() => selectTab('exercises')}
        >
          <Dumbbell size={14} aria-hidden="true" /> Thư viện bài tập
        </button>
      </div>

      {activeTab === 'plans' ? (
        <div id="workout-panel-plans" role="tabpanel" aria-labelledby="workout-tab-plans" className="workout-panel">
          <WorkoutTemplateList refreshKey={refreshKey} onEdit={(template) => navigate(`/pt/my-workout-plans/${template._id}/edit`)} />
          <AiWorkoutWizard open={aiOpen} customers={customers} onClose={() => setAiOpen(false)} onGenerated={(draft) => navigate('/pt/my-workout-plans/new', { state: { aiWorkoutDraft: draft } })} />
        </div>
      ) : (
        <div id="workout-panel-exercises" role="tabpanel" aria-labelledby="workout-tab-exercises">
          <ExerciseLibraryPage />
        </div>
      )}
    </section>
  );
}
