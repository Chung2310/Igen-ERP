export interface StandardDocData {
  title: string;
  topic: string;
  content: string;
}

export const STANDARD_3S_KNOWLEDGE_DOCS: StandardDocData[] = [
  // 1. Kiến thức Gym
  {
    title: 'Bộ Nguyên tắc Tập luyện & Tăng cơ - Giảm mỡ chuẩn 3S-Gym',
    topic: 'GYM_PRINCIPLES',
    content: `1. NGUYÊN TẮC TẬP LUYỆN CỐT LÕI:
- Progressive Overload (Quá tải tăng tiến): Cơ bắp chỉ phát triển khi chịu kích thích lớn dần theo thời gian. Các cách tăng tải: Tăng mức tạ (Load), tăng số lần lặp (Reps), tăng số hiệp (Sets), cải thiện chất lượng kỹ thuật/tempo (Form & Time Under Tension), giảm thời gian nghỉ giữa các hiệp.
- Specificity (Tính đặc hiệu): Tập luyện theo đúng mục tiêu cụ thể (Sức mạnh 1-5 reps, Tăng cơ 6-12 reps, Thể lực sức bền 15+ reps).
- Recovery & Adaptation: Cơ bắp không phát triển trong lúc tập mà phục hồi và to lên trong lúc nghỉ ngơi và ngủ đủ giấc (48-72h cho mỗi nhóm cơ lớn).

2. PHÂN BIỆT CÁC MỤC TIÊU:
- Tăng cơ (Hypertrophy): Thặng dư calo nhẹ (+200-300 kcal), Volume 10-20 sets/nhóm cơ/tuần, RPE 7-9 (còn 1-2 reps dự trữ).
- Giảm mỡ (Fat Loss): Thâm hụt calo (-300-500 kcal), duy trì mức tạ nặng để giữ cơ, kết hợp Cardio LISS/HIIT.
- Body Recomposition (Tăng cơ - Giảm mỡ đồng thời): Ăn ở mức Calo duy trì (Maintenance), nạp 2.0-2.2g Protein/kg, phù hợp nhất cho người mới bắt đầu (Newbie gains) hoặc người có tỷ lệ mỡ cao (>25% nam, >32% nữ).
- Cải thiện thể lực: Phối hợp sức mạnh và sức bền tim mạch, tập trung vào các bài phức hợp đa khớp (Compound movements).

3. PHÂN BỔ VOLUME, INTENSITY VÀ FREQUENCY:
- Volume: 10-20 hiệp hiệu quả mỗi nhóm cơ trong 1 tuần.
- Frequency: Tần suất kích thích mỗi nhóm cơ 2 lần/tuần cho kết quả tối ưu so với tập 1 lần/tuần.
- RPE/RIR: Đảm bảo đa số các hiệp chính dừng ở RIR 1-3 (cách ngưỡng thất bại 1-3 lần lặp).`,
  },

  // 2. Dinh dưỡng
  {
    title: 'Cẩm nang Dinh dưỡng, Tính Calories & Thư viện Món ăn Việt Nam',
    topic: 'NUTRITION',
    content: `1. CÔNG THỨC TÍNH NĂNG LƯỢNG:
- BMR (Basal Metabolic Rate): Tính theo công thức Mifflin-St Jeor:
  + Nam: 10 * Cân nặng (kg) + 6.25 * Chiều cao (cm) - 5 * Tuổi + 5
  + Nữ: 10 * Cân nặng (kg) + 6.25 * Chiều cao (cm) - 5 * Tuổi - 161
- TDEE (Total Daily Energy Expenditure) = BMR * PAL (Hệ số vận động từ 1.2 đến 1.9).
- Calorie Deficit: Giảm 300 - 500 kcal/ngày để giảm 0.5kg mỡ/tuần an toàn.

2. PHÂN BỔ MACRONUTRIENTS:
- Protein: 1.6 - 2.2g/kg trọng lượng cơ thể (4 kcal/g).
- Chất béo (Fat): 0.8 - 1.0g/kg (chiếm 20-30% tổng calo, 9 kcal/g).
- Carbohydrates (Tinh bột): Phần calo còn lại (4 kcal/g).
- Chất xơ: 25 - 35g/ngày.
- Nước (Hydration): 40ml / kg cân nặng mỗi ngày (tăng thêm 500-1000ml trong ngày có tập luyện).

3. THƯ VIỆN THỰC PHẨM VIỆT NAM & THAY THẾ TƯƠNG ĐƯƠNG (FOOD SWAP):
- Nguồn đạm (Protein) tương đương 25-30g Protein:
  + 120g Ức gà phi lê (130 kcal) = 130g Tôm tươi (120 kcal) = 130g Thịt bò nạc (160 kcal) = 140g Cá basa/cá thu (170 kcal) = 4 lòng trắng trứng + 1 quả trứng nguyên (150 kcal) = 1 muỗng Whey Isolate (120 kcal) = 200g Đậu hũ trắng (160 kcal).
- Nguồn tinh bột (Carbs) tương đương ~35-40g Carbs:
  + 1 bát cơm trắng vơi (150g ~ 195 kcal) = 1 củ khoai lang luộc 180g (160 kcal) = 1 bắp ngô luộc lớn (150 kcal) = 50g Yến mạch khô (190 kcal) = 1 đĩa bún/phở tươi 150g (165 kcal).
- Thực đơn mẫu chuẩn 1700 kcal:
  + Sáng: Phở bò tái nạc ít bánh + 2 quả trứng chần (450 kcal, 32g Pro).
  + Trưa: 1 bát cơm gạo lứt + 150g ức gà xào ớt chuông + 1 bát canh rau ngót thịt băm (520 kcal, 45g Pro).
  + Xế chiều (Pre-workout): 1 quả chuối + 1 hộp sữa chua không đường + 1 muỗng Whey (250 kcal, 28g Pro).
  + Tối: 1 củ khoai lang nhỏ + 150g cá hấp xì dầu + đĩa rau củ luộc chấm kho quẹt ít dầu (480 kcal, 38g Pro).`,
  },

  // 3. InBody
  {
    title: 'Cẩm nang Đọc, Phân tích & So sánh Chỉ số InBody cho PT 3S-Gym',
    topic: 'INBODY_ANALYSIS',
    content: `1. Ý NGHĨA CÁC CHỈ SỐ INBODY THEN CHỐT:
- Weight (Cân nặng tổng thể): Tổng trọng lượng cơ thể bao gồm nước, xương, cơ và mỡ.
- SMM (Skeletal Muscle Mass - Khối lượng cơ xương): Chỉ số vàng phản ánh lượng cơ bắp chịu sự điều khiển chủ động. Mục tiêu luôn là duy trì hoặc tăng SMM.
- Body Fat Mass (Khối lượng mỡ kg) & Percent Body Fat (PBF - % Mỡ cơ thể):
  + Nam: Chuẩn 10-18%, Thừa mỡ >20%, Béo phì >25%.
  + Nữ: Chuẩn 18-25%, Thừa mỡ >28%, Béo phì >32%.
- Visceral Fat Level (Mỡ nội tạng): Mức 1-9 là an toàn, mức 10-14 là nguy cơ cao, mức >=15 là nguy hiểm liên quan bệnh tim mạch, mỡ máu.
- BMR (Basal Metabolic Rate): Năng lượng tối thiểu để duy trì sự sống. Cơ càng nhiều thì BMR càng cao.
- Segmental Lean Analysis (Phân tích cơ từng phân đoạn): Đánh giá độ cân đối giữa tay trái/phải, chân trái/phải và thân mình để phát hiện lệch cơ.

2. QUY TRÌNH SO SÁNH INBODY LẦN 1 - LẦN 2 (SAU 4 TUẦN):
- Trường hợp 1: Giảm cân + Giảm mỡ + Giữ/tăng cơ -> Chúc mừng học viên, biểu dương sự tuân thủ giáo án và dinh dưỡng.
- Trường hợp 2: Cân nặng không đổi nhưng PBF giảm (Tăng 1kg cơ, giảm 1kg mỡ) -> Giải thích hiện tượng Body Recomposition, vóc dáng săn chắc thon gọn hơn rõ rệt dù số cân trên bàn cân đứng yên.
- Trường hợp 3: Giảm cân nhưng Giảm cơ + Tăng % mỡ (Skinny Fat) -> Cảnh báo học viên đang nhịn ăn quá mức hoặc thiếu protein, cần tăng calo và tăng tạ.

3. NHỮNG ĐIỀU PT TUYỆT ĐỐI KHÔNG NÊN KẾT LUẬN TỪ INBODY:
- Không chẩn đoán bệnh lý y khoa từ InBody.
- Luôn kiểm tra các yếu tố sai số trước đo: Học viên có uống 1 lít nước ngay trước khi đo không? Có đo sau buổi tập nặng không? Đo vào thời điểm nào trong ngày? (Nên đo cố định vào buổi sáng chưa ăn hoặc trước buổi tập).`,
  },

  // 4. Mobility
  {
    title: 'Hướng dẫn Đánh giá & Bài tập Cải thiện Mobility từng khớp',
    topic: 'MOBILITY',
    content: `1. KHÁI NIỆM MOBILITY VS FLEXIBILITY:
- Flexibility (Độ dẻo): Khả năng cơ bắp được kéo giãn thụ động bởi ngoại lực.
- Mobility (Độ linh hoạt khớp): Khả năng chủ động kiểm soát và tạo ra lực trong toàn bộ biên độ chuyển động của khớp (Active Range of Motion).

2. CÁC BÀI TEST ĐÁNH GIÁ MOBILITY BAN ĐẦU:
- Overhead Squat Test: Đánh giá tổng thể độ mở vai, độ thẳng cột sống ngực, khớp hông và độ gập cổ chân.
- Thomas Test: Kiểm tra độ co cứng của cơ gập hông (Iliopsoas, Rectus Femoris).
- Knee-to-Wall Ankle Test: Đặt mũi chân cách tường 10cm, đẩy gối chạm tường mà gót không nhấc để đo độ linh hoạt cổ chân (Dorsiflexion).

3. BÀI TẬP CẢI THIỆN MOBILITY CHUYÊN BIỆT:
- Khớp hông (Hip Mobility): 90/90 Hip Switch, Frog Stretch, Hip CARs (Controlled Articular Rotations), Cossack Squat.
- Cổ chân (Ankle Mobility): Banded Ankle Distraction, Calf Wall Stretch, Deep Goblet Squat Hold with Ankle Shift.
- Khớp vai & Cột sống ngực (Thoracic & Shoulder): Cat-Cow rotation, Thread the Needle, PVC Pipe Dislocates, Band Pull-Aparts.

4. NGUYÊN TẮC ÁP DỤNG:
- Thực hiện 8-10 phút bài tập Mobility động trước buổi tập chính.
- Tập trung vào các khớp cần thiết cho buổi tập hôm đó (VD: Mobility hông/cổ chân cho ngày Leg Day; Mobility vai/ngực cho ngày Push/Pull Day).`,
  },

  // 5. Stretching & Phục hồi
  {
    title: 'Quy trình Giãn cơ Dynamic/Static, Foam Rolling & Phục hồi Cơ bắp',
    topic: 'STRETCHING_RECOVERY',
    content: `1. QUY TRÌNH GIÃN CƠ TRƯỚC VÀ SAU TẬP:
- Giãn cơ động (Dynamic Stretching) - Trước tập: Tăng thân nhiệt, bôi trơn ổ khớp, kích thích hệ thần kinh (Leg Swings, Arm Circles, Walking Lunges with Torso Twist, Inchworms). Thời gian: 5-7 phút.
- Giãn cơ tĩnh (Static Stretching) - Sau tập: Hạ nhịp tim, kéo dài các thớ cơ co cứng, chuyển hệ thần kinh sang trạng thái thư giãn đối giao cảm (Parasympathetic). Giữ mỗi tư thế 20-30 giây, thở sâu bằng bụng.

2. KỸ THUẬT FOAM ROLLING (SMR - TỰ GIẢI PHÓNG MÀNG CƠ):
- Sử dụng con lăn Foam Roller để tác động vào các điểm Trigger Points (nút thắt cơ).
- Các vùng cần lăn: Đùi trước (Quadriceps), Dải chậu chày (IT Band), Đùi sau (Hamstrings), Bắp chân (Gastrocnemius), Cơ lưng rộng (Latissimus Dorsi), Cơ mông (Gluteus).
- Lưu ý an toàn: Lăn chậm 1-2 inch/giây. Khi gặp điểm đau, dừng lại giữ 20-30 giây kết hợp thở sâu. Tuyệt đối không lăn lên khớp gối, khớp háng hoặc vùng thắt lưng dưới.

3. QUẢN LÝ NGÀY NGHỈ & GIẤC NGỦ:
- Giấc ngủ sâu 7-8 tiếng là thời điểm duy nhất cơ thể tiết ra Testosterone và HGH tự nhiên để phục hồi tổn thương cơ bắp.
- Phục hồi chủ động (Active Recovery): Đi bộ 30 phút ngoài trời, bơi nhẹ, ngâm nước ấm giúp tăng lưu thông máu đưa dinh dưỡng tới cơ bắp mà không gây mỏi thêm.`,
  },

  // 6. Sai lệch tư thế
  {
    title: 'Cẩm nang Nhận diện & Chỉnh sửa Sai lệch Tư thế (Posture Correction)',
    topic: 'POSTURE_CORRECTION',
    content: `1. CÁC DẠNG SAI LỆCH TƯ THẾ THƯỜNG GẶP:
- Hội chứng chéo trên (Upper Crossed Syndrome):
  + Biểu hiện: Vai cuộn về trước (Rounded Shoulders), đầu nhô về trước (Forward Head), lưng trên gù (Kyphosis).
  + Nguyên nhân: Ngồi máy tính/điện thoại nhiều khiến cơ ngực và cơ thang trên co cứng, cơ lưng giữa (Rhomboids, Lower Traps) và cơ gập cổ sâu bị suy yếu.
  + Giải pháp: Kéo giãn cơ ngực (Doorway Pec Stretch), tập mạnh cơ lưng trên (Face Pulls, Y-T-W Raises, Prone Cobra).

- Hội chứng chéo dưới (Lower Crossed Syndrome - Anterior Pelvic Tilt - APT):
  + Biểu hiện: Võng thắt lưng dưới, bụng dưới phình to dù gầy, xương chậu đổ về trước.
  + Nguyên nhân: Ngồi nhiều khiến cơ gập hông (Hip Flexors) và cơ thắt lưng co cứng, cơ mông (Glutes) và cơ bụng (Abs/Core) bị ức chế yếu đi.
  + Giải pháp: Kéo giãn cơ gập hông (Couch Stretch), tập kích hoạt cơ mông và cơ bụng (Barbell Hip Thrust, Glute Bridge, Deadbug, Hollow Body Hold, RKC Plank).

- Sụp gối (Knee Valgus):
  + Biểu hiện: Đầu gối chụm vào trong khi Squat, Lunge, tiếp đất nhảy.
  + Nguyên nhân: Cơ mông nhỡ (Gluteus Medius) yếu hoặc cổ chân thiếu linh hoạt.
  + Giải pháp: Đeo Miniband tập Clamshells, Lateral Band Walks, Goblet Squat with band around knees.

2. MOVEMENT SCREENING & BÀI TẬP THAY THẾ:
- Luôn kiểm tra chuyển động không tạ trước khi lắp tạ nặng. Nếu học viên chưa kiểm soát được tư thế trung tính (Neutral Spine), hãy thay bài tập phức tạp bằng các biến thể hỗ trợ (Regression).`,
  },

  // 7. Kỹ thuật bài tập
  {
    title: 'Profile Kỹ thuật Bài tập, Cues Coaching & Bài tập Thay thế An toàn',
    topic: 'EXERCISE_TECHNIQUE',
    content: `1. BARBELL BACK SQUAT (GÁNH ĐÙI):
- Setup: Đòn đặt trên cơ cầu vai (High-bar), 2 tay nắm chặt khóa bả vai, chân rộng bằng vai, mũi chân mở 15-30 độ.
- Execution: Hít sâu gồng bụng (Valsalva), đẩy hông ra sau đồng thời mở gối theo hướng mũi chân, xuống tới khi đùi song song hoặc dưới song song sàn.
- Cues Coaching: "Đạp sàn đẩy lên", "Mở gối", "Giữ ngực cao", "Khóa chặt bụng".
- Common Mistakes: Nhấc gót chân, sụp gối, cong lưng dưới (Butt Wink quá mức).
- Bài thay thế (Regression): Goblet Squat, Box Squat, Leg Press.

2. CONVENTIONAL DEADLIFT & ROMANIAN DEADLIFT (RDL):
- Setup: Thanh đòn cách cẳng chân 2-3cm, 2 bàn chân rộng bằng hông, tay nắm ngoài chân.
- Execution: Khóa khớp hông (Hip Hinge), siết cơ xô kéo thanh đòn sát chân, đạp sàn đứng thẳng siết mông.
- Cues Coaching: "Đạp gãy thanh đòn", "Đẩy sàn ra xa", "Giữ thanh đòn dính sát cẳng chân", "Khóa hông ở đỉnh".
- Common Mistakes: Cong lưng tôm, giật tạ bằng tay, ưỡn lưng quá mức ở đỉnh.
- Bài thay thế: Trap Bar Deadlift, Dumbbell RDL, Cable Pull-Through.

3. BARBELL BENCH PRESS (ĐẨY NGỰC):
- Setup: Nằm 5 điểm tiếp xúc (2 bàn chân, mông, lưng trên, đầu), khép và hạ xương bả vai, tạo độ cong tự nhiên lưng trên.
- Execution: Hạ đòn có kiểm soát về điểm ngực dưới (núm vú), cùi chỏ tạo góc 45-70 độ so với thân mình, đẩy thẳng lên trên.
- Cues Coaching: "Bẻ cong thanh đòn", "Ép bả vai xuống ghế", "Đạp chân xuống sàn tạo lực Leg Drive".
- Common Mistakes: Xòe cùi chỏ 90 độ gây kẹp bao gân vai, nhấc mông khỏi ghế, thả rơi đòn lên ngực.
- Bài thay thế: Dumbbell Bench Press, Floor Press, Push-up.

4. LAT PULLDOWN & SEATED CABLE ROW (LƯNG XÔ):
- Cues Coaching: "Hạ vai trước khi kéo tay", "Kéo cùi chỏ về phía túi quần sau", "Ưỡn nhẹ ngực đón tạ", "Giữ 1 giây siết cơ xô ở điểm cuối".`,
  },

  // 8. Quy trình PT (SOP)
  {
    title: 'Quy trình Vận hành Tiêu chuẩn (SOP) dành cho Huấn luyện viên 3S-Gym',
    topic: 'PT_WORKFLOW',
    content: `1. SOP 1: QUY TRÌNH TIẾP NHẬN HỌC VIÊN MỚI:
- Bước 1: Đón tiếp học viên đúng giờ, trang phục chuẩn PT 3S-Gym, nụ cười thân thiện.
- Bước 2: Phỏng vấn tiền sử bệnh lý, chấn thương cũ (PAR-Q), công việc và thói quen ăn uống.
- Bước 3: Lắng nghe mục tiêu cụ thể và thời hạn mong muốn của học viên.

2. SOP 2: QUY TRÌNH ĐO INBODY & ĐÁNH GIÁ CHUYỂN ĐỘNG:
- Bước 1: Hướng dẫn học viên đứng lên máy InBody đúng tư thế, quét và đồng bộ dữ liệu vào App 3S-Gym.
- Bước 2: Phân tích chỉ số trực quan và thực hiện 3 bài test chuyển động (Overhead Squat, Plank, Shoulder Mobility).
- Bước 3: Cùng học viên thống nhất mục tiêu SMART (Specific, Measurable, Achievable, Relevant, Time-bound).

3. SOP 3: THIẾT KẾ GIÁO ÁN & HƯỚNG DẪN BUỔI ĐẦU:
- Xây dựng giáo án cá nhân hóa trên hệ thống 3S-Gym.
- Buổi tập 1 tập trung vào cảm nhận cơ, hướng dẫn hít thở gồng core và kiểm soát mức tạ nhẹ. Không để học viên bị kiệt sức hoặc nôn nao.

4. SOP 4: ĐÁNH GIÁ ĐỊNH KỲ MỖI 4 TUẦN:
- Đo lại InBody vào tuần thứ 4, chụp ảnh so sánh tiến độ vóc dáng.
- Đánh giá mức tăng tiến tạ (Progressive Overload) và điều chỉnh thực đơn/giáo án cho chu kỳ tiếp theo.

5. SOP 5: QUY TRÌNH 5 PHÚT KẾT THÚC BUỔI TẬP:
- 3 phút giãn cơ tĩnh và thả lỏng.
- 2 phút dặn dò uống nước, dinh dưỡng bữa sau tập và ghi nhận Check-in buổi tập trên App 3S-Gym, xác nhận lịch buổi tới.`,
  },

  // 9. Quy trình Chăm sóc học viên
  {
    title: 'Sổ tay 13 Tình huống Chăm sóc Học viên Thực chiến (Customer Care)',
    topic: 'CUSTOMER_CARE',
    content: `1. CHĂM SÓC SAU BUỔI ĐẦU TIÊN:
- Việc làm: Nhắn tin hỏi thăm mức độ đau nhức cơ DOMS vào sáng hôm sau.
- Kịch bản: "Chào [Tên], hôm qua buổi đầu tập về cơ bắp của em có bị ê ẩm nhiều không? Đây là phản ứng rất bình thường khi cơ được đánh thức. Em nhớ uống đủ 2.5L nước và ăn đủ đạm nhé!"
- Ghi nhận App: Cập nhật trạng thái thể lực buổi 1.

2. KHÁCH NGHỈ TẬP 1-2 BUỔI LIÊN TIẾP:
- Việc làm: Nhắn tin chia sẻ chân thành sau 24h kể từ buổi hủy thứ 2.
- Kịch bản: "Anh/chị [Tên] ơi, đợt này công việc bận rộn nhiều hả anh/chị? Em luôn sẵn sàng sắp xếp đổi sang khung giờ linh hoạt hơn để mình không bị đứt quãng tiến độ nhé!"
- Ghi nhận App: Đặt Care Task nhắc nhở sau 2 ngày.

3. KHÁCH NGHỈ TẬP LÂU (QUÁ 5-7 NGÀY):
- Việc làm: Gọi điện hoặc nhắn tin kịch bản khơi gợi lại mục tiêu ban đầu.
- Kịch bản: "Em chào chị [Tên], cả tuần nay không thấy chị ghé phòng tập, em nhớ chị quá! Mục tiêu giảm 4kg đón Tết của chị em mình đang đi được nửa chặng đường rồi, chiều mai chị qua em hướng dẫn 1 buổi giãn cơ nhẹ nhàng nạp lại năng lượng nhé!"

4. TIẾN ĐỘ BỊ CHỮNG CÂN (WEIGHT PLATEAU):
- Việc làm: Trấn an tâm lý, rà soát nhật ký ăn uống thực tế và đo lại InBody.
- Kịch bản: "Chị đừng lo lắng nhé, việc chững cân sau 3 tuần là phản ứng sinh lý thích nghi hoàn toàn bình thường của cơ thể. Em đã rà soát lại và điều chỉnh phân bổ Carbs cho chị, tuần tới cơ thể sẽ tiếp tục đốt mỡ mạnh mẽ trở lại!"

5. KHÁCH SẮP HẾT GÓI TẬP (CÒN 3-5 BUỔI):
- Việc làm: Đo InBody tổng kết giai đoạn 1, xuất báo cáo trước-sau trên App và phác thảo lộ trình giai đoạn 2.
- Kịch bản: "Chúc mừng anh [Tên] đã hoàn thành xuất sắc mục tiêu giảm 3.5kg mỡ của giai đoạn 1! Để giữ vững vóc dáng này và bước vào giai đoạn 2 tăng cơ định hình cơ bắp sắc nét, em đã thiết kế sẵn lộ trình tiếp theo cho anh..."`,
  },

  // 10. Kịch bản Tư vấn & Xử lý từ chối
  {
    title: 'Bộ Kịch bản Tư vấn Chuyên sâu & Xử lý 8 Tình huống Từ chối (Sales Script)',
    topic: 'SALES_CONSULTATION',
    content: `1. KHAI THÁC PAIN POINT & TƯ VẤN THEO INBODY:
- Kịch bản: "Dựa trên kết quả InBody, tỷ lệ mỡ của anh đang ở mức 26% và mỡ nội tạng mức 11. Đây chính là nguyên nhân khiến anh hay thấy nặng nề và đau mỏi lưng dưới khi ngồi lâu. Với lộ trình 12 tuần này, em cam kết đồng hành giúp anh đưa mỡ về mức chuẩn 16% và dứt điểm đau mỏi lưng."

2. XỬ LÝ TỪ CHỐI: "GIÁ PT BÊN EM CAO QUÁ":
- Kịch bản: "Em rất hiểu chi phí là yếu tố anh/chị cân nhắc. Tuy nhiên tại 3S-Gym, mức phí này không chỉ là 1 giờ tập trên sàn, mà là toàn bộ giải pháp trọn gói: Giáo án cá nhân hóa độc quyền trên App, theo dõi dinh dưỡng từng bữa ăn hàng ngày và bảo hiểm an toàn khớp 100%. Nếu tự tập sai vừa mất 6 tháng không kết quả vừa tốn chi phí trị liệu đau khớp, thì đầu tư PT ngay từ đầu là giải pháp tiết kiệm nhất ạ."

3. XỬ LÝ TỪ CHỐI: "ĐỂ ANH/CHỊ VỀ SUY NGHĨ THÊM":
- Kịch bản: "Dạ vâng, quyết định đầu tư cho sức khỏe cần sự cân nhắc kỹ lưỡng ạ. Không biết anh/chị còn băn khoăn về thời gian biểu tập luyện hay về phương pháp dinh dưỡng bên em để em làm rõ thêm cho mình an tâm ạ? Chiều mai em mời anh/chị trải nghiệm thử 1 buổi tập thực tế 45 phút không tính phí trước nhé!"

4. XỬ LÝ TỪ CHỐI: "EM TỰ TẬP TRÊN YOUTUBE / TIKTOK ĐƯỢC":
- Kịch bản: "Video trên mạng rất hay nhưng họ không nhìn thấy được góc gập cổ chân hay độ cong cột sống của riêng em. Rất nhiều bạn tự tập sau 2 tháng phải đến gặp PT vì bị đau thắt lưng và đau khớp gối do sai góc chuyển động. Có PT chỉnh form trực tiếp từng rep sẽ giúp em tiến bộ nhanh gấp 3 lần và an toàn tuyệt đối."

5. XỬ LÝ TỪ CHỐI: "DẠO NÀY ANH/CHỊ BẬN QUÁ":
- Kịch bản: "Chính vì anh/chị bận rộn nên càng cần PT để tối ưu hóa thời gian ạ! Thay vì phải loay hoay 90 phút ở phòng tập, giáo án của em được thiết kế cô đọng trong đúng 45 phút, lịch tập linh hoạt theo tuần, giúp anh/chị vừa tiết kiệm thời gian vừa nhân đôi năng lượng làm việc."

6. KỊCH BẢN FOLLOW-UP SAU 24H BUỔI TẬP TRẢI NGHIỆM:
- Kịch bản: "Chào chị [Tên], hôm qua tập xong cơ thể chị cảm thấy thế nào ạ? Em vừa hoàn thiện bản lộ trình 12 tuần chi tiết dựa trên các bài test hôm qua của chị trên hệ thống 3S-Gym. Hôm nay phòng tập đang có chương trình tặng 3 buổi kèm khi kích hoạt gói trong tuần, em giữ ưu đãi này cho chị nhé!"`,
  },
];
