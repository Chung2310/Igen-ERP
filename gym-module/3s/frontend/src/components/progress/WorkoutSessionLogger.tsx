import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { AlertTriangle, Camera, CheckCircle2, ClipboardList, Dumbbell, MessageSquare, PenLine, Scale, Sparkles } from 'lucide-react';
import { api } from '../../services/api';
import { getSession } from '../../services/session';
import { clearWorkoutSessionCache, readWorkoutSessionCache, workoutSessionCacheKey, writeWorkoutSessionCache, type CachedWorkoutSession } from '../../services/workoutSessionCache';
import { buildBodyMeasurementInput } from '../../services/bodyMeasurement';
import { uploadWorkoutProgressPhotos } from '../../services/progressPhotos';
import { localWorkoutSessionTime, workoutSessionIso } from '../../services/workoutSessionTime';
import { compareWorkoutWithPreviousDay } from '../../services/workoutDayComparison';
import {
  errorMessage,
  TRACKING_TYPE_LABELS,
  type BodyMeasurementDraft,
  type BodyweightPrescription,
  type BodyweightResult,
  type CardioPrescription,
  type CardioResult,
  type CompletedSetResult,
  type IntervalPrescription,
  type IntervalResult,
  type MobilityPrescription,
  type MobilityResult,
  type StrengthPrescription,
  type StrengthResult,
  type TrackingPrescription,
  type TrackingResult,
  type TrackingType,
  type WorkoutProgressPhotoDraft,
  type WorkoutSessionDto,
} from '../../types';
import { useToast } from '../ui/ToastProvider';
import ProgressEmptyState from './ProgressEmptyState';
import BodyweightResultEditor from './tracking/BodyweightResultEditor';
import CardioResultEditor from './tracking/CardioResultEditor';
import IntervalResultEditor from './tracking/IntervalResultEditor';
import MobilityResultEditor from './tracking/MobilityResultEditor';
import StrengthResultEditor from './tracking/StrengthResultEditor';
import WorkoutMeasurementFields from './WorkoutMeasurementFields';
import WorkoutProgressPhotoFields from './WorkoutProgressPhotoFields';
import CustomerSignaturePad, { type CustomerSignaturePadHandle } from './CustomerSignaturePad';
import WorkoutDayComparison from './WorkoutDayComparison';

interface PlannedExercise {
  exerciseId?: string;
  name: string;
  trackingType: TrackingType;
  prescription: TrackingPrescription;
}

export interface WorkoutLoggerActivePlan {
  _id: string;
  version: number;
  title: string;
  sessions?: Array<{ name: string; exercises?: PlannedExercise[] }>;
}

interface Props {
  customerId: string;
  customerName?: string;
  activePlan: WorkoutLoggerActivePlan | null;
  previousSessions?: WorkoutSessionDto[];
  onSaved: () => void;
  onClose?: () => void;
}

interface ExerciseResultDraft {
  result: TrackingResult;
  notes?: string;
}

