export interface AssistantPromptItem {
  title: string;
  requestType: string;
  scenario: string;
  tags?: string[];
}

export interface AssistantTopic {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  prompts: AssistantPromptItem[];
}

export const ASSISTANT_TOPICS: AssistantTopic[] = [
  // ==========================================
  // 1. KIẾN THỨC GYM
  // ==========================================
  {
    id: 'gym-principles',
    name: '1. Kiến thức Gym',
    icon: '🏋️‍♂️',
    color: '#0284c7',
    description: 'Nguyên tắc tập luyện, Tăng cơ, Giảm mỡ, Tăng sức mạnh, Thể lực, Progressive Overload, Volume/Intensity/Frequency.',
    prompts: [
      {
        title: 'Nguyên tắc Progressive Overload trong tăng cơ',
        requestType: 'WORKOUT_KNOWLEDGE',
        scenario: 'Hướng dẫn cách áp dụng nguyên tắc Progressive Overload (tăng tiến mức tạ, số rep, số set, tempo, giảm thời gian nghỉ) cho học viên mục tiêu tăng cơ Hypertrophy an toàn, tránh quá tải khớp.',
        tags: ['Nguyên tắc', 'Tăng cơ', 'Progressive Overload'],
      },
      {
        title: 'Phân biệt Fat Loss vs Muscle Gain vs Recomposition',
        requestType: 'WORKOUT_KNOWLEDGE',
        scenario: 'Phân tích sự khác biệt về cơ chế sinh học, khối lượng tập luyện và chế độ dinh dưỡng giữa 3 mục tiêu: Giảm mỡ (Fat Loss), Tăng cơ (Muscle Gain) và Tái cấu trúc cơ thể (Body Recomposition).',
        tags: ['Mục tiêu', 'Giảm mỡ', 'Tăng cơ', 'Recomp'],
      },
      {
        title: 'Tăng sức mạnh (Strength Training) & Thang RPE/RIR',
        requestType: 'WORKOUT_KNOWLEDGE',
        scenario: 'Phương pháp tập luyện phát triển sức mạnh tối đa (1-5 reps, 80-90% 1RM, nghỉ 3-5 phút), cách ứng dụng thang đo RPE (Rate of Perceived Exertion) và RIR (Reps in Reserve) để kiểm soát cường độ.',
        tags: ['Sức mạnh', 'RPE', 'RIR'],
      },
      {
        title: 'Cải thiện thể lực & Sức bền tim mạch (Cardio/HIIT)',
        requestType: 'WORKOUT_KNOWLEDGE',
        scenario: 'Xây dựng phương pháp cải thiện thể lực và sức bền tim mạch: Phối hợp LISS (Steady State Cardio) và HIIT (High-Intensity Interval Training) để không làm mất cơ bắp.',
        tags: ['Thể lực', 'Cardio', 'HIIT'],
      },
      {
        title: 'Tính toán Volume, Intensity và Frequency',
        requestType: 'WORKOUT_KNOWLEDGE',
        scenario: 'Hướng dẫn PT tính toán Volume (10-20 hiệp hiệu quả/nhóm cơ/tuần), Intensity (% 1RM hoặc RPE) và Frequency (tần suất 2-3 lần/nhóm cơ/tuần) theo trình độ học viên.',
        tags: ['Volume', 'Intensity', 'Frequency'],
      },
      {
        title: 'Rest & Recovery: Phục hồi giữa hiệp và giữa các buổi',
        requestType: 'WORKOUT_KNOWLEDGE',
        scenario: 'Nguyên tắc nghỉ ngơi phục hồi: Thời gian nghỉ giữa các hiệp tập cho từng mục tiêu (Sức mạnh 3-5p, Tăng cơ 1-2p, Thể lực 30-60s) và thời gian tái tạo cơ bắp (48-72h giữa các buổi cùng nhóm cơ).',
        tags: ['Recovery', 'Nghỉ ngơi'],
      },
      {
        title: 'Lộ trình 4 tuần đầu cho người mới bắt đầu (Novice Guide)',
        requestType: 'WORKOUT_KNOWLEDGE',
        scenario: 'Xây dựng giáo án thích nghi 4 tuần đầu cho người mới tập gym: Tập trung vào học chuyển động chuẩn, thích nghi thần kinh - cơ (Neuromuscular Adaptation) và tạo thói quen bền vững.',
        tags: ['Người mới', 'Cơ bản', 'Giáo án'],
      },
    ],
  },

  // ==========================================
  // 2. DINH DƯỠNG & THỰC PHẨM VIỆT NAM
  // ==========================================
  {
    id: 'nutrition',
    name: '2. Dinh dưỡng & Món ăn VN',
    icon: '🥗',
    color: '#10b981',
    description: 'Calories, BMR/TDEE, Macros, Thư viện thực phẩm VN, Thực đơn mẫu, Food Swap & Đọc nhãn.',
    prompts: [
      {
        title: 'Tính toán BMR, TDEE và Calorie Deficit/Surplus',
        requestType: 'NUTRITION_KNOWLEDGE',
        scenario: 'Công thức Mifflin-St Jeor tính BMR và hệ số hoạt động PAL để ra TDEE. Hướng dẫn thiết lập mức Calorie Deficit (thâm hụt 300-500 kcal) cho giảm mỡ hoặc Surplus (thặng dư 200-300 kcal) cho tăng cơ nạc.',
        tags: ['Calories', 'BMR', 'TDEE', 'Deficit'],
      },
      {
        title: 'Phân bổ Macros chuẩn: Protein, Carbs, Fats & Chất xơ',
        requestType: 'NUTRITION_KNOWLEDGE',
        scenario: 'Cách chia tỷ lệ Macros: Protein (1.6 - 2.2g/kg), Fats (0.8 - 1.0g/kg), Carbs (phần calo còn lại). Bổ sung 25-35g chất xơ mỗi ngày và công thức tính lượng nước uống chuẩn (Hydration: 40ml/kg cân nặng).',
        tags: ['Macros', 'Protein', 'Chất xơ', 'Nước'],
      },
      {
        title: 'Thực đơn mẫu món ăn Việt Nam chuẩn Macro',
        requestType: 'NUTRITION_KNOWLEDGE',
        scenario: 'Gợi ý thực đơn 1 ngày hoàn toàn bằng món ăn Việt Nam gần gũi (Phở bò tái nạc, Cơm tấm thịt nạc nướng không mỡ, Ức gà áp chảo sốt tiêu, Canh rau ngót thịt băm, Trứng luộc, Chuối, Sữa chua Hy Lạp) đạt 1700 kcal và 135g Protein.',
        tags: ['Thực đơn mẫu', 'Món Việt', 'Protein'],
      },
      {
        title: 'Thư viện món ăn Việt & Bảng thay thế thực phẩm (Food Swap)',
        requestType: 'NUTRITION_KNOWLEDGE',
        scenario: 'Bảng quy đổi tương đương các món ăn Việt Nam để học viên linh hoạt đổi bữa (VD: 100g ức gà = 100g tôm = 120g cá phi lê = 130g bò nạc = 4 lòng trắng trứng; 1 bát cơm trắng = 1 củ khoai lang 150g = 1 bắp ngô = 50g yến mạch).',
        tags: ['Food Swap', 'Món Việt', 'Thay thế'],
      },
      {
        title: 'Pre-workout & Post-workout Meal Timing',
        requestType: 'NUTRITION_KNOWLEDGE',
        scenario: 'Hướng dẫn học viên ăn gì trước tập 1.5 - 2h (Carb phức hợp + Protein nhẹ, ít mỡ), trước tập 30p (Carb nhanh như chuối/mật ong) và sau tập 45p (Whey/Protein hấp thu nhanh + Carb bổ sung Glycogen).',
        tags: ['Timing', 'Pre-workout', 'Post-workout'],
      },
      {
        title: 'Hướng dẫn đọc nhãn dinh dưỡng (Nutrition Facts)',
        requestType: 'NUTRITION_KNOWLEDGE',
        scenario: 'Cách hướng dẫn khách hàng đọc bảng thành phần dinh dưỡng trên bao bì thực phẩm: Khẩu phần (Serving Size), Lượng đường bổ sung (Added Sugars), Chất béo chuyển hóa (Trans Fat), và cách nhận biết Calo ẩn.',
        tags: ['Nhãn dinh dưỡng', 'Tips'],
      },
    ],
  },

  // ==========================================
  // 3. INBODY & PHÂN TÍCH CHỈ SỐ
  // ==========================================
  {
    id: 'inbody',
    name: '3. Phân tích InBody',
    icon: '📊',
    color: '#6366f1',
    description: 'Cách đọc InBody, Ý nghĩa từng chỉ số, So sánh L1 - L2, Giải thích cho khách & Cảnh báo sai lầm.',
    prompts: [
      {
        title: 'Ý nghĩa từng chỉ số then chốt trên phiếu InBody',
        requestType: 'INBODY_ANALYSIS',
        scenario: 'Giải thích chi tiết và trực quan ý nghĩa của: BMI, Body Fat % (PBF), Fat Mass (khối lượng mỡ kg), Skeletal Muscle Mass (SMM - cơ xương kg), BMR, Visceral Fat Level (Mỡ nội tạng 1-20), và Body Balance.',
        tags: ['InBody', 'Chỉ số', 'PBF', 'SMM'],
      },
      {
        title: 'Phân tích cơ từng phân đoạn (Segmental Lean Analysis)',
        requestType: 'INBODY_ANALYSIS',
        scenario: 'Cách đọc phần phân tích phát triển cơ từng chi (Tay trái, Tay phải, Thân, Chân trái, Chân phải) để phát hiện chênh lệch sức mạnh, lệch cơ do thuận tay/chân và gợi ý bài tập Unilateral cân bằng.',
        tags: ['Segmental', 'Lệch cơ', 'Cân bằng'],
      },
      {
        title: 'Kịch bản so sánh InBody Lần 1 và Lần 2 (Tiến độ 1 tháng)',
        requestType: 'INBODY_ANALYSIS',
        scenario: 'Kịch bản phân tích so sánh 2 phiếu InBody sau 4 tuần tập luyện: Cách chúc mừng khi tăng cơ giảm mỡ; cách giải thích tích cực khi cân nặng giữ nguyên nhưng vòng eo thu nhỏ (tăng 0.8kg cơ, giảm 0.8kg mỡ).',
        tags: ['So sánh L1-L2', 'Tiến độ', 'Tư vấn'],
      },
      {
        title: 'Cách giải thích InBody khéo léo, truyền cảm hứng cho khách',
        requestType: 'INBODY_ANALYSIS',
        scenario: 'Cách PT dùng ngôn từ chuyên nghiệp nhưng dễ hiểu, không làm khách hoang mang khi chỉ số mỡ cao, biến kết quả đo thành động lực và mục tiêu hành động rõ ràng.',
        tags: ['Giao tiếp', 'Động lực', 'Khách hàng'],
      },
      {
        title: 'Những điều PT tuyệt đối KHÔNG NÊN kết luận từ InBody',
        requestType: 'INBODY_ANALYSIS',
        scenario: 'Cảnh báo chuyên môn: Không chẩn đoán bệnh lý y khoa từ InBody; giải thích hiện tượng dao động nước (uống nhiều nước/ăn no trước đo, chu kỳ kinh nguyệt) ảnh hưởng đến kết quả điện trở sinh học BIA.',
        tags: ['Cảnh báo', 'An toàn', 'Sai lầm'],
      },
    ],
  },

  // ==========================================
  // 4. MOBILITY & KHỞI ĐỘNG
  // ==========================================
  {
    id: 'mobility',
    name: '4. Mobility & Khởi động',
    icon: '🤸',
    color: '#f59e0b',
    description: 'Mobility vs Flexibility, Test khớp, Bài tập cải thiện hông/vai/cổ chân, Thời điểm áp dụng.',
    prompts: [
      {
        title: 'Khái niệm Mobility vs Flexibility & Sự khác biệt',
        requestType: 'MOBILITY_KNOWLEDGE',
        scenario: 'Giải thích rõ ràng: Flexibility là độ dẻo thụ động của cơ bắp, Mobility là khả năng kiểm soát chủ động lực và chuyển động trong toàn bộ biên độ khớp (Active Range of Motion).',
        tags: ['Khái niệm', 'Mobility', 'Flexibility'],
      },
      {
        title: 'Các bài Test Mobility cơ bản (Movement Screen)',
        requestType: 'MOBILITY_KNOWLEDGE',
        scenario: 'Hướng dẫn thực hiện các bài test: 1. Overhead Squat Test (đánh giá hông, cổ chân, vai), 2. Thomas Test (độ co cứng cơ gập hông), 3. Knee-to-Wall Test (đo gập cổ chân Dorsiflexion).',
        tags: ['Bài test', 'Overhead Squat', 'Thomas Test'],
      },
      {
        title: 'Bài tập Mobility khớp hông (Hip) & Cổ chân (Ankle)',
        requestType: 'MOBILITY_KNOWLEDGE',
        scenario: 'Quy trình bài tập: 90/90 Hip Stretch, Hip CARs, Deep Squat Hold with Shift, Ankle Banded Mobilization để học viên squat sâu không bị nhấc gót và mở khớp hông linh hoạt.',
        tags: ['Khớp hông', 'Cổ chân', 'Squat'],
      },
      {
        title: 'Bài tập Mobility khớp vai (Shoulder) & Cột sống ngực (T-Spine)',
        requestType: 'MOBILITY_KNOWLEDGE',
        scenario: 'Bài tập: Cat-Cow with rotation, Open Book Stretch, PVC Pipe Shoulder Dislocates, Band Pull-Apart để mở ngực và tăng biên độ xoay khớp vai an toàn cho bài Bench Press/Overhead Press.',
        tags: ['Khớp vai', 'Cột sống ngực', 'Khởi động'],
      },
      {
        title: 'Khi nào sử dụng Mobility trước và sau buổi tập',
        requestType: 'MOBILITY_KNOWLEDGE',
        scenario: 'Hướng dẫn: Dùng Mobility động trước tập để chuẩn bị khớp cho các bài chính; dùng Mobility tĩnh kết hợp thở sâu sau tập để giải phóng áp lực ổ khớp.',
        tags: ['Thời điểm', 'Quy trình'],
      },
    ],
  },

  // ==========================================
  // 5. STRETCHING & PHỤC HỒI
  // ==========================================
  {
    id: 'stretching',
    name: '5. Stretching & Phục hồi',
    icon: '🧘',
    color: '#8b5cf6',
    description: 'Dynamic vs Static Stretching, Foam Rolling (SMR), Giấc ngủ, Rest day & Hồi phục.',
    prompts: [
      {
        title: 'Dynamic Stretching trước tập vs Static Stretching sau tập',
        requestType: 'RECOVERY_KNOWLEDGE',
        scenario: 'Tại sao không nên giãn cơ tĩnh lâu trước buổi tập nặng (làm giảm lực co cơ tối đa)? Hướng dẫn Dynamic Stretching (Leg Swings, Arm Circles) trước tập và Static Stretching (giữ 20-30s) sau tập.',
        tags: ['Dynamic', 'Static', 'Giãn cơ'],
      },
      {
        title: 'Kỹ thuật Foam Rolling (SMR - Giải màng cơ)',
        requestType: 'RECOVERY_KNOWLEDGE',
        scenario: 'Kỹ thuật tự giải phóng màng cơ bằng con lăn bọt Foam Roller: Lăn đùi trước (Quads), đùi sau (Hamstrings), dải chậu chày (IT Band), bắp chân (Calves), lưng trên (T-Spine); tránh lăn trực tiếp vào khớp hoặc thắt lưng.',
        tags: ['Foam Rolling', 'SMR', 'Giải cơ'],
      },
      {
        title: 'Tối ưu giấc ngủ và hướng dẫn học viên tự phục hồi',
        requestType: 'RECOVERY_KNOWLEDGE',
        scenario: 'Tư vấn vai trò của giấc ngủ sâu (7-8 tiếng) đối với việc giải phóng Growth Hormone, tổng hợp cơ bắp. Các thói quen phục hồi: Tắm nước ấm, bổ sung Magie/Kẽm, kiểm soát Stress và nhịp sinh học.',
        tags: ['Giấc ngủ', 'Phục hồi', 'Tự chăm sóc'],
      },
      {
        title: 'Quản lý Ngày nghỉ (Rest Day) & Tuần giảm tải (Deload Week)',
        requestType: 'RECOVERY_KNOWLEDGE',
        scenario: 'Khái niệm Phục hồi chủ động (Active Recovery: đi bộ nhẹ, bơi lội, yoga). Khi nào cần lên lịch 1 tuần Deload (giảm 50% Volume, giữ nguyên mức tạ) khi học viên có dấu hiệu quá tải (Overtraining).',
        tags: ['Rest Day', 'Deload', 'Active Recovery'],
      },
    ],
  },

  // ==========================================
  // 6. SAI LỆCH TƯ THẾ & CHỈNH SỬA
  // ==========================================
  {
    id: 'posture',
    name: '6. Sai lệch tư thế',
    icon: '📐',
    color: '#ec4899',
    description: 'Rounded Shoulder, Forward Head, Anterior Pelvic Tilt, Knee Valgus & Movement Screening.',
    prompts: [
      {
        title: 'Khắc phục Vai cuộn (Rounded Shoulders) & Đầu nhô trước',
        requestType: 'POSTURE_CORRECTION',
        scenario: 'Phân tích hội chứng chéo trên (Upper Crossed Syndrome): Cơ ngực/cơ thang trên bị co cứng, cơ lưng giữa/cơ cổ sâu bị yếu. Kế hoạch: Giãn Pecs, tăng cường Face Pulls, Band Pull-aparts, Chin Tucks.',
        tags: ['Vai cuộn', 'Gù lưng', 'Forward Head'],
      },
      {
        title: 'Chỉnh sửa Võng lưng dưới (Anterior Pelvic Tilt - APT)',
        requestType: 'POSTURE_CORRECTION',
        scenario: 'Phân tích hội chứng chéo dưới (Lower Crossed Syndrome): Cơ gập hông và cơ dựng sống thắt lưng co cứng, cơ mông và cơ bụng yếu. Kế hoạch: Giãn Hip Flexors (Couch Stretch), tăng cường Glute Bridge, Hip Thrust, Deadbug, Plank.',
        tags: ['Võng lưng', 'APT', 'Mông bụng'],
      },
      {
        title: 'Khắc phục Sụp gối (Knee Valgus) trong Squat & Lunge',
        requestType: 'POSTURE_CORRECTION',
        scenario: 'Nguyên nhân sụp gối: Cơ mông nhỡ (Gluteus Medius) yếu hoặc cổ chân cứng. Kế hoạch chỉnh sửa: Kích hoạt mông với Miniband (Clamshell, Monster Walk), cues "xoay vặn bàn chân bám sàn và đẩy gối ra ngoài".',
        tags: ['Sụp gối', 'Knee Valgus', 'Glute Medius'],
      },
      {
        title: 'Đánh giá chênh lệch sức mạnh trái/phải & Bài tập Unilateral',
        requestType: 'POSTURE_CORRECTION',
        scenario: 'Cách nhận biết và khắc phục bất cân xứng cơ thể: Áp dụng các bài tập từng bên (Bulgarian Split Squat, Single Leg RDL, Single Arm Dumbbell Row), luôn bắt đầu từ bên yếu và giới hạn số rep bên mạnh theo bên yếu.',
        tags: ['Lệch bên', 'Unilateral', 'Cân bằng'],
      },
      {
        title: 'Movement Screening: Đánh giá chuyển động trước khi lên tạ',
        requestType: 'POSTURE_CORRECTION',
        scenario: 'Quy trình kiểm tra 5 chuyển động mẫu: Hinge, Squat, Push, Pull, Lunge để phát hiện điểm bù trừ (Compensation) trước khi cho học viên tăng mức tạ.',
        tags: ['Screening', 'Chuyển động'],
      },
    ],
  },

  // ==========================================
  // 7. KỸ THUẬT BÀI TẬP & CUES COACHING
  // ==========================================
  {
    id: 'technique',
    name: '7. Kỹ thuật bài tập',
    icon: '🎯',
    color: '#f97316',
    description: 'Setup, Execution, Breathing, Tempo, Cues coaching, Lỗi thường gặp & Bài tập thay thế.',
    prompts: [
      {
        title: 'Profile bài Barbell Back Squat & Cues coaching',
        requestType: 'EXERCISE_TECHNIQUE',
        scenario: 'Profile chi tiết Barbell Squat: Setup vị trí đòn High-bar/Low-bar, khóa bả vai (Lat engagement), kỹ thuật hít thở gồng bụng Valsalva Maneuver, Cues "đạp sàn", "mở gối", sửa lỗi nhấc gót hoặc cong lưng dưới (Butt Wink).',
        tags: ['Squat', 'Barbell', 'Cues'],
      },
      {
        title: 'Profile bài Conventional Deadlift & Romanian Deadlift (RDL)',
        requestType: 'EXERCISE_TECHNIQUE',
        scenario: 'So sánh Deadlift kéo từ sàn vs RDL khóa gối: Kỹ thuật Hip Hinge (gập hông đẩy mông ra sau), giữ thanh đòn sát chân, siết xô bảo vệ thắt lưng, Cues "đạp gãy thanh đòn" và lỗi cong lưng nguy hiểm.',
        tags: ['Deadlift', 'RDL', 'Hip Hinge'],
      },
      {
        title: 'Profile bài Barbell & Dumbbell Bench Press',
        requestType: 'EXERCISE_TECHNIQUE',
        scenario: 'Kỹ thuật đẩy ngực chuẩn: Khép và hạ xương bả vai (Retract & Depress Scapula), tạo độ võng tự nhiên lưng trên (Arch), vị trí cùi chỏ góc 45-75 độ so với thân, Cues "kéo thanh đòn về ngực dưới" để không đau khớp vai.',
        tags: ['Bench Press', 'Đẩy ngực', 'Bảo vệ vai'],
      },
      {
        title: 'Kỹ thuật bài tập Lưng xô: Lat Pulldown & Seated Row',
        requestType: 'EXERCISE_TECHNIQUE',
        scenario: 'Cues cảm nhận cơ xô (Lats): Hạ xương bả vai trước khi kéo tay, kéo cùi chỏ về phía túi quần sau, không ngửa người quá 15 độ, Tempo 2-0-1-1 (1 giây siết cơ đỉnh).',
        tags: ['Lưng xô', 'Lat Pulldown', 'Row'],
      },
      {
        title: 'Kỹ thuật bài tập Mông đùi: Barbell Hip Thrust & Split Squat',
        requestType: 'EXERCISE_TECHNIQUE',
        scenario: 'Profile Barbell Hip Thrust: Kê lưng ngang mép ghế, cằm gập nhìn về trước, bàn chân vuông góc với cẳng chân ở điểm cao nhất, siết mông khóa hông (Posterior Pelvic Tilt ở đỉnh).',
        tags: ['Mông đùi', 'Hip Thrust', 'Split Squat'],
      },
      {
        title: 'Danh mục bài tập thay thế khi học viên đau gối / đau thắt lưng',
        requestType: 'EXERCISE_TECHNIQUE',
        scenario: 'Bảng bài tập thay thế an toàn: Đau gối (thay Squat sâu bằng Box Squat / Leg Press góc 90 độ / Romanian Deadlift); Đau thắt lưng (thay Barbell Row bằng Chest-Supported Row / Lat Pulldown; thay Back Squat bằng Goblet Squat).',
        tags: ['Bài thay thế', 'Đau gối', 'Đau lưng'],
      },
    ],
  },

  // ==========================================
  // 8. QUY TRÌNH PT CHUẨN (SOP)
  // ==========================================
  {
    id: 'pt-process',
    name: '8. Quy trình PT (SOP)',
    icon: '📋',
    color: '#06b6d4',
    description: 'Quy trình tiếp nhận, Đánh giá ban đầu, Đo InBody, Xây mục tiêu & Kết thúc buổi tập.',
    prompts: [
      {
        title: 'SOP 1: Quy trình tiếp nhận & Phỏng vấn học viên mới',
        requestType: 'PT_WORKFLOW',
        scenario: 'Quy trình 15 phút tiếp nhận: Chào hỏi tạo thiện cảm, khai thác tiền sử bệnh lý/chấn thương (PAR-Q), thói quen ăn uống, công việc, quỹ thời gian và kỳ vọng cụ thể của học viên.',
        tags: ['SOP', 'Tiếp nhận', 'Phỏng vấn'],
      },
      {
        title: 'SOP 2: Quy trình đo InBody chuẩn & Phân tích tại chỗ',
        requestType: 'PT_WORKFLOW',
        scenario: 'Quy trình đo InBody chuẩn hóa: Kiểm tra điều kiện trước đo (không no, không uống quá nhiều nước), nhập mã khách hàng trên App 3S-Gym, quét/phân tích chỉ số và thiết lập mục tiêu SMART cùng học viên.',
        tags: ['SOP', 'Đo InBody', 'Mục tiêu SMART'],
      },
      {
        title: 'SOP 3: Quy trình xây dựng giáo án & Lộ trình tập luyện',
        requestType: 'PT_WORKFLOW',
        scenario: 'Quy trình thiết kế giáo án cá nhân hóa trên App 3S-Gym: Xác định tần suất buổi/tuần, lựa chọn Split phù hợp (Full Body / Upper-Lower / Push-Pull-Legs), chọn bài tập chính và bài bổ trợ.',
        tags: ['SOP', 'Giáo án', 'Lộ trình'],
      },
      {
        title: 'SOP 4: Quy trình hướng dẫn buổi tập đầu tiên (First Impression)',
        requestType: 'PT_WORKFLOW',
        scenario: 'Quy trình buổi tập 1: Khởi động khớp 10p, test chuyển động với tạ nhẹ 25p, dặn dò hít thở và cảm nhận cơ 15p, hạ nhiệt giãn cơ 10p. Chú trọng an toàn và không để học viên bị kiệt sức buổi đầu.',
        tags: ['SOP', 'Buổi đầu', 'Ấn tượng'],
      },
      {
        title: 'SOP 5: Quy trình đánh giá định kỳ & Cập nhật giáo án hàng tháng',
        requestType: 'PT_WORKFLOW',
        scenario: 'Quy trình kiểm tra tiến độ mỗi 4 tuần: Đo lại InBody, chụp ảnh vóc dáng trước-sau (Progress Photo), so sánh mức tạ đã tăng tiến, phỏng vấn mức độ hài lòng và điều chỉnh giáo án giai đoạn tiếp theo.',
        tags: ['SOP', 'Đánh giá định kỳ', 'Cập nhật'],
      },
      {
        title: 'SOP 6: Quy trình 5 phút kết thúc buổi tập chuyên nghiệp',
        requestType: 'PT_WORKFLOW',
        scenario: 'Quy trình kết thúc buổi tập chuẩn 3S-Gym: Giãn cơ phục hồi, dặn dò dinh dưỡng và uống nước, ghi nhận buổi tập (Check-in) trên App 3S-Gym, dặn bài tập về nhà và xác nhận lịch hẹn buổi sau.',
        tags: ['SOP', 'Kết thúc buổi', 'Check-in'],
      },
    ],
  },

  // ==========================================
  // 9. QUY TRÌNH CHĂM SÓC HỌC VIÊN (13 TÌNH HUỐNG)
  // ==========================================
  {
    id: 'customer-care',
    name: '9. Quy trình Chăm sóc',
    icon: '💬',
    color: '#e11d48',
    description: '13 Tình huống chăm sóc: Khách mới, Sau buổi 1, Nghỉ tập, Chững cân, Hết gói, Gia hạn.',
    prompts: [
      {
        title: 'Tình huống 1: Chăm sóc học viên sau buổi tập đầu tiên',
        requestType: 'CUSTOMER_CARE',
        scenario: 'Tình huống: Học viên vừa hoàn thành buổi 1. Việc cần làm: Nhắn tin hỏi thăm cảm giác cơ bắp, mức độ đau nhức DOMS. Khi nào: 8h - 9h sáng hôm sau. Kịch bản: Soạn tin nhắn mẫu ấm áp, ân cần. Ghi nhận App: Cập nhật trạng thái thể lực buổi 1.',
        tags: ['Buổi 1', 'Đau cơ', 'Hỏi thăm'],
      },
      {
        title: 'Tình huống 2: Khách nghỉ tập 1-2 buổi liên tiếp',
        requestType: 'CUSTOMER_CARE',
        scenario: 'Tình huống: Học viên hủy hoặc hoãn 2 buổi tập. Việc cần làm: Nhắn tin chia sẻ, hỏi thăm sức khỏe/công việc. Khi nào: Sau 24h kể từ buổi hủy thứ hai. Kịch bản: Tin nhắn không gây áp lực, chủ động đề xuất đổi giờ linh hoạt. Ghi nhận App: Đánh dấu Care Task nhắc nhở.',
        tags: ['Nghỉ tập', 'Nhắc lịch'],
      },
      {
        title: 'Tình huống 3: Khách nghỉ tập lâu (quá 5-7 ngày không liên lạc)',
        requestType: 'CUSTOMER_CARE',
        scenario: 'Tình huống: Khách im lặng không đi tập 1 tuần. Việc cần làm: Gọi điện hoặc nhắn tin kịch bản khơi gợi lại mục tiêu ban đầu. Khi nào: Ngày thứ 6-7. Kịch bản: Nhắc lại cam kết và đề xuất 1 buổi tập nhẹ phục hồi năng lượng.',
        tags: ['Khách nghỉ lâu', 'Mất động lực', 'Kéo khách'],
      },
      {
        title: 'Tình huống 4: Khách có kết quả chậm / Tiến độ bị chững (Plateau)',
        requestType: 'CUSTOMER_CARE',
        scenario: 'Tình huống: Cân nặng hoặc mỡ không giảm sau 3 tuần. Việc cần làm: Rà soát lại nhật ký ăn uống thực tế, kiểm tra giấc ngủ/stress, điều chỉnh Macro. Kịch bản: Động viên, phân tích nguyên nhân sinh lý và giải pháp.',
        tags: ['Chững cân', 'Plateau', 'Động viên'],
      },
      {
        title: 'Tình huống 5: Khách phàn nàn bài tập quá nặng hoặc mệt mỏi',
        requestType: 'CUSTOMER_CARE',
        scenario: 'Tình huống: Khách phản hồi bài tập quá mệt hoặc ê ẩm khớp. Việc cần làm: Lắng nghe, không tranh cãi, ngay lập tức hạ mức tạ hoặc đổi bài tập thay thế nhẹ nhàng hơn. Kịch bản: Lời xin lỗi chân thành và cam kết điều chỉnh.',
        tags: ['Phàn nàn', 'Bài quá nặng', 'Xử lý'],
      },
      {
        title: 'Tình huống 6: Khách sắp hết gói tập (còn 3 - 5 buổi)',
        requestType: 'CUSTOMER_CARE',
        scenario: 'Tình huống: Học viên còn 5 buổi trong gói. Việc cần làm: Đo lại InBody đánh giá toàn diện giai đoạn 1, xuất báo cáo tiến độ trên App 3S-Gym và phác thảo lộ trình giai đoạn 2. Kịch bản: Mở lời tư vấn gia hạn tự nhiên.',
        tags: ['Sắp hết buổi', 'Gia hạn', 'Tổng kết'],
      },
      {
        title: 'Tình huống 7: Khách giới thiệu bạn bè / người thân',
        requestType: 'CUSTOMER_CARE',
        scenario: 'Tình huống: Khách hàng hài lòng sau khi giảm được mỡ/tăng cơ. Việc cần làm: Cảm ơn và gửi tặng voucher 1 buổi tập trải nghiệm miễn phí cho bạn bè/người thân của khách. Kịch bản: Lời nhờ vả tinh tế và ưu đãi tri ân.',
        tags: ['Giới thiệu', 'Referral', 'Ưu đãi'],
      },
    ],
  },

  // ==========================================
  // 10. KỊCH BẢN TƯ VẤN & SALES (XỬ LÝ TỪ CHỐI)
  // ==========================================
  {
    id: 'consultation-sales',
    name: '10. Kịch bản Tư vấn & Sales',
    icon: '🤝',
    color: '#d97706',
    description: 'Khai thác Pain Point, Tư vấn theo InBody, Xử lý từ chối: Giá cao, Để suy nghĩ, Tự tập, Bận.',
    prompts: [
      {
        title: 'Khai thác Nhu cầu, Pain Point & Tư vấn theo InBody',
        requestType: 'SALES_CONSULTATION',
        scenario: 'Kịch bản phỏng vấn tư vấn chuyên sâu dựa trên phiếu InBody: Cách đặt câu hỏi đào sâu nỗi đau (đau lưng mỏi gối, tự ti vóc dáng, thiếu sức bền) và vạch ra lộ trình giải quyết dứt điểm trong 12 tuần.',
        tags: ['Khai thác', 'Pain Point', 'InBody'],
      },
      {
        title: 'Xử lý từ chối 1: "Giá PT bên em cao quá so với phòng khác"',
        requestType: 'SALES_CONSULTATION',
        scenario: 'Kịch bản xử lý khi khách chê giá cao: Nhấn mạnh sự khác biệt về chất lượng 1-1, giáo án cá nhân hóa trên App 3S-Gym, theo dõi dinh dưỡng từng bữa, cam kết an toàn khớp và tiết kiệm hàng tháng trời tự tập sai lầm.',
        tags: ['Giá cao', 'Xử lý từ chối', 'Giá trị'],
      },
      {
        title: 'Xử lý từ chối 2: "Để anh/chị về suy nghĩ thêm / hỏi người thân"',
        requestType: 'SALES_CONSULTATION',
        scenario: 'Kịch bản xử lý khi khách chần chừ: Đặt câu hỏi tìm hiểu băn khoăn thực sự ẩn sau (lo không theo được lịch hay tài chính), giải tỏa lo lắng và chốt lịch trải nghiệm thử 1 buổi trước khi quyết định.',
        tags: ['Suy nghĩ thêm', 'Do dự', 'Chốt thử'],
      },
      {
        title: 'Xử lý từ chối 3: "Em tự tập trên mạng / YouTube / TikTok được"',
        requestType: 'SALES_CONSULTATION',
        scenario: 'Kịch bản xử lý khi khách muốn tự tập: Phân tích rủi ro xem video không biết mình sai form ở đâu, nguy cơ chấn thương thắt lưng/khớp gối và lợi ích của việc có PT chỉnh sửa từng chuyển động ngay tại chỗ.',
        tags: ['Tự tập', 'TikTok', 'An toàn'],
      },
      {
        title: 'Xử lý từ chối 4: "Dạo này anh/chị bận quá, chưa thu xếp được thời gian"',
        requestType: 'SALES_CONSULTATION',
        scenario: 'Kịch bản tư vấn cho khách hàng bận rộn: Giải pháp giáo án tối ưu 45 phút/buổi, lịch tập linh hoạt theo tuần, chứng minh sức khỏe tốt giúp tăng 200% hiệu suất làm việc.',
        tags: ['Bận rộn', 'Thời gian', 'Linh hoạt'],
      },
      {
        title: 'Xử lý từ chối 5: "Em chưa đủ tiền đóng một lần / Muốn trả góp"',
        requestType: 'SALES_CONSULTATION',
        scenario: 'Kịch bản tư vấn giải pháp tài chính: Hướng dẫn khách chia nhỏ gói tập theo tháng hoặc gói ngắn hạn 12-24 buổi, chương trình trả góp 0% để khách bắt đầu ngay mà không áp lực.',
        tags: ['Tài chính', 'Chia nhỏ', 'Trả góp'],
      },
      {
        title: 'Kịch bản Follow-up sau 24h kể từ buổi tập trải nghiệm',
        requestType: 'SALES_CONSULTATION',
        scenario: 'Kịch bản tin nhắn/gọi điện follow-up chuyên nghiệp sau buổi tập thử: Gửi ảnh phân tích tư thế & InBody, tóm tắt lộ trình 3 giai đoạn đã phác thảo và kích hoạt ưu đãi quà tặng nếu đăng ký trong 48h.',
        tags: ['Follow-up', 'Tập thử', 'Chốt gói'],
      },
      {
        title: 'Kịch bản tư vấn Tái ký / Gia hạn gói tập lộ trình nâng cao',
        requestType: 'SALES_CONSULTATION',
        scenario: 'Kịch bản tư vấn gia hạn: Chiếu biểu đồ tiến độ trước-sau trên App, chúc mừng thành quả giai đoạn 1 và đề xuất mục tiêu giai đoạn 2 (tăng cơ định hình / nâng cao thể lực), kèm chính sách ưu đãi dành riêng cho học viên thân thiết.',
        tags: ['Tái ký', 'Gia hạn', 'Khách cũ'],
      },
    ],
  },
];
