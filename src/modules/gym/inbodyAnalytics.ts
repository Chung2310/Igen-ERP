import type { GymRecord } from "../../../shared/gym/types";

export interface MetricClassification {
  status: "UNDER" | "NORMAL" | "OVER";
  label: string;
  tone: "info" | "success" | "warning" | "danger";
  description: string;
}

export interface HealthAlert {
  id: string;
  title: string;
  desc: string;
  level: "warning" | "danger";
}

export interface InBodyComparison {
  daysBetween: number;
  deltaWeight: number;
  deltaFatPercentage: number;
  deltaFatMass: number | null;
  deltaMuscleMass: number;
  deltaVisceralFat: number;
  deltaScore: number;
  trendSummary: string;
  trendType: "EXCELLENT" | "GOOD" | "NEUTRAL" | "NEEDS_ADJUSTMENT";
}

export interface InBodyGoalAlignment {
  goal: GymRecord;
  goalTypeLabel: string;
  progressStatus: "ON_TRACK" | "NEEDS_FOCUS";
  statusSummary: string;
  recommendation: string;
}

export interface InBodyAnalysisResult {
  classifications: {
    bmi?: MetricClassification;
    bodyFat?: MetricClassification;
    visceralFat?: MetricClassification;
    inbodyScore?: MetricClassification;
  };
  strengths: string[];
  improvements: string[];
  priorities: string[];
  alerts: HealthAlert[];
  segmentalAnalysis: {
    muscleImbalanceArm: { hasImbalance: boolean; diffPct: number; note: string };
    muscleImbalanceLeg: { hasImbalance: boolean; diffPct: number; note: string };
    trunkSummary: string;
  };
  consultationGuide: {
    talkingPoints: string[];
    nutritionAdvice: string;
    workoutAdvice: string;
    targetCaloriesRecommendation: {
      maintenance: number;
      fatLoss: number;
      muscleGain: number;
    };
    proteinRecommendation: string;
    waterRecommendation: string;
  };
  quickMessage: string;
  comparison: InBodyComparison | null;
  goalAlignment: InBodyGoalAlignment | null;
}

export function classifyBmi(bmi: number | null | undefined): MetricClassification | undefined {
  if (bmi == null || !Number.isFinite(bmi) || bmi <= 0) return undefined;
  if (bmi < 18.5) {
    return {
      status: "UNDER",
      label: "Thiếu cân",
      tone: "info",
      description: "Cần bổ sung dinh dưỡng để đạt cân nặng tiêu chuẩn.",
    };
  }
  if (bmi <= 22.9) {
    return {
      status: "NORMAL",
      label: "Bình thường",
      tone: "success",
      description: "Chỉ số BMI chuẩn cho người Châu Á.",
    };
  }
  if (bmi <= 24.9) {
    return {
      status: "OVER",
      label: "Tiền béo phì",
      tone: "warning",
      description: "Hơi vượt chuẩn, cần kết hợp tập luyện và kiểm soát khẩu phần.",
    };
  }
  return {
    status: "OVER",
    label: "Béo phì",
    tone: "danger",
    description: "Cần can thiệp lộ trình giảm mỡ khoa học để tránh nguy cơ chuyển hóa.",
  };
}

