import type {
  CustomerGoalData,
  HealthAlert,
  InBodyAnalysisResult,
  InBodyComparison,
  InBodyGoalAlignment,
  InBodyRecordData,
  MetricClassification,
} from '../types/inbody';

// 1. Phân loại chỉ số BMI theo chuẩn Châu Á (WPRO/WHO)
export function classifyBmi(bmi: number | null | undefined): MetricClassification | undefined {
  if (bmi == null || !Number.isFinite(bmi) || bmi <= 0) return undefined;
  if (bmi < 18.5) {
    return { status: 'UNDER', label: 'Thiếu cân', badgeClass: 'bg-blue-100 text-blue-800', color: '#0284c7', description: 'Cần bổ sung dinh dưỡng để đạt cân nặng tiêu chuẩn.' };
  }
  if (bmi <= 22.9) {
    return { status: 'NORMAL', label: 'Bình thường', badgeClass: 'bg-emerald-100 text-emerald-800', color: '#16a34a', description: 'Chỉ số BMI chuẩn cho người Châu Á.' };
  }
  if (bmi <= 24.9) {
    return { status: 'OVER', label: 'Tiền béo phì', badgeClass: 'bg-amber-100 text-amber-800', color: '#d97706', description: 'Hơi vượt chuẩn, cần kết hợp tập luyện và kiểm soát khẩu phần.' };
  }
  return { status: 'OVER', label: 'Béo phì', badgeClass: 'bg-rose-100 text-rose-800', color: '#dc2626', description: 'Cần can thiệp lộ trình giảm mỡ khoa học để tránh nguy cơ chuyển hóa.' };
}

// 2. Phân loại Tỷ lệ Mỡ cơ thể (% Body Fat)
export function classifyBodyFat(pct: number | null | undefined, gender: string = 'MALE'): MetricClassification | undefined {
  if (pct == null || !Number.isFinite(pct) || pct <= 0) return undefined;
  const isFemale = gender.toUpperCase() === 'FEMALE' || gender.toUpperCase() === 'NỮ';

  if (isFemale) {
    if (pct < 18) {
      return { status: 'UNDER', label: 'Rất thấp (VĐV)', badgeClass: 'bg-blue-100 text-blue-800', color: '#0284c7', description: 'Tỷ lệ mỡ rất thấp, cần chú ý nội tiết tố nữ.' };
    }
    if (pct <= 28) {
      return { status: 'NORMAL', label: 'Lý tưởng', badgeClass: 'bg-emerald-100 text-emerald-800', color: '#16a34a', description: 'Tỷ lệ mỡ chuẩn khỏe đẹp cho nữ giới.' };
    }
    if (pct <= 32) {
      return { status: 'OVER', label: 'Hơi thừa mỡ', badgeClass: 'bg-amber-100 text-amber-800', color: '#d97706', description: 'Hơi cao so với chuẩn, nên siết nhẹ mỡ thừa.' };
    }
    return { status: 'OVER', label: 'Mỡ cao', badgeClass: 'bg-rose-100 text-rose-800', color: '#dc2626', description: 'Mỡ cơ thể cao, cần chương trình tập & thâm hụt calo tích cực.' };
  } else {
    // MALE / DEFAULT
    if (pct < 10) {
      return { status: 'UNDER', label: 'Rất thấp (VĐV)', badgeClass: 'bg-blue-100 text-blue-800', color: '#0284c7', description: 'Mỡ rất thấp, thể trạng vận động viên thi đấu.' };
    }
    if (pct <= 20) {
      return { status: 'NORMAL', label: 'Lý tưởng', badgeClass: 'bg-emerald-100 text-emerald-800', color: '#16a34a', description: 'Tỷ lệ mỡ chuẩn phong độ cho nam giới.' };
    }
    if (pct <= 25) {
      return { status: 'OVER', label: 'Hơi thừa mỡ', badgeClass: 'bg-amber-100 text-amber-800', color: '#d97706', description: 'Mỡ hơi cao, bắt đầu tích tụ vùng bụng.' };
    }
    return { status: 'OVER', label: 'Mỡ cao', badgeClass: 'bg-rose-100 text-rose-800', color: '#dc2626', description: 'Mỡ cơ thể cao, cần ưu tiên giảm mỡ toàn thân.' };
  }
}

