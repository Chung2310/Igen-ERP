import { useState } from 'react';
import { ChevronDown, ChevronUp, Layers, Sparkles, UserCheck, UserPlus } from 'lucide-react';
import { api } from '../../services/api';
import { errorMessage, type Customer } from '../../types';
import { useToast } from '../ui/ToastProvider';
import CustomerSelect from '../ui/CustomerSelect';
import QuickAddCustomerModal from './QuickAddCustomerModal';

import type { InBodyOcrDraft } from '../../types/inbody';
export type { InBodyOcrDraft };

interface InBodyReviewFormProps {
  draft: InBodyOcrDraft;
  onConfirmed: (draft: InBodyOcrDraft) => void;
}

function formatInBodyWarning(text: string): string {
  const t = text.trim();
  const lower = t.toLowerCase();
  if (lower.includes('segmental fat') && lower.includes('estimated')) {
    return 'Chỉ số phân bố mỡ từng phần (tay, chân, thân) là giá trị ước tính từ thuật toán máy đo.';
  }
  if ((lower.includes('segmental lean') || lower.includes('segmental muscle')) && lower.includes('estimated')) {
    return 'Chỉ số phân bố cơ từng phần (tay, chân, thân) là giá trị ước tính từ thuật toán máy đo.';
  }
  if (lower.includes('ecw') && lower.includes('estimated')) {
    return 'Tỷ lệ nước ngoại bào (ECW/TBW) là số liệu ước tính từ điện trở kháng.';
  }
  if (lower.includes('body composition') && lower.includes('estimated')) {
    return 'Thành phần cơ thể là số liệu ước tính từ dòng điện sinh học BIA.';
  }
  if (lower.includes('impedance')) {
    return 'Dữ liệu trở kháng điện sinh học đo được từ các điện cực tiếp xúc.';
  }
  if (lower.includes('blurry') || lower.includes('blur') || lower.includes('unclear')) {
    return 'Ảnh chụp phiếu đo có vùng hơi mờ, PT vui lòng đối chiếu kỹ lại số đo trên phiếu gốc.';
  }
  if (lower.includes('confidence') && (lower.includes('low') || lower.includes('thấp'))) {
    return 'Độ nét của ảnh phiếu đo chưa cao, vui lòng rà soát lại các số liệu.';
  }
  return t;
}

const numberValue = (value: string): number | undefined => (value.trim() === '' ? undefined : Number(value));

