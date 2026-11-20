import { useState } from 'react';
import { api } from '../../services/api';
import { useToast } from '../ui/ToastProvider';
import { errorMessage } from '../../types';
import type { Customer, ActivityItem } from '../../types';

const ACTIVITIES: ActivityItem[] = [
  {
    id: 'gym_hiit',
    name: 'Gym / Kháng lực cường độ cao (1h)',
    category: 'STRENGTH',
    categoryLabel: 'Tập tạ / Gym',
    met: 6.5,
    defaultDurationMinutes: 60,
    benchmarkText: '1h tập tạ ~ 400 - 500 kcal',
    description: 'Tập tạ nặng, nghỉ ngắn, superset kích thích phì đại cơ bắp tối đa.',
    badgeColor: '#2563eb',
  },
  {
    id: 'running_5k',
    name: 'Chạy bộ 5km (Pace ~6:00)',
    category: 'CARDIO',
    categoryLabel: 'Chạy bộ',
    met: 9.8,
    defaultDurationMinutes: 30,
    defaultDistanceKm: 5,
    benchmarkText: 'Chạy 5km ~ 450 - 550 kcal',
    description: 'Chạy tốc độ trung bình 10 km/h, đốt calo và tăng dung tích tim phổi.',
    badgeColor: '#ea580c',
  },
  {
    id: 'swimming_1k',
    name: 'Bơi lội 1km (Bơi sải / Ếch)',
    category: 'CARDIO',
    categoryLabel: 'Bơi lội',
    met: 7.5,
    defaultDurationMinutes: 40,
    defaultDistanceKm: 1,
    benchmarkText: 'Bơi 1km ~ 350 - 450 kcal',
    description: 'Vận động toàn thân dưới nước, giảm áp lực lên khớp gối và cột sống.',
    badgeColor: '#0284c7',
  },
  {
    id: 'cycling_20k',
    name: 'Cycling / Đạp xe 20km ngoài trời',
    category: 'CARDIO',
    categoryLabel: 'Đạp xe',
    met: 7.5,
    defaultDurationMinutes: 50,
    defaultDistanceKm: 20,
    benchmarkText: 'Đạp xe 20km ~ 350 - 500 kcal',
    description: 'Tốc độ 22-25 km/h, kích hoạt đùi trước, mông và sức bền tim mạch.',
    badgeColor: '#16a34a',
  },
  {
    id: 'tabata_hiit',
    name: 'Tabata / HIIT ngắt quãng (30p)',
    category: 'CARDIO',
    categoryLabel: 'Cardio / HIIT',
    met: 9.5,
    defaultDurationMinutes: 30,
    benchmarkText: '30 phút HIIT ~ 350 - 450 kcal',
    description: '20s nỗ lực tối đa + 10s nghỉ, hiệu ứng đốt mỡ sau tập (EPOC).',
    badgeColor: '#dc2626',
  },
  {
    id: 'boxing_kickfit',
    name: 'Boxing / Kickfit (45p)',
    category: 'MARTIAL_ARTS',
    categoryLabel: 'Võ thuật',
    met: 8.5,
    defaultDurationMinutes: 45,
    benchmarkText: '45 phút Boxing ~ 400 - 500 kcal',
    description: 'Đấm bao cát, di chuyển linh hoạt, rèn luyện phản xạ và đốt mỡ siết eo.',
    badgeColor: '#7c3aed',
  },
  {
    id: 'jump_rope',
    name: 'Nhảy dây tốc độ (30p)',
    category: 'CARDIO',
    categoryLabel: 'Cardio',
    met: 10.0,
    defaultDurationMinutes: 30,
    benchmarkText: '30 phút nhảy dây ~ 400 - 550 kcal',
    description: '100-120 nhịp/phút, tiêu hao calo vượt trội so với chạy bộ cùng thời gian.',
    badgeColor: '#db2777',
  },
  {
    id: 'badminton',
    name: 'Cầu lông / Tennis đối kháng (1h)',
    category: 'SPORTS',
    categoryLabel: 'Thể thao',
    met: 6.5,
    defaultDurationMinutes: 60,
    benchmarkText: '1h đối kháng ~ 360 - 480 kcal',
    description: 'Di chuyển bước chân liên tục, xoay người linh hoạt và đập cầu.',
    badgeColor: '#059669',
  },
  {
    id: 'cardio_zone2',
    name: 'Cardio Zone 2 / LISS (45p)',
    category: 'CARDIO',
    categoryLabel: 'Zone 2 LISS',
    met: 5.5,
    defaultDurationMinutes: 45,
    benchmarkText: '45 phút Zone 2 ~ 250 - 350 kcal',
    description: 'Nhịp tim 60-70% Max HR, tối ưu hóa quá trình oxy hóa chất béo làm năng lượng.',
    badgeColor: '#0891b2',
  },
  {
    id: 'yoga_mobility',
    name: 'Yoga & Giãn cơ phục hồi (45p)',
    category: 'RECOVERY',
    categoryLabel: 'Phục hồi',
    met: 3.0,
    defaultDurationMinutes: 45,
    benchmarkText: '45 phút Yoga ~ 120 - 200 kcal',
    description: 'Giảm đau mỏi cơ, tăng tầm vận động khớp (ROM) và hạ hormone cortisol.',
    badgeColor: '#4f46e5',
  },
];

