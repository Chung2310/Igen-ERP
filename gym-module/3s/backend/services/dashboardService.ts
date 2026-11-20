import CustomerProfile from '../models/CustomerProfile.js';
import BodyMeasurement from '../models/BodyMeasurement.js';
import InBodyRecord from '../models/InBodyRecord.js';
import CareAlert from '../models/CareAlert.js';
import type { AuthenticatedUser } from '../types/express.js';

async function getPtDashboard(user: AuthenticatedUser) {
  const customers = await CustomerProfile.find({ assignedPtId: user.id, status: 'ACTIVE' }).lean();
  const summaries = await Promise.all(customers.map(async (customer) => {
    const [bodyMeasurements, inbodyRecords, openAlerts] = await Promise.all([
      BodyMeasurement.find({ customerId: customer._id }).sort({ measuredAt: 1 }).lean(),
      InBodyRecord.find({ customerId: customer._id }).sort({ measurementDate: 1 }).lean(),
      CareAlert.countDocuments({ customerId: customer._id, status: 'OPEN' }),
    ]);

    const convertedInbody = inbodyRecords.map((r) => ({
      _id: r._id,
      measuredAt: r.measurementDate,
      weight: r.weight,
      bodyFatPercentage: r.bodyFatPercentage ?? undefined,
      muscleMass: r.muscleMass ?? undefined,
    }));

    const convertedBody = bodyMeasurements.map((b) => ({
      _id: b._id,
      measuredAt: b.measuredAt,
      weight: b.weight,
      bodyFatPercentage: b.bodyFatPercentage,
      muscleMass: b.muscleMass,
    }));

    const measurements = [...convertedInbody, ...convertedBody].sort(
      (a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime(),
    );

    const sufficient = measurements.length >= 2;
    if (!sufficient) {
      return {
        customerId: String(customer._id),
        fullName: customer.fullName,
        phone: customer.phone,
        initialGoal: customer.initialGoal || 'Cải thiện vóc dáng & sức khỏe',
        initialWeight: customer.initialWeight ?? (measurements[0]?.weight ?? null),
        dataStatus: 'INSUFFICIENT_DATA' as const,
        rank: null,
        score: null,
        scoreBreakdown: null,
        progressCategory: 'INSUFFICIENT_DATA' as const,
        sourcePath: `/api/progress/${customer._id}`,
        measurementCount: measurements.length,
        firstMeasurement: measurements[0] ?? null,
        latestMeasurement: measurements.at(-1) ?? null,
        changes: null,
        openAlerts,
        riskFactors: [
          'Chưa đo đủ ≥ 2 lần InBody để so sánh trước/sau (BF-AT)',
          ...(openAlerts > 0 ? [`Đang có ${openAlerts} cảnh báo chăm sóc chưa xử lý`] : []),
        ],
        improvementTips: [
          'Hẹn học viên lịch đo InBody lần tiếp theo để hoàn thiện dữ liệu tiến độ.',
          'Kiểm tra lại tần suất tập luyện và mức độ tham gia các buổi tập trong tuần.',
        ],
      };
    }

    const first = measurements[0];
    const latest = measurements.at(-1)!;
    const bodyFatChange = (first.bodyFatPercentage ?? 0) - (latest.bodyFatPercentage ?? 0); // > 0 is fat loss (good)
    const muscleChange = (latest.muscleMass ?? 0) - (first.muscleMass ?? 0); // > 0 is muscle gain (good)
    const weightChange = (latest.weight ?? 0) - (first.weight ?? 0);
    const measurementTrend = Math.max(0, Math.min(70, Math.round(50 + bodyFatChange * 5 + muscleChange * 5)));
    const careRisk = Math.max(0, 30 - openAlerts * 10);
    const score = measurementTrend + careRisk;

    // Categorization: GOOD (>= 70), SLOW (50-69), POOR (< 50)
    let progressCategory: 'GOOD' | 'SLOW' | 'POOR' = 'SLOW';
    if (score >= 70) progressCategory = 'GOOD';
    else if (score < 50) progressCategory = 'POOR';

    const riskFactors: string[] = [];
    const improvementTips: string[] = [];

    if (bodyFatChange < 0) {
      riskFactors.push(`Tỷ lệ mỡ tăng (+${Math.abs(bodyFatChange).toFixed(1)}% so với lần đo đầu)`);
      improvementTips.push('Kiểm soát lại lượng Calorie nạp vào, hạn chế đường tinh luyện & đồ ăn khuya.');
    }
    if (muscleChange < 0) {
      riskFactors.push(`Khối lượng cơ bắp suy giảm (${muscleChange.toFixed(1)} kg)`);
      improvementTips.push('Tăng cường nạp đạm (Protein), tối ưu thời gian ngủ nghỉ (≥ 7h) để phục hồi sợi cơ.');
    }
    if (openAlerts > 0) {
      riskFactors.push(`Có ${openAlerts} cảnh báo chăm sóc đang mở`);
      improvementTips.push('Gọi điện / nhắn tin hỏi thăm học viên để lắng nghe khó khăn trong tuần.');
    }
    if (bodyFatChange === 0 && muscleChange === 0) {
      riskFactors.push('Chỉ số cơ/mỡ chưa có biến chuyển sau các lần đo');
      improvementTips.push('Xem xét điều chỉnh tăng tiến mức tạ (Progressive Overload) hoặc thay đổi bài tập Cardio.');
    }

    if (improvementTips.length === 0) {
      improvementTips.push('Duy trì phác đồ tập luyện và chế độ ăn hiện tại, tiếp tục phát huy kết quả tốt.');
    }

    const daysBetween = Math.max(
      1,
      Math.round((new Date(latest.measuredAt).getTime() - new Date(first.measuredAt).getTime()) / (1000 * 60 * 60 * 24)),
    );

    return {
      customerId: String(customer._id),
      fullName: customer.fullName,
      phone: customer.phone,
      initialGoal: customer.initialGoal || 'Tăng cơ giảm mỡ & săn chắc vóc dáng',
      initialWeight: customer.initialWeight ?? (first.weight ?? null),
      dataStatus: 'READY' as const,
      rank: null,
      score,
      scoreBreakdown: { measurementTrend, careRisk },
      progressCategory,
      sourcePath: `/api/progress/${customer._id}`,
      measurementCount: measurements.length,
      firstMeasurement: first,
      latestMeasurement: latest,
      changes: {
        bodyFatChange: Number(bodyFatChange.toFixed(1)),
        muscleChange: Number(muscleChange.toFixed(1)),
        weightChange: Number(weightChange.toFixed(1)),
        daysBetween,
      },
      openAlerts,
      riskFactors,
      improvementTips,
    };
  }));

  const readyCustomers = summaries.filter((c) => c.dataStatus === 'READY');
  const goodProgressCount = readyCustomers.filter((c) => (c.score ?? 0) >= 70).length;
  const slowProgressCount = readyCustomers.filter((c) => (c.score ?? 0) >= 50 && (c.score ?? 0) < 70).length;
  const poorProgressCount = readyCustomers.filter((c) => (c.score ?? 0) < 50).length;

  return {
    totalCustomers: customers.length,
    openAlerts: await CareAlert.countDocuments({ ptId: user.id, status: 'OPEN' }),
    goodProgressCount,
    slowProgressCount,
    poorProgressCount,
    customers: summaries,
  };
}

export { getPtDashboard };

