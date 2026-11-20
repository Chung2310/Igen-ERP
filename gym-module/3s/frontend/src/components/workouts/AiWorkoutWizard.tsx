import { useEffect, useRef, useState } from 'react';
import { api } from '../../services/api';
import { useToast } from '../ui/ToastProvider';
import {
  availabilityError,
  availabilityProposalDefaults,
  availabilitySummary,
} from '../../services/workoutAvailability';
import { errorMessage } from '../../types';
import type { WorkoutAvailabilitySlot } from '../../types/workoutAvailability';
import type { AiWorkoutGenerationJob } from '../../types/workoutGeneration';
import WorkoutAvailabilityEditor from './WorkoutAvailabilityEditor';
import CustomerSelect from '../ui/CustomerSelect';

type Customer = { _id: string; fullName: string; phone: string };
type Proposal = { durationWeeks: number; sessionsPerWeek: number; minutesPerSession: number; level: string; trainingMethod: string; trainingSplit: string; priorityMuscleGroups: string[]; restrictions: string[] };
type Props = { open: boolean; customers: Customer[]; onClose(): void; onGenerated(value: unknown): void };

const POLL_INTERVAL_MS = 2_000;
const MAX_POLL_ATTEMPTS = 300;
const wait = (durationMs: number) => new Promise((resolve) => setTimeout(resolve, durationMs));
const newIdempotencyKey = () => globalThis.crypto?.randomUUID?.()
  || `workout-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function AiWorkoutWizard({ open, customers, onClose, onGenerated }: Props) {
  const toast = useToast();
  const [customerId, setCustomerId] = useState('');
  const [availabilitySlots, setAvailabilitySlots] = useState<WorkoutAvailabilitySlot[]>([]);
  const [proposal, setProposal] = useState<Proposal>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(0);
  const [generationMessage, setGenerationMessage] = useState('');
  const generationRun = useRef(0);
  const generationKey = useRef('');

  useEffect(() => {
    if (!open) {
      generationRun.current += 1;
      setLoading(false);
      setGenerationMessage('');
    }
  }, [open]);

  useEffect(() => {
    generationKey.current = '';
  }, [customerId, proposal, availabilitySlots]);

  useEffect(() => () => {
    generationRun.current += 1;
  }, []);

  if (!open) return null;

  const availability = availabilitySummary(availabilitySlots);
  const proposalDefaults = availabilityProposalDefaults(availabilitySlots);
  const availabilityText = `${availability.dayCount} ngày rảnh · ${availability.slotCount} khung giờ`;

  const analyze = async () => {
    if (!customerId) {
      toast.error('Vui lòng chọn học viên.');
      setError('Vui lòng chọn học viên.');
      return;
    }
    const slotError = availabilityError(availabilitySlots);
    if (slotError) {
      toast.error(slotError);
      setError(slotError);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await api.post<Proposal>('/api/ai/workout-proposals', { customerId, availabilitySlots });
      setProposal({ ...result.data, ...proposalDefaults });
      setStep(1);
    } catch (cause) {
      const msg = errorMessage(cause);
      toast.error(msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const generate = async () => {
    if (!proposal) return;
    const run = ++generationRun.current;
    const idempotencyKey = generationKey.current || newIdempotencyKey();
    generationKey.current = idempotencyKey;
    setLoading(true);
    setError('');
    setGenerationMessage('Đang gửi yêu cầu tạo giáo án...');
    try {
      const accepted = await api.post<AiWorkoutGenerationJob>(
        '/api/ai/workout-generations',
        { customerId, proposal, availabilitySlots, additionalRequest: '' },
        { headers: { 'Idempotency-Key': idempotencyKey } },
      );
      let job = accepted.data;
      setGenerationMessage('AI đang tạo giáo án ở chế độ nền. Bạn có thể tiếp tục chờ tại đây...');

      for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
        if (generationRun.current !== run) return;
        if (job.status === 'SUCCEEDED') {
          if (!('result' in job)) throw new Error('Tác vụ AI hoàn tất nhưng không có dữ liệu giáo án.');
          generationKey.current = '';
          setGenerationMessage('');
          toast.success('Tạo giáo án bằng AI thành công.');
          onGenerated(job.result);
          return;
        }
        if (job.status === 'FAILED') {
          generationKey.current = '';
          throw new Error(job.error?.message || 'Không thể tạo bản nháp giáo án.');
        }
        if (attempt > 0) await wait(POLL_INTERVAL_MS);
        if (generationRun.current !== run) return;
        job = (await api.get<AiWorkoutGenerationJob>(`/api/ai/workout-generations/${job.id}`)).data;
      }
      throw new Error('Tác vụ AI vẫn đang xử lý. Vui lòng thử kiểm tra lại sau.');
    } catch (cause) {
      const msg = errorMessage(cause);
      toast.error(msg);
      setError(msg);
      setGenerationMessage('');
    } finally {
      if (generationRun.current === run) setLoading(false);
    }
  };

  const continueToGeneration = () => {
    if (!proposal) return;
    if (!Number.isInteger(proposal.durationWeeks) || proposal.durationWeeks < 1 || proposal.durationWeeks > 12) {
      const msg = 'Số tuần phải từ 1 đến 12.';
      toast.error(msg);
      setError(msg);
      return;
    }
    if (!Number.isInteger(proposal.sessionsPerWeek) || proposal.sessionsPerWeek < 1 || proposal.sessionsPerWeek > 7) {
      const msg = 'Số buổi mỗi tuần phải từ 1 đến 7.';
      toast.error(msg);
      setError(msg);
      return;
    }
    if (!Number.isInteger(proposal.minutesPerSession) || proposal.minutesPerSession < 15 || proposal.minutesPerSession > 240) {
      const msg = 'Số phút mỗi buổi phải từ 15 đến 240.';
      toast.error(msg);
      setError(msg);
      return;
    }
    setError('');
    setStep(3);
  };

  const primaryAction = () => {
    if (step === 0) return void analyze();
    if (step === 1) { setError(''); setStep(2); return; }
    if (step === 2) { continueToGeneration(); return; }
    void generate();
  };

  const primaryLabel = loading ? 'Đang xử lý...' : step === 0 ? 'Phân tích bằng AI' : step === 1 ? 'Tiếp tục cấu hình' : step === 2 ? 'Tiếp tục tạo giáo án' : 'Tạo giáo án';
  const steps = ['Chọn học viên', 'Duyệt phân tích', 'Cấu hình', 'Tạo giáo án'];

  return (
    <div
      className="modal-backdrop workout-wizard-backdrop fixed inset-0 z-[9999] flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs overflow-hidden"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="module-modal workout-ai-wizard w-full sm:max-w-2xl max-h-[92dvh] sm:max-h-[88vh] flex flex-col bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden m-0 border-0 sm:border sm:border-slate-200"
        role="dialog"
        aria-modal="true"
        aria-label="Tạo giáo án bằng AI"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Mobile bottom sheet drag indicator */}
        <div className="sm:hidden flex items-center justify-center pt-2.5 pb-1 bg-white shrink-0">
          <div className="w-10 h-1 bg-slate-300 rounded-full" />
        </div>
        <header className="workout-wizard-header">
          <div>
            <p>AI programming</p>
            <h2>Tạo giáo án bằng AI</h2>
          </div>
          <button type="button" className="modal-close" aria-label="Đóng" onClick={onClose}>×</button>
        </header>
        <div className="workout-wizard-body">
          <div className="workout-wizard-progress-wrap">
            {/* Mobile clean stepper bar */}
            <div className="sm:hidden flex items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl mb-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-sky-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  {step + 1}
                </span>
                <span className="text-xs font-bold text-slate-800">
                  Bước {step + 1}/4: {steps[step]}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {steps.map((_, index) => (
                  <div
                    key={index}
                    className={`h-1.5 rounded-full transition-all ${
                      index === step
                        ? 'w-5 bg-sky-600'
                        : index < step
                        ? 'w-2 bg-emerald-500'
                        : 'w-2 bg-slate-300'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Desktop 4-step progress */}
            <ol className="hidden sm:grid workout-wizard-progress" aria-label="Tiến trình tạo giáo án">
              {steps.map((label, index) => (
                <li
                  key={label}
                  className={index < step ? 'is-complete' : index === step ? 'is-active' : ''}
                  aria-current={index === step ? 'step' : undefined}
                >
                  <span>{index + 1}</span>
                  {label}
                </li>
              ))}
            </ol>
          </div>
          {step === 0 && (
            <div className="module-form workout-wizard-form">
              <CustomerSelect
                label="Học viên"
                name="customerId"
                value={customerId}
                customers={customers as unknown as import('../../types').Customer[]}
                disabled={loading}
                onChange={setCustomerId}
                placeholder="Chọn học viên..."
              />
              <WorkoutAvailabilityEditor
                value={availabilitySlots}
                disabled={loading}
                onChange={setAvailabilitySlots}
              />
              {proposalDefaults.sessionsPerWeek > 0 && (
                <p className="workout-availability-calculation" aria-live="polite">
                  Tự tính: {proposalDefaults.sessionsPerWeek} buổi/tuần · {proposalDefaults.minutesPerSession} phút/buổi
                </p>
              )}
            </div>
          )}
          {proposal && step === 1 && (
            <div className="workout-wizard-summary">
              <div className="workout-wizard-summary-heading">
                <strong className="workout-wizard-title">Đề xuất phân tích</strong>
                <span className="workout-availability-summary">{availabilityText}</span>
              </div>
              {proposal.trainingMethod && (
                <div className="workout-wizard-method-box">
                  <div className="workout-wizard-method-title">Định hướng & Phương pháp huấn luyện</div>
                  <p className="workout-wizard-method-text">{proposal.trainingMethod}</p>
                </div>
              )}
              <dl className="workout-wizard-review">
                <div><dt>Chu kỳ</dt><dd>{proposal.durationWeeks} tuần</dd></div>
                <div><dt>Tần suất</dt><dd>{proposal.sessionsPerWeek} buổi/tuần</dd></div>
                <div><dt>Thời lượng</dt><dd>{proposal.minutesPerSession} phút/buổi</dd></div>
                <div className="is-full-width"><dt>Phân bổ lịch tập</dt><dd className="split-content">{proposal.trainingSplit}</dd></div>
              </dl>
            </div>
          )}
          {proposal && step === 2 && (
            <div className="workout-wizard-summary">
              <div className="workout-wizard-summary-heading">
                <strong className="workout-wizard-title">Điều chỉnh đề xuất</strong>
                <span className="workout-availability-summary">{availabilityText}</span>
              </div>
              <div className="workout-wizard-fields-grid">
                <label className="module-field workout-wizard-field-card">
                  Số tuần
                  <input
                    aria-label="Số tuần"
                    type="number"
                    min="1"
                    max="12"
                    placeholder="Ví dụ: 8"
                    value={proposal.durationWeeks}
                    onChange={(event) => setProposal({ ...proposal, durationWeeks: Number(event.target.value) })}
                  />
                  <span className="field-hint">Từ 1 đến 12 tuần</span>
                </label>
                <label className="module-field workout-wizard-field-card">
                  Số buổi mỗi tuần
                  <input
                    aria-label="Số buổi mỗi tuần"
                    type="number"
                    min="1"
                    max="7"
                    placeholder="Ví dụ: 4"
                    value={proposal.sessionsPerWeek}
                    onChange={(event) => setProposal({ ...proposal, sessionsPerWeek: Number(event.target.value) })}
                  />
                  <span className="field-hint">Từ 1 đến 7 buổi/tuần</span>
                </label>
                <label className="module-field workout-wizard-field-card">
                  Số phút mỗi buổi
                  <input
                    aria-label="Số phút mỗi buổi"
                    type="number"
                    min="15"
                    max="240"
                    step="15"
                    placeholder="Ví dụ: 60"
                    value={proposal.minutesPerSession}
                    onChange={(event) => setProposal({ ...proposal, minutesPerSession: Number(event.target.value) })}
                  />
                  <span className="field-hint">Bước nhảy 15 phút</span>
                </label>
              </div>
            </div>
          )}
          {proposal && step === 3 && (
            <div className="workout-wizard-summary">
              <div className="workout-wizard-summary-heading">
                <strong className="workout-wizard-title">Sẵn sàng tạo giáo án</strong>
                <span className="workout-availability-summary">{availabilityText}</span>
              </div>
              <div className="workout-wizard-confirm-guide">
                Hệ thống AI sẽ phân tích và xếp lịch bài tập cụ thể cho từng buổi dựa trên các thông số đã duyệt dưới đây.
              </div>
              <dl className="workout-wizard-review">
                <div><dt>Chu kỳ</dt><dd>{proposal.durationWeeks} tuần</dd></div>
                <div><dt>Tần suất</dt><dd>{proposal.sessionsPerWeek} buổi/tuần</dd></div>
                <div><dt>Thời lượng</dt><dd>{proposal.minutesPerSession} phút/buổi</dd></div>
                <div><dt>Cấp độ</dt><dd>{proposal.level}</dd></div>
                <div className="is-full-width"><dt>Phân bổ lịch tập</dt><dd className="split-content">{proposal.trainingSplit}</dd></div>
              </dl>
            </div>
          )}
          {error && <p className="module-error workout-wizard-error" role="alert">{error}</p>}
          {generationMessage && <p className="workout-wizard-confirm-guide" role="status">{generationMessage}</p>}
        </div>
        <footer className="module-actions workout-wizard-actions flex items-center justify-between gap-2.5 p-3 sm:px-5 sm:py-3.5 border-t border-slate-200 bg-white shrink-0 pb-[max(14px,env(safe-area-inset-bottom))]">
          {step === 0 ? (
            <button
              type="button"
              className="button button-secondary flex-1 sm:flex-none min-h-[44px] text-xs sm:text-sm font-semibold cursor-pointer"
              onClick={onClose}
            >
              Hủy
            </button>
          ) : (
            <button
              type="button"
              className="button button-secondary flex-1 sm:flex-none min-h-[44px] text-xs sm:text-sm font-semibold cursor-pointer"
              disabled={loading}
              onClick={() => { setError(''); setStep((current) => current - 1); }}
            >
              Quay lại
            </button>
          )}
          <button
            type="button"
            className="button button-primary flex-1 sm:flex-none min-h-[44px] text-xs sm:text-sm font-bold shadow-sm cursor-pointer"
            disabled={loading}
            onClick={primaryAction}
          >
            {primaryLabel}
          </button>
        </footer>
      </section>
    </div>
  );
}
