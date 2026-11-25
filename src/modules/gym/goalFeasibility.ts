export type RoadmapGoalType =
  | "FAT_LOSS"
  | "WEIGHT_LOSS"
  | "MUSCLE_GAIN"
  | "WEIGHT_GAIN"
  | "RECOMPOSITION"
  | "FITNESS"
  | "STRENGTH";

export type FeasibilityStatus = "FEASIBLE" | "CHALLENGING" | "INFEASIBLE";

export interface FeasibilityAssessment {
  status: FeasibilityStatus;
  badgeLabel: string;
  headline: string;
  weeklyRate: number;
  weeklyRateUnit: string;
  dailyCalorieImpact: number;
  reasons: string[];
  recommendations: string[];
  recommendedWeeks?: number;
  recommendedTarget?: number;
}

/**
 * Đánh giá tính khả thi mục tiêu thể hình dựa trên nguyên lý ACSM & NSCA
 * (Ported from 3S-Gym frontend/src/services/goalFeasibilityService.ts)
 */
export function evaluateGoalFeasibility(input: {
  goalType: RoadmapGoalType;
  targetValue: number;
  targetUnit: string;
  durationWeeks: number;
  sessionsPerWeek: number;
  currentWeight?: number | null;
  gender?: string;
}): FeasibilityAssessment {
  const weeks = Math.max(1, input.durationWeeks || 12);
  const target = Math.max(0.1, input.targetValue || 0);
  const currentWeight = input.currentWeight && input.currentWeight > 0 ? input.currentWeight : 65;
  const bmr = input.gender === "FEMALE" ? 1300 : 1600;
  const weeklyRate = Number((target / weeks).toFixed(2));

  if (input.goalType === "FAT_LOSS" || input.goalType === "WEIGHT_LOSS") {
    if (input.targetUnit === "kg") {
      const dailyDeficit = Math.round((weeklyRate * 7700) / 7);
      const weeklyWeightPct = (weeklyRate / currentWeight) * 100;

      if (weeklyRate > 1.25 || weeklyWeightPct > 1.8 || dailyDeficit > 1300) {
        const recommendedWeeks = Math.min(52, Math.ceil(target / 0.6));
        const recommendedTarget = Number((weeks * 0.6).toFixed(1));
        return {
          status: "INFEASIBLE",
          badgeLabel: "Bất khả thi",
          headline: `Giảm ${target} kg trong ${weeks} tuần (${weeklyRate} kg/tuần) vượt ngưỡng an toàn sinh lý học.`,
          weeklyRate,
          weeklyRateUnit: "kg/tuần",
          dailyCalorieImpact: -dailyDeficit,
          reasons: [
            `Đòi hỏi thâm hụt ~${dailyDeficit.toLocaleString("vi-VN")} kcal/ngày, dễ rơi dưới BMR (~${bmr} kcal).`,
            "Nguy cơ mất cơ nạc, suy giảm trao đổi chất và hiệu ứng Yo-Yo.",
          ],
          recommendations: [
            `Kéo dài lộ trình lên ${recommendedWeeks} tuần (~0.6 kg/tuần).`,
            `Hoặc giảm mục tiêu trong ${weeks} tuần xuống ~${recommendedTarget} kg.`,
          ],
          recommendedWeeks,
          recommendedTarget,
        };
      }

      if (weeklyRate > 0.8 || dailyDeficit > 850) {
        const recommendedWeeks = Math.min(52, Math.ceil(target / 0.7));
        const recommendedTarget = Number((weeks * 0.7).toFixed(1));
        return {
          status: "CHALLENGING",
          badgeLabel: "Khá thách thức",
          headline: `Tốc độ giảm ${weeklyRate} kg/tuần ở mức cao, cần kỷ luật dinh dưỡng & tập luyện chặt chẽ.`,
          weeklyRate,
          weeklyRateUnit: "kg/tuần",
          dailyCalorieImpact: -dailyDeficit,
          reasons: [
            `Thâm hụt ~${dailyDeficit.toLocaleString("vi-VN")} kcal/ngày; cần đạm 1.8–2.2g/kg để giữ cơ.`,
          ],
          recommendations: [
            `Theo dõi InBody mỗi 2–4 tuần; có thể giãn lên ${recommendedWeeks} tuần nếu mệt mỏi.`,
          ],
          recommendedWeeks,
          recommendedTarget,
        };
      }

      return {
        status: "FEASIBLE",
        badgeLabel: "Khả thi",
        headline: `Giảm ${target} kg trong ${weeks} tuần (${weeklyRate} kg/tuần) đạt chuẩn an toàn.`,
        weeklyRate,
        weeklyRateUnit: "kg/tuần",
        dailyCalorieImpact: -dailyDeficit,
        reasons: [
          `Thâm hụt ~${dailyDeficit.toLocaleString("vi-VN")} kcal/ngày, bảo tồn cơ tốt.`,
        ],
        recommendations: [
          `Duy trì ${input.sessionsPerWeek} buổi/tuần kết hợp đủ đạm & nước.`,
        ],
      };
    }

    if (input.targetUnit === "% mỡ") {
      if (weeklyRate > 0.8) {
        const recommendedWeeks = Math.min(52, Math.ceil(target / 0.4));
        const recommendedTarget = Number((weeks * 0.4).toFixed(1));
        return {
          status: "INFEASIBLE",
          badgeLabel: "Bất khả thi",
          headline: `Giảm ${target}% mỡ trong ${weeks} tuần (${weeklyRate}%/tuần) vượt tốc độ giảm mỡ tự nhiên.`,
          weeklyRate,
          weeklyRateUnit: "% mỡ/tuần",
          dailyCalorieImpact: -900,
          reasons: [
            "Tốc độ giảm mỡ tự nhiên an toàn khoảng 0.3–0.5% mỡ/tuần.",
          ],
          recommendations: [
            `Kéo dài lộ trình lên tối thiểu ${recommendedWeeks} tuần hoặc giảm mục tiêu xuống ${recommendedTarget}% mỡ.`,
          ],
          recommendedWeeks,
          recommendedTarget,
        };
      }
    }
  }

  if (input.goalType === "MUSCLE_GAIN") {
    const dailySurplus = Math.round(weeklyRate * 1500);
    if (weeklyRate > 0.45) {
      const recommendedWeeks = Math.min(52, Math.ceil(target / 0.2));
      const recommendedTarget = Number((weeks * 0.2).toFixed(1));
      return {
        status: "INFEASIBLE",
        badgeLabel: "Bất khả thi",
        headline: `Tăng ${target} kg cơ trong ${weeks} tuần (${weeklyRate} kg/tuần) vượt trần sinh học tự nhiên.`,
        weeklyRate,
        weeklyRateUnit: "kg cơ/tuần",
        dailyCalorieImpact: dailySurplus,
        reasons: [
          "Tốc độ tổng hợp cơ tự nhiên tối đa ~0.2–0.25 kg/tuần; vượt mức này chủ yếu tích mỡ.",
        ],
        recommendations: [
          `Điều chỉnh thời gian lên ${recommendedWeeks} tuần hoặc mục tiêu ${recommendedTarget} kg cơ.`,
        ],
        recommendedWeeks,
        recommendedTarget,
      };
    }
    if (weeklyRate > 0.25) {
      return {
        status: "CHALLENGING",
        badgeLabel: "Khá thách thức",
        headline: `Tốc độ tăng cơ ${weeklyRate} kg/tuần cần kiểm soát thặng dư calo chặt để hạn chế mỡ thừa.`,
        weeklyRate,
        weeklyRateUnit: "kg cơ/tuần",
        dailyCalorieImpact: dailySurplus,
        reasons: ["Cần thặng dư 300–400 kcal/ngày và đạm ≥ 2.0g/kg."],
        recommendations: ["Áp dụng quá tải lũy tiến (Progressive Overload) đều mỗi tuần."],
        recommendedWeeks: Math.min(52, Math.ceil(target / 0.22)),
        recommendedTarget: Number((weeks * 0.22).toFixed(1)),
      };
    }
  }

  return {
    status: "FEASIBLE",
    badgeLabel: "Khả thi",
    headline: `Mục tiêu phù hợp với lộ trình ${weeks} tuần (${input.sessionsPerWeek} buổi/tuần).`,
    weeklyRate,
    weeklyRateUnit: `${input.targetUnit}/tuần`,
    dailyCalorieImpact: input.goalType === "WEIGHT_GAIN" ? 300 : 0,
    reasons: ["Tốc độ tiến triển hợp lý, đảm bảo phục hồi và duy trì bền vững."],
    recommendations: ["Theo dõi chỉ số định kỳ mỗi 2–4 tuần để tinh chỉnh."],
  };
}
