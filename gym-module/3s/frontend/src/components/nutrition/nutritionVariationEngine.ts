import type { MealBlock, MealFoodItem } from './MealCardItem';

export interface DayVariationTemplate {
  dayOfWeek: string;
  theme: string;
  meals: Array<{
    name: string;
    timeSlot: string;
    kcalRatio: number;
    items: Array<{
      name: string;
      amount: string;
      proteinRatio: number;
      carbsRatio: number;
      fatRatio: number;
      kcalRatio: number;
      prepTip?: string;
    }>;
  }>;
}

// Thư viện 7 ngày thực đơn thể hình Việt Nam chuẩn khoa học, luân phiên đạm - tinh bột - rau xanh
export const VIETNAMESE_7DAYS_TEMPLATES: DayVariationTemplate[] = [
  // 1. Thứ Hai: Khởi động tuần với Ức gà & Thăn bò
  {
    dayOfWeek: 'Thứ Hai',
    theme: 'Ức gà áp chảo & Thăn bò tỏi',
    meals: [
      {
        name: 'Bữa Sáng',
        timeSlot: '07:00 - 07:45',
        kcalRatio: 0.25,
        items: [
          { name: 'Bánh mì đen lúa mạch', amount: '2 lát (70g)', proteinRatio: 0.15, carbsRatio: 0.75, fatRatio: 0.1, kcalRatio: 0.45, prepTip: 'Nướng giòn' },
          { name: 'Trứng gà ốp la ít dầu', amount: '2 quả', proteinRatio: 0.35, carbsRatio: 0.05, fatRatio: 0.6, kcalRatio: 0.45, prepTip: 'Dùng dầu oliu hoặc xịt chống dính' },
          { name: 'Salad dưa leo cà chua bi', amount: '1 đĩa (100g)', proteinRatio: 0.1, carbsRatio: 0.8, fatRatio: 0.1, kcalRatio: 0.1, prepTip: 'Rưới chút dấm táo' },
        ],
      },
      {
        name: 'Bữa Trưa',
        timeSlot: '12:00 - 12:45',
        kcalRatio: 0.35,
        items: [
          { name: 'Ức gà áp chảo sốt tiêu đen', amount: '180g', proteinRatio: 0.75, carbsRatio: 0.05, fatRatio: 0.2, kcalRatio: 0.5, prepTip: 'Ướp tiêu, tỏi, áp chảo chín tới không khô' },
          { name: 'Cơm gạo lứt huyết rồng', amount: '1 chén (150g)', proteinRatio: 0.1, carbsRatio: 0.85, fatRatio: 0.05, kcalRatio: 0.35, prepTip: 'Nấu mềm dẻo' },
          { name: 'Canh cải ngọt thịt bằm', amount: '1 tô vừa (200g)', proteinRatio: 0.35, carbsRatio: 0.4, fatRatio: 0.25, kcalRatio: 0.15, prepTip: 'Nêm nhạt, ít muối' },
        ],
      },
      {
        name: 'Bữa Phụ',
        timeSlot: '16:00 - 16:30',
        kcalRatio: 0.12,
        items: [
          { name: 'Chuối tiêu chín', amount: '1 quả vừa', proteinRatio: 0.05, carbsRatio: 0.9, fatRatio: 0.05, kcalRatio: 0.5, prepTip: 'Ăn trước tập 45-60 phút' },
          { name: 'Sữa chua Hy Lạp không đường', amount: '1 hộp (100g)', proteinRatio: 0.55, carbsRatio: 0.35, fatRatio: 0.1, kcalRatio: 0.5, prepTip: 'Trộn cùng hạt chia nếu thích' },
        ],
      },
      {
        name: 'Bữa Tối',
        timeSlot: '19:30 - 20:15',
        kcalRatio: 0.28,
        items: [
          { name: 'Thăn bò áp chảo tỏi tây', amount: '150g', proteinRatio: 0.65, carbsRatio: 0.05, fatRatio: 0.3, kcalRatio: 0.5, prepTip: 'Áp chảo lửa lớn 3-4 phút' },
          { name: 'Khoai lang mật hấp', amount: '1 củ vừa (150g)', proteinRatio: 0.05, carbsRatio: 0.9, fatRatio: 0.05, kcalRatio: 0.35, prepTip: 'Hấp giữ trọn vị ngọt tự nhiên' },
          { name: 'Rau muống luộc dầm chanh', amount: '1 đĩa (150g)', proteinRatio: 0.2, carbsRatio: 0.7, fatRatio: 0.1, kcalRatio: 0.15, prepTip: 'Nước luộc vắt chanh làm canh thanh nhiệt' },
        ],
      },
    ],
  },

  // 2. Thứ Ba: Cá hồi nướng & Heo thăn xào nấm
  {
    dayOfWeek: 'Thứ Ba',
    theme: 'Cá hồi măng tây & Heo thăn nạc',
    meals: [
      {
        name: 'Bữa Sáng',
        timeSlot: '07:00 - 07:45',
        kcalRatio: 0.25,
        items: [
          { name: 'Phở bò nạc tái ít bánh', amount: '1 tô vừa (100g bánh phở, 120g bò)', proteinRatio: 0.45, carbsRatio: 0.45, fatRatio: 0.1, kcalRatio: 0.85, prepTip: 'Nước dùng trong, không húp váng mỡ' },
          { name: 'Rau thơm & giá đỗ chần', amount: '1 đĩa nhỏ', proteinRatio: 0.2, carbsRatio: 0.7, fatRatio: 0.1, kcalRatio: 0.15, prepTip: 'Chần sơ giữ độ giòn' },
        ],
      },
      {
        name: 'Bữa Trưa',
        timeSlot: '12:00 - 12:45',
        kcalRatio: 0.35,
        items: [
          { name: 'Cá hồi áp chảo măng tây', amount: '150g cá + 80g măng tây', proteinRatio: 0.5, carbsRatio: 0.1, fatRatio: 0.4, kcalRatio: 0.55, prepTip: 'Cá áp chảo mặt da giòn rụm, giàu Omega-3' },
          { name: 'Cơm gạo lứt huyết rồng', amount: '1 chén (150g)', proteinRatio: 0.1, carbsRatio: 0.85, fatRatio: 0.05, kcalRatio: 0.3, prepTip: 'Nấu cùng chút đậu đỏ' },
          { name: 'Canh bí đỏ nấu thịt nạc', amount: '1 tô (150g bí, 30g thịt)', proteinRatio: 0.25, carbsRatio: 0.6, fatRatio: 0.15, kcalRatio: 0.15, prepTip: 'Nấu ngọt tự nhiên' },
        ],
      },
      {
        name: 'Bữa Phụ',
        timeSlot: '16:00 - 16:30',
        kcalRatio: 0.12,
        items: [
          { name: 'Trứng gà luộc lòng đào', amount: '2 quả', proteinRatio: 0.4, carbsRatio: 0.05, fatRatio: 0.55, kcalRatio: 0.7, prepTip: 'Luộc sôi 6 phút ngâm nước đá' },
          { name: 'Táo tươi giòn', amount: '1 quả nhỏ (120g)', proteinRatio: 0.05, carbsRatio: 0.9, fatRatio: 0.05, kcalRatio: 0.3, prepTip: 'Rửa sạch ăn cả vỏ' },
        ],
      },
      {
        name: 'Bữa Tối',
        timeSlot: '19:30 - 20:15',
        kcalRatio: 0.28,
        items: [
          { name: 'Thịt heo thăn xào nấm rơm', amount: '160g nạc thăn + 80g nấm', proteinRatio: 0.65, carbsRatio: 0.15, fatRatio: 0.2, kcalRatio: 0.5, prepTip: 'Xào nhanh lửa lớn với hành khô' },
          { name: 'Bún gạo lứt luộc', amount: '1 tô vừa (150g)', proteinRatio: 0.1, carbsRatio: 0.85, fatRatio: 0.05, kcalRatio: 0.35, prepTip: 'Trộn chút dầu mè cho thơm' },
          { name: 'Canh rau ngót nấu tôm bằm', amount: '1 tô (150g rau, 40g tôm)', proteinRatio: 0.4, carbsRatio: 0.45, fatRatio: 0.15, kcalRatio: 0.15, prepTip: 'Vò nhẹ lá rau ngót' },
        ],
      },
    ],
  },

  // 3. Thứ Tư: Tôm hấp nước dừa & Cháo yến mạch gà
  {
    dayOfWeek: 'Thứ Tư',
    theme: 'Tôm hấp sả dừa & Yến mạch ức gà',
    meals: [
      {
        name: 'Bữa Sáng',
        timeSlot: '07:00 - 07:45',
        kcalRatio: 0.25,
        items: [
          { name: 'Cháo yến mạch ức gà xé', amount: '50g yến mạch + 120g ức gà', proteinRatio: 0.5, carbsRatio: 0.4, fatRatio: 0.1, kcalRatio: 0.75, prepTip: 'Nấu yến mạch 5p, thả gà xé và rắc hành tiêu' },
          { name: 'Chuối già Nam Mỹ', amount: '1 quả (100g)', proteinRatio: 0.05, carbsRatio: 0.9, fatRatio: 0.05, kcalRatio: 0.25, prepTip: 'Bổ sung kali chống chuột rút' },
        ],
      },
      {
        name: 'Bữa Trưa',
        timeSlot: '12:00 - 12:45',
        kcalRatio: 0.35,
        items: [
          { name: 'Tôm hấp sả nước dừa tươi', amount: '200g tôm tươi', proteinRatio: 0.75, carbsRatio: 0.1, fatRatio: 0.15, kcalRatio: 0.45, prepTip: 'Hấp 5 phút tôm vừa chín tới giòn ngọt' },
          { name: 'Cơm gạo lứt huyết rồng', amount: '1 chén (150g)', proteinRatio: 0.1, carbsRatio: 0.85, fatRatio: 0.05, kcalRatio: 0.35, prepTip: 'Ăn chậm nhai kỹ' },
          { name: 'Canh mồng tơi nấu mướp cua đồng', amount: '1 tô vừa (200g)', proteinRatio: 0.35, carbsRatio: 0.45, fatRatio: 0.2, kcalRatio: 0.2, prepTip: 'Mát gan giải nhiệt' },
        ],
      },
      {
        name: 'Bữa Phụ',
        timeSlot: '16:00 - 16:30',
        kcalRatio: 0.12,
        items: [
          { name: 'Sinh tố bơ chuối sữa hạt', amount: '1 ly (1/2 quả bơ, 1/2 chuối, 150ml sữa hạt)', proteinRatio: 0.15, carbsRatio: 0.5, fatRatio: 0.35, kcalRatio: 1.0, prepTip: 'Chất béo đơn tốt cho tim mạch' },
        ],
      },
      {
        name: 'Bữa Tối',
        timeSlot: '19:30 - 20:15',
        kcalRatio: 0.28,
        items: [
          { name: 'Đùi gà góc tư lọc da nướng mật ong', amount: '160g thịt nạc', proteinRatio: 0.65, carbsRatio: 0.1, fatRatio: 0.25, kcalRatio: 0.5, prepTip: 'Nướng nồi chiên không dầu 180 độ 15p' },
          { name: 'Khoai tây bi nướng thảo mộc', amount: '150g', proteinRatio: 0.1, carbsRatio: 0.85, fatRatio: 0.05, kcalRatio: 0.35, prepTip: 'Rắc chút muối tiêu lá oregano' },
          { name: 'Bông cải xanh luộc', amount: '1 đĩa (150g)', proteinRatio: 0.25, carbsRatio: 0.7, fatRatio: 0.05, kcalRatio: 0.15, prepTip: 'Chấm nước tương tỏi ớt' },
        ],
      },
    ],
  },

  // 4. Thứ Năm: Cá lóc hấp gừng & Bò xào ớt chuông
  {
    dayOfWeek: 'Thứ Năm',
    theme: 'Cá lóc hấp hành & Bò xào ớt chuông',
    meals: [
      {
        name: 'Bữa Sáng',
        timeSlot: '07:00 - 07:45',
        kcalRatio: 0.25,
        items: [
          { name: 'Bánh cuốn nóng thịt nạc chả lụa', amount: '1 đĩa vừa (100g bánh, 80g thịt nạc & chả lụa nạc)', proteinRatio: 0.4, carbsRatio: 0.45, fatRatio: 0.15, kcalRatio: 0.8, prepTip: 'Nước mắm pha loãng chanh tỏi ớt' },
          { name: 'Dưa leo & giá đỗ thơm', amount: '1 đĩa nhỏ', proteinRatio: 0.15, carbsRatio: 0.8, fatRatio: 0.05, kcalRatio: 0.2, prepTip: 'Ăn kèm thanh mát' },
        ],
      },
      {
        name: 'Bữa Trưa',
        timeSlot: '12:00 - 12:45',
        kcalRatio: 0.35,
        items: [
          { name: 'Cá lóc hấp gừng hành hoa', amount: '220g cá lóc tươi phi lê', proteinRatio: 0.75, carbsRatio: 0.05, fatRatio: 0.2, kcalRatio: 0.5, prepTip: 'Cá tươi hấp ngọt thịt, không dầu mỡ' },
          { name: 'Cơm gạo lứt huyết rồng', amount: '1 chén (150g)', proteinRatio: 0.1, carbsRatio: 0.85, fatRatio: 0.05, kcalRatio: 0.35, prepTip: 'Giàu chất xơ no lâu' },
          { name: 'Canh chua cá bông lau miền Tây', amount: '1 tô (cà chua, dứa, đậu bắp, bạc hà)', proteinRatio: 0.2, carbsRatio: 0.65, fatRatio: 0.15, kcalRatio: 0.15, prepTip: 'Vị chua thanh kích thích tiêu hóa' },
        ],
      },
      {
        name: 'Bữa Phụ',
        timeSlot: '16:00 - 16:30',
        kcalRatio: 0.12,
        items: [
          { name: 'Khoai lang mật luộc', amount: '1 củ nhỏ (120g)', proteinRatio: 0.05, carbsRatio: 0.9, fatRatio: 0.05, kcalRatio: 0.6, prepTip: 'Carb hấp thu chậm dồi dào năng lượng' },
          { name: 'Sữa đậu nành nguyên chất ít đường', amount: '1 hộp (200ml)', proteinRatio: 0.45, carbsRatio: 0.4, fatRatio: 0.15, kcalRatio: 0.4, prepTip: 'Uống mát trước tập' },
        ],
      },
      {
        name: 'Bữa Tối',
        timeSlot: '19:30 - 20:15',
        kcalRatio: 0.28,
        items: [
          { name: 'Thịt bò xào ớt chuông ba màu', amount: '150g thịt bò + 100g ớt chuông', proteinRatio: 0.65, carbsRatio: 0.15, fatRatio: 0.2, kcalRatio: 0.5, prepTip: 'Ớt chuông giàu vitamin C hỗ trợ hấp thu sắt' },
          { name: 'Bắp ngô ngọt luộc', amount: '1 bắp vừa (120g hạt)', proteinRatio: 0.1, carbsRatio: 0.85, fatRatio: 0.05, kcalRatio: 0.35, prepTip: 'Bắp ngọt tự nhiên' },
          { name: 'Canh cải cúc nấu tôm tươi', amount: '1 tô vừa (150g cải cúc, 30g tôm)', proteinRatio: 0.35, carbsRatio: 0.5, fatRatio: 0.15, kcalRatio: 0.15, prepTip: 'Thanh mát dễ ngủ' },
        ],
      },
    ],
  },

  // 5. Thứ Sáu: Bún chả nạc & Mực hấp gừng
  {
    dayOfWeek: 'Thứ Sáu',
    theme: 'Bún chả nạc nướng & Mực hấp gừng',
    meals: [
      {
        name: 'Bữa Sáng',
        timeSlot: '07:00 - 07:45',
        kcalRatio: 0.25,
        items: [
          { name: 'Bún chả thịt nạc nướng không dầu', amount: '120g thịt nạc nướng + 100g bún', proteinRatio: 0.45, carbsRatio: 0.45, fatRatio: 0.1, kcalRatio: 0.85, prepTip: 'Nướng nồi chiên không dầu thơm lừng' },
          { name: 'Rau sống kinh giới tía tô', amount: '1 rổ nhỏ', proteinRatio: 0.15, carbsRatio: 0.8, fatRatio: 0.05, kcalRatio: 0.15, prepTip: 'Rửa sạch ngâm nước muối' },
        ],
      },
      {
        name: 'Bữa Trưa',
        timeSlot: '12:00 - 12:45',
        kcalRatio: 0.35,
        items: [
          { name: 'Ức gà xào nấm đông cô & cà rốt', amount: '180g ức gà + 60g nấm', proteinRatio: 0.7, carbsRatio: 0.15, fatRatio: 0.15, kcalRatio: 0.5, prepTip: 'Xào nhanh nước tương tỏi' },
          { name: 'Cơm gạo lứt huyết rồng', amount: '1 chén (150g)', proteinRatio: 0.1, carbsRatio: 0.85, fatRatio: 0.05, kcalRatio: 0.35, prepTip: 'Cơm dẻo thơm' },
          { name: 'Canh bí xanh sườn non lọc mỡ', amount: '1 tô (150g bí, 50g sườn nạc)', proteinRatio: 0.3, carbsRatio: 0.45, fatRatio: 0.25, kcalRatio: 0.15, prepTip: 'Hớt sạch bọt mỡ khi hầm' },
        ],
      },
      {
        name: 'Bữa Phụ',
        timeSlot: '16:00 - 16:30',
        kcalRatio: 0.12,
        items: [
          { name: 'Whey Protein Isolate hoặc Sữa tươi không đường', amount: '1 ly (250ml)', proteinRatio: 0.85, carbsRatio: 0.1, fatRatio: 0.05, kcalRatio: 0.6, prepTip: 'Nạp nhanh axit amin phục hồi cơ' },
          { name: 'Chuối tiêu chín', amount: '1 quả', proteinRatio: 0.05, carbsRatio: 0.9, fatRatio: 0.05, kcalRatio: 0.4, prepTip: 'Bổ sung glycogen' },
        ],
      },
      {
        name: 'Bữa Tối',
        timeSlot: '19:30 - 20:15',
        kcalRatio: 0.28,
        items: [
          { name: 'Mực ống tươi hấp gừng sả', amount: '180g mực', proteinRatio: 0.75, carbsRatio: 0.1, fatRatio: 0.15, kcalRatio: 0.5, prepTip: 'Hấp 6 phút mực giòn ngọt' },
          { name: 'Bún gạo lứt luộc', amount: '1 tô vừa (150g)', proteinRatio: 0.1, carbsRatio: 0.85, fatRatio: 0.05, kcalRatio: 0.35, prepTip: 'Thanh nhẹ cho buổi tối cuối tuần' },
          { name: 'Canh rong biển đậu phụ non thịt bằm', amount: '1 tô vừa (30g rong biển, 50g đậu phụ)', proteinRatio: 0.4, carbsRatio: 0.4, fatRatio: 0.2, kcalRatio: 0.15, prepTip: 'Thải độc và ngủ sâu giấc' },
        ],
      },
    ],
  },

  // 6. Thứ Bảy: Bò lúc lắc & Trứng cuộn rau củ
  {
    dayOfWeek: 'Thứ Bảy',
    theme: 'Bò lúc lắc thảo mộc & Cá thu áp chảo',
    meals: [
      {
        name: 'Bữa Sáng',
        timeSlot: '07:30 - 08:15',
        kcalRatio: 0.25,
        items: [
          { name: 'Trứng cuộn rau củ (cà rốt, nấm, hành)', amount: '3 quả trứng + 50g rau củ', proteinRatio: 0.45, carbsRatio: 0.15, fatRatio: 0.4, kcalRatio: 0.65, prepTip: 'Cuộn tròn cắt khoanh đẹp mắt' },
          { name: 'Bánh mì đen lúa mạch', amount: '2 lát (70g)', proteinRatio: 0.15, carbsRatio: 0.75, fatRatio: 0.1, kcalRatio: 0.35, prepTip: 'Phết chút bơ đậu phộng nếu thích' },
        ],
      },
      {
        name: 'Bữa Trưa',
        timeSlot: '12:00 - 12:45',
        kcalRatio: 0.35,
        items: [
          { name: 'Bò lúc lắc xào ớt chuông củ hành', amount: '160g thịt bò nạc + 80g rau củ', proteinRatio: 0.65, carbsRatio: 0.15, fatRatio: 0.2, kcalRatio: 0.5, prepTip: 'Xào lửa to lắc đều tay thơm phức' },
          { name: 'Khoai tây nướng bổ cau', amount: '1 củ to (180g)', proteinRatio: 0.1, carbsRatio: 0.85, fatRatio: 0.05, kcalRatio: 0.35, prepTip: 'Nướng vàng ruộm vỏ giòn' },
          { name: 'Salad xà lách dầu giấm sốt mè rang', amount: '1 tô (150g)', proteinRatio: 0.15, carbsRatio: 0.65, fatRatio: 0.2, kcalRatio: 0.15, prepTip: 'Chống ngấy cực tốt' },
        ],
      },
      {
        name: 'Bữa Phụ',
        timeSlot: '16:00 - 16:30',
        kcalRatio: 0.12,
        items: [
          { name: 'Ổi giòn gọt vỏ', amount: '1 quả to (150g)', proteinRatio: 0.05, carbsRatio: 0.9, fatRatio: 0.05, kcalRatio: 0.6, prepTip: 'Giàu chất xơ và Vitamin C' },
          { name: 'Hạt hạnh nhân sấy mộc', amount: '8-10 hạt (15g)', proteinRatio: 0.2, carbsRatio: 0.2, fatRatio: 0.6, kcalRatio: 0.4, prepTip: 'Cung cấp năng lượng bền bỉ' },
        ],
      },
      {
        name: 'Bữa Tối',
        timeSlot: '19:30 - 20:15',
        kcalRatio: 0.28,
        items: [
          { name: 'Cá thu sốt cà chua ít dầu', amount: '150g cá thu phi lê', proteinRatio: 0.6, carbsRatio: 0.1, fatRatio: 0.3, kcalRatio: 0.5, prepTip: 'Sốt cà chua tươi thơm nồng' },
          { name: 'Cơm gạo lứt huyết rồng', amount: '1 chén (150g)', proteinRatio: 0.1, carbsRatio: 0.85, fatRatio: 0.05, kcalRatio: 0.35, prepTip: 'Nhai kỹ' },
          { name: 'Rau cải ngồng luộc', amount: '1 đĩa (150g)', proteinRatio: 0.25, carbsRatio: 0.65, fatRatio: 0.1, kcalRatio: 0.15, prepTip: 'Độ ngọt tự nhiên của rau' },
        ],
      },
    ],
  },

  // 7. Chủ Nhật: Bánh canh tôm thịt & Gà hấp lá chanh
  {
    dayOfWeek: 'Chủ Nhật',
    theme: 'Gà hấp lá chanh & Tôm rim mặn ngọt',
    meals: [
      {
        name: 'Bữa Sáng',
        timeSlot: '08:00 - 08:45',
        kcalRatio: 0.25,
        items: [
          { name: 'Bánh canh bột gạo tôm thịt nạc', amount: '1 tô vừa (100g bánh canh, 80g tôm, 50g thịt nạc)', proteinRatio: 0.45, carbsRatio: 0.45, fatRatio: 0.1, kcalRatio: 0.85, prepTip: 'Nước lèo ngọt thanh từ rau củ và tôm' },
          { name: 'Hành hoa & ngò gai thái nhỏ', amount: '1 nhúm', proteinRatio: 0.1, carbsRatio: 0.8, fatRatio: 0.1, kcalRatio: 0.15, prepTip: 'Dậy mùi thơm đặc trưng' },
        ],
      },
      {
        name: 'Bữa Trưa',
        timeSlot: '12:00 - 12:45',
        kcalRatio: 0.35,
        items: [
          { name: 'Thịt gà ta hấp lá chanh bỏ da', amount: '180g thịt đùi & ức', proteinRatio: 0.75, carbsRatio: 0.05, fatRatio: 0.2, kcalRatio: 0.5, prepTip: 'Chấm muối tiêu chanh ớt truyền thống' },
          { name: 'Cơm gạo lứt huyết rồng', amount: '1 chén (150g)', proteinRatio: 0.1, carbsRatio: 0.85, fatRatio: 0.05, kcalRatio: 0.35, prepTip: 'Cơm dẻo ấm bụng' },
          { name: 'Canh mướp hương nấu thịt nạc bằm', amount: '1 tô (150g mướp, 30g nạc bằm)', proteinRatio: 0.3, carbsRatio: 0.55, fatRatio: 0.15, kcalRatio: 0.15, prepTip: 'Ngọt lịm vị mướp quê' },
        ],
      },
      {
        name: 'Bữa Phụ',
        timeSlot: '16:00 - 16:30',
        kcalRatio: 0.12,
        items: [
          { name: 'Sữa chua không đường trộn trái cây tươi', amount: '1 hũ (120g)', proteinRatio: 0.45, carbsRatio: 0.45, fatRatio: 0.1, kcalRatio: 0.6, prepTip: 'Bổ sung chất chống oxy hóa' },
          { name: 'Hạt điều rang mộc', amount: '1 muỗng (15g)', proteinRatio: 0.2, carbsRatio: 0.2, fatRatio: 0.6, kcalRatio: 0.4, prepTip: 'Chất béo tốt' },
        ],
      },
      {
        name: 'Bữa Tối',
        timeSlot: '19:30 - 20:15',
        kcalRatio: 0.28,
        items: [
          { name: 'Tôm sú rim mặn ngọt ít dầu', amount: '180g tôm', proteinRatio: 0.7, carbsRatio: 0.15, fatRatio: 0.15, kcalRatio: 0.5, prepTip: 'Rim với nước mắm ngon và chút đường ăn kiêng' },
          { name: 'Khoai lang hấp hoặc Cơm lứt', amount: '1 chén vừa (140g)', proteinRatio: 0.05, carbsRatio: 0.9, fatRatio: 0.05, kcalRatio: 0.35, prepTip: 'Nạp năng lượng phục hồi' },
          { name: 'Canh rau đay mồng tơi nấu tôm khô', amount: '1 tô vừa', proteinRatio: 0.35, carbsRatio: 0.5, fatRatio: 0.15, kcalRatio: 0.15, prepTip: 'Thanh mát giải nhiệt' },
        ],
      },
    ],
  },
];