export default function InBodyReviewForm({ draft, onConfirmed }: InBodyReviewFormProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState(draft.customerId || '');
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [createdCustomer, setCreatedCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState({
    measurementDate: draft.measurementDate.slice(0, 10),
    weight: draft.weight?.toString() ?? '',
    height: draft.height?.toString() ?? '',
    bmi: draft.bmi?.toString() ?? '',
    bodyFatPercentage: draft.bodyFatPercentage?.toString() ?? '',
    bodyFatMass: draft.bodyFatMass?.toString() ?? '',
    muscleMass: draft.muscleMass?.toString() ?? '',
    bmr: draft.bmr?.toString() ?? '',
    visceralFatLevel: draft.visceralFatLevel?.toString() ?? '',
    inbodyScore: draft.inbodyScore?.toString() ?? '',
    bodyWater: draft.bodyWater?.toString() ?? '',
    boneMineral: draft.boneMineral?.toString() ?? '',
    waistHipRatio: draft.waistHipRatio?.toString() ?? '',
  });

  const hasSegmentalData = Boolean(
    (draft.segmentalMuscle && Object.values(draft.segmentalMuscle).some((v) => v != null)) ||
    (draft.segmentalFat && Object.values(draft.segmentalFat).some((v) => v != null))
  );
  const [showSegmental, setShowSegmental] = useState(hasSegmentalData);
  const [segmentalMuscle, setSegmentalMuscle] = useState<Record<string, string>>({
    rightArm: draft.segmentalMuscle?.rightArm?.toString() ?? '',
    leftArm: draft.segmentalMuscle?.leftArm?.toString() ?? '',
    trunk: draft.segmentalMuscle?.trunk?.toString() ?? '',
    rightLeg: draft.segmentalMuscle?.rightLeg?.toString() ?? '',
    leftLeg: draft.segmentalMuscle?.leftLeg?.toString() ?? '',
  });
  const [segmentalFat, setSegmentalFat] = useState<Record<string, string>>({
    rightArm: draft.segmentalFat?.rightArm?.toString() ?? '',
    leftArm: draft.segmentalFat?.leftArm?.toString() ?? '',
    trunk: draft.segmentalFat?.trunk?.toString() ?? '',
    rightLeg: draft.segmentalFat?.rightLeg?.toString() ?? '',
    leftLeg: draft.segmentalFat?.leftLeg?.toString() ?? '',
  });

  const change = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }));

  const submit = async () => {
    if (!selectedCustomerId) {
      toast.error('Vui lòng chọn học viên áp dụng cho kết quả InBody này.');
      return;
    }
    setLoading(true);
    try {
      const cleanSegmental = (seg: Record<string, string>) => {
        const hasAny = Object.values(seg).some((v) => v.trim() !== '');
        if (!hasAny) return undefined;
        return {
          rightArm: numberValue(seg.rightArm) ?? null,
          leftArm: numberValue(seg.leftArm) ?? null,
          trunk: numberValue(seg.trunk) ?? null,
          rightLeg: numberValue(seg.rightLeg) ?? null,
          leftLeg: numberValue(seg.leftLeg) ?? null,
        };
      };

      const payload = {
        customerId: selectedCustomerId,
        measurementDate: form.measurementDate,
        weight: numberValue(form.weight),
        height: numberValue(form.height),
        bmi: numberValue(form.bmi),
        bodyFatPercentage: numberValue(form.bodyFatPercentage),
        bodyFatMass: numberValue(form.bodyFatMass),
        muscleMass: numberValue(form.muscleMass),
        bmr: numberValue(form.bmr),
        visceralFatLevel: numberValue(form.visceralFatLevel),
        inbodyScore: numberValue(form.inbodyScore),
        bodyWater: numberValue(form.bodyWater),
        boneMineral: numberValue(form.boneMineral),
        waistHipRatio: numberValue(form.waistHipRatio),
        segmentalMuscle: cleanSegmental(segmentalMuscle),
        segmentalFat: cleanSegmental(segmentalFat),
      };
      const result = await api.patch<InBodyOcrDraft>(`/api/inbody/${draft._id}/confirm-ocr`, payload);
      toast.success(result.message);
      onConfirmed(result.data);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const rawWarnings = draft.ocrWarnings?.length ? draft.ocrWarnings : draft.warnings ?? [];
  const warnings = rawWarnings.filter(
    (w) =>
      !w.includes('Tên đọc được trên phiếu') &&
      !w.includes('Đã tự động nhận diện học viên') &&
      !w.toLowerCase().includes('khớp chính xác học viên')
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '4px 0 16px' }}>
      <div
        className="published-card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
          margin: 0,
        }}
      >
        <div>
          <strong>Cần PT kiểm tra</strong>
          <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: '#64748b' }}>
            Kết quả quét tự động là bản nháp để PT đối chiếu và xác nhận tính chính xác của các số liệu.
          </p>
        </div>
        {draft.confidence !== undefined && draft.confidence < 0.8 && (
          <strong style={{ color: '#b45309', background: '#fef3c7', padding: '4px 10px', borderRadius: '16px', fontSize: '0.8rem' }}>
            Độ tin cậy thấp
          </strong>
        )}
      </div>

      {warnings.length > 0 && (
        <div
          style={{
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: '10px',
            padding: '12px 16px',
            fontSize: '0.84rem',
            color: '#92400e',
          }}
          aria-label="Cảnh báo OCR"
        >
          <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontSize: '0.88rem' }}>
            <span>⚠️</span> <span>Lưu ý kiểm tra từ phiếu đo:</span>
          </strong>
          <ul className="panel" aria-label="Cảnh báo OCR" style={{ margin: 0, paddingLeft: '20px', lineHeight: 1.5 }}>
            {warnings.map((warning) => (
              <li key={warning}>{formatInBodyWarning(warning)}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Customer Selection & Auto-Matching Notice */}
      <div
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '16px',
          display: 'grid',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                background: 'rgba(2, 132, 199, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <UserCheck size={16} color="#0284c7" />
            </div>
            <strong style={{ fontSize: '0.92rem', color: '#003b70' }}>
              Học viên áp dụng kết quả đo <span style={{ color: '#e11d48' }}>*</span>
            </strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {draft.detectedCustomerName && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  padding: '3px 10px',
                  borderRadius: '20px',
                  fontSize: '0.78rem',
                  color: '#0369a1',
                }}
              >
                <Sparkles size={13} color="#0284c7" />
                <span>
                  Tên đọc từ phiếu: <strong>{draft.detectedCustomerName}</strong>
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowQuickAdd(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-sky-700 hover:text-sky-800 bg-sky-50 hover:bg-sky-100 active:bg-sky-200 border border-sky-300 rounded-lg transition-all cursor-pointer shadow-2xs hover:shadow-xs"
              title="Thêm nhanh học viên mới vào hệ thống"
            >
              <UserPlus size={14} className="text-sky-600" />
              <span>Thêm nhanh học viên</span>
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <CustomerSelect
              label=""
              name="reviewCustomerId"
              ariaLabel="Học viên áp dụng kết quả đo"
              value={selectedCustomerId}
              onChange={(selectedId) => setSelectedCustomerId(selectedId)}
              extraCustomer={createdCustomer}
              required
              placeholder="Tìm và chọn học viên áp dụng kết quả InBody này..."
            />
          </div>
          <button
            type="button"
            onClick={() => setShowQuickAdd(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 active:bg-sky-800 rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
            title="Thêm nhanh học viên mới vào hệ thống"
          >
            <UserPlus size={15} />
            <span>Thêm mới</span>
          </button>
        </div>

        {draft.detectedCustomerName && selectedCustomerId && (
          <p style={{ margin: 0, fontSize: '0.76rem', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px' }}>
            ✓ Đã ghép nối học viên tương ứng. Bạn có thể kiểm tra hoặc chọn học viên khác nếu cần.
          </p>
        )}
      </div>

      <div className="inbody-form-row-3">
        <label className="inbody-input-label">
          <span>
            Ngày đo <strong style={{ color: '#e11d48' }}>*</strong>
          </span>
          <input
            aria-label="Ngày đo xác nhận"
            type="date"
            value={form.measurementDate}
            onChange={(event) => change('measurementDate', event.target.value)}
            required
          />
        </label>

        <label className="inbody-input-label">
          <span>Cân nặng (kg) <strong style={{ color: '#e11d48' }}>*</strong></span>
          <input
            aria-label="Cân nặng (kg)"
            type="number"
            step="any"
            placeholder="vd: 65.5"
            value={form.weight}
            onChange={(event) => change('weight', event.target.value)}
          />
        </label>

        <label className="inbody-input-label">
          <span>Chiều cao (cm)</span>
          <input
            aria-label="Chiều cao (cm)"
            type="number"
            step="any"
            placeholder="vd: 170.1"
            value={form.height}
            onChange={(event) => change('height', event.target.value)}
          />
        </label>
      </div>

      <div className="inbody-form-row-4">
        <label className="inbody-input-label">
          <span>BMI (Chỉ số thể trọng)</span>
          <input
            aria-label="BMI"
            type="number"
            step="any"
            placeholder="vd: 22.4"
            value={form.bmi}
            onChange={(event) => change('bmi', event.target.value)}
          />
        </label>

        <label className="inbody-input-label">
          <span>Tỷ lệ mỡ (%)</span>
          <input
            aria-label="Tỷ lệ mỡ (%)"
            type="number"
            step="any"
            placeholder="vd: 18.5"
            value={form.bodyFatPercentage}
            onChange={(event) => change('bodyFatPercentage', event.target.value)}
          />
        </label>

        <label className="inbody-input-label">
          <span>Khối lượng mỡ (kg)</span>
          <input
            aria-label="Khối lượng mỡ (kg)"
            type="number"
            step="any"
            placeholder="vd: 12.1"
            value={form.bodyFatMass}
            onChange={(event) => change('bodyFatMass', event.target.value)}
          />
        </label>

        <label className="inbody-input-label">
          <span>Khối lượng cơ (SMM kg)</span>
          <input
            aria-label="Khối lượng cơ (kg)"
            type="number"
            step="any"
            placeholder="vd: 28.2"
            value={form.muscleMass}
            onChange={(event) => change('muscleMass', event.target.value)}
          />
        </label>
      </div>

      <div className="inbody-form-row-3">
        <label className="inbody-input-label">
          <span>Mỡ nội tạng (Level 1-20)</span>
          <input
            aria-label="Mỡ nội tạng"
            type="number"
            step="any"
            min="0.1"
            max="30"
            placeholder="vd: 4.5"
            value={form.visceralFatLevel}
            onChange={(event) => change('visceralFatLevel', event.target.value)}
          />
        </label>

        <label className="inbody-input-label">
          <span>BMR - Trao đổi chất (kcal)</span>
          <input
            aria-label="BMR"
            type="number"
            step="any"
            placeholder="vd: 1540"
            value={form.bmr}
            onChange={(event) => change('bmr', event.target.value)}
          />
        </label>

        <label className="inbody-input-label">
          <span>Điểm InBody (/100)</span>
          <input
            aria-label="Điểm InBody"
            type="number"
            step="any"
            placeholder="vd: 78"
            value={form.inbodyScore}
            onChange={(event) => change('inbodyScore', event.target.value)}
          />
        </label>
      </div>

      <div className="inbody-form-row-3">
        <label className="inbody-input-label">
          <span>Lượng nước cơ thể - TBW (L)</span>
          <input
            aria-label="Lượng nước"
            type="number"
            step="any"
            placeholder="vd: 41.5"
            value={form.bodyWater}
            onChange={(event) => change('bodyWater', event.target.value)}
          />
        </label>

        <label className="inbody-input-label">
          <span>Khoáng chất xương (kg)</span>
          <input
            aria-label="Khoáng xương"
            type="number"
            step="any"
            placeholder="vd: 3.1"
            value={form.boneMineral}
            onChange={(event) => change('boneMineral', event.target.value)}
          />
        </label>

        <label className="inbody-input-label">
          <span>Tỷ lệ eo / hông (WHR)</span>
          <input
            aria-label="Tỷ lệ eo/mông"
            type="number"
            step="any"
            placeholder="vd: 0.85"
            value={form.waistHipRatio}
            onChange={(event) => change('waistHipRatio', event.target.value)}
          />
        </label>
      </div>

      <div
        style={{
          border: '1px solid #e0f2fe',
          borderRadius: '10px',
          overflow: 'hidden',
          background: '#f8fafc',
          marginTop: '4px',
        }}
      >
        <button
          type="button"
          onClick={() => setShowSegmental(!showSegmental)}
          style={{
            width: '100%',
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#f0f9ff',
            border: 'none',
            borderBottom: showSegmental ? '1px solid #e0f2fe' : 'none',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '0.88rem',
            color: '#003b70',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={16} color="#0284c7" /> Phân Tích Cơ & Mỡ Từng Phân Vùng
          </span>
          {showSegmental ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showSegmental && (
          <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '14px', background: '#ffffff' }}>
            <div>
              <strong style={{ fontSize: '0.84rem', color: '#15803d', display: 'block', marginBottom: '8px' }}>
                💪 Khối lượng cơ từng phần (kg):
              </strong>
              <div className="inbody-form-row-5">
                {[
                  { key: 'rightArm', label: 'Tay Phải' },
                  { key: 'leftArm', label: 'Tay Trái' },
                  { key: 'trunk', label: 'Thân Mình' },
                  { key: 'rightLeg', label: 'Chân Phải' },
                  { key: 'leftLeg', label: 'Chân Trái' },
                ].map((item) => (
                  <label key={item.key} style={{ fontSize: '0.78rem', color: '#475569', margin: 0 }}>
                    <span>{item.label}</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="kg"
                      value={segmentalMuscle[item.key]}
                      onChange={(e) =>
                        setSegmentalMuscle((prev) => ({ ...prev, [item.key]: e.target.value }))
                      }
                      style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', marginTop: '2px', fontSize: '0.82rem' }}
                    />
                  </label>
                ))}
              </div>
            </div>

            <div>
              <strong style={{ fontSize: '0.84rem', color: '#b45309', display: 'block', marginBottom: '8px' }}>
                🧀 Khối lượng mỡ từng phần (kg):
              </strong>
              <div className="inbody-form-row-5">
                {[
                  { key: 'rightArm', label: 'Tay Phải' },
                  { key: 'leftArm', label: 'Tay Trái' },
                  { key: 'trunk', label: 'Thân Mình' },
                  { key: 'rightLeg', label: 'Chân Phải' },
                  { key: 'leftLeg', label: 'Chân Trái' },
                ].map((item) => (
                  <label key={item.key} style={{ fontSize: '0.78rem', color: '#475569', margin: 0 }}>
                    <span>{item.label}</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="kg"
                      value={segmentalFat[item.key]}
                      onChange={(e) =>
                        setSegmentalFat((prev) => ({ ...prev, [item.key]: e.target.value }))
                      }
                      style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', marginTop: '2px', fontSize: '0.82rem' }}
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px', gap: '10px' }}>
        <button
          className="button button-primary"
          type="button"
          aria-label="Xác nhận dữ liệu"
          onClick={() => void submit()}
          disabled={loading}
          style={{ minWidth: '180px', padding: '10px 20px', fontSize: '0.92rem', fontWeight: 700 }}
        >
          {loading ? 'Đang xác nhận...' : 'Xác nhận dữ liệu'}
        </button>
      </div>

      <QuickAddCustomerModal
        open={showQuickAdd}
        initialData={{
          fullName: draft.detectedCustomerName,
          height: form.height ? Number(form.height) : draft.height,
          initialWeight: form.weight ? Number(form.weight) : draft.weight,
          assignedPtId: draft.ptId,
        }}
        onClose={() => setShowQuickAdd(false)}
        onCreated={(newCustomer) => {
          setCreatedCustomer(newCustomer);
          setSelectedCustomerId(newCustomer._id || newCustomer.id || '');
        }}
      />
    </div>
  );
}
