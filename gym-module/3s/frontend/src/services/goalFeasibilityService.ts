import type { InBodyRecordData } from '../types/inbody';
import type { RoadmapCustomerMeta, RoadmapGoalType } from './roadmapGenerator';

export type FeasibilityStatus = 'FEASIBLE' | 'CHALLENGING' | 'INFEASIBLE';

export interface FeasibilityAssessment {
  status: FeasibilityStatus;
  badgeLabel: string;
  badgeColor: string;
  headline: string;
  weeklyRate: number; // kg or % per week
  weeklyRateUnit: string;
  safeWeeklyRateMax: number;
  dailyCalorieImpact: number; // deficit or surplus per day (kcal)
  reasons: string[];
  risks?: string[];
  recommendations: string[];
  recommendedWeeks?: number;
  recommendedTarget?: number;
}

export interface FeasibilityInput {
  goalType: RoadmapGoalType;
  targetValue: number;
  targetUnit: string;
  durationWeeks: number;
  sessionsPerWeek: number;
  customerMeta?: RoadmapCustomerMeta | null;
  latestInbody?: InBodyRecordData | null;
}

/**
 * Đánh giá tính khả thi mục tiêu thể hình dựa trên nguyên lý khoa học thể thao (ACSM & NSCA)
 */
export function evaluateGoalFeasibility(input: FeasibilityInput): FeasibilityAssessment {
  const {
    goalType,
    targetValue,
    targetUnit = 'kg',
    durationWeeks,
    customerMeta,
    latestInbody,
  } = input;

  const weeks = Math.max(1, durationWeeks || 12);
  const target = Math.max(0.1, targetValue || 0);

  // Lấy cân nặng hiện tại
  const currentWeight =
    latestInbody?.weight || customerMeta?.initialWeight || 65;
  const currentBfp = latestInbody?.bodyFatPercentage || 22;
  const bmr = latestInbody?.bmr || (customerMeta?.gender === 'FEMALE' ? 1300 : 1600);

  // Tốc độ thay đổi mỗi tuần
  const weeklyRate = parseFloat((target / weeks).toFixed(2));

  // 1. GIẢM MỠ & GIẢM CÂN (FAT_LOSS / WEIGHT_LOSS)
  if (goalType === 'FAT_LOSS' || goalType === 'WEIGHT_LOSS') {
    if (targetUnit === 'kg') {
      // 1kg mỡ ~= 7700 kcal
      const dailyDeficit = Math.round((weeklyRate * 7700) / 7);
      const safeMaxRate = 0.8; // 0.8 kg/tuần chuẩn y khoa
      const maxChallengingRate = 1.25; // 1.25 kg/tuần là ngưỡng cực đại

      // Tính % trọng lượng cơ thể giảm mỗi tuần
      const weeklyWeightPct = (weeklyRate / currentWeight) * 100;

      if (weeklyRate > maxChallengingRate || weeklyWeightPct > 1.8 || dailyDeficit > 1300) {
        const recommendedWeeks = Math.ceil(target / 0.6);
        const recommendedTarget = parseFloat((weeks * 0.6).toFixed(1));

        return {
          status: 'INFEASIBLE',
          badgeLabel: 'BẤT KHẢ THI',
          badgeColor: '#ef4444',
          headline: `Mục tiêu giảm ${target} kg trong ${weeks} tuần (${weeklyRate} kg/tuần) vượt ngưỡng an toàn sinh lý học!`,
          weeklyRate,
          weeklyRateUnit: 'kg/tuần',
          safeWeeklyRateMax: safeMaxRate,
          dailyCalorieImpact: -dailyDeficit,
          reasons: [
            `Tốc độ giảm ${weeklyRate} kg/tuần đòi hỏi mức thâm hụt tới ~${dailyDeficit.toLocaleString()} kcal/ngày.`,
            `Lượng calo cho phép nạp vào sẽ rơi xuống dưới ngưỡng BMR (${bmr} kcal), kích hoạt cơ chế sinh tồn "Starvation Mode".`,
            `Cơ thể sẽ dị hóa cơ bắp nghiêm trọng, suy giảm trao đổi chất (Metabolic Adaptation) và giảm hormone giáp T3.`,
          ],
          risks: [
            'Mất khối lượng cơ nạc (Muscle Wasting) và chảy xệ da.',
            'Hạ đường huyết, chóng mặt, rụng tóc và rối loạn nội tiết tố.',
            'Nguy cơ hiệu ứng Yo-Yo (tăng cân trở lại gấp đôi sau khi dừng ăn kiêng).',
          ],
          recommendations: [
            `Kéo dài lộ trình lên ${recommendedWeeks} tuần với tốc độ an toàn 0.5 - 0.7 kg/tuần.`,
            `Hoặc điều chỉnh mục tiêu khả thi trong ${weeks} tuần xuống khoảng ${recommendedTarget} kg.`,
          ],
          recommendedWeeks,
          recommendedTarget,
        };
      }

      if (weeklyRate > safeMaxRate || dailyDeficit > 850) {
        const recommendedWeeks = Math.ceil(target / 0.7);
        const recommendedTarget = parseFloat((weeks * 0.7).toFixed(1));

        return {
          status: 'CHALLENGING',
          badgeLabel: 'KHÁ THÁCH THỨC',
          badgeColor: '#f59e0b',
          headline: `Tốc độ giảm ${weeklyRate} kg/tuần ở mức cao, đòi hỏi kỷ luật dinh dưỡng & tập luyện rất nghiêm ngặt.`,
          weeklyRate,
          weeklyRateUnit: 'kg/tuần',
          safeWeeklyRateMax: safeMaxRate,
          dailyCalorieImpact: -dailyDeficit,
          reasons: [
            `Thâm hụt calo yêu cầu ~${dailyDeficit} kcal/ngày, học viên cần bổ sung đủ Protein (1.8 - 2.2g/kg) để giữ cơ.`,
            `Cần theo dõi sát chỉ số InBody mỗi 2-4 tuần để tránh dị hóa cơ.`,
          ],
          recommendations: [
            `Giữ mức thâm hụt ổn định 500 - 700 kcal kết hợp Cardio Zone 2 sau buổi tập tạ.`,
            `Nếu cảm thấy kiệt sức, có thể giãn thời gian lên ${recommendedWeeks} tuần.`,
          ],
          recommendedWeeks,
          recommendedTarget,
        };
      }

      return {
        status: 'FEASIBLE',
        badgeLabel: 'HOÀN TOÀN KHẢ THI',
        badgeColor: '#10b981',
        headline: `Mục tiêu giảm ${target} kg trong ${weeks} tuần (${weeklyRate} kg/tuần) đạt chuẩn khoa học thể thao vàng!`,
        weeklyRate,
        weeklyRateUnit: 'kg/tuần',
        safeWeeklyRateMax: safeMaxRate,
        dailyCalorieImpact: -dailyDeficit,
        reasons: [
          `Tốc độ giảm ${weeklyRate} kg/tuần nằm trong ngưỡng lý tưởng 0.3 - 0.7 kg/tuần.`,
          `Mức thâm hụt calo ~${dailyDeficit} kcal/ngày hoàn toàn tự nhiên, không gây ức chế trao đổi chất và bảo tồn cơ tối đa.`,
        ],
        recommendations: [
          `Duy trì mức thâm hụt calo nhẹ nhàng, bổ sung đầy đủ nước và chất xơ.`,
          `Tập luyện kháng lực đều đặn ${input.sessionsPerWeek} buổi/tuần để định hình cơ thể.`,
        ],
      };
    }

    if (targetUnit === '% mỡ') {
      const weeklyBfpDrop = parseFloat((target / weeks).toFixed(2));
      if (weeklyBfpDrop > 0.8) {
        const recommendedWeeks = Math.ceil(target / 0.4);
        return {
          status: 'INFEASIBLE',
          badgeLabel: 'BẤT KHẢ THI',
          badgeColor: '#ef4444',
          headline: `Giảm ${target}% mỡ trong ${weeks} tuần (${weeklyBfpDrop}%/tuần) là phi thực tế!`,
          weeklyRate: weeklyBfpDrop,
          weeklyRateUnit: '% mỡ/tuần',
          safeWeeklyRateMax: 0.4,
          dailyCalorieImpact: -900,
          reasons: [
            `Tốc độ giảm mỡ tự nhiên tối đa của con người không vượt quá 0.3% - 0.5% mỡ/tuần.`,
            `Hiện tại cơ thể đang ở ${currentBfp}% mỡ, giảm quá nhanh sẽ gây mất nước và mất cơ chứ không phải mỡ thực tế.`,
          ],
          recommendations: [
            `Khuyến nghị lộ trình tối thiểu ${recommendedWeeks} tuần để giảm ${target}% mỡ bền vững.`,
          ],
          recommendedWeeks,
          recommendedTarget: parseFloat((weeks * 0.4).toFixed(1)),
        };
      }
    }
  }

  // 2. TĂNG CƠ NẠC (MUSCLE_GAIN)
  if (goalType === 'MUSCLE_GAIN') {
    const safeMaxRate = 0.25; // 0.25 kg cơ/tuần (~1 kg cơ/tháng là cực đại tự nhiên)
    const dailySurplus = Math.round(weeklyRate * 1500);

    if (weeklyRate > 0.45) {
      const recommendedWeeks = Math.ceil(target / 0.2);
      const recommendedTarget = parseFloat((weeks * 0.2).toFixed(1));

      return {
        status: 'INFEASIBLE',
        badgeLabel: 'BẤT KHẢ THI',
        badgeColor: '#ef4444',
        headline: `Mục tiêu tăng ${target} kg cơ trong ${weeks} tuần (${weeklyRate} kg/tuần) vượt trần sinh học tự nhiên!`,
        weeklyRate,
        weeklyRateUnit: 'kg cơ/tuần',
        safeWeeklyRateMax: safeMaxRate,
        dailyCalorieImpact: dailySurplus,
        reasons: [
          `Về mặt sinh học tự nhiên (Natural Bodybuilding), tốc độ tổng hợp protein cơ bắp tối đa của người mới tập chỉ khoảng 0.2 - 0.25 kg cơ/tuần (~1kg/tháng).`,
          `Nếu tăng cân với tốc độ ${weeklyRate} kg/tuần, trên 70% khối lượng tăng thêm sẽ là MỠ thừa và tích nước, không phải cơ nạc.`,
        ],
        risks: [
          'Tích tụ mỡ nội tạng và kháng Insulin do ăn dư thừa calo quá mức.',
          'Rạn da và tăng áp lực lên hệ tim mạch, khớp xương.',
        ],
        recommendations: [
          `Điều chỉnh thời gian lên ${recommendedWeeks} tuần để xây dựng cơ nạc chất lượng (Lean Bulk).`,
          `Hoặc đặt mục tiêu tăng khoảng ${recommendedTarget} kg cơ trong ${weeks} tuần này.`,
        ],
        recommendedWeeks,
        recommendedTarget,
      };
    }

    if (weeklyRate > safeMaxRate) {
      return {
        status: 'CHALLENGING',
        badgeLabel: 'KHÁ THÁCH THỨC',
        badgeColor: '#f59e0b',
        headline: `Tốc độ tăng cơ ${weeklyRate} kg/tuần đòi hỏi thặng dư calo kiểm soát chặt chẽ để tránh tăng mỡ thừa.`,
        weeklyRate,
        weeklyRateUnit: 'kg cơ/tuần',
        safeWeeklyRateMax: safeMaxRate,
        dailyCalorieImpact: dailySurplus,
        reasons: [
          `Cần nạp thặng dư khoảng 300 - 400 kcal/ngày và tối thiểu 2.0g Protein/kg trọng lượng cơ thể.`,
          `Phải áp dụng nguyên tắc Quá tải lũy tiến (Progressive Overload) liên tục mỗi tuần.`,
        ],
        recommendations: [
          `Tập trung vào các bài tập compound lớn (Squat, Deadlift, Bench Press) để kích thích hormone đồng hóa tự nhiên.`,
        ],
        recommendedWeeks: Math.ceil(target / 0.22),
        recommendedTarget: parseFloat((weeks * 0.22).toFixed(1)),
      };
    }

    return {
      status: 'FEASIBLE',
      badgeLabel: 'HOÀN TOÀN KHẢ THI',
      badgeColor: '#10b981',
      headline: `Mục tiêu tăng ${target} kg cơ trong ${weeks} tuần (${weeklyRate} kg/tuần) rất khoa học và tối ưu cơ nạc!`,
      weeklyRate,
      weeklyRateUnit: 'kg cơ/tuần',
      safeWeeklyRateMax: safeMaxRate,
      dailyCalorieImpact: 250,
      reasons: [
        `Tốc độ tăng cơ nạc vừa phải giúp học viên hạn chế tối đa tích mỡ, duy trì vóc dáng săn chắc.`,
        `Thặng dư calo nhẹ 200 - 300 kcal/ngày tạo môi trường đồng hóa tối ưu mà không gây áp lực hệ tiêu hóa.`,
      ],
      recommendations: [
        `Đảm bảo nạp đủ 1.6 - 2.0g Protein/kg và ngủ đủ 7-8 tiếng mỗi đêm để cơ bắp phục hồi.`,
      ],
    };
  }

  // 3. TÁI CẤU TRÚC VÓC DÁNG (RECOMPOSITION)
  if (goalType === 'RECOMPOSITION') {
    if (weeks < 8) {
      return {
        status: 'INFEASIBLE',
        badgeLabel: 'BẤT KHẢ THI',
        badgeColor: '#ef4444',
        headline: `Tái cấu trúc vóc dáng (vừa giảm mỡ vừa tăng cơ) đòi hỏi tối thiểu 8 - 12 tuần!`,
        weeklyRate,
        weeklyRateUnit: 'kg/tuần',
        safeWeeklyRateMax: 0.5,
        dailyCalorieImpact: 0,
        reasons: [
          `Recomposition là quá trình chuyển hóa phức tạp, cần thời gian để cơ thể vừa đốt mỡ vừa xây dựng mô cơ mới.`,
          `Thời gian ${weeks} tuần là quá ngắn để thấy sự biến đổi rõ rệt của mô cơ và mô mỡ song hành.`,
        ],
        recommendations: [
          `Khuyến nghị nâng thời gian lộ trình lên ít nhất 8 hoặc 12 tuần.`,
        ],
        recommendedWeeks: 12,
      };
    }

    return {
      status: 'FEASIBLE',
      badgeLabel: 'HOÀN TOÀN KHẢ THI',
      badgeColor: '#10b981',
      headline: `Lộ trình ${weeks} tuần phù hợp lý tưởng cho mục tiêu Tái cấu trúc vóc dáng (Body Recomposition)!`,
      weeklyRate,
      weeklyRateUnit: 'kg/tuần',
      safeWeeklyRateMax: 0.5,
      dailyCalorieImpact: -150,
      reasons: [
        `Áp dụng chế độ Calorie Cycling: ăn đủ calo ngày tập nặng và thâm hụt nhẹ ngày nghỉ.`,
        `Tối ưu hóa thể trạng cho học viên có % mỡ trung bình (${currentBfp}%) muốn săn chắc toàn thân.`,
      ],
      recommendations: [
        `Ưu tiên tập tạ nặng kích thích cơ bắp kết hợp nạp 2.0g Protein/kg.`,
      ],
    };
  }

  // Mặc định khả thi cho các mục tiêu Thể lực & Sức mạnh
  return {
    status: 'FEASIBLE',
    badgeLabel: 'HOÀN TOÀN KHẢ THI',
    badgeColor: '#10b981',
    headline: `Mục tiêu phù hợp với chu kỳ huấn luyện ${weeks} tuần (${input.sessionsPerWeek} buổi/tuần).`,
    weeklyRate,
    weeklyRateUnit: 'điểm/tuần',
    safeWeeklyRateMax: 1,
    dailyCalorieImpact: 0,
    reasons: [
      `Chu kỳ ${weeks} tuần đủ để cơ thể thích nghi thần kinh cơ (Neuromuscular Adaptation) và gia tăng sức mạnh.`,
    ],
    recommendations: [
      `Tập trung kiểm soát kỹ thuật động tác chuẩn xác trước khi nâng tạ nặng.`,
    ],
  };
}