// 3. Phân loại Mỡ Nội Tạng (Visceral Fat Level: 1-20)
export function classifyVisceralFat(level: number | null | undefined): MetricClassification | undefined {
  if (level == null || !Number.isFinite(level) || level <= 0) return undefined;
  if (level <= 5) {
    return { status: 'NORMAL', label: 'Lý tưởng', badgeClass: 'bg-emerald-100 text-emerald-800', color: '#16a34a', description: 'Mỡ nội tạng rất tốt, cơ quan nội tạng hoạt động tối ưu.' };
  }
  if (level <= 9) {
    return { status: 'NORMAL', label: 'Bình thường', badgeClass: 'bg-amber-100 text-amber-800', color: '#d97706', description: 'Trong ngưỡng an toàn nhưng cần duy trì lối sống lành mạnh.' };
  }
  if (level <= 14) {
    return { status: 'OVER', label: 'Nguy cơ cao', badgeClass: 'bg-rose-100 text-rose-800', color: '#dc2626', description: 'Mỡ nội tạng mức báo động, nguy cơ gan nhiễm mỡ & tim mạch.' };
  }
  return { status: 'OVER', label: 'Nguy hiểm', badgeClass: 'bg-rose-200 text-rose-900', color: '#991b1b', description: 'Mỡ nội tạng cực kỳ cao, bắt buộc phải giảm mỡ ngay.' };
}

// 4. Phân loại Điểm InBody Score
export function classifyInbodyScore(score: number | null | undefined): MetricClassification | undefined {
  if (score == null || !Number.isFinite(score) || score <= 0) return undefined;
  if (score >= 80) {
    return { status: 'NORMAL', label: 'Xuất sắc', badgeClass: 'bg-emerald-100 text-emerald-800', color: '#16a34a', description: 'Thể chất tuyệt vời, cơ bắp săn chắc và tỷ lệ mỡ lý tưởng.' };
  }
  if (score >= 70) {
    return { status: 'NORMAL', label: 'Khá tốt', badgeClass: 'bg-blue-100 text-blue-800', color: '#0284c7', description: 'Thể chất đạt chuẩn, tiếp tục rèn luyện để tối ưu thêm.' };
  }
  if (score >= 60) {
    return { status: 'UNDER', label: 'Trung bình', badgeClass: 'bg-amber-100 text-amber-800', color: '#d97706', description: 'Cần cải thiện thêm khối lượng cơ bắp hoặc giảm bớt mỡ thừa.' };
  }
  return { status: 'UNDER', label: 'Cần cải thiện', badgeClass: 'bg-rose-100 text-rose-800', color: '#dc2626', description: 'Thể chất yếu hoặc tỷ lệ mỡ/cơ mất cân bằng đáng kể.' };
}