interface ActivityLibraryCalculatorProps {
  selectedCustomer?: Customer | null;
  onLogged?: () => void;
}

export default function ActivityLibraryCalculator({ selectedCustomer, onLogged }: ActivityLibraryCalculatorProps) {
  const toast = useToast();
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem>(ACTIVITIES[0]);
  const [weightKg, setWeightKg] = useState<string>(selectedCustomer?.initialWeight ? String(selectedCustomer.initialWeight) : '70');
  const [durationMinutes, setDurationMinutes] = useState<string>(String(ACTIVITIES[0].defaultDurationMinutes));
  const [distanceKm, setDistanceKm] = useState<string>(String(ACTIVITIES[0].defaultDistanceKm || ''));
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [saving, setSaving] = useState(false);

  // ACSM Calorie Burn Formula: Calories = (MET * 3.5 * weightKg / 200) * durationMinutes
  const weight = parseFloat(weightKg) || 70;
  const duration = parseFloat(durationMinutes) || 30;
  const calculatedCalories = Math.round(((selectedActivity.met * 3.5 * weight) / 200) * duration);
  const caloriesPerMinute = parseFloat(((selectedActivity.met * 3.5 * weight) / 200).toFixed(1));

  const handleSelectActivity = (act: ActivityItem) => {
    setSelectedActivity(act);
    setDurationMinutes(String(act.defaultDurationMinutes));
    if (act.defaultDistanceKm) {
      setDistanceKm(String(act.defaultDistanceKm));
    } else {
      setDistanceKm('');
    }
  };

  const handleSaveToLog = async () => {
    if (!selectedCustomer?._id) {
      toast.error('Vui lòng chọn học viên ở thanh tìm kiếm trước khi lưu nhật ký vận động.');
      return;
    }

    try {
      setSaving(true);
      await api.post('/api/nutrition/logs', {
        customerId: selectedCustomer._id,
        loggedAt: new Date().toISOString(),
        type: 'ACTIVITY',
        name: selectedActivity.name,
        calories: calculatedCalories,
        durationMinutes: duration,
        notes: `Tiêu hao ước tính: MET ${selectedActivity.met} | Cân nặng ${weight}kg | Thời gian ${duration} phút`,
      });
      toast.success(`Đã ghi nhận +${calculatedCalories} kcal tiêu hao vào hồ sơ của ${selectedCustomer.fullName}!`);
      if (onLogged) onLogged();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const filteredActivities = selectedCategory === 'ALL'
    ? ACTIVITIES
    : ACTIVITIES.filter((a) => a.category === selectedCategory);

  return (
    <div style={{ display: 'grid', gap: '14px', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      {/* Top Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#ffffff',
          borderRadius: '12px',
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '1.05rem', color: '#ffffff', fontWeight: 800 }}>
            Ước Tính Tiêu Hao Calo Hoạt Động Thể Thao
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
            Hệ số trao đổi chất (METs) theo cân nặng & thời gian vận động
          </p>
        </div>

        {/* Quick Presets */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {[
            { label: 'Gym 1h', actId: 'gym_hiit' },
            { label: 'Chạy 5km', actId: 'running_5k' },
            { label: 'Bơi 1km', actId: 'swimming_1k' },
            { label: 'Cycling 20km', actId: 'cycling_20k' },
            { label: 'Tabata 30p', actId: 'tabata_hiit' },
          ].map((preset) => (
            <button
              key={preset.actId}
              type="button"
              onClick={() => {
                const target = ACTIVITIES.find((a) => a.id === preset.actId);
                if (target) handleSelectActivity(target);
              }}
              style={{
                background: selectedActivity.id === preset.actId ? '#00a4e4' : 'rgba(255,255,255,0.1)',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px', alignItems: 'start' }}>
        {/* Left: Activity Cards Grid */}
        <div style={{ display: 'grid', gap: '12px' }}>
          {/* Category Filter Pills */}
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
            {[
              { id: 'ALL', label: 'Tất cả bộ môn' },
              { id: 'STRENGTH', label: 'Tập tạ / Gym' },
              { id: 'CARDIO', label: 'Cardio / Chạy / Bơi' },
              { id: 'MARTIAL_ARTS', label: 'Võ thuật / Boxing' },
              { id: 'SPORTS', label: 'Thể thao' },
              { id: 'RECOVERY', label: 'Phục hồi / Yoga' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  background: selectedCategory === cat.id ? 'var(--primary-color)' : '#f1f5f9',
                  color: selectedCategory === cat.id ? '#ffffff' : '#475569',
                  border: '1px solid',
                  borderColor: selectedCategory === cat.id ? 'var(--primary-color)' : '#cbd5e1',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Cards List */}
          <div style={{ display: 'grid', gap: '10px', maxHeight: '520px', overflowY: 'auto', paddingRight: '4px' }}>
            {filteredActivities.map((act) => {
              const isSelected = selectedActivity.id === act.id;
              return (
                <div
                  key={act.id}
                  onClick={() => handleSelectActivity(act)}
                  style={{
                    background: isSelected ? '#f0fdf4' : '#ffffff',
                    border: '1.5px solid',
                    borderColor: isSelected ? '#22c55e' : '#e2e8f0',
                    borderRadius: '12px',
                    padding: '14px 16px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: isSelected ? '0 2px 8px rgba(34, 197, 94, 0.15)' : '0 1px 3px rgba(0,0,0,0.02)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>{act.name}</strong>
                      {isSelected && <span style={{ color: '#16a34a', fontWeight: 800, fontSize: '0.85rem' }}>✓</span>}
                    </div>
                    <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                      {act.description}
                    </p>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span
                      style={{
                        background: '#f1f5f9',
                        color: '#334155',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        display: 'inline-block',
                      }}
                    >
                      MET {act.met}
                    </span>
                    <div style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: 700, marginTop: '3px' }}>
                      {act.benchmarkText}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Live Interactive Calculator */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            padding: '22px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            display: 'grid',
            gap: '18px',
          }}
        >
          <div>
            <span style={{ fontSize: '0.74rem', color: '#0284c7', fontWeight: 700, textTransform: 'uppercase' }}>
              Bộ Tính Năng Lượng Động
            </span>
            <h3 style={{ margin: '2px 0 0', fontSize: '1.15rem', color: 'var(--primary-color)', fontWeight: 800 }}>
              {selectedActivity.name}
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              {selectedActivity.description}
            </p>
          </div>

          {/* Inputs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                Cân nặng học viên (kg)
              </label>
              <input
                type="number"
                step="0.5"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                Thời gian tập (Phút)
              </label>
              <input
                type="number"
                step="5"
                min="5"
                max="360"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
              />
            </div>
          </div>

          {/* Distance input if available */}
          {selectedActivity.defaultDistanceKm !== undefined && (
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                Quãng đường hoàn thành (km)
              </label>
              <input
                type="number"
                step="0.5"
                value={distanceKm}
                placeholder={`Mặc định: ${selectedActivity.defaultDistanceKm} km`}
                onChange={(e) => setDistanceKm(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
              />
            </div>
          )}

          {/* Big Calorie Display */}
          <div
            style={{
              background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
              border: '1.5px solid #86efac',
              borderRadius: '12px',
              padding: '18px',
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: '0.78rem', color: '#166534', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Ước Tính Năng Lượng Đốt Cháy
            </span>
            <div style={{ fontSize: '2.4rem', fontWeight: 900, color: '#15803d', margin: '4px 0', lineHeight: 1 }}>
              {calculatedCalories} <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>kcal</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '6px' }}>
              <span>Tốc độ: <strong>~{caloriesPerMinute} kcal/phút</strong></span>
              <span>•</span>
              <span>Hệ số: <strong>MET {selectedActivity.met}</strong></span>
              <span>•</span>
              <span>Thời lượng: <strong>{duration} phút</strong></span>
            </div>
          </div>

          {/* Calculation Formula Note */}
          <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.75rem', color: '#64748b' }}>
            <span style={{ fontWeight: 700, color: '#334155' }}>Công thức chuẩn ACSM:</span>
            <div style={{ marginTop: '2px' }}>
              Calories = (MET × 3.5 × {weight}kg / 200) × {duration} phút = <strong>{calculatedCalories} kcal</strong>
            </div>
          </div>

          {/* Save to Log Button */}
          <button
            type="button"
            className="button button-primary"
            onClick={() => void handleSaveToLog()}
            disabled={saving}
            style={{ padding: '12px', fontSize: '0.9rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {saving ? 'Đang lưu...' : `Ghi ${calculatedCalories} kcal vào Nhật Ký Tiêu Hao`}
          </button>
        </div>
      </div>
    </div>
  );
}
