interface ReportAnalytics { totalVolume: number; averageRpe: number | null; attendance: { present: number; late: number; absent: number; rate: number | null }; streakWeeks: number; bodyDeltas: Record<string, number>; achievements: Array<{ isNewInPeriod: boolean; exerciseName?: string; kind?: string; value?: number; achievedAt?: string; sessionId?: string }>; dataQuality: { level: string; reasons: string[] } }
const number = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
const change = (label: string, value: number, unit: string) => `${label} ${value < 0 ? 'giảm' : value > 0 ? 'tăng' : 'không thay đổi'} ${number(Math.abs(value))}${unit}`;

export function generateProgressReport(analytics: ReportAnalytics, period: { periodStart: string; periodEnd: string }) {
  const sentences: string[] = []; const total = analytics.attendance.present + analytics.attendance.late + analytics.attendance.absent; const completed = analytics.attendance.present + analytics.attendance.late;
  if (total) sentences.push(`Trong giai đoạn ${new Date(period.periodStart).toLocaleDateString('vi-VN')} – ${new Date(period.periodEnd).toLocaleDateString('vi-VN')}, khách hàng hoàn thành ${completed}/${total} buổi${analytics.attendance.rate !== null ? `, đạt tỷ lệ tham gia ${number(analytics.attendance.rate)}%` : ''}.`);
  const body: string[] = [];
  if (typeof analytics.bodyDeltas.weight === 'number') body.push(change('cân nặng', analytics.bodyDeltas.weight, ' kg'));
  if (typeof analytics.bodyDeltas.bodyFatPercentage === 'number') body.push(change('tỷ lệ mỡ', analytics.bodyDeltas.bodyFatPercentage, '%'));
  if (typeof analytics.bodyDeltas.bodyFatMass === 'number') body.push(change('khối lượng mỡ', analytics.bodyDeltas.bodyFatMass, ' kg'));
  if (typeof analytics.bodyDeltas.muscleMass === 'number') body.push(change('khối lượng cơ', analytics.bodyDeltas.muscleMass, ' kg'));
  if (typeof analytics.bodyDeltas.visceralFatLevel === 'number') body.push(change('mỡ nội tạng', analytics.bodyDeltas.visceralFatLevel, ' cấp'));
  if (typeof analytics.bodyDeltas.inbodyScore === 'number') body.push(change('điểm InBody', analytics.bodyDeltas.inbodyScore, ' điểm'));
  if (typeof analytics.bodyDeltas.waist === 'number') body.push(change('vòng eo', analytics.bodyDeltas.waist, ' cm'));
  if (body.length) sentences.push(`Về chỉ số cơ thể, ${body.join(', ')}.`);
  const achievementCount = analytics.achievements.filter((item) => item.isNewInPeriod).length;
  if (achievementCount) sentences.push(`Khách hàng thiết lập ${achievementCount} thành tích mới.`);
  if (analytics.totalVolume > 0) sentences.push(`Tổng khối lượng tập đạt ${number(analytics.totalVolume)} kg${analytics.averageRpe !== null ? ` với RPE trung bình ${number(analytics.averageRpe)}` : ''}.`);
  if (!sentences.length) sentences.push('Chưa có đủ dữ liệu để tạo đánh giá tiến bộ chi tiết trong giai đoạn này.');
  return { summary: sentences.join(' '), metrics: { totalVolume: analytics.totalVolume, averageRpe: analytics.averageRpe, attendanceRate: analytics.attendance.rate, weightDelta: analytics.bodyDeltas.weight, bodyFatDelta: analytics.bodyDeltas.bodyFatPercentage, bodyFatMassDelta: analytics.bodyDeltas.bodyFatMass, muscleDelta: analytics.bodyDeltas.muscleMass, visceralFatDelta: analytics.bodyDeltas.visceralFatLevel, inbodyScoreDelta: analytics.bodyDeltas.inbodyScore, waistDelta: analytics.bodyDeltas.waist, achievementCount, streakWeeks: analytics.streakWeeks }, warnings: [...analytics.dataQuality.reasons], sourceVersions: { analytics: 1 }, generatorVersion: 1 };
}
