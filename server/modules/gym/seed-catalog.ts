import { ObjectId } from "mongodb";
import { tenantFilter, type GymActor } from "./access";
import { records } from "./store";

export interface SeedFoodEntry {
  name: string;
  category: "PROTEIN" | "CARB" | "VEGGIE" | "FAT";
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingLabel: string;
  servingGrams: number;
  cookingNote: string;
  source: "SYSTEM" | "UPLOAD";
  keywords: string[];
}

/**
 * 43 standard Vietnamese gym dishes ported directly from 3S Gym
 * (6 DEFAULT_AVAILABLE_FOODS + 37 FOOD_DATABASE entries).
 * Macro & calorie values are per serving (scaled from per-100g * defaultServingGrams).
 */
const RAW_3S_FOODS: Array<{
  name: string;
  category: "PROTEIN" | "CARB" | "VEGGIE" | "FAT";
  kcal100: number;
  p100: number;
  c100: number;
  f100: number;
  grams: number;
  servingLabel: string;
  note: string;
  source: "SYSTEM" | "UPLOAD";
}> = [
  // 6 Món có sẵn mặc định (3S DEFAULT_AVAILABLE_FOODS)
  { name: "Thịt bò xào bông thiên lý", category: "PROTEIN", kcal100: 146, p100: 18.6, c100: 4, f100: 6, grams: 150, servingLabel: "1 đĩa (150g)", note: "Xào lửa lớn giữ độ giòn ngọt tự nhiên của bông thiên lý", source: "UPLOAD" },
  { name: "Cá bống kho tiêu gừng", category: "PROTEIN", kcal100: 130, p100: 20, c100: 2.6, f100: 4, grams: 150, servingLabel: "1 đĩa (150g)", note: "Kho keo ít đường, thêm tiêu đen ấm bụng", source: "UPLOAD" },
  { name: "Canh chua cá lóc miền Tây", category: "VEGGIE", kcal100: 54, p100: 7.2, c100: 3.2, f100: 1.2, grams: 250, servingLabel: "1 tô lớn (250g)", note: "Nấu cùng dứa, cà chua, bạc hà và đậu bắp thanh nhiệt", source: "UPLOAD" },
  { name: "Ức gà nướng sốt mù tạt mật ong", category: "PROTEIN", kcal100: 152, p100: 24.4, c100: 3.3, f100: 3.8, grams: 180, servingLabel: "1 phần (180g)", note: "Nướng nồi chiên không dầu 180°C trong 15 phút", source: "UPLOAD" },
  { name: "Trứng cuộn rau củ ngũ sắc", category: "PROTEIN", kcal100: 120, p100: 10, c100: 2.6, f100: 7.3, grams: 150, servingLabel: "1 đĩa (150g)", note: "Trộn cà rốt băm, hành tây và đậu cô ve cuộn ít dầu", source: "UPLOAD" },
  { name: "Chả cá thác lác hấp thì là", category: "PROTEIN", kcal100: 113, p100: 17.3, c100: 1.3, f100: 4, grams: 150, servingLabel: "1 đĩa (150g)", note: "Quết dẻo hấp cùng thì là chấm mắm tiêu chanh", source: "UPLOAD" },

  // 11 Protein (Đạm)
  { name: "Ức gà áp chảo sốt tiêu đen", category: "PROTEIN", kcal100: 144, p100: 25, c100: 1, f100: 2.8, grams: 180, servingLabel: "180g (1 phần)", note: "Ướp tiêu, tỏi, áp chảo chín tới không khô", source: "SYSTEM" },
  { name: "Thịt thăn bò áp chảo tỏi tây", category: "PROTEIN", kcal100: 187, p100: 25.3, c100: 0.7, f100: 8, grams: 150, servingLabel: "150g (1 phần)", note: "Áp chảo lửa lớn 3-4 phút", source: "SYSTEM" },
  { name: "Cá hồi áp chảo măng tây", category: "PROTEIN", kcal100: 206, p100: 22, c100: 2, f100: 12, grams: 150, servingLabel: "150g cá + măng tây", note: "Áp chảo mặt da giòn rụm, giàu Omega-3", source: "SYSTEM" },
  { name: "Tôm hấp sả nước dừa tươi", category: "PROTEIN", kcal100: 99, p100: 21, c100: 1, f100: 0.8, grams: 200, servingLabel: "200g (1 đĩa)", note: "Hấp 5 phút tôm vừa chín tới giòn ngọt", source: "SYSTEM" },
  { name: "Thịt heo thăn xào nấm rơm", category: "PROTEIN", kcal100: 156, p100: 22.5, c100: 3.1, f100: 5.6, grams: 160, servingLabel: "160g nạc thăn + nấm", note: "Xào nhanh lửa lớn với hành khô", source: "SYSTEM" },
  { name: "Trứng gà luộc lòng đào (2 quả)", category: "PROTEIN", kcal100: 145, p100: 13, c100: 1, f100: 10, grams: 100, servingLabel: "2 quả (100g)", note: "Luộc sôi 6 phút ngâm nước đá", source: "SYSTEM" },
  { name: "Đậu hũ trắng sốt cà chua ít dầu", category: "PROTEIN", kcal100: 76, p100: 8, c100: 2, f100: 4.5, grams: 200, servingLabel: "1 đĩa (200g)", note: "Đậu hũ non sốt cà chua ít dầu thanh đạm", source: "SYSTEM" },
  { name: "Cá rô phi phi lê áp chảo", category: "PROTEIN", kcal100: 105, p100: 20, c100: 0, f100: 2.2, grams: 180, servingLabel: "180g phi lê", note: "Phi lê áp chảo rắc muối hồng & thì là", source: "SYSTEM" },
  { name: "Mực ống hấp gừng sả", category: "PROTEIN", kcal100: 92, p100: 18, c100: 2.2, f100: 1.1, grams: 180, servingLabel: "180g (1 đĩa)", note: "Hấp giòn ngọt chấm muối tiêu chanh", source: "SYSTEM" },
  { name: "Whey Protein Isolate (1 scoop)", category: "PROTEIN", kcal100: 400, p100: 90, c100: 3.3, f100: 1.6, grams: 30, servingLabel: "1 muỗng (30g)", note: "Pha với 250ml nước lạnh hoặc sữa hạt", source: "SYSTEM" },
  { name: "Phở bò nạc tái ít bánh", category: "PROTEIN", kcal100: 108, p100: 10.3, c100: 12.8, f100: 1.7, grams: 350, servingLabel: "1 tô vừa (100g bánh, 120g bò)", note: "Nước dùng trong, không húp váng mỡ", source: "SYSTEM" },

  // 8 Carbs (Tinh bột)
  { name: "Cơm gạo lứt huyết rồng", category: "CARB", kcal100: 110, p100: 2.6, c100: 23.3, f100: 1, grams: 150, servingLabel: "1 chén (150g)", note: "Nấu mềm dẻo, ăn chậm nhai kỹ", source: "SYSTEM" },
  { name: "Khoai lang mật hấp", category: "CARB", kcal100: 86, p100: 1.6, c100: 20, f100: 0.1, grams: 150, servingLabel: "1 củ vừa (150g)", note: "Hấp giữ trọn vị ngọt tự nhiên", source: "SYSTEM" },
  { name: "Bánh mì đen lúa mạch", category: "CARB", kcal100: 265, p100: 13, c100: 43, f100: 3.5, grams: 70, servingLabel: "2 lát (70g)", note: "Nướng giòn thơm kẹp trứng hoặc bơ", source: "SYSTEM" },
  { name: "Cháo yến mạch ức gà xé", category: "CARB", kcal100: 110, p100: 9, c100: 16.5, f100: 1.8, grams: 200, servingLabel: "50g yến mạch + gà xé", note: "Nấu yến mạch 5p, thả gà xé và rắc hành tiêu", source: "SYSTEM" },
  { name: "Bún gạo lứt luộc", category: "CARB", kcal100: 110, p100: 2, c100: 24, f100: 0.3, grams: 150, servingLabel: "1 tô vừa (150g)", note: "Trộn chút dầu mè cho thơm", source: "SYSTEM" },
  { name: "Bắp ngọt / Ngô vàng luộc", category: "CARB", kcal100: 96, p100: 3.4, c100: 21, f100: 1.5, grams: 150, servingLabel: "1 bắp vừa (150g)", note: "Luộc ngọt tự nhiên, giàu chất xơ", source: "SYSTEM" },
  { name: "Khoai tây hấp / nghiền tiêu", category: "CARB", kcal100: 87, p100: 1.9, c100: 20, f100: 0.1, grams: 150, servingLabel: "1 củ vừa (150g)", note: "Hấp chín nghiền rắc tiêu thơm nức", source: "SYSTEM" },
  { name: "Cơm trắng dẻo", category: "CARB", kcal100: 130, p100: 2.7, c100: 28.5, f100: 0.3, grams: 130, servingLabel: "1 bát con (130g)", note: "Cơm dẻo ăn kèm các món giàu đạm", source: "SYSTEM" },

  // 11 Veggies & Soups (Rau củ & Canh)
  { name: "Rau thơm & giá đỗ chần", category: "VEGGIE", kcal100: 75, p100: 4, c100: 13, f100: 1, grams: 100, servingLabel: "1 đĩa nhỏ", note: "Chần sơ giữ độ giòn tươi ngon", source: "SYSTEM" },
  { name: "Rau muống luộc dầm chanh", category: "VEGGIE", kcal100: 20, p100: 3, c100: 2, f100: 0.3, grams: 150, servingLabel: "1 đĩa (150g)", note: "Nước luộc vắt chanh làm canh thanh nhiệt", source: "SYSTEM" },
  { name: "Salad dưa leo cà chua bi", category: "VEGGIE", kcal100: 25, p100: 1.1, c100: 5, f100: 0.2, grams: 140, servingLabel: "1 đĩa (140g)", note: "Rưới chút dấm táo hoặc sốt mè rang", source: "SYSTEM" },
  { name: "Bông cải xanh (Súp lơ) luộc", category: "VEGGIE", kcal100: 34, p100: 2.8, c100: 6.6, f100: 0.4, grams: 150, servingLabel: "1 đĩa (150g)", note: "Hấp hoặc luộc chín tới giòn ngọt", source: "SYSTEM" },
  { name: "Bắp cải luộc thanh ngọt", category: "VEGGIE", kcal100: 27, p100: 1.3, c100: 5.3, f100: 0.1, grams: 150, servingLabel: "1 đĩa (150g)", note: "Chấm trứng hoặc nước mắm tỏi ớt", source: "SYSTEM" },
  { name: "Canh cải ngọt thịt bằm", category: "VEGGIE", kcal100: 42, p100: 3.5, c100: 2, f100: 2, grams: 200, servingLabel: "1 tô vừa (200g)", note: "Nêm nhạt, ít muối, ngọt mát", source: "SYSTEM" },
  { name: "Canh bí đỏ nấu thịt nạc", category: "VEGGIE", kcal100: 48, p100: 3, c100: 6, f100: 1.5, grams: 200, servingLabel: "1 tô (150g bí, 30g thịt)", note: "Nấu ngọt tự nhiên giàu vitamin A", source: "SYSTEM" },
  { name: "Canh rau ngót nấu tôm bằm", category: "VEGGIE", kcal100: 40, p100: 4, c100: 3, f100: 1, grams: 200, servingLabel: "1 tô (150g rau, 40g tôm)", note: "Vò nhẹ lá rau ngót nấu thanh ngọt", source: "SYSTEM" },
  { name: "Canh mồng tơi mướp cua đồng", category: "VEGGIE", kcal100: 38, p100: 3, c100: 2.5, f100: 1.5, grams: 200, servingLabel: "1 tô vừa (200g)", note: "Mát gan giải nhiệt ngày nắng", source: "SYSTEM" },
  { name: "Măng tây xanh áp chảo tỏi", category: "VEGGIE", kcal100: 30, p100: 2.5, c100: 4, f100: 0.2, grams: 100, servingLabel: "1 phần (100g)", note: "Áp chảo lửa lớn với chút tỏi đập dập", source: "SYSTEM" },
  { name: "Dưa chuột tươi thái lát", category: "VEGGIE", kcal100: 15, p100: 0.7, c100: 3.3, f100: 0.1, grams: 150, servingLabel: "1 quả (150g)", note: "Rửa sạch thái lát chấm muối ớt", source: "SYSTEM" },

  // 7 Fat & Healthy Snacks (Chất béo tốt & Bữa phụ)
  { name: "Bơ sáp chín", category: "FAT", kcal100: 160, p100: 2, c100: 8.5, f100: 15, grams: 60, servingLabel: "1/2 quả (60g)", note: "Chất béo đơn tốt cho tim mạch", source: "SYSTEM" },
  { name: "Hạt hạnh nhân nướng mộc", category: "FAT", kcal100: 575, p100: 20, c100: 20, f100: 50, grams: 20, servingLabel: "1 vốc nhỏ (20g)", note: "Ăn vặt lành mạnh hoặc trộn cùng yến mạch", source: "SYSTEM" },
  { name: "Sữa chua Hy Lạp không đường", category: "FAT", kcal100: 90, p100: 10, c100: 4, f100: 3, grams: 100, servingLabel: "1 hộp (100g)", note: "Trộn cùng hạt chia hoặc hoa quả tươi", source: "SYSTEM" },
  { name: "Chuối tiêu chín", category: "FAT", kcal100: 90, p100: 1.1, c100: 23, f100: 0.3, grams: 100, servingLabel: "1 quả vừa (100g)", note: "Bổ sung kali, ăn trước tập 45-60 phút", source: "SYSTEM" },
  { name: "Táo tươi giòn", category: "FAT", kcal100: 54, p100: 0.4, c100: 13.5, f100: 0.2, grams: 120, servingLabel: "1 quả nhỏ (120g)", note: "Rửa sạch ăn cả vỏ giữ trọn chất xơ", source: "SYSTEM" },
  { name: "Hạt óc chó nướng mộc", category: "FAT", kcal100: 650, p100: 15, c100: 14, f100: 65, grams: 20, servingLabel: "1 vốc nhỏ (20g)", note: "Giàu Omega-3 và chất chống oxy hóa", source: "SYSTEM" },
  { name: "Dầu Olive Extra Virgin", category: "FAT", kcal100: 884, p100: 0, c100: 0, f100: 100, grams: 10, servingLabel: "1 thìa canh (10g)", note: "Trộn trực tiếp vào salad hoặc món rau", source: "SYSTEM" },
];