// 5. Engine phân tích toàn diện InBody
export function analyzeInBody(
  current: InBodyRecordData,
  previous?: InBodyRecordData | null,
  customerMeta?: { fullName?: string; gender?: string; height?: number; phone?: string },
  customerGoal?: CustomerGoalData | null
): InBodyAnalysisResult {
  const gender = customerMeta?.gender || (typeof current.customerId === 'object' && current.customerId?.gender) || 'MALE';
  const fullName = customerMeta?.fullName || (typeof current.customerId === 'object' && current.customerId?.fullName) || 'Học viên';
  const isFemale = gender.toUpperCase() === 'FEMALE' || gender.toUpperCase() === 'NỮ';

  const bmiClass = classifyBmi(current.bmi);
  const bodyFatClass = classifyBodyFat(current.bodyFatPercentage, gender);
  const visceralFatClass = classifyVisceralFat(current.visceralFatLevel);
  const inbodyScoreClass = classifyInbodyScore(current.inbodyScore);

  const strengths: string[] = [];
  const improvements: string[] = [];
  const priorities: string[] = [];
  const alerts: HealthAlert[] = [];

  // Phân tích cơ bắp
  const weight = current.weight || 0;
  const muscleMass = current.muscleMass || 0;
  const muscleRatio = weight > 0 && muscleMass > 0 ? (muscleMass / weight) * 100 : null;

  if (muscleRatio) {
    if ((!isFemale && muscleRatio >= 45) || (isFemale && muscleRatio >= 36)) {
      strengths.push(`Khối lượng cơ xương phát triển rất tốt (${muscleMass} kg ~ ${muscleRatio.toFixed(1)}% trọng lượng cơ thể).`);
    } else if ((!isFemale && muscleRatio < 38) || (isFemale && muscleRatio < 30)) {
      improvements.push(`Khối lượng cơ xương còn thấp (${muscleMass} kg ~ ${muscleRatio.toFixed(1)}%), nguy cơ suy giảm cơ bắp và trao đổi chất chậm.`);
      priorities.push('Ưu tiên xây dựng khối lượng cơ bắp nền tảng (Hypertrophy Training) và tăng nạp Protein.');
    }
  }

  // Phân tích BMR & Trao đổi chất
  if (current.bmr) {
    if (current.bmr >= (isFemale ? 1300 : 1600)) {
      strengths.push(`Tỷ lệ trao đổi chất cơ bản (BMR: ${current.bmr} kcal) ở mức tốt, giúp đốt calo tự nhiên hiệu quả.`);
    } else {
      improvements.push(`BMR ở mức thấp (${current.bmr} kcal), cơ thể dễ tích mỡ nếu ăn dư calo.`);
    }
  }

  // Phân tích % Mỡ & Mỡ nội tạng
  if (current.bodyFatPercentage != null) {
    if (bodyFatClass?.status === 'NORMAL' || bodyFatClass?.label === 'Lý tưởng') {
      strengths.push(`Tỷ lệ mỡ cơ thể (${current.bodyFatPercentage}%) nằm trong ngưỡng lý tưởng & khỏe mạnh.`);
    } else if (bodyFatClass?.status === 'OVER') {
      improvements.push(`Tỷ lệ mỡ cơ thể (${current.bodyFatPercentage}%) vượt chuẩn, cần chiến lược thâm hụt calo kiểm soát.`);
      if (current.bodyFatPercentage >= (isFemale ? 32 : 25)) {
        alerts.push({
          id: 'alert-high-fat',
          title: 'Tỷ lệ mỡ cơ thể cao',
          desc: `Tỷ lệ mỡ ${current.bodyFatPercentage}% đang ở mức báo động, ảnh hưởng tiêu cực đến sức bền và vóc dáng.`,
          level: 'danger',
        });
      }
    }
  }

  // Mỡ nội tạng
  if (current.visceralFatLevel != null) {
    if (current.visceralFatLevel <= 5) {
      strengths.push(`Mỡ nội tạng (Level ${current.visceralFatLevel}) ở ngưỡng an toàn xuất sắc, bảo vệ tim mạch tốt.`);
    } else if (current.visceralFatLevel >= 10) {
      improvements.push(`Mỡ nội tạng (Level ${current.visceralFatLevel}) ở mức nguy hiểm! Nguy cơ cao gan nhiễm mỡ, mỡ máu và tim mạch.`);
      priorities.push('CẤP BÁCH: Giảm mỡ nội tạng thông qua dinh dưỡng hạn chế đường/rượu bia kết hợp Cardio Zone 2.');
      alerts.push({
        id: 'alert-visceral-danger',
        title: 'Mỡ nội tạng ở mức nguy cơ cao (Level ' + current.visceralFatLevel + ')',
        desc: 'Mức mỡ nội tạng >= 10 gây áp lực trực tiếp lên các cơ quan nội tạng. PT cần giải thích rõ nguy cơ cho học viên.',
        level: 'danger',
      });
    } else if (current.visceralFatLevel >= 7) {
      improvements.push(`Mỡ nội tạng (Level ${current.visceralFatLevel}) đang chớm ngưỡng cảnh báo, cần lưu ý chế độ ăn.`);
      alerts.push({
        id: 'alert-visceral-warning',
        title: 'Mỡ nội tạng chớm cao (Level ' + current.visceralFatLevel + ')',
        desc: 'Nên kiểm soát đồ ngọt, đồ chiên xào và tăng cường cardio nhẹ nhàng hàng tuần.',
        level: 'warning',
      });
    }
  }

  // Điểm InBody
  if (current.inbodyScore != null && current.inbodyScore >= 80) {
    strengths.push(`Điểm InBody tổng thể đạt ${current.inbodyScore}/100 - Xếp loại xuất sắc.`);
  }

  // Phân tích lệch cơ từng phần (Segmental Analysis)
  const sm = current.segmentalMuscle;
  let armImbalance = { hasImbalance: false, diffPct: 0, note: '' };
  let legImbalance = { hasImbalance: false, diffPct: 0, note: '' };

  if (sm?.rightArm && sm?.leftArm) {
    const diff = Math.abs(sm.rightArm - sm.leftArm);
    const maxArm = Math.max(sm.rightArm, sm.leftArm);
    const diffPct = maxArm > 0 ? (diff / maxArm) * 100 : 0;
    if (diffPct > 8) {
      armImbalance = {
        hasImbalance: true,
        diffPct: Number(diffPct.toFixed(1)),
        note: `Cơ tay ${sm.rightArm > sm.leftArm ? 'Phải' : 'Trái'} khỏe hơn tay đối diện ${diffPct.toFixed(1)}%.`,
      };
      improvements.push(`Lệch cơ chi trên: Cơ tay ${sm.rightArm > sm.leftArm ? 'Phải' : 'Trái'} trội hơn ${diffPct.toFixed(1)}%.`);
      priorities.push('Bổ sung các bài tập đơn lập (Unilateral Training: Dumbbell curl, Single arm press) để cân bằng lực 2 tay.');
    } else {
      strengths.push('Cơ 2 bên tay phát triển cân đối và đồng đều.');
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
        note: `Cơ chân ${sm.rightLeg > sm.leftLeg ? 'Phải' : 'Trái'} phát triển hơn ${diffPct.toFixed(1)}%.`,
      };
      improvements.push(`Lệch cơ chi dưới: Chân ${sm.rightLeg > sm.leftLeg ? 'Phải' : 'Trái'} lệch ${diffPct.toFixed(1)}%.`);
      priorities.push('Cần tập thêm Bulgarian Split Squat, Single Leg Press để tránh áp lực lệch khớp gối & hông.');
    } else {
      strengths.push('Cơ 2 bên chân phát triển cân xứng.');
    }
  }

  // Nếu chưa có vấn đề ưu tiên cụ thể
  if (priorities.length === 0) {
    if (bodyFatClass?.status === 'OVER') {
      priorities.push('Ưu tiên giảm tỷ lệ mỡ cơ thể về mức lý tưởng thông qua thâm hụt calo 300-500 kcal/ngày.');
    } else if (bmiClass?.status === 'UNDER') {
      priorities.push('Ưu tiên tăng cân an toàn và tăng khối lượng cơ nạc (Hypertrophy + Caloric Surplus nhẹ).');
    } else {
      priorities.push('Duy trì thể trạng lý tưởng, tối ưu hóa sức mạnh và độ săn chắc cơ bắp.');
    }
  }

  // Tính toán calo đề xuất
  const bmrValue = current.bmr || (weight > 0 ? Math.round(weight * 22) : 1500);
  const maintenanceCal = Math.round(bmrValue * 1.45); // TDEE ước lượng vận động vừa
  const fatLossCal = Math.max(1200, maintenanceCal - 400);
  const muscleGainCal = maintenanceCal + 300;

  // Lượng protein đề xuất (1.6 - 2.0g / kg)
  const proteinGramMin = weight > 0 ? Math.round(weight * 1.6) : 90;
  const proteinGramMax = weight > 0 ? Math.round(weight * 2.0) : 120;
  const proteinRecommendation = `${proteinGramMin} - ${proteinGramMax}g Protein mỗi ngày (~${proteinGramMin * 4} - ${proteinGramMax * 4} kcal)`;

  // Lượng nước đề xuất (0.04L / kg)
  const waterLiters = weight > 0 ? (weight * 0.04).toFixed(1) : '2.5';
  const waterRecommendation = `Uống tối thiểu ${waterLiters} lít nước lọc mỗi ngày để hỗ trợ trao đổi chất.`;

  // 4.5. Phân tích đối chiếu Mục tiêu học viên (nếu có)
  let goalAlignment: InBodyGoalAlignment | null = null;
  if (customerGoal && customerGoal.title) {
    const goalType = customerGoal.type || 'WEIGHT_LOSS';
    const goalTypeLabel =
      goalType === 'FAT_LOSS'
        ? 'Giảm mỡ'
        : goalType === 'MUSCLE_GAIN'
        ? 'Tăng cơ'
        : goalType === 'WEIGHT_GAIN'
        ? 'Tăng cân'
        : goalType === 'RECOMPOSITION'
        ? 'Tái cấu trúc cơ thể (Tăng cơ & Giảm mỡ)'
        : goalType === 'FITNESS'
        ? 'Thể lực & Sức bền'
        : 'Giảm cân';

    let progressStatus: InBodyGoalAlignment['progressStatus'] = 'ON_TRACK';
    let statusSummary = `Mục tiêu "${customerGoal.title}" đang được theo dõi sát sao.`;
    let recommendation = `Duy trì lịch tập ${customerGoal.sessionsPerWeek || 3} buổi/tuần theo kế hoạch.`;

    if (goalType === 'WEIGHT_LOSS' || goalType === 'FAT_LOSS') {
      if (previous && (current.weight < previous.weight || (current.bodyFatPercentage != null && previous.bodyFatPercentage != null && current.bodyFatPercentage < previous.bodyFatPercentage))) {
        progressStatus = 'ON_TRACK';
        statusSummary = `Tiến độ rất tích cực! Cơ thể đang giảm mỡ/giảm cân đúng hướng mục tiêu "${customerGoal.title}".`;
      } else if (bodyFatClass?.status === 'OVER') {
        progressStatus = 'NEEDS_FOCUS';
        statusSummary = `Tỷ lệ mỡ hiện tại (${current.bodyFatPercentage}%) cần tập trung siết chặt thâm hụt calo để đạt mốc mục tiêu.`;
      }
      recommendation = `Ưu tiên thâm hụt calo (${fatLossCal} kcal/ngày), kết hợp ${customerGoal.sessionsPerWeek || 3} buổi tập và ${customerGoal.cardioNotes || 'Cardio Zone 2 20-30p'}.`;
    } else if (goalType === 'MUSCLE_GAIN') {
      if (previous && current.muscleMass != null && previous.muscleMass != null && current.muscleMass > previous.muscleMass) {
        progressStatus = 'ON_TRACK';
        statusSummary = `Khối lượng cơ nạc đang tăng trưởng (+${(current.muscleMass - previous.muscleMass).toFixed(1)} kg), bám sát mục tiêu "${customerGoal.title}".`;
      } else {
        progressStatus = 'NEEDS_FOCUS';
        statusSummary = `Cần kích thích cơ bắp mạnh hơn và tăng cường nạp protein để tối ưu hóa việc tăng cơ.`;
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

    // Đưa vào ưu tiên số 1
    priorities.unshift(`🎯 Bám sát mục tiêu "${customerGoal.title}": ${goalAlignment.recommendation}`);
  }

  // Kịch bản tư vấn cho PT (Talking Points)
  const talkingPoints = [
    `Chào ${fullName}, hôm nay chúng ta vừa có kết quả đo InBody ngày ${new Date(current.measurementDate).toLocaleDateString('vi-VN')}.`,
    customerGoal?.title
      ? `🎯 Đối chiếu với mục tiêu "${customerGoal.title}" (Hạn chót: ${customerGoal.deadline ? new Date(customerGoal.deadline).toLocaleDateString('vi-VN') : 'Sắp tới'}): ${goalAlignment?.statusSummary || 'Đang bám sát lộ trình.'}`
      : null,
    `Điểm mạnh nổi bật nhất của ${fullName} là: ${strengths.slice(0, 2).join('; ') || 'Cơ thể có nền tảng thể lực sẵn sàng để tập luyện'}.`,
    improvements.length > 0
      ? `Điểm chúng ta cần tập trung cải thiện trong giai đoạn này: ${improvements.slice(0, 2).join('; ')}.`
      : `Thể trạng của bạn đang rất tốt, mục tiêu tiếp theo là duy trì và nâng cao hiệu suất vận động.`,
    `Chiến lược số 1 tôi thiết kế riêng cho bạn là: ${priorities[0]}.`,
  ].filter(Boolean) as string[];

  const nutritionAdvice = `Mục tiêu Calo: ${
    bodyFatClass?.status === 'OVER'
      ? `${fatLossCal} kcal/ngày (Thâm hụt kiểm soát để siết mỡ)`
      : bmiClass?.status === 'UNDER'
      ? `${muscleGainCal} kcal/ngày (Thặng dư nhẹ để tăng cơ)`
      : `${maintenanceCal} kcal/ngày (Duy trì cân bằng)`
  }. Nạp đủ ${proteinRecommendation}. Uống đủ ${waterRecommendation}.`;

  const workoutAdvice = `Lịch tập: ${customerGoal?.sessionsPerWeek || '3-4'} buổi kháng lực/tuần kết hợp ${
    current.visceralFatLevel && current.visceralFatLevel >= 8
      ? '2 buổi Cardio Zone 2 (20-30 phút sau tập tạ) để đốt mỡ nội tạng'
      : 'Cardio phục hồi và các bài tập Compound đa khớp'
  }.`;

  // So sánh với lần đo trước (nếu có)
  let comparison: InBodyComparison | null = null;
  if (previous) {
    const days = Math.max(1, Math.round((new Date(current.measurementDate).getTime() - new Date(previous.measurementDate).getTime()) / (1000 * 60 * 60 * 24)));
    const deltaW = Number((current.weight - previous.weight).toFixed(1));
    const deltaFat = current.bodyFatPercentage != null && previous.bodyFatPercentage != null ? Number((current.bodyFatPercentage - previous.bodyFatPercentage).toFixed(1)) : 0;
    const deltaFatM = current.bodyFatMass != null && previous.bodyFatMass != null ? Number((current.bodyFatMass - previous.bodyFatMass).toFixed(1)) : null;
    const deltaM = current.muscleMass != null && previous.muscleMass != null ? Number((current.muscleMass - previous.muscleMass).toFixed(1)) : 0;
    const deltaV = current.visceralFatLevel != null && previous.visceralFatLevel != null ? Number((current.visceralFatLevel - previous.visceralFatLevel).toFixed(1)) : 0;
    const deltaS = current.inbodyScore != null && previous.inbodyScore != null ? Number((current.inbodyScore - previous.inbodyScore).toFixed(1)) : 0;

    let trendType: InBodyComparison['trendType'] = 'NEUTRAL';
    let trendSummary = 'Chỉ số tương đối ổn định so với lần đo trước.';

    if (deltaM > 0 && deltaFat < 0) {
      trendType = 'EXCELLENT';
      trendSummary = `🔥 Xuất sắc! Tăng ${deltaM} kg cơ và giảm ${Math.abs(deltaFat)}% mỡ (Body Recomposition cực chuẩn).`;
    } else if (deltaFat < 0) {
      trendType = 'GOOD';
      trendSummary = `👍 Tiến bộ tốt! Giảm thành công ${Math.abs(deltaFat)}% mỡ (${deltaFatM ? Math.abs(deltaFatM) + 'kg mỡ' : ''}).`;
    } else if (deltaM > 0) {
      trendType = 'GOOD';
      trendSummary = `💪 Tăng trưởng tốt! Tăng thêm ${deltaM} kg khối lượng cơ nạc.`;
    } else if (deltaFat > 1.5 && deltaM < 0) {
      trendType = 'NEEDS_ADJUSTMENT';
      trendSummary = `⚠️ Cần điều chỉnh! Có xu hướng tăng ${deltaFat}% mỡ và giảm ${Math.abs(deltaM)} kg cơ. PT cần xem lại dinh dưỡng/nghỉ ngơi.`;
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

  // Tin nhắn mẫu gửi nhanh qua Zalo/SMS
  const quickMessage = `📋 [3S GYM] TỔNG HỢP KẾT QUẢ ĐO INBODY (${new Date(current.measurementDate).toLocaleDateString('vi-VN')})
Học viên: ${fullName}${customerGoal?.title ? `\n🎯 MỤC TIÊU: ${customerGoal.title} (Hạn chót: ${customerGoal.deadline ? new Date(customerGoal.deadline).toLocaleDateString('vi-VN') : '—'})\n• Đánh giá: ${goalAlignment?.statusSummary || 'Đang bám sát'}` : ''}
-------------------------------
📊 CÁC CHỈ SỐ CHÍNH:
• Cân nặng: ${current.weight} kg (${bmiClass?.label || 'Chuẩn'})
• Tỷ lệ mỡ (% Body Fat): ${current.bodyFatPercentage != null ? current.bodyFatPercentage + '%' : '—'} (${bodyFatClass?.label || '—'})
• Khối lượng cơ xương: ${current.muscleMass != null ? current.muscleMass + ' kg' : '—'}
• Mỡ nội tạng: Level ${current.visceralFatLevel != null ? current.visceralFatLevel : '—'} (${visceralFatClass?.label || '—'})
• Điểm InBody: ${current.inbodyScore != null ? current.inbodyScore + '/100' : '—'}

🌟 ĐIỂM MẠNH:
${strengths.map((s) => '✓ ' + s).join('\n') || '✓ Nền tảng thể chất sẵn sàng'}

🎯 ĐIỂM CẦN CẢI THIỆN & ƯU TIÊN:
${priorities.map((p) => '→ ' + p).join('\n')}

🥗 KHUYẾN NGHỊ DINH DƯỠNG & TẬP LUYỆN TỪ PT:
• ${nutritionAdvice}
• ${workoutAdvice}

PT sẽ đồng hành và theo dõi sát sao tiến độ cùng bạn trong các buổi tập tới! 💪🔥`;

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
      trunkSummary: sm?.trunk ? `Khối lượng cơ thân mình đạt ${sm.trunk} kg.` : 'Cơ thân mình ổn định.',
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
