import ProgressSection from './ProgressSection';

export interface Measurement {
  _id: string;
  measuredAt: string;
  weight?: number;
  bodyFatPercentage?: number;
  muscleMass?: number;
  measurements?: Record<string, number | undefined>;
}

interface ChartValue {
  id: string;
  date: string;
  value: number;
}

function MetricChart({ label, unit, values }: { label: string; unit: string; values: ChartValue[] }) {
  if (values.length === 0) {
    return (
      <div aria-label={`Biểu đồ ${label}`} className="rounded-lg bg-white p-6 text-center text-sm text-slate-500">
        Chưa có dữ liệu
      </div>
    );
  }

  if (values.length === 1) {
    const first = values[0];
    return (
      <div aria-label={`Biểu đồ ${label}`} className="rounded-lg bg-white p-5 text-center">
        <p className="font-oswald text-2xl font-bold text-primary">{first.value.toLocaleString('vi-VN')} {unit}</p>
        <p className="mt-1 text-xs font-semibold text-slate-500">Mốc ngày {new Date(first.date).toLocaleDateString('vi-VN')}</p>
        <p className="mt-3 text-xs leading-5 text-slate-500">Ghi thêm một mốc để hiển thị xu hướng thay đổi.</p>
      </div>
    );
  }

  const numbers = values.map((item) => item.value);
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  const span = max - min || 1;
  const coordinates = values.map((item, index) => ({
    ...item,
    x: 20 + index * (260 / (values.length - 1)),
    y: 110 - ((item.value - min) / span) * 80,
  }));

  return (
    <svg className="h-44 w-full text-sky-600" role="img" aria-label={`Biểu đồ ${label}`} viewBox="0 0 300 140">
      <polyline
        points={coordinates.map((item) => `${item.x},${item.y}`).join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
      />
      {coordinates.map((item) => {
        const date = new Date(item.date).toLocaleDateString('vi-VN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
        return (
          <circle key={item.id} cx={item.x} cy={item.y} r="5" aria-label={`${date}: ${item.value} ${unit}`}>
            <title>{date}: {item.value} {unit}</title>
          </circle>
        );
      })}
    </svg>
  );
}

const configs = [
  { key: 'weight', label: 'cân nặng', unit: 'kg' },
  { key: 'bodyFatPercentage', label: 'tỷ lệ mỡ', unit: '%' },
  { key: 'muscleMass', label: 'khối lượng cơ', unit: 'kg' },
  { key: 'chest', label: 'vòng ngực', unit: 'cm' },
  { key: 'waist', label: 'vòng eo', unit: 'cm' },
  { key: 'hips', label: 'vòng hông', unit: 'cm' },
  { key: 'arm', label: 'vòng tay', unit: 'cm' },
  { key: 'thigh', label: 'vòng đùi', unit: 'cm' },
  { key: 'calf', label: 'bắp chân', unit: 'cm' },
] as const;

export default function ProgressCharts({ measurements }: { measurements: Measurement[] }) {
  return (
    <ProgressSection title="Biểu đồ tiến độ">
      <div className="grid gap-4 lg:grid-cols-2">
        {configs.map((config) => {
          const values = measurements
            .map((item) => ({
              id: item._id,
              date: item.measuredAt,
              value: config.key in item ? item[config.key as 'weight'] : item.measurements?.[config.key],
            }))
            .filter((item): item is ChartValue => typeof item.value === 'number');

          return (
            <article className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs" key={config.key}>
              <h3 className="text-xs font-bold capitalize text-[#003b70]">{config.label}</h3>
              <MetricChart label={config.label} unit={config.unit} values={values} />
            </article>
          );
        })}
      </div>
    </ProgressSection>
  );
}