export const DEFAULT_GYM_FOODS: SeedFoodEntry[] = RAW_3S_FOODS.map((f) => ({
  name: f.name,
  category: f.category,
  calories: Math.round((f.kcal100 * f.grams) / 100),
  protein: Math.round(((f.p100 * f.grams) / 100) * 10) / 10,
  carbs: Math.round(((f.c100 * f.grams) / 100) * 10) / 10,
  fat: Math.round(((f.f100 * f.grams) / 100) * 10) / 10,
  servingLabel: f.servingLabel,
  servingGrams: f.grams,
  cookingNote: f.note,
  source: f.source,
  keywords: [f.category.toLowerCase()],
}));

export interface SeedExerciseEntry {
  name: string;
  muscleGroup: string;
  muscleGroups: string[];
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  trackingType: "STRENGTH" | "BODYWEIGHT" | "CARDIO" | "INTERVAL" | "MOBILITY";
  equipment: string;
  instructions: string;
}

/**
 * 32 standard shared gym exercises matching 3S Gym library coverage across
 * all 10 muscle groups and 5 tracking types.
 */
export const DEFAULT_GYM_EXERCISES: SeedExerciseEntry[] = [
  // Ngực (4)
  { name: "Barbell Bench Press", muscleGroup: "Ngực", muscleGroups: ["Ngực", "Tay sau", "Vai"], level: "INTERMEDIATE", trackingType: "STRENGTH", equipment: "Thanh đòn, ghế phẳng", instructions: "Nằm ngửa trên ghế phẳng, khóa bả vai, hạ thanh tạ kiểm soát chạm ngực giữa rồi đẩy mạnh lên." },
  { name: "Incline Dumbbell Press", muscleGroup: "Ngực", muscleGroups: ["Ngực", "Vai"], level: "BEGINNER", trackingType: "STRENGTH", equipment: "Tạ đơn, ghế dốc 30°", instructions: "Đặt ghế dốc 30 độ, giữ khuỷu tay tạo góc 45 độ so với thân, đẩy tạ đều hai bên để tập trung ngực trên." },
  { name: "Cable Chest Fly", muscleGroup: "Ngực", muscleGroups: ["Ngực"], level: "BEGINNER", trackingType: "STRENGTH", equipment: "Máy kéo cáp đôi", instructions: "Bước một chân lên trước giữ thăng bằng, hơi gập khuỷu tay, ép hai tay về trước ngực và siết cơ ngực 1 giây." },
  { name: "Push-Up", muscleGroup: "Ngực", muscleGroups: ["Ngực", "Tay sau", "Bụng / Core"], level: "BEGINNER", trackingType: "BODYWEIGHT", equipment: "Không dụng cụ", instructions: "Giữ thân người thẳng từ đầu đến gót chân, gồng core, hạ ngực sát sàn rồi đẩy lên dứt khoát." },

  // Lưng (4)
  { name: "Lat Pulldown", muscleGroup: "Lưng", muscleGroups: ["Lưng", "Tay trước"], level: "BEGINNER", trackingType: "STRENGTH", equipment: "Máy kéo xô", instructions: "Ngồi cố định đùi, nắm thanh rộng hơn vai, kéo thanh về phía ngực trên bằng cách ép bả vai xuống." },
  { name: "Seated Cable Row", muscleGroup: "Lưng", muscleGroups: ["Lưng", "Tay trước"], level: "BEGINNER", trackingType: "STRENGTH", equipment: "Máy kéo cáp ngồi", instructions: "Giữ lưng thẳng trung tính, kéo tay cầm về phía rốn, ép sát hai bả vai rồi thả chậm có kiểm soát." },
  { name: "Barbell Bent-Over Row", muscleGroup: "Lưng", muscleGroups: ["Lưng", "Bụng / Core"], level: "INTERMEDIATE", trackingType: "STRENGTH", equipment: "Thanh đòn", instructions: "Gập hông khoảng 45 độ, giữ lưng phẳng, kéo thanh đòn hướng về bụng dưới và kiểm soát nhịp hạ." },
  { name: "Pull-Up", muscleGroup: "Lưng", muscleGroups: ["Lưng", "Tay trước"], level: "ADVANCED", trackingType: "BODYWEIGHT", equipment: "Xà đơn", instructions: "Treo người tự nhiên, siết bả vai kéo cằm vượt qua thanh xà, hạ chậm hết biên độ." },

  // Chân (5)
  { name: "Barbell Back Squat", muscleGroup: "Chân", muscleGroups: ["Chân", "Mông", "Bụng / Core"], level: "INTERMEDIATE", trackingType: "STRENGTH", equipment: "Thanh đòn, khung squat", instructions: "Đặt thanh đòn trên cơ cầu vai, hít sâu gồng bụng, đẩy hông ra sau và hạ đùi song song sàn rồi đạp mạnh gót chân đứng lên." },
  { name: "Leg Press", muscleGroup: "Chân", muscleGroups: ["Chân", "Mông"], level: "BEGINNER", trackingType: "STRENGTH", equipment: "Máy đạp đùi 45°", instructions: "Đặt bàn chân rộng bằng vai giữa bàn đạp, hạ gối kiểm soát không nhấc lưng dưới khỏi ghế, đạp lên không khóa cứng khớp gối." },
  { name: "Romanian Deadlift", muscleGroup: "Chân", muscleGroups: ["Chân", "Mông", "Lưng"], level: "INTERMEDIATE", trackingType: "STRENGTH", equipment: "Thanh đòn hoặc tạ đơn", instructions: "Hơi chùng gối cố định, đẩy hông ra sau trượt tạ sát ống đồng đến khi căng đùi sau, sau đó siết mông đứng thẳng." },
  { name: "Walking Lunge", muscleGroup: "Chân", muscleGroups: ["Chân", "Mông"], level: "BEGINNER", trackingType: "STRENGTH", equipment: "Tạ đơn", instructions: "Bước dài về trước, hạ gối sau gần chạm sàn sao cho cả hai gối tạo góc 90 độ, đạp chân trước tiến lên." },
  { name: "Leg Curl Machine", muscleGroup: "Chân", muscleGroups: ["Chân"], level: "BEGINNER", trackingType: "STRENGTH", equipment: "Máy móc đùi sau", instructions: "Cố định hông sát đệm, gập gối kéo đệm lăn về phía mông và giữ đỉnh co cơ 1 giây." },

  // Mông (3)
  { name: "Barbell Hip Thrust", muscleGroup: "Mông", muscleGroups: ["Mông", "Chân"], level: "INTERMEDIATE", trackingType: "STRENGTH", equipment: "Thanh đòn, ghế tập, đệm hông", instructions: "Tựa lưng trên vào mép ghế, cẳng chân vuông góc mặt sàn ở điểm cao nhất, đẩy hông lên siết chặt cơ mông." },
  { name: "Bulgarian Split Squat", muscleGroup: "Mông", muscleGroups: ["Mông", "Chân"], level: "INTERMEDIATE", trackingType: "STRENGTH", equipment: "Tạ đơn, ghế tập", instructions: "Đặt mu bàn chân sau lên ghế, đổ nhẹ thân người về trước để ưu tiên cơ mông, hạ sâu và đạp gót chân trước đứng lên." },
  { name: "Cable Glute Kickback", muscleGroup: "Mông", muscleGroups: ["Mông"], level: "BEGINNER", trackingType: "STRENGTH", equipment: "Máy cáp, dây cổ chân", instructions: "Giữ thân trên ổn định, đá chân ra sau theo đường vòng cung nhẹ và siết mông tối đa không võng lưng." },

  // Vai (3)
  { name: "Overhead Barbell Press", muscleGroup: "Vai", muscleGroups: ["Vai", "Tay sau", "Bụng / Core"], level: "INTERMEDIATE", trackingType: "STRENGTH", equipment: "Thanh đòn", instructions: "Đứng vững gồng chặt bụng và mông, đẩy thanh tạ thẳng lên qua đầu rồi hạ kiểm soát về ngang xương đòn." },
  { name: "Dumbbell Lateral Raise", muscleGroup: "Vai", muscleGroups: ["Vai"], level: "BEGINNER", trackingType: "STRENGTH", equipment: "Tạ đơn", instructions: "Hơi gập khuỷu tay, nâng tạ sang ngang tới độ cao ngang vai, không nhún cầu vai, hạ chậm kiểm soát." },
  { name: "Cable Face Pull", muscleGroup: "Vai", muscleGroups: ["Vai", "Lưng"], level: "BEGINNER", trackingType: "STRENGTH", equipment: "Máy cáp, dây thừng", instructions: "Kéo dây thừng về ngang trán đồng thời mở rộng khuỷu tay và xoay ngoài vai để tăng cường vai sau." },

  // Tay trước (2)
  { name: "Dumbbell Bicep Curl", muscleGroup: "Tay trước", muscleGroups: ["Tay trước"], level: "BEGINNER", trackingType: "STRENGTH", equipment: "Tạ đơn", instructions: "Khóa khuỷu tay sát thân người, cuốn tạ lên không đung đưa lưng, siết tay trước ở đỉnh và hạ chậm." },
  { name: "Hammer Curl", muscleGroup: "Tay trước", muscleGroups: ["Tay trước"], level: "BEGINNER", trackingType: "STRENGTH", equipment: "Tạ đơn", instructions: "Giữ lòng bàn tay hướng vào nhau suốt chuyển động để tác động tốt vào cơ cánh tay và cẳng tay." },

  // Tay sau (2)
  { name: "Cable Tricep Pushdown", muscleGroup: "Tay sau", muscleGroups: ["Tay sau"], level: "BEGINNER", trackingType: "STRENGTH", equipment: "Máy cáp, dây thừng hoặc thanh thẳng", instructions: "Khóa chặt khuỷu tay bên sườn, duỗi thẳng cẳng tay xuống dưới và tách nhẹ dây ở điểm cuối." },
  { name: "Overhead Dumbbell Tricep Extension", muscleGroup: "Tay sau", muscleGroups: ["Tay sau"], level: "INTERMEDIATE", trackingType: "STRENGTH", equipment: "Tạ đơn", instructions: "Giữ khuỷu tay hướng lên trần nhà, hạ tạ ra sau đầu căng sâu đầu dài cơ tay sau rồi đẩy thẳng lên." },

  // Bụng / Core (3)
  { name: "Front Plank", muscleGroup: "Bụng / Core", muscleGroups: ["Bụng / Core"], level: "BEGINNER", trackingType: "BODYWEIGHT", equipment: "Thảm tập", instructions: "Chống khuỷu tay thẳng dưới vai, cuộn nhẹ xương chậu, siết chặt cơ bụng và mông giữ thân thẳng." },
  { name: "Hanging Leg Raise", muscleGroup: "Bụng / Core", muscleGroups: ["Bụng / Core"], level: "ADVANCED", trackingType: "BODYWEIGHT", equipment: "Xà đơn", instructions: "Treo người chắc chắn, cuộn hông nâng hai chân lên cao kiểm soát, tránh lấy đà đung đưa." },
  { name: "Dead Bug", muscleGroup: "Bụng / Core", muscleGroups: ["Bụng / Core"], level: "BEGINNER", trackingType: "BODYWEIGHT", equipment: "Thảm tập", instructions: "Nằm ngửa ép sát lưng dưới xuống thảm, duỗi chéo tay và chân đối diện từ từ kết hợp thở ra đều." },

  // Toàn thân (2)
  { name: "Conventional Deadlift", muscleGroup: "Toàn thân", muscleGroups: ["Toàn thân", "Lưng", "Chân", "Mông"], level: "ADVANCED", trackingType: "STRENGTH", equipment: "Thanh đòn", instructions: "Thanh tạ sát giữa bàn chân, giữ lưng trung tính, siết xô, đạp sàn nâng tạ sát ống đồng lên đến khi khóa hông." },
  { name: "Kettlebell Swing", muscleGroup: "Toàn thân", muscleGroups: ["Toàn thân", "Mông", "Bụng / Core"], level: "INTERMEDIATE", trackingType: "INTERVAL", equipment: "Tạ ấm Kettlebell", instructions: "Phát lực từ động tác gập - duỗi hông bùng nổ (hip hinge), đánh tạ lên ngang ngực bằng lực mông đùi." },

  // Tim mạch / Cardio & Interval & Mobility (4)
  { name: "Incline Treadmill Walk (Zone 2)", muscleGroup: "Tim mạch / Cardio", muscleGroups: ["Tim mạch / Cardio", "Chân"], level: "BEGINNER", trackingType: "CARDIO", equipment: "Máy chạy bộ", instructions: "Thiết lập độ dốc 8–12%, tốc độ 4.5–5.5 km/h, duy trì nhịp tim 60–70% Max HR, không bám tay vịn." },
  { name: "Stationary Bike Endurance", muscleGroup: "Tim mạch / Cardio", muscleGroups: ["Tim mạch / Cardio", "Chân"], level: "BEGINNER", trackingType: "CARDIO", equipment: "Xe đạp tập cố định", instructions: "Điều chỉnh yên ngang hông, duy trì vòng quay 75–90 RPM với mức kháng lực vừa phải để đốt mỡ bền vững." },
  { name: "Assault Bike HIIT Interval", muscleGroup: "Tim mạch / Cardio", muscleGroups: ["Tim mạch / Cardio", "Toàn thân"], level: "ADVANCED", trackingType: "INTERVAL", equipment: "Xe đạp quạt Assault Bike", instructions: "Đạp nước rút hết sức 20–30 giây luân phiên nghỉ nhẹ 40–60 giây theo số vòng quy định." },
  { name: "World's Greatest Stretch & Hip Mobility", muscleGroup: "Toàn thân", muscleGroups: ["Toàn thân", "Chân", "Lưng"], level: "BEGINNER", trackingType: "MOBILITY", equipment: "Thảm tập", instructions: "Bước lunge sâu, đặt tay trong bàn chân và xoay mở ngực hướng lên trần, giữ 3–5 giây mỗi bên để giải phóng khớp hông và cột sống ngực." },
];