export function classifyBodyFat(
  pct: number | null | undefined,
  gender = "MALE",
): MetricClassification | undefined {
  if (pct == null || !Number.isFinite(pct) || pct <= 0) return undefined;
  const isFemale = gender.toUpperCase() === "FEMALE" || gender.toUpperCase() === "NỮ";

  if (isFemale) {
    if (pct < 18)
      return {
        status: "UNDER",
        label: "Rất thấp (VĐV)",
        tone: "info",
        description: "Tỷ lệ mỡ rất thấp, cần chú ý nội tiết tố nữ.",
      };
    if (pct <= 28)
      return {
        status: "NORMAL",
        label: "Lý tưởng",
        tone: "success",
        description: "Tỷ lệ mỡ chuẩn khỏe đẹp cho nữ giới.",
      };
    if (pct <= 32)
      return {
        status: "OVER",
        label: "Hơi thừa mỡ",
        tone: "warning",
        description: "Hơi cao so với chuẩn, nên siết nhẹ mỡ thừa.",
      };
    return {
      status: "OVER",
      label: "Mỡ cao",
      tone: "danger",
      description: "Mỡ cơ thể cao, cần chương trình tập & thâm hụt calo tích cực.",
    };
  }

  if (pct < 10)
    return {
      status: "UNDER",
      label: "Rất thấp (VĐV)",
      tone: "info",
      description: "Mỡ rất thấp, thể trạng vận động viên thi đấu.",
    };
  if (pct <= 20)
    return {
      status: "NORMAL",
      label: "Lý tưởng",
      tone: "success",
      description: "Tỷ lệ mỡ chuẩn phong độ cho nam giới.",
    };
  if (pct <= 25)
    return {
      status: "OVER",
      label: "Hơi thừa mỡ",
      tone: "warning",
      description: "Mỡ hơi cao, bắt đầu tích tụ vùng bụng.",
    };
  return {
    status: "OVER",
    label: "Mỡ cao",
    tone: "danger",
    description: "Mỡ cơ thể cao, cần ưu tiên giảm mỡ toàn thân.",
  };
}

export function classifyVisceralFat(
  level: number | null | undefined,
): MetricClassification | undefined {
  if (level == null || !Number.isFinite(level) || level <= 0) return undefined;
  if (level <= 5)
    return {
      status: "NORMAL",
      label: "Lý tưởng",
      tone: "success",
      description: "Mỡ nội tạng rất tốt, cơ quan nội tạng hoạt động tối ưu.",
    };
  if (level <= 9)
    return {
      status: "NORMAL",
      label: "Bình thường",
      tone: "warning",
      description: "Trong ngưỡng an toàn nhưng cần duy trì lối sống lành mạnh.",
    };
  if (level <= 14)
    return {
      status: "OVER",
      label: "Nguy cơ cao",
      tone: "danger",
      description: "Mỡ nội tạng mức báo động, nguy cơ gan nhiễm mỡ & tim mạch.",
    };
  return {
    status: "OVER",
    label: "Nguy hiểm",
    tone: "danger",
    description: "Mỡ nội tạng cực kỳ cao, bắt buộc phải giảm mỡ ngay.",
  };
}

export function classifyInbodyScore(
  score: number | null | undefined,
): MetricClassification | undefined {
  if (score == null || !Number.isFinite(score) || score <= 0) return undefined;
  if (score >= 80)
    return {
      status: "NORMAL",
      label: "Xuất sắc",
      tone: "success",
      description: "Thể chất tuyệt vời, cơ bắp săn chắc và tỷ lệ mỡ lý tưởng.",
    };
  if (score >= 70)
    return {
      status: "NORMAL",
      label: "Khá tốt",
      tone: "info",
      description: "Thể chất đạt chuẩn, tiếp tục rèn luyện để tối ưu thêm.",
    };
  if (score >= 60)
    return {
      status: "UNDER",
      label: "Trung bình",
      tone: "warning",
      description: "Cần cải thiện thêm khối lượng cơ bắp hoặc giảm bớt mỡ thừa.",
    };
  return {
    status: "UNDER",
    label: "Cần cải thiện",
    tone: "danger",
    description: "Thể chất yếu hoặc tỷ lệ mỡ/cơ mất cân bằng đáng kể.",
  };
}