/**
 * Sinh cấu trúc các bữa ăn theo tỷ lệ Calo & Macro mục tiêu
 */
export function buildMealsFromTemplate(
  template: DayVariationTemplate,
  targetKcal: number,
  mealCount: number = 4
): MealBlock[] {
  let templateMeals = template.meals;

  if (mealCount === 3) {
    templateMeals = [
      { ...template.meals[0], kcalRatio: 0.3 },
      { ...template.meals[1], kcalRatio: 0.4 },
      { ...template.meals[3], kcalRatio: 0.3 },
    ];
  } else if (mealCount === 2) {
    templateMeals = [
      { ...template.meals[1], name: 'Bữa Trưa (11:30)', kcalRatio: 0.5 },
      { ...template.meals[3], name: 'Bữa Tối (18:30)', kcalRatio: 0.5 },
    ];
  } else if (mealCount === 5) {
    templateMeals = [
      template.meals[0],
      template.meals[1],
      template.meals[2],
      template.meals[3],
      {
        name: 'Bữa Phụ Đêm (21:30)',
        timeSlot: '21:30 - 22:00',
        kcalRatio: 0.08,
        items: [
          { name: 'Sữa hạt ấm hoặc Casein Protein', amount: '1 ly (200ml)', proteinRatio: 0.7, carbsRatio: 0.2, fatRatio: 0.1, kcalRatio: 1.0, prepTip: 'Uống trước ngủ 30p giúp hồi phục cơ' },
        ],
      },
    ];
  }

  return templateMeals.map((m, mIdx) => {
    const mealTargetKcal = Math.round(targetKcal * m.kcalRatio);
    const items: MealFoodItem[] = m.items.map((it) => {
      const itKcal = Math.max(20, Math.round(mealTargetKcal * it.kcalRatio));
      const proteinG = Math.round((itKcal * it.proteinRatio) / 4);
      const carbsG = Math.round((itKcal * it.carbsRatio) / 4);
      const fatG = Math.round((itKcal * it.fatRatio) / 9);
      return {
        name: it.name,
        amount: it.amount,
        calories: itKcal,
        protein: proteinG,
        carbs: carbsG,
        fat: fatG,
        prepTip: it.prepTip,
      };
    });

    return {
      id: `meal_var_${Date.now()}_${mIdx}_${Math.random().toString(36).substr(2, 4)}`,
      name: m.name,
      timeSlot: m.timeSlot,
      targetKcal: mealTargetKcal,
      items,
    };
  });
}

/**
 * Tìm mẫu thực đơn theo thứ trong tuần
 */
export function getTemplateForDayOfWeek(dayOfWeekName: string): DayVariationTemplate {
  const found = VIETNAMESE_7DAYS_TEMPLATES.find((t) => t.dayOfWeek.toLowerCase() === dayOfWeekName.toLowerCase());
  return found || VIETNAMESE_7DAYS_TEMPLATES[0];
}

/**
 * Đổi ngẫu nhiên món ăn của 1 ngày sang 1 template khác
 */
export function randomizeDayMeals(currentDayMeals: MealBlock[], targetKcal: number, excludeDayName?: string): MealBlock[] {
  const availableTemplates = VIETNAMESE_7DAYS_TEMPLATES.filter((t) => t.dayOfWeek !== excludeDayName);
  const picked = availableTemplates[Math.floor(Math.random() * availableTemplates.length)] || VIETNAMESE_7DAYS_TEMPLATES[0];
  return buildMealsFromTemplate(picked, targetKcal, currentDayMeals.length || 4);
}