export async function seedDefaultFoods(actor: GymActor) {
  const existing = await records("food-images")
    .find(tenantFilter(actor))
    .project({ name: 1 })
    .limit(500)
    .toArray();
  const names = new Set(existing.map((item) => String(item.name || "").trim().toLowerCase()));
  const now = new Date().toISOString();
  const docs: any[] = [];
  for (const item of DEFAULT_GYM_FOODS) {
    if (names.has(item.name.toLowerCase())) continue;
    docs.push({
      _id: new ObjectId().toHexString(),
      ...tenantFilter(actor),
      ...item,
      revision: 1,
      createdBy: actor.userId,
      createdAt: now,
      updatedAt: now,
    });
  }
  if (docs.length > 0) {
    await records("food-images").insertMany(docs);
  }
  return { insertedCount: docs.length, totalDefaults: DEFAULT_GYM_FOODS.length };
}

export async function seedDefaultExercises(actor: GymActor) {
  const existing = await records("exercises")
    .find(tenantFilter(actor))
    .project({ name: 1 })
    .limit(500)
    .toArray();
  const names = new Set(existing.map((item) => String(item.name || "").trim().toLowerCase()));
  const now = new Date().toISOString();
  const docs: any[] = [];
  for (const item of DEFAULT_GYM_EXERCISES) {
    if (names.has(item.name.toLowerCase())) continue;
    docs.push({
      _id: new ObjectId().toHexString(),
      ...tenantFilter(actor),
      ...item,
      videos: [],
      revision: 1,
      createdBy: actor.userId,
      createdAt: now,
      updatedAt: now,
    });
  }
  if (docs.length > 0) {
    await records("exercises").insertMany(docs);
  }
  return { insertedCount: docs.length, totalDefaults: DEFAULT_GYM_EXERCISES.length };
}