const key = () =>
  globalThis.crypto?.randomUUID?.() ||
  `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const setResult = (): CompletedSetResult => ({ id: key(), completed: true });

function materialize(exercise: PlannedExercise): ExerciseResultDraft {
  if (exercise.trackingType === 'STRENGTH' || exercise.trackingType === 'BODYWEIGHT') {
    const setsVal = (exercise.prescription as StrengthPrescription | undefined)?.sets;
    const count = Math.max(1, Number(setsVal || 1));
    return { result: { sets: Array.from({ length: count }, setResult) } };
  }
  return { result: {} };
}

function stripClientIds(result: TrackingResult): TrackingResult {
  if ('sets' in result && Array.isArray(result.sets)) {
    return { ...result, sets: result.sets.map(({ id: _id, ...set }) => set) };
  }
  return { ...result };
}

function resultEditor(
  exercise: PlannedExercise,
  value: TrackingResult,
  onChange: (result: TrackingResult) => void,
): ReactNode {
  if (exercise.trackingType === 'STRENGTH') {
    return (
      <StrengthResultEditor
        exerciseName={exercise.name}
        prescription={exercise.prescription as StrengthPrescription}
        value={value as StrengthResult}
        onChange={onChange}
      />
    );
  }
  if (exercise.trackingType === 'BODYWEIGHT') {
    return (
      <BodyweightResultEditor
        exerciseName={exercise.name}
        prescription={exercise.prescription as BodyweightPrescription}
        value={value as BodyweightResult}
        onChange={onChange}
      />
    );
  }
  if (exercise.trackingType === 'CARDIO') {
    return (
      <CardioResultEditor
        exerciseName={exercise.name}
        prescription={exercise.prescription as CardioPrescription}
        value={value as CardioResult}
        onChange={onChange}
      />
    );
  }
  if (exercise.trackingType === 'INTERVAL') {
    return (
      <IntervalResultEditor
        exerciseName={exercise.name}
        prescription={exercise.prescription as IntervalPrescription}
        value={value as IntervalResult}
        onChange={onChange}
      />
    );
  }
  if (exercise.trackingType === 'MOBILITY') {
    return (
      <MobilityResultEditor
        exerciseName={exercise.name}
        prescription={exercise.prescription as MobilityPrescription}
        value={value as MobilityResult}
        onChange={onChange}
      />
    );
  }
  return (
    <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
      Bài tập này chưa có cách ghi nhận. Hãy cập nhật giáo án trước khi ghi buổi tập.
    </p>
  );
}

export default function WorkoutSessionLogger({
  customerId,
  customerName,
  activePlan,
  previousSessions = [],
  onSaved,
  onClose,
}: Props) {
  const toast = useToast();
  const idempotencyKey = useRef<string>(key());
  const submitting = useRef(false);
  const signaturePadRef = useRef<CustomerSignaturePadHandle>(null);
  const [signerName, setSignerName] = useState(customerName || '');
  const [signatureDataUrl, setSignatureDataUrl] = useState('');
  const [restoredSignature, setRestoredSignature] = useState(false);
  const [sessionIndex, setSessionIndex] = useState(0);
  const [recordedAt, setRecordedAt] = useState(localWorkoutSessionTime);
  const [feeling, setFeeling] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [measurement, setMeasurement] = useState<BodyMeasurementDraft>({});
  const [progressPhotos, setProgressPhotos] = useState<WorkoutProgressPhotoDraft[]>([]);
  const [editedResults, setEditedResults] = useState<Record<number, ExerciseResultDraft[]>>({});
  const cacheKey = useMemo(() => {
    const user = getSession()?.user;
    const ownerId = user?._id || user?.id || user?.username;
    return ownerId ? workoutSessionCacheKey(ownerId, customerId) : '';
  }, [customerId]);
  const planSessionCount = activePlan?.sessions?.length || 0;
  const [cacheReady, setCacheReady] = useState(!cacheKey);
  const [hasChanges, setHasChanges] = useState(false);
  const [cacheNotice, setCacheNotice] = useState('');
  const [cacheError, setCacheError] = useState('');
  const restoredPhotoUrls = useRef<string[]>([]);
  const savedRef = useRef(false);
  const markEdited = () => { setHasChanges(true); setCacheError(''); };

  const exercises = useMemo(
    () => activePlan?.sessions?.[sessionIndex]?.exercises || [],
    [activePlan, sessionIndex],
  );
  const initialResults = useMemo(() => exercises.map(materialize), [exercises]);
  const results = editedResults[sessionIndex] || initialResults;
  const hasUnclassified = exercises.some(
    (exercise) => !exercise.trackingType || exercise.trackingType === 'UNCLASSIFIED',
  );
  const dayComparison = useMemo(() => compareWorkoutWithPreviousDay(
    recordedAt.recordedDate,
    exercises.map((exercise, index) => ({
      exerciseId: exercise.exerciseId,
      name: exercise.name,
      trackingType: exercise.trackingType,
      result: results[index]?.result,
    })),
    previousSessions,
  ), [recordedAt.recordedDate, exercises, results, previousSessions]);

  useEffect(() => {
    let active = true;
    savedRef.current = false;
    if (cacheKey) setCacheReady(false);
    setHasChanges(false);
    setCacheNotice('');
    setCacheError('');
    const restore = async () => {
      try {
        const cached = cacheKey ? await readWorkoutSessionCache(cacheKey) : null;
        if (!active) return;
        if (cached && cached.customerId === customerId) {
          const samePlan = cached.planId === activePlan?._id && cached.planVersion === activePlan?.version && Number.isInteger(cached.sessionIndex) && cached.sessionIndex >= 0 && cached.sessionIndex < planSessionCount;
          const photos = cached.progressPhotos.map((photo) => {
            const previewUrl = URL.createObjectURL(photo.file);
            restoredPhotoUrls.current.push(previewUrl);
            return { ...photo, previewUrl };
          });
          idempotencyKey.current = cached.idempotencyKey;
          setSessionIndex(samePlan ? cached.sessionIndex : 0);
          setEditedResults(samePlan ? cached.editedResults : {});
          setRecordedAt(cached.recordedAt);
          setFeeling(cached.feeling);
          setNotes(cached.notes);
          setMeasurement(cached.measurement);
          setProgressPhotos(photos);
          setSignerName(cached.signerName);
          setSignatureDataUrl(cached.signatureDataUrl);
          setRestoredSignature(Boolean(cached.signatureDataUrl));
          setCacheNotice(samePlan
            ? 'Đã khôi phục tiến độ tự lưu trên trình duyệt.'
            : 'Giáo án đã thay đổi. Đã giữ ghi chú, số đo, ảnh và chữ ký; kết quả bài tập được đặt lại.');
        } else {
          idempotencyKey.current = key();
          setSessionIndex(0);
          setEditedResults({});
          setRecordedAt(localWorkoutSessionTime());
          setFeeling('');
          setNotes('');
          setMeasurement({});
          setProgressPhotos([]);
          setSignerName(customerName || '');
          setSignatureDataUrl('');
          setRestoredSignature(false);
          signaturePadRef.current?.clear();
        }
      } catch (error) {
        if (active) {
          setSessionIndex(0); setEditedResults({}); setRecordedAt(localWorkoutSessionTime());
          setFeeling(''); setNotes(''); setMeasurement({}); setProgressPhotos([]);
          setSignerName(customerName || ''); setSignatureDataUrl(''); setRestoredSignature(false);
          setCacheError(`Không thể đọc cache tiến độ: ${errorMessage(error)}`);
        }
      } finally {
        if (active) setCacheReady(true);
      }
    };
    void restore();
    return () => {
      active = false;
      for (const url of restoredPhotoUrls.current) URL.revokeObjectURL(url);
      restoredPhotoUrls.current = [];
    };
  }, [cacheKey, customerId, customerName, activePlan?._id, activePlan?.version, planSessionCount]);

  useEffect(() => {
    if (!cacheReady || !hasChanges || !cacheKey || !activePlan || savedRef.current) return;
    const cached: CachedWorkoutSession = {
      customerId,
      planId: activePlan._id,
      planVersion: activePlan.version,
      idempotencyKey: idempotencyKey.current,
      sessionIndex,
      recordedAt,
      feeling,
      notes,
      measurement,
      progressPhotos: progressPhotos.map(({ id, file, angle }) => ({ id, file, angle })),
      editedResults,
      signerName,
      signatureDataUrl,
      updatedAt: new Date().toISOString(),
    };
    void writeWorkoutSessionCache(cacheKey, cached)
      .then(() => setCacheNotice('Tiến độ đã được tự lưu trên trình duyệt.'))
      .catch((error) => setCacheError(`Không thể tự lưu tiến độ: ${errorMessage(error)}`));
  }, [cacheReady, hasChanges, cacheKey, activePlan, customerId, sessionIndex, recordedAt, feeling, notes, measurement, progressPhotos, editedResults, signerName, signatureDataUrl]);

  if (!activePlan) {
    return (
      <ProgressEmptyState
        icon={ClipboardList}
        title="Chưa có giáo án đang áp dụng"
        description="Hãy gán giáo án cho khách hàng trước khi ghi nhận một buổi tập mới."
      />
    );
  }

  const updateResult = (exerciseIndex: number, result: TrackingResult) => {
    markEdited();
    setEditedResults((current) => {
      const next = (current[sessionIndex] || initialResults).map((draft) => ({ ...draft }));
      next[exerciseIndex] = { ...next[exerciseIndex], result };
      return { ...current, [sessionIndex]: next };
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting.current) return;
    if (!customerId) {
      toast.error('Vui lòng chọn học viên / khách hàng.');
      return;
    }
    if (!activePlan) {
      toast.error('Chưa có giáo án đang áp dụng cho khách hàng.');
      return;
    }
    if (!recordedAt.recordedDate?.trim()) {
      toast.error('Vui lòng nhập ngày tập.');
      return;
    }
    if (!recordedAt.recordedTime?.trim()) {
      toast.error('Vui lòng nhập giờ tập.');
      return;
    }
    const performedAt = workoutSessionIso(recordedAt.recordedDate, recordedAt.recordedTime);
    if (!performedAt) {
      toast.error('Ngày hoặc giờ ghi nhận không hợp lệ.');
      return;
    }
    if (hasUnclassified) {
      toast.error('Có bài tập chưa phân loại cách ghi nhận. Hãy cập nhật giáo án trước khi ghi buổi tập.');
      return;
    }

    submitting.current = true;
    setLoading(true);
    try {
      const exerciseResults = exercises.map((exercise, exerciseIndex) => ({
        ...(exercise.exerciseId ? { exerciseId: exercise.exerciseId } : {}),
        exerciseIndex,
        result: stripClientIds(results[exerciseIndex].result),
        ...(results[exerciseIndex].notes ? { notes: results[exerciseIndex].notes } : {}),
      }));
      const bodyMeasurement = buildBodyMeasurementInput(measurement);
      const uploadedPhotos = await uploadWorkoutProgressPhotos(progressPhotos);

      let customerSignature: { signatureUrl: string; signedAt: string; signerName?: string } | undefined;
      if (signaturePadRef.current && !signaturePadRef.current.isEmpty()) {
        try {
          const blob = await signaturePadRef.current.toBlob();
          let sigUrl = '';
          if (blob) {
            const file = new File([blob], `signature-${customerId}-${Date.now()}.png`, { type: 'image/png' });
            const formData = new FormData();
            formData.append('image', file);
            const uploadRes = await api.upload<{ url: string }>('/api/upload/image', formData);
            sigUrl = uploadRes.data?.url || '';
          }
          if (!sigUrl) {
            sigUrl = signaturePadRef.current.toDataUrl() || '';
          }
          if (sigUrl) {
            customerSignature = {
              signatureUrl: sigUrl,
              signedAt: new Date().toISOString(),
              ...(signerName.trim() ? { signerName: signerName.trim() } : {}),
            };
          }
        } catch {
          const dataUrl = signaturePadRef.current.toDataUrl();
          if (dataUrl) {
            customerSignature = {
              signatureUrl: dataUrl,
              signedAt: new Date().toISOString(),
              ...(signerName.trim() ? { signerName: signerName.trim() } : {}),
            };
          }
        }
      }

      if (!customerSignature && signatureDataUrl) {
        customerSignature = { signatureUrl: signatureDataUrl, signedAt: new Date().toISOString(), ...(signerName.trim() ? { signerName: signerName.trim() } : {}) };
      }

      const result = await api.post('/api/workout-sessions', {
        customerId,
        workoutPlanId: activePlan._id,
        workoutPlanVersion: activePlan.version,
        sessionIndex,
        performedAt,
        attendance: 'PRESENT',
        exerciseResults,
        feeling,
        notes,
        idempotencyKey: idempotencyKey.current,
        ...(bodyMeasurement ? { bodyMeasurement } : {}),
        ...(uploadedPhotos.length > 0 ? { progressPhotos: uploadedPhotos } : {}),
        ...(customerSignature ? { customerSignature } : {})
      });
      savedRef.current = true;
      if (cacheKey) {
        try { await clearWorkoutSessionCache(cacheKey); }
        catch (error) { toast.error(`Buổi tập đã lưu nhưng chưa xóa được cache: ${errorMessage(error)}`); }
      }
      toast.success(result.message);
      signaturePadRef.current?.clear();
      onSaved();
      idempotencyKey.current = key();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  if (!cacheReady) return <p role="status" className="py-8 text-center text-sm text-slate-600">Đang khôi phục tiến độ đã lưu...</p>;

  return (
    <form aria-label="Ghi nhận buổi tập" noValidate onSubmit={submit}>
      <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-slate-700" role="status">
        <CheckCircle2 size={17} className="mr-2 inline text-sky-700" aria-hidden="true" />
        {cacheNotice || 'Nội dung đang nhập sẽ tự lưu trên trình duyệt và hiện lại khi mở màn này.'}
      </div>
      {cacheError && <p role="alert" className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900"><AlertTriangle size={17} aria-hidden="true" />{cacheError}</p>}
      {/* 1. Thông tin ca tập — dùng profile-form-section và profile-form-grid từ index.css */}
      <section className="profile-form-section pt-0">
        <h3>
          <Sparkles size={16} />
          <span>Giáo án & Ca tập</span>
        </h3>
        <div className="pt-detail-info-card mb-3.5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase">Giáo án áp dụng</div>
              <div className="text-base font-bold text-[#003b70] mt-0.5">{activePlan.title}</div>
            </div>
            <div className="pt-detail-chip">
              {(activePlan.sessions || []).length} Buổi tập
            </div>
          </div>
        </div>

        <div className="profile-form-grid">
          <div className="field">
            <label htmlFor="session-select">Buổi tập</label>
            <select
              id="session-select"
              value={sessionIndex}
              onChange={(event) => { markEdited(); setSessionIndex(Number(event.target.value)); }}
            >
              {(activePlan.sessions || []).map((session, index) => (
                <option key={`${session.name}-${index}`} value={index}>
                  {session.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="performed-date">Ngày tập</label>
            <input
              id="performed-date"
              aria-label="Ngày ghi nhận"
              type="date"
              value={recordedAt.recordedDate}
              onChange={(event) => { markEdited(); setRecordedAt((current) => ({ ...current, recordedDate: event.target.value })); }}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="performed-time">Giờ tập</label>
            <input
              id="performed-time"
              aria-label="Giờ ghi nhận"
              type="time"
              step={60}
              value={recordedAt.recordedTime}
              onChange={(event) => { markEdited(); setRecordedAt((current) => ({ ...current, recordedTime: event.target.value })); }}
              required
            />
          </div>

        </div>
      </section>

      {/* 2. Danh sách bài tập — dùng profile-form-section và pt-card từ index.css */}
      <section className="profile-form-section">
          <h3>
            <Dumbbell size={16} />
            <span>Kết quả bài tập ({exercises.length})</span>
          </h3>

          <div className="flex flex-col gap-3.5">
            {exercises.map((exercise, exerciseIndex) => (
              <div
                className="pt-card"
                key={`${exercise.exerciseId || exercise.name}-${exerciseIndex}`}
              >
                <div className="pt-card-body">
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-700 font-bold text-xs flex items-center justify-center border border-sky-100">
                        {exerciseIndex + 1}
                      </div>
                      <h4 className="text-sm font-bold text-[#003b70] m-0">
                        {exercise.name}
                      </h4>
                    </div>
                    <span className="pt-detail-chip text-xs py-1 px-2.5">
                      {TRACKING_TYPE_LABELS[exercise.trackingType || 'UNCLASSIFIED']}
                    </span>
                  </div>

                  <div className="mt-2.5">
                    {resultEditor(exercise, results[exerciseIndex]?.result, (result) =>
                      updateResult(exerciseIndex, result),
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {recordedAt.recordedDate && (
            <div className="mt-4">
              <WorkoutDayComparison comparisons={dayComparison} dateKey={recordedAt.recordedDate} />
            </div>
          )}
      </section>

      {/* 3. Chỉ số cơ thể & Ảnh tiến độ */}
          <section className="profile-form-section">
            <h3>
              <Scale size={16} />
              <span>Chỉ số đo lường</span>
            </h3>
            <WorkoutMeasurementFields value={measurement} onChange={(value) => { markEdited(); setMeasurement(value); }} />
          </section>

          <section className="profile-form-section">
            <h3>
              <Camera size={16} />
              <span>Ảnh tiến độ</span>
            </h3>
            <WorkoutProgressPhotoFields
              value={progressPhotos}
              onChange={(value) => { markEdited(); setProgressPhotos(value); }}
              disabled={loading}
            />
          </section>

      {/* 4. Cảm nhận & Ghi chú — dùng profile-form-section và profile-form-grid từ index.css */}
      <section className="profile-form-section">
        <h3>
          <MessageSquare size={16} />
          <span>Cảm nhận & Ghi chú</span>
        </h3>
        <div className="profile-form-grid">
          <div className="field">
            <label htmlFor="session-feeling">Cảm nhận sau buổi tập</label>
            <textarea
              id="session-feeling"
              rows={3}
              aria-label="Cảm nhận sau buổi tập"
              placeholder="Ví dụ: Thể lực tốt, hoàn thành trọn vẹn giáo án..."
              value={feeling}
              onChange={(event) => { markEdited(); setFeeling(event.target.value); }}
            />
          </div>

          <div className="field">
            <label htmlFor="session-notes">Ghi chú chuyên môn</label>
            <textarea
              id="session-notes"
              rows={3}
              aria-label="Ghi chú buổi tập"
              placeholder="Nhập lưu ý kỹ thuật, điều chỉnh tạ buổi sau..."
              value={notes}
              onChange={(event) => { markEdited(); setNotes(event.target.value); }}
            />
          </div>
        </div>
      </section>

      {/* 6. Chữ ký xác nhận của khách hàng */}
      <section className="profile-form-section">
          <h3>
            <PenLine size={16} />
            <span>Chữ ký xác nhận của khách hàng</span>
          </h3>
          {restoredSignature ? (
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
              <img src={signatureDataUrl} alt="Chữ ký đã khôi phục" className="max-h-44 max-w-full bg-white" />
              <button type="button" className="button button-secondary mt-3 min-h-[44px]" onClick={() => { markEdited(); setRestoredSignature(false); setSignatureDataUrl(''); }}>Ký lại</button>
            </div>
          ) : (
            <CustomerSignaturePad
              ref={signaturePadRef}
              signerName={signerName}
              onSignerNameChange={(value) => { markEdited(); setSignerName(value); }}
              onSignatureChange={(hasSignature) => { markEdited(); setSignatureDataUrl(hasSignature ? signaturePadRef.current?.toDataUrl() || '' : ''); }}
              placeholderName={customerName || 'Họ và tên khách hàng'}
            />
          )}
      </section>

      {/* 5. Action Buttons — sticky bottom để luôn thấy nút thao tác trên mobile */}
      <div className="profile-form-actions sticky bottom-0 z-20 -mx-4 sm:-mx-6 -mb-4 sm:-mb-6 mt-6 border-t border-slate-200 bg-white/95 backdrop-blur-xs p-3.5 sm:p-4 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] flex items-center justify-end gap-2.5">
        {onClose && (
          <button
            type="button"
            className="button button-secondary flex-1 sm:flex-none min-h-[44px]"
            disabled={loading}
            onClick={onClose}
          >
            Hủy
          </button>
        )}
        <button
          className="button button-primary flex-1 sm:flex-none min-h-[44px]"
          disabled={loading}
          type="submit"
        >
          <CheckCircle2 size={16} className="inline mr-1" />
          <span>{loading ? 'Đang lưu kết quả...' : 'Hoàn tất buổi tập'}</span>
        </button>
      </div>
    </form>
  );
}