export function analyzeInBody(
  current: GymRecord,
  previous?: GymRecord | null,
  customerMeta?: { fullName?: string; gender?: string; height?: number; phone?: string },
  customerGoal?: GymRecord | null,
): InBodyAnalysisResult {
  const gender = customerMeta?.gender || "MALE";
  const fullName = customerMeta?.fullName || "Học viên";
  const isFemale = gender.toUpperCase() === "FEMALE" || gender.toUpperCase() === "NỮ";

  const bmiClass = classifyBmi(current.bmi);
  const bodyFatClass = classifyBodyFat(current.bodyFatPercentage, gender);
  const visceralFatClass = classifyVisceralFat(current.visceralFatLevel);
  const inbodyScoreClass = classifyInbodyScore(current.inbodyScore);

  const strengths: string[] = [];
  const improvements: string[] = [];
  const priorities: string[] = [];
  const alerts: HealthAlert[] = [];

  const weight = Number(current.weight || 0);
  const muscleMass = Number(current.muscleMass || 0);
  const muscleRatio = weight > 0 && muscleMass > 0 ? (muscleMass / weight) * 100 : null;

  if (muscleRatio) {
    if ((!isFemale && muscleRatio >= 45) || (isFemale && muscleRatio >= 36)) {
      strengths.push(
        `Khối lượng cơ xương phát triển rất tốt (${muscleMass} kg ~ ${muscleRatio.toFixed(1)}% trọng lượng cơ thể).`,
      );
    } else if ((!isFemale && muscleRatio < 38) || (isFemale && muscleRatio < 30)) {
      improvements.push(
        `Khối lượng cơ xương còn thấp (${muscleMass} kg ~ ${muscleRatio.toFixed(1)}%), nguy cơ suy giảm cơ bắp và trao đổi chất chậm.`,
      );
      priorities.push(
        "Ưu tiên xây dựng khối lượng cơ bắp nền tảng (Hypertrophy Training) và tăng nạp Protein.",
      );
    }
  }

  if (current.bmr) {
    if (current.bmr >= (isFemale ? 1300 : 1600)) {
      strengths.push(
        `Tỷ lệ trao đổi chất cơ bản (BMR: ${current.bmr} kcal) ở mức tốt, giúp đốt calo tự nhiên hiệu quả.`,
      );
    } else {
      improvements.push(
        `BMR ở mức thấp (${current.bmr} kcal), cơ thể dễ tích mỡ nếu ăn dư calo.`,
      );
    }
  }

  if (current.bodyFatPercentage != null) {
    if (bodyFatClass?.status === "NORMAL") {
      strengths.push(
        `Tỷ lệ mỡ cơ thể (${current.bodyFatPercentage}%) nằm trong ngưỡng lý tưởng & khỏe mạnh.`,
      );
    } else if (bodyFatClass?.status === "OVER") {
      improvements.push(
        `Tỷ lệ mỡ cơ thể (${current.bodyFatPercentage}%) vượt chuẩn, cần chiến lược thâm hụt calo kiểm soát.`,
      );
      if (current.bodyFatPercentage >= (isFemale ? 32 : 25)) {
        alerts.push({
          id: "alert-high-fat",
          title: "Tỷ lệ mỡ cơ thể cao",
          desc: `Tỷ lệ mỡ ${current.bodyFatPercentage}% đang ở mức báo động, ảnh hưởng tiêu cực đến sức bền và vóc dáng.`,
          level: "danger",
        });
      }
    }
  }

  if (current.visceralFatLevel != null) {
    if (current.visceralFatLevel <= 5) {
      strengths.push(
        `Mỡ nội tạng (Level ${current.visceralFatLevel}) ở ngưỡng an toàn xuất sắc, bảo vệ tim mạch tốt.`,
      );
    } else if (current.visceralFatLevel >= 10) {
      improvements.push(
        `Mỡ nội tạng (Level ${current.visceralFatLevel}) ở mức nguy hiểm! Nguy cơ cao gan nhiễm mỡ, mỡ máu và tim mạch.`,
      );
      priorities.push(
        "CẤP BÁCH: Giảm mỡ nội tạng thông qua dinh dưỡng hạn chế đường/rượu bia kết hợp Cardio Zone 2.",
      );
      alerts.push({
        id: "alert-visceral-danger",
        title: `Mỡ nội tạng ở mức nguy cơ cao (Level ${current.visceralFatLevel})`,
        desc: "Mức mỡ nội tạng >= 10 gây áp lực trực tiếp lên các cơ quan nội tạng. PT cần giải thích rõ nguy cơ cho học viên.",
        level: "danger",
      });
    } else if (current.visceralFatLevel >= 7) {
      improvements.push(
        `Mỡ nội tạng (Level ${current.visceralFatLevel}) đang chớm ngưỡng cảnh báo, cần lưu ý chế độ ăn.`,
      );
      alerts.push({
        id: "alert-visceral-warning",
        title: `Mỡ nội tạng chớm cao (Level ${current.visceralFatLevel})`,
        desc: "Nên kiểm soát đồ ngọt, đồ chiên xào và tăng cường cardio nhẹ nhàng hàng tuần.",
        level: "warning",
      });
    }
  }

  if (current.inbodyScore != null && current.inbodyScore >= 80) {
    strengths.push(
      `Điểm InBody tổng thể đạt ${current.inbodyScore}/100 - Xếp loại xuất sắc.`,
    );
  }

  const sm = current.segmentalMuscle;
  let armImbalance = { hasImbalance: false, diffPct: 0, note: "" };
  let legImbalance = { hasImbalance: false, diffPct: 0, note: "" };

  if (sm?.rightArm && sm?.leftArm) {
    const diff = Math.abs(sm.rightArm - sm.leftArm);
    const maxArm = Math.max(sm.rightArm, sm.leftArm);
    const diffPct = maxArm > 0 ? (diff / maxArm) * 100 : 0;
    if (diffPct > 8) {
      armImbalance = {
        hasImbalance: true,
        diffPct: Number(diffPct.toFixed(1)),
        note: `Cơ tay ${sm.rightArm > sm.leftArm ? "Phải" : "Trái"} khỏe hơn tay đối diện ${diffPct.toFixed(1)}%.`,
      };
      improvements.push(
        `Lệch cơ chi trên: Cơ tay ${sm.rightArm > sm.leftArm ? "Phải" : "Trái"} trội hơn ${diffPct.toFixed(1)}%.`,
      );
      priorities.push(
        "Bổ sung các bài tập đơn lập (Unilateral Training: Dumbbell curl, Single arm press) để cân bằng lực 2 tay.",
      );
    } else {
      strengths.push("Cơ 2 bên tay phát triển cân đối và đồng đều.");
    }
  }

  if (sm?.rightLeg && sm?.leftLeg) {
    const diff = Math.abs(sm.rightLeg - sm.leftLeg);
    const maxLeg = Math.max(sm.rightLeg, sm.leftLeg);
    const diffPct = maxLeg > 0 ? (diff / maxLeg) * 100 : 0;
    if (diffPct > 8) {
      legImbalance = {
        hasImbalance: true,
        diffPct: Number(diffPct.toFixed(1)),
        note: `Cơ chân ${sm.rightLeg > sm.leftLeg ? "Phải" : "Trái"} phát triển hơn ${diffPct.toFixed(1)}%.`,
      };
      improvements.push(
        `Lệch cơ chi dưới: Chân ${sm.rightLeg > sm.leftLeg ? "Phải" : "Trái"} lệch ${diffPct.toFixed(1)}%.`,
      );
      priorities.push(
        "Cần tập thêm Bulgarian Split Squat, Single Leg Press để tránh áp lực lệch khớp gối & hông.",
      );
    } else {
      strengths.push("Cơ 2 bên chân phát triển cân xứng.");
    }
  }

  if (priorities.length === 0) {
    if (bodyFatClass?.status === "OVER") {
      priorities.push(
        "Ưu tiên giảm tỷ lệ mỡ cơ thể về mức lý tưởng thông qua thâm hụt calo 300-500 kcal/ngày.",
      );
    } else if (bmiClass?.status === "UNDER") {
      priorities.push(
        "Ưu tiên tăng cân an toàn và tăng khối lượng cơ nạc (Hypertrophy + Caloric Surplus nhẹ).",
      );
    } else {
      priorities.push(
        "Duy trì thể trạng lý tưởng, tối ưu hóa sức mạnh và độ săn chắc cơ bắp.",
      );
    }
  }

  const bmrValue = current.bmr || (weight > 0 ? Math.round(weight * 22) : 1500);
  const maintenanceCal = Math.round(bmrValue * 1.45);
  const fatLossCal = Math.max(1200, maintenanceCal - 400);
  const muscleGainCal = maintenanceCal + 300;
  const proteinGramMin = weight > 0 ? Math.round(weight * 1.6) : 90;
  const proteinGramMax = weight > 0 ? Math.round(weight * 2.0) : 120;
  const proteinRecommendation = `${proteinGramMin} - ${proteinGramMax}g Protein mỗi ngày (~${proteinGramMin * 4} - ${proteinGramMax * 4} kcal)`;
  const waterLiters = weight > 0 ? (weight * 0.04).toFixed(1) : "2.5";
  const waterRecommendation = `Uống tối thiểu ${waterLiters} lít nước lọc mỗi ngày để hỗ trợ trao đổi chất.`;

  let goalAlignment: InBodyGoalAlignment | null = null;
  if (customerGoal && customerGoal.title) {
    const goalType = customerGoal.type || "WEIGHT_LOSS";
    const goalTypeLabel =
      goalType === "FAT_LOSS"
        ? "Giảm mỡ"
        : goalType === "MUSCLE_GAIN"
          ? "Tăng cơ"
          : goalType === "WEIGHT_GAIN"
            ? "Tăng cân"
            : goalType === "RECOMPOSITION"
              ? "Tái cấu trúc cơ thể"
              : goalType === "FITNESS"
                ? "Thể lực & Sức bền"
                : "Giảm cân";
    let progressStatus: "ON_TRACK" | "NEEDS_FOCUS" = "ON_TRACK";
    let statusSummary = `Mục tiêu "${customerGoal.title}" đang được theo dõi sát sao.`;
    let recommendation = `Duy trì lịch tập ${customerGoal.sessionsPerWeek || 3} buổi/tuần theo kế hoạch.`;

    if (goalType === "WEIGHT_LOSS" || goalType === "FAT_LOSS") {
      if (
        previous &&
        (current.weight < previous.weight ||
          (current.bodyFatPercentage != null &&
            previous.bodyFatPercentage != null &&
            current.bodyFatPercentage < previous.bodyFatPercentage))
      ) {
        progressStatus = "ON_TRACK";
        statusSummary = `Tiến độ rất tích cực! Cơ thể đang giảm mỡ/giảm cân đúng hướng mục tiêu "${customerGoal.title}".`;
      } else if (bodyFatClass?.status === "OVER") {
        progressStatus = "NEEDS_FOCUS";
        statusSummary = `Tỷ lệ mỡ hiện tại (${current.bodyFatPercentage}%) cần tập trung siết chặt thâm hụt calo để đạt mốc mục tiêu.`;
      }
      recommendation = `Ưu tiên thâm hụt calo (${fatLossCal} kcal/ngày), kết hợp ${customerGoal.sessionsPerWeek || 3} buổi tập và ${customerGoal.cardioNotes || "Cardio Zone 2 20-30p"}.`;
    } else if (goalType === "MUSCLE_GAIN") {
      if (
        previous &&
        current.muscleMass != null &&
        previous.muscleMass != null &&
        current.muscleMass > previous.muscleMass
      ) {
        progressStatus = "ON_TRACK";
        statusSummary = `Khối lượng cơ nạc đang tăng trưởng (+${(current.muscleMass - previous.muscleMass).toFixed(1)} kg), bám sát mục tiêu "${customerGoal.title}".`;
      } else {
        progressStatus = "NEEDS_FOCUS";
        statusSummary =
          "Cần kích thích cơ bắp mạnh hơn và tăng cường nạp protein để tối ưu hóa việc tăng cơ.";
      }
      recommendation = `Thặng dư calo nhẹ (${muscleGainCal} kcal/ngày), nạp tối thiểu ${proteinGramMax}g protein mỗi ngày.`;
    }

    goalAlignment = {
      goal: customerGoal,
      goalTypeLabel,
      progressStatus,
      statusSummary,
      recommendation,
    };
    priorities.unshift(`Bám sát mục tiêu "${customerGoal.title}": ${recommendation}`);
  }

  const measureDateLabel = current.measurementDate
    ? new Date(current.measurementDate).toLocaleDateString("vi-VN")
    : "—";

  const talkingPoints = [
    `Chào ${fullName}, hôm nay chúng ta vừa có kết quả đo InBody ngày ${measureDateLabel}.`,
    customerGoal?.title
      ? `Đối chiếu với mục tiêu "${customerGoal.title}": ${goalAlignment?.statusSummary || "Đang bám sát lộ trình."}`
      : null,
    `Điểm mạnh nổi bật nhất của ${fullName} là: ${strengths.slice(0, 2).join("; ") || "Cơ thể có nền tảng thể lực sẵn sàng để tập luyện"}.`,
    improvements.length > 0
      ? `Điểm chúng ta cần tập trung cải thiện trong giai đoạn này: ${improvements.slice(0, 2).join("; ")}.`
      : "Thể trạng của bạn đang rất tốt, mục tiêu tiếp theo là duy trì và nâng cao hiệu suất vận động.",
    `Chiến lược số 1 tôi thiết kế riêng cho bạn là: ${priorities[0]}.`,
  ].filter(Boolean) as string[];

  const nutritionAdvice = `Mục tiêu Calo: ${
    bodyFatClass?.status === "OVER"
      ? `${fatLossCal} kcal/ngày (Thâm hụt kiểm soát để siết mỡ)`
      : bmiClass?.status === "UNDER"
        ? `${muscleGainCal} kcal/ngày (Thặng dư nhẹ để tăng cơ)`
        : `${maintenanceCal} kcal/ngày (Duy trì cân bằng)`
  }. Nạp đủ ${proteinRecommendation}. ${waterRecommendation}`;

  const workoutAdvice = `Lịch tập: ${customerGoal?.sessionsPerWeek || "3-4"} buổi kháng lực/tuần kết hợp ${
    current.visceralFatLevel && current.visceralFatLevel >= 8
      ? "2 buổi Cardio Zone 2 (20-30 phút sau tập tạ) để đốt mỡ nội tạng"
      : "Cardio phục hồi và các bài tập Compound đa khớp"
  }.`;

  let comparison: InBodyComparison | null = null;
  if (previous) {
    const days = Math.max(
      1,
      Math.round(
        (new Date(current.measurementDate).getTime() -
          new Date(previous.measurementDate).getTime()) /
          (1000 * 60 * 60 * 24),
      ),
    );
    const deltaW = Number((Number(current.weight || 0) - Number(previous.weight || 0)).toFixed(1));
    const deltaFat =
      current.bodyFatPercentage != null && previous.bodyFatPercentage != null
        ? Number((current.bodyFatPercentage - previous.bodyFatPercentage).toFixed(1))
        : 0;
    const deltaFatM =
      current.bodyFatMass != null && previous.bodyFatMass != null
        ? Number((current.bodyFatMass - previous.bodyFatMass).toFixed(1))
        : null;
    const deltaM =
      current.muscleMass != null && previous.muscleMass != null
        ? Number((current.muscleMass - previous.muscleMass).toFixed(1))
        : 0;
    const deltaV =
      current.visceralFatLevel != null && previous.visceralFatLevel != null
        ? Number((current.visceralFatLevel - previous.visceralFatLevel).toFixed(1))
        : 0;
    const deltaS =
      current.inbodyScore != null && previous.inbodyScore != null
        ? Number((current.inbodyScore - previous.inbodyScore).toFixed(1))
        : 0;

    let trendType: InBodyComparison["trendType"] = "NEUTRAL";
    let trendSummary = "Chỉ số tương đối ổn định so với lần đo trước.";
    if (deltaM > 0 && deltaFat < 0) {
      trendType = "EXCELLENT";
      trendSummary = `Xuất sắc! Tăng ${deltaM} kg cơ và giảm ${Math.abs(deltaFat)}% mỡ (Body Recomposition cực chuẩn).`;
    } else if (deltaFat < 0) {
      trendType = "GOOD";
      trendSummary = `Tiến bộ tốt! Giảm thành công ${Math.abs(deltaFat)}% mỡ${deltaFatM ? ` (${Math.abs(deltaFatM)}kg mỡ)` : ""}.`;
    } else if (deltaM > 0) {
      trendType = "GOOD";
      trendSummary = `Tăng trưởng tốt! Tăng thêm ${deltaM} kg khối lượng cơ nạc.`;
    } else if (deltaFat > 1.5 && deltaM < 0) {
      trendType = "NEEDS_ADJUSTMENT";
      trendSummary = `Cần điều chỉnh! Có xu hướng tăng ${deltaFat}% mỡ và giảm ${Math.abs(deltaM)} kg cơ. PT cần xem lại dinh dưỡng/nghỉ ngơi.`;
    }

    comparison = {
      daysBetween: days,
      deltaWeight: deltaW,
      deltaFatPercentage: deltaFat,
      deltaFatMass: deltaFatM,
      deltaMuscleMass: deltaM,
      deltaVisceralFat: deltaV,
      deltaScore: deltaS,
      trendSummary,
      trendType,
    };
  }

  const quickMessage = `TỔNG HỢP KẾT QUẢ ĐO INBODY (${measureDateLabel})
Học viên: ${fullName}${customerGoal?.title ? `\nMỤC TIÊU: ${customerGoal.title} — ${goalAlignment?.statusSummary || ""}` : ""}
-------------------------------
CÁC CHỈ SỐ CHÍNH:
• Cân nặng: ${current.weight} kg (${bmiClass?.label || "Chuẩn"})
• Tỷ lệ mỡ (% Body Fat): ${current.bodyFatPercentage != null ? `${current.bodyFatPercentage}%` : "—"} (${bodyFatClass?.label || "—"})
• Khối lượng cơ xương: ${current.muscleMass != null ? `${current.muscleMass} kg` : "—"}
• Mỡ nội tạng: Level ${current.visceralFatLevel ?? "—"} (${visceralFatClass?.label || "—"})
• Điểm InBody: ${current.inbodyScore != null ? `${current.inbodyScore}/100` : "—"}

ĐIỂM MẠNH:
${strengths.map((s) => `✓ ${s}`).join("\n") || "✓ Nền tảng thể chất sẵn sàng"}

ĐIỂM CẦN CẢI THIỆN & ƯU TIÊN:
${priorities.map((p) => `→ ${p}`).join("\n")}

KHUYẾN NGHỊ DINH DƯỠNG & TẬP LUYỆN TỪ PT:
• ${nutritionAdvice}
• ${workoutAdvice}`;

  return {
    classifications: {
      bmi: bmiClass,
      bodyFat: bodyFatClass,
      visceralFat: visceralFatClass,
      inbodyScore: inbodyScoreClass,
    },
    strengths,
    improvements,
    priorities,
    alerts,
    segmentalAnalysis: {
      muscleImbalanceArm: armImbalance,
      muscleImbalanceLeg: legImbalance,
      trunkSummary: sm?.trunk
        ? `Khối lượng cơ thân mình đạt ${sm.trunk} kg.`
        : "Cơ thân mình ổn định.",
    },
    consultationGuide: {
      talkingPoints,
      nutritionAdvice,
      workoutAdvice,
      targetCaloriesRecommendation: {
        maintenance: maintenanceCal,
        fatLoss: fatLossCal,
        muscleGain: muscleGainCal,
      },
      proteinRecommendation,
      waterRecommendation,
    },
    quickMessage,
    comparison,
    goalAlignment,
  };
}
