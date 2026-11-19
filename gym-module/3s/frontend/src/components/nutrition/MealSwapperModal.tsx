import { useState, useEffect, useId, useMemo, useRef } from 'react';
import {
  ArrowRightLeft,
  Check,
  Search,
  X,
  Plus,
  Trash2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Layers,
} from 'lucide-react';
import type { FoodItem, FoodCategory } from '../../types';

export interface CurrentMealItemContext {
  name: string;
  amount: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  prepTip?: string;
  mealName?: string;
}

export interface SwapResultPayload {
  name: string;
  amount: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  prepTip?: string;
}

export interface MealSwapperModalProps {
  open: boolean;
  onClose: () => void;
  currentDish?: CurrentMealItemContext;
  initialFoodName?: string;
  initialGrams?: string;
  targetItemLabel?: string;
  onApplySwap?: (swapResult: SwapResultPayload) => void;
}

export interface CustomFoodItem extends FoodItem {
  isCustom?: boolean;
}

export const STORAGE_KEY_CUSTOM_FOODS = '3s_gym_custom_food_database';

// Danh sách món có sẵn mặc định trong hệ thống để học viên và PT tham khảo nhanh
export const DEFAULT_AVAILABLE_FOODS: CustomFoodItem[] = [
  {
    id: 'avail_bo_thien_ly',
    name: 'Thịt bò xào bông thiên lý',
    category: 'protein',
    categoryLabel: 'Món có sẵn',
    caloriesPer100g: 146,
    proteinPer100g: 18.6,
    carbsPer100g: 4,
    fatPer100g: 6,
    unit: 'đĩa',
    defaultServingGrams: 150,
    servingLabel: '1 đĩa (150g)',
    prepTip: 'Xào lửa lớn giữ độ giòn ngọt tự nhiên của bông thiên lý',
    isCustom: true,
  },
  {
    id: 'avail_ca_bong_kho',
    name: 'Cá bống kho tiêu gừng',
    category: 'protein',
    categoryLabel: 'Món có sẵn',
    caloriesPer100g: 130,
    proteinPer100g: 20,
    carbsPer100g: 2.6,
    fatPer100g: 4,
    unit: 'đĩa',
    defaultServingGrams: 150,
    servingLabel: '1 đĩa (150g)',
    prepTip: 'Kho keo ít đường, thêm tiêu đen ấm bụng',
    isCustom: true,
  },
  {
    id: 'avail_canh_chua_ca_loc',
    name: 'Canh chua cá lóc miền Tây',
    category: 'veggies',
    categoryLabel: 'Món có sẵn',
    caloriesPer100g: 54,
    proteinPer100g: 7.2,
    carbsPer100g: 3.2,
    fatPer100g: 1.2,
    unit: 'tô',
    defaultServingGrams: 250,
    servingLabel: '1 tô lớn (250g)',
    prepTip: 'Nấu cùng dứa, cà chua, bạc hà và đậu bắp thanh nhiệt',
    isCustom: true,
  },
  {
    id: 'avail_uc_ga_mu_tat',
    name: 'Ức gà nướng sốt mù tạt mật ong',
    category: 'protein',
    categoryLabel: 'Món có sẵn',
    caloriesPer100g: 152,
    proteinPer100g: 24.4,
    carbsPer100g: 3.3,
    fatPer100g: 3.8,
    unit: 'phần',
    defaultServingGrams: 180,
    servingLabel: '1 phần (180g)',
    prepTip: 'Nướng nồi chiên không dầu 180°C trong 15 phút',
    isCustom: true,
  },
  {
    id: 'avail_trung_cuon_ngu_sac',
    name: 'Trứng cuộn rau củ ngũ sắc',
    category: 'protein',
    categoryLabel: 'Món có sẵn',
    caloriesPer100g: 120,
    proteinPer100g: 10,
    carbsPer100g: 2.6,
    fatPer100g: 7.3,
    unit: 'đĩa',
    defaultServingGrams: 150,
    servingLabel: '1 đĩa (150g)',
    prepTip: 'Trộn cà rốt băm, hành tây và đậu cô ve cuộn ít dầu',
    isCustom: true,
  },
  {
    id: 'avail_cha_ca_thac_lac',
    name: 'Chả cá thác lác hấp thì là',
    category: 'protein',
    categoryLabel: 'Món có sẵn',
    caloriesPer100g: 113,
    proteinPer100g: 17.3,
    carbsPer100g: 1.3,
    fatPer100g: 4,
    unit: 'đĩa',
    defaultServingGrams: 150,
    servingLabel: '1 đĩa (150g)',
    prepTip: 'Quết dẻo hấp cùng thì là chấm mắm tiêu chanh',
    isCustom: true,
  },
];

// Thư viện món ăn thực đơn thể hình Việt Nam chuẩn phong phú
export const FOOD_DATABASE: FoodItem[] = [
  // 1. Protein (Đạm)
  {
    id: 'chicken_breast_pepper',
    name: 'Ức gà áp chảo sốt tiêu đen',
    category: 'protein',
    categoryLabel: 'Đạm (Protein)',
    caloriesPer100g: 144,
    proteinPer100g: 25,
    carbsPer100g: 1,
    fatPer100g: 2.8,
    unit: 'g',
    defaultServingGrams: 180,
    servingLabel: '180g (1 phần)',
    prepTip: 'Ướp tiêu, tỏi, áp chảo chín tới không khô',
  },
  {
    id: 'beef_lean_garlic',
    name: 'Thịt thăn bò áp chảo tỏi tây',
    category: 'protein',
    categoryLabel: 'Đạm (Protein)',
    caloriesPer100g: 187,
    proteinPer100g: 25.3,
    carbsPer100g: 0.7,
    fatPer100g: 8,
    unit: 'g',
    defaultServingGrams: 150,
    servingLabel: '150g (1 phần)',
    prepTip: 'Áp chảo lửa lớn 3-4 phút',
  },
  {
    id: 'salmon_fillet',
    name: 'Cá hồi áp chảo măng tây',
    category: 'protein',
    categoryLabel: 'Đạm (Protein)',
    caloriesPer100g: 206,
    proteinPer100g: 22,
    carbsPer100g: 2,
    fatPer100g: 12,
    unit: 'g',
    defaultServingGrams: 150,
    servingLabel: '150g cá + măng tây',
    prepTip: 'Áp chảo mặt da giòn rụm, giàu Omega-3',
  },
  {
    id: 'shrimp_steamed',
    name: 'Tôm hấp sả nước dừa tươi',
    category: 'protein',
    categoryLabel: 'Đạm (Protein)',
    caloriesPer100g: 99,
    proteinPer100g: 21,
    carbsPer100g: 1,
    fatPer100g: 0.8,
    unit: 'g',
    defaultServingGrams: 200,
    servingLabel: '200g (1 đĩa)',
    prepTip: 'Hấp 5 phút tôm vừa chín tới giòn ngọt',
  },
  {
    id: 'pork_tenderloin_mushroom',
    name: 'Thịt heo thăn xào nấm rơm',
    category: 'protein',
    categoryLabel: 'Đạm (Protein)',
    caloriesPer100g: 156,
    proteinPer100g: 22.5,
    carbsPer100g: 3.1,
    fatPer100g: 5.6,
    unit: 'g',
    defaultServingGrams: 160,
    servingLabel: '160g nạc thăn + nấm',
    prepTip: 'Xào nhanh lửa lớn với hành khô',
  },
  {
    id: 'whole_eggs_boiled',
    name: 'Trứng gà luộc lòng đào (2 quả)',
    category: 'protein',
    categoryLabel: 'Đạm (Protein)',
    caloriesPer100g: 145,
    proteinPer100g: 13,
    carbsPer100g: 1,
    fatPer100g: 10,
    unit: 'quả',
    defaultServingGrams: 100,
    servingLabel: '2 quả (100g)',
    prepTip: 'Luộc sôi 6 phút ngâm nước đá',
  },
  {
    id: 'tofu_tomato',
    name: 'Đậu hũ trắng sốt cà chua ít dầu',
    category: 'protein',
    categoryLabel: 'Đạm (Protein)',
    caloriesPer100g: 76,
    proteinPer100g: 8,
    carbsPer100g: 2,
    fatPer100g: 4.5,
    unit: 'g',
    defaultServingGrams: 200,
    servingLabel: '1 đĩa (200g)',
    prepTip: 'Đậu hũ non sốt cà chua ít dầu thanh đạm',
  },
  {
    id: 'tilapia_panseared',
    name: 'Cá rô phi phi lê áp chảo',
    category: 'protein',
    categoryLabel: 'Đạm (Protein)',
    caloriesPer100g: 105,
    proteinPer100g: 20,
    carbsPer100g: 0,
    fatPer100g: 2.2,
    unit: 'g',
    defaultServingGrams: 180,
    servingLabel: '180g phi lê',
    prepTip: 'Phi lê áp chảo rắc muối hồng & thì là',
  },
  {
    id: 'squid_ginger',
    name: 'Mực ống hấp gừng sả',
    category: 'protein',
    categoryLabel: 'Đạm (Protein)',
    caloriesPer100g: 92,
    proteinPer100g: 18,
    carbsPer100g: 2.2,
    fatPer100g: 1.1,
    unit: 'g',
    defaultServingGrams: 180,
    servingLabel: '180g (1 đĩa)',
    prepTip: 'Hấp giòn ngọt chấm muối tiêu chanh',
  },
  {
    id: 'whey_isolate',
    name: 'Whey Protein Isolate (1 scoop)',
    category: 'protein',
    categoryLabel: 'Đạm (Protein)',
    caloriesPer100g: 400,
    proteinPer100g: 90,
    carbsPer100g: 3.3,
    fatPer100g: 1.6,
    unit: 'g',
    defaultServingGrams: 30,
    servingLabel: '1 muỗng (30g)',
    prepTip: 'Pha với 250ml nước lạnh hoặc sữa hạt',
  },
  {
    id: 'pho_bo_lean',
    name: 'Phở bò nạc tái ít bánh',
    category: 'protein',
    categoryLabel: 'Đạm (Protein)',
    caloriesPer100g: 108,
    proteinPer100g: 10.3,
    carbsPer100g: 12.8,
    fatPer100g: 1.7,
    unit: 'tô',
    defaultServingGrams: 350,
    servingLabel: '1 tô vừa (100g bánh, 120g bò)',
    prepTip: 'Nước dùng trong, không húp váng mỡ',
  },

  // 2. Carbs (Tinh bột)
  {
    id: 'brown_rice',
    name: 'Cơm gạo lứt huyết rồng',
    category: 'carbs',
    categoryLabel: 'Tinh bột (Carbs)',
    caloriesPer100g: 110,
    proteinPer100g: 2.6,
    carbsPer100g: 23.3,
    fatPer100g: 1,
    unit: 'chén',
    defaultServingGrams: 150,
    servingLabel: '1 chén (150g)',
    prepTip: 'Nấu mềm dẻo, ăn chậm nhai kỹ',
  },
  {
    id: 'sweet_potato',
    name: 'Khoai lang mật hấp',
    category: 'carbs',
    categoryLabel: 'Tinh bột (Carbs)',
    caloriesPer100g: 86,
    proteinPer100g: 1.6,
    carbsPer100g: 20,
    fatPer100g: 0.1,
    unit: 'củ',
    defaultServingGrams: 150,
    servingLabel: '1 củ vừa (150g)',
    prepTip: 'Hấp giữ trọn vị ngọt tự nhiên',
  },
  {
    id: 'whole_wheat_bread',
    name: 'Bánh mì đen lúa mạch',
    category: 'carbs',
    categoryLabel: 'Tinh bột (Carbs)',
    caloriesPer100g: 265,
    proteinPer100g: 13,
    carbsPer100g: 43,
    fatPer100g: 3.5,
    unit: 'lát',
    defaultServingGrams: 70,
    servingLabel: '2 lát (70g)',
    prepTip: 'Nướng giòn thơm kẹp trứng hoặc bơ',
  },
  {
    id: 'oats_porridge',
    name: 'Cháo yến mạch ức gà xé',
    category: 'carbs',
    categoryLabel: 'Tinh bột (Carbs)',
    caloriesPer100g: 110,
    proteinPer100g: 9,
    carbsPer100g: 16.5,
    fatPer100g: 1.8,
    unit: 'bát',
    defaultServingGrams: 200,
    servingLabel: '50g yến mạch + gà xé',
    prepTip: 'Nấu yến mạch 5p, thả gà xé và rắc hành tiêu',
  },
  {
    id: 'bun_brown_rice',
    name: 'Bún gạo lứt luộc',
    category: 'carbs',
    categoryLabel: 'Tinh bột (Carbs)',
    caloriesPer100g: 110,
    proteinPer100g: 2,
    carbsPer100g: 24,
    fatPer100g: 0.3,
    unit: 'tô',
    defaultServingGrams: 150,
    servingLabel: '1 tô vừa (150g)',
    prepTip: 'Trộn chút dầu mè cho thơm',
  },
  {
    id: 'corn_sweet',
    name: 'Bắp ngọt / Ngô vàng luộc',
    category: 'carbs',
    categoryLabel: 'Tinh bột (Carbs)',
    caloriesPer100g: 96,
    proteinPer100g: 3.4,
    carbsPer100g: 21,
    fatPer100g: 1.5,
    unit: 'bắp',
    defaultServingGrams: 150,
    servingLabel: '1 bắp vừa (150g)',
    prepTip: 'Luộc ngọt tự nhiên, giàu chất xơ',
  },
  {
    id: 'boiled_potato',
    name: 'Khoai tây hấp / nghiền tiêu',
    category: 'carbs',
    categoryLabel: 'Tinh bột (Carbs)',
    caloriesPer100g: 87,
    proteinPer100g: 1.9,
    carbsPer100g: 20,
    fatPer100g: 0.1,
    unit: 'củ',
    defaultServingGrams: 150,
    servingLabel: '1 củ vừa (150g)',
    prepTip: 'Hấp chín nghiền rắc tiêu thơm nức',
  },
  {
    id: 'white_rice',
    name: 'Cơm trắng dẻo',
    category: 'carbs',
    categoryLabel: 'Tinh bột (Carbs)',
    caloriesPer100g: 130,
    proteinPer100g: 2.7,
    carbsPer100g: 28.5,
    fatPer100g: 0.3,
    unit: 'bát',
    defaultServingGrams: 130,
    servingLabel: '1 bát con (130g)',
    prepTip: 'Cơm dẻo ăn kèm các món giàu đạm',
  },

  // 3. Veggies & Soups (Rau Củ, Món Canh & Xơ)
  {
    id: 'sprouts_herbs',
    name: 'Rau thơm & giá đỗ chần',
    category: 'veggies',
    categoryLabel: 'Rau củ / Xơ',
    caloriesPer100g: 75,
    proteinPer100g: 4,
    carbsPer100g: 13,
    fatPer100g: 1,
    unit: 'đĩa',
    defaultServingGrams: 100,
    servingLabel: '1 đĩa nhỏ',
    prepTip: 'Chần sơ giữ độ giòn tươi ngon',
  },
  {
    id: 'water_spinach',
    name: 'Rau muống luộc dầm chanh',
    category: 'veggies',
    categoryLabel: 'Rau củ / Xơ',
    caloriesPer100g: 20,
    proteinPer100g: 3,
    carbsPer100g: 2,
    fatPer100g: 0.3,
    unit: 'đĩa',
    defaultServingGrams: 150,
    servingLabel: '1 đĩa (150g)',
    prepTip: 'Nước luộc vắt chanh làm canh thanh nhiệt',
  },
  {
    id: 'salad_cucumber_tomato',
    name: 'Salad dưa leo cà chua bi',
    category: 'veggies',
    categoryLabel: 'Rau củ / Xơ',
    caloriesPer100g: 25,
    proteinPer100g: 1.1,
    carbsPer100g: 5,
    fatPer100g: 0.2,
    unit: 'đĩa',
    defaultServingGrams: 140,
    servingLabel: '1 đĩa (140g)',
    prepTip: 'Rưới chút dấm táo hoặc sốt mè rang',
  },
  {
    id: 'broccoli_steamed',
    name: 'Bông cải xanh (Súp lơ) luộc',
    category: 'veggies',
    categoryLabel: 'Rau củ / Xơ',
    caloriesPer100g: 34,
    proteinPer100g: 2.8,
    carbsPer100g: 6.6,
    fatPer100g: 0.4,
    unit: 'đĩa',
    defaultServingGrams: 150,
    servingLabel: '1 đĩa (150g)',
    prepTip: 'Hấp hoặc luộc chín tới giòn ngọt',
  },
  {
    id: 'cabbage_boiled',
    name: 'Bắp cải luộc thanh ngọt',
    category: 'veggies',
    categoryLabel: 'Rau củ / Xơ',
    caloriesPer100g: 27,
    proteinPer100g: 1.3,
    carbsPer100g: 5.3,
    fatPer100g: 0.1,
    unit: 'đĩa',
    defaultServingGrams: 150,
    servingLabel: '1 đĩa (150g)',
    prepTip: 'Chấm trứng hoặc nước mắm tỏi ớt',
  },
  {
    id: 'soup_cai_ngot',
    name: 'Canh cải ngọt thịt bằm',
    category: 'veggies',
    categoryLabel: 'Rau củ / Xơ',
    caloriesPer100g: 42,
    proteinPer100g: 3.5,
    carbsPer100g: 2,
    fatPer100g: 2,
    unit: 'tô',
    defaultServingGrams: 200,
    servingLabel: '1 tô vừa (200g)',
    prepTip: 'Nêm nhạt, ít muối, ngọt mát',
  },
  {
    id: 'soup_bi_do',
    name: 'Canh bí đỏ nấu thịt nạc',
    category: 'veggies',
    categoryLabel: 'Rau củ / Xơ',
    caloriesPer100g: 48,
    proteinPer100g: 3,
    carbsPer100g: 6,
    fatPer100g: 1.5,
    unit: 'tô',
    defaultServingGrams: 200,
    servingLabel: '1 tô (150g bí, 30g thịt)',
    prepTip: 'Nấu ngọt tự nhiên giàu vitamin A',
  },
  {
    id: 'soup_rau_ngot_tom',
    name: 'Canh rau ngót nấu tôm bằm',
    category: 'veggies',
    categoryLabel: 'Rau củ / Xơ',
    caloriesPer100g: 40,
    proteinPer100g: 4,
    carbsPer100g: 3,
    fatPer100g: 1,
    unit: 'tô',
    defaultServingGrams: 200,
    servingLabel: '1 tô (150g rau, 40g tôm)',
    prepTip: 'Vò nhẹ lá rau ngót nấu thanh ngọt',
  },
  {
    id: 'soup_mong_toi_cua',
    name: 'Canh mồng tơi mướp cua đồng',
    category: 'veggies',
    categoryLabel: 'Rau củ / Xơ',
    caloriesPer100g: 38,
    proteinPer100g: 3,
    carbsPer100g: 2.5,
    fatPer100g: 1.5,
    unit: 'tô',
    defaultServingGrams: 200,
    servingLabel: '1 tô vừa (200g)',
    prepTip: 'Mát gan giải nhiệt ngày nắng',
  },
  {
    id: 'asparagus_sauteed',
    name: 'Măng tây xanh áp chảo tỏi',
    category: 'veggies',
    categoryLabel: 'Rau củ / Xơ',
    caloriesPer100g: 30,
    proteinPer100g: 2.5,
    carbsPer100g: 4,
    fatPer100g: 0.2,
    unit: 'phần',
    defaultServingGrams: 100,
    servingLabel: '1 phần (100g)',
    prepTip: 'Áp chảo lửa lớn với chút tỏi đập dập',
  },
  {
    id: 'cucumber_fresh',
    name: 'Dưa chuột tươi thái lát',
    category: 'veggies',
    categoryLabel: 'Rau củ / Xơ',
    caloriesPer100g: 15,
    proteinPer100g: 0.7,
    carbsPer100g: 3.3,
    fatPer100g: 0.1,
    unit: 'quả',
    defaultServingGrams: 150,
    servingLabel: '1 quả (150g)',
    prepTip: 'Rửa sạch thái lát chấm muối ớt',
  },

  // 4. Fat & Healthy Snacks (Chất Béo Tốt & Bữa Phụ)
  {
    id: 'avocado_ripe',
    name: 'Bơ sáp chín',
    category: 'fat',
    categoryLabel: 'Chất béo (Fat)',
    caloriesPer100g: 160,
    proteinPer100g: 2,
    carbsPer100g: 8.5,
    fatPer100g: 15,
    unit: 'quả',
    defaultServingGrams: 60,
    servingLabel: '1/2 quả (60g)',
    prepTip: 'Chất béo đơn tốt cho tim mạch',
  },
  {
    id: 'almonds_roasted',
    name: 'Hạt hạnh nhân nướng mộc',
    category: 'fat',
    categoryLabel: 'Chất béo (Fat)',
    caloriesPer100g: 575,
    proteinPer100g: 20,
    carbsPer100g: 20,
    fatPer100g: 50,
    unit: 'g',
    defaultServingGrams: 20,
    servingLabel: '1 vốc nhỏ (20g)',
    prepTip: 'Ăn vặt lành mạnh hoặc trộn cùng yến mạch',
  },
  {
    id: 'greek_yogurt',
    name: 'Sữa chua Hy Lạp không đường',
    category: 'fat',
    categoryLabel: 'Chất béo (Fat)',
    caloriesPer100g: 90,
    proteinPer100g: 10,
    carbsPer100g: 4,
    fatPer100g: 3,
    unit: 'hộp',
    defaultServingGrams: 100,
    servingLabel: '1 hộp (100g)',
    prepTip: 'Trộn cùng hạt chia hoặc hoa quả tươi',
  },
  {
    id: 'banana_ripe',
    name: 'Chuối tiêu chín',
    category: 'fat',
    categoryLabel: 'Chất béo (Fat)',
    caloriesPer100g: 90,
    proteinPer100g: 1.1,
    carbsPer100g: 23,
    fatPer100g: 0.3,
    unit: 'quả',
    defaultServingGrams: 100,
    servingLabel: '1 quả vừa (100g)',
    prepTip: 'Bổ sung kali, ăn trước tập 45-60 phút',
  },
  {
    id: 'apple_crisp',
    name: 'Táo tươi giòn',
    category: 'fat',
    categoryLabel: 'Chất béo (Fat)',
    caloriesPer100g: 54,
    proteinPer100g: 0.4,
    carbsPer100g: 13.5,
    fatPer100g: 0.2,
    unit: 'quả',
    defaultServingGrams: 120,
    servingLabel: '1 quả nhỏ (120g)',
    prepTip: 'Rửa sạch ăn cả vỏ giữ trọn chất xơ',
  },
  {
    id: 'walnuts_roasted',
    name: 'Hạt óc chó nướng mộc',
    category: 'fat',
    categoryLabel: 'Chất béo (Fat)',
    caloriesPer100g: 650,
    proteinPer100g: 15,
    carbsPer100g: 14,
    fatPer100g: 65,
    unit: 'g',
    defaultServingGrams: 20,
    servingLabel: '1 vốc nhỏ (20g)',
    prepTip: 'Giàu Omega-3 và chất chống oxy hóa',
  },
  {
    id: 'olive_oil',
    name: 'Dầu Olive Extra Virgin',
    category: 'fat',
    categoryLabel: 'Chất béo (Fat)',
    caloriesPer100g: 884,
    proteinPer100g: 0,
    carbsPer100g: 0,
    fatPer100g: 100,
    unit: 'g',
    defaultServingGrams: 10,
    servingLabel: '1 thìa canh (10g)',
    prepTip: 'Trộn trực tiếp vào salad hoặc món rau',
  },
];

// ==========================================
// Clean Modern Dropdown Selector Component
// ==========================================
interface ModernFoodSelectorProps {
  id?: string;
  label: string;
  selectedFood: FoodItem;
  foods: FoodItem[];
  onSelect: (food: FoodItem) => void;
  onDeleteCustomFood?: (foodId: string, e: React.MouseEvent) => void;
  accentColor?: 'green' | 'blue';
}

function ModernFoodSelector({
  id,
  label,
  selectedFood,
  foods,
  onSelect,
  onDeleteCustomFood,
  accentColor = 'green',
}: ModernFoodSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isGreen = accentColor === 'green';

  // Close on outside click or Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleDown = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  const filteredFoods = useMemo(() => {
    return foods.filter((f) => {
      let matchCat = true;
      if (filterCategory === 'custom') {
        matchCat = Boolean((f as CustomFoodItem).isCustom);
      } else if (filterCategory !== 'all') {
        matchCat = f.category === filterCategory;
      }
      if (!filterText.trim()) return matchCat;
      const q = filterText.toLowerCase().trim();
      return (f.name.toLowerCase().includes(q) || f.categoryLabel.toLowerCase().includes(q)) && matchCat;
    });
  }, [foods, filterCategory, filterText]);

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <label
        htmlFor={id}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.74rem',
          color: isGreen ? '#166534' : '#003b70',
          fontWeight: 700,
          marginBottom: '4px',
        }}
      >
        <span>{label}</span>
        <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#64748b' }}>
          (Bấm để đổi món)
        </span>
      </label>

      {/* Clean Trigger Box */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#ffffff',
          border: isOpen
            ? isGreen
              ? '2px solid #16a34a'
              : '2px solid #0284c7'
            : isGreen
              ? '1.5px solid #86efac'
              : '1.5px solid #cbd5e1',
          borderRadius: '10px',
          padding: '9px 12px',
          cursor: 'pointer',
          textAlign: 'left',
          boxShadow: isOpen
            ? isGreen
              ? '0 0 0 3px rgba(34, 197, 94, 0.2)'
              : '0 0 0 3px rgba(2, 132, 199, 0.2)'
            : '0 1px 3px rgba(0,0,0,0.05)',
          transition: 'all 0.15s ease',
        }}
      >
        <div style={{ overflow: 'hidden' }}>
          <div
            style={{
              fontSize: '0.9rem',
              fontWeight: 800,
              color: isGreen ? '#15803d' : '#0f172a',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {selectedFood.name}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>
            {selectedFood.servingLabel || `${selectedFood.defaultServingGrams}g`} •{' '}
            <span style={{ color: '#ea580c', fontWeight: 700 }}>
              {selectedFood.caloriesPer100g} kcal/100g
            </span>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            borderRadius: '6px',
            background: isGreen ? '#f0fdf4' : '#f1f5f9',
            color: isGreen ? '#16a34a' : '#475569',
            flexShrink: 0,
            marginLeft: '6px',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        >
          <ChevronDown size={16} />
        </div>
      </button>

      {/* Hidden native select for DOM accessibility & test compatibility */}
      <select
        id={id}
        value={selectedFood.id}
        onChange={(e) => {
          const found = foods.find((f) => f.id === e.target.value);
          if (found) onSelect(found);
        }}
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
          opacity: 0,
          pointerEvents: 'none',
        }}
        tabIndex={-1}
        aria-hidden="true"
      >
        {foods.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name} ({f.servingLabel || `${f.defaultServingGrams}g`})
          </option>
        ))}
      </select>

      {/* Floating Dropdown Popover */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            zIndex: 120,
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '12px',
            boxShadow: '0 18px 40px -4px rgba(0,0,0,0.22), 0 6px 14px rgba(0,0,0,0.08)',
            padding: '10px',
            minWidth: '280px',
          }}
        >
          {/* Search Input inside dropdown */}
          <div style={{ position: 'relative', marginBottom: '8px' }}>
            <Search
              size={14}
              color="#94a3b8"
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              autoFocus
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Tìm nhanh theo tên món..."
              style={{
                width: '100%',
                padding: '6px 10px 6px 30px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.78rem',
                outline: 'none',
              }}
            />
          </div>

          {/* Mini category pills without emojis */}
          <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '6px', marginBottom: '6px' }}>
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'custom', label: 'Có sẵn' },
              { id: 'veggies', label: 'Rau củ' },
              { id: 'protein', label: 'Đạm' },
              { id: 'carbs', label: 'Tinh bột' },
              { id: 'fat', label: 'Chất béo' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterCategory(tab.id)}
                style={{
                  padding: '4px 9px',
                  borderRadius: '6px',
                  border: 'none',
                  background: filterCategory === tab.id ? (isGreen ? '#16a34a' : '#0284c7') : '#f1f5f9',
                  color: filterCategory === tab.id ? '#ffffff' : '#475569',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Scrollable list of items */}
          <div
            style={{
              maxHeight: '230px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              paddingRight: '2px',
            }}
          >
            {filteredFoods.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.78rem' }}>
                Không tìm thấy món phù hợp
              </div>
            ) : (
              filteredFoods.map((f) => {
                const isItemSel = f.id === selectedFood.id;
                const isCustom = Boolean((f as CustomFoodItem).isCustom);
                return (
                  <div
                    key={f.id}
                    onClick={() => {
                      onSelect(f);
                      setIsOpen(false);
                    }}
                    style={{
                      padding: '7px 10px',
                      borderRadius: '8px',
                      background: isItemSel ? (isGreen ? '#f0fdf4' : '#eff6ff') : '#ffffff',
                      border: isItemSel
                        ? isGreen
                          ? '1px solid #86efac'
                          : '1px solid #bfdbfe'
                        : '1px solid transparent',
                      cursor: 'pointer',
                      transition: 'background 0.1s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '6px',
                    }}
                    onMouseEnter={(e) => {
                      if (!isItemSel) e.currentTarget.style.background = '#f8fafc';
                    }}
                    onMouseLeave={(e) => {
                      if (!isItemSel) e.currentTarget.style.background = '#ffffff';
                    }}
                  >
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          style={{
                            fontSize: '0.82rem',
                            fontWeight: 800,
                            color: isItemSel ? (isGreen ? '#15803d' : '#1d4ed8') : '#1e293b',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {f.name}
                        </span>
                        {isCustom && (
                          <span
                            style={{
                              fontSize: '0.64rem',
                              fontWeight: 700,
                              background: '#e0f2fe',
                              color: '#0369a1',
                              padding: '1px 5px',
                              borderRadius: '4px',
                            }}
                          >
                            Có sẵn
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                        <span>{f.servingLabel || `${f.defaultServingGrams}g`}</span> •{' '}
                        <span style={{ color: '#ea580c', fontWeight: 600 }}>{f.caloriesPer100g} kcal/100g</span> •{' '}
                        <span>P: {f.proteinPer100g}g</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                      {isCustom && onDeleteCustomFood && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteCustomFood(f.id, e);
                          }}
                          title="Xóa món tự thêm này"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            padding: '3px',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                      {isItemSel && (
                        <div
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            background: isGreen ? '#22c55e' : '#0284c7',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Check size={12} strokeWidth={3} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// Main MealSwapperModal Component
// ==========================================
export default function MealSwapperModal({
  open,
  onClose,
  currentDish,
  initialFoodName,
  initialGrams,
  targetItemLabel,
  onApplySwap,
}: MealSwapperModalProps) {
  const sourceFoodId = useId();
  const sourceGramsId = useId();
  const targetFoodId = useId();

  // Custom user foods from localStorage
  const [customFoods, setCustomFoods] = useState<CustomFoodItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CUSTOM_FOODS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to load custom foods from localStorage', e);
    }
    return DEFAULT_AVAILABLE_FOODS;
  });

  // Active Category includes 'custom' for available/saved dishes
  const [activeCategory, setActiveCategory] = useState<FoodCategory | 'all' | 'custom'>('custom');
  const [sourceFood, setSourceFood] = useState<FoodItem>(FOOD_DATABASE[0]);
  const [sourceGrams, setSourceGrams] = useState<string>('150');
  const [targetFood, setTargetFood] = useState<FoodItem>(customFoods[0] || FOOD_DATABASE[1]);
  const [targetGrams, setTargetGrams] = useState<string>('150');

  // Top-level modal tab: 'swap' (Đổi Món Tương Đương) or 'manage' (Quản Lý Kho Món: Thêm, Sửa, Xóa)
  const [modalTab, setModalTab] = useState<'swap' | 'manage'>('swap');
  const [editingFoodId, setEditingFoodId] = useState<string | null>(null);
  const [manageSearchQuery, setManageSearchQuery] = useState('');
  const [manageCategoryFilter, setManageCategoryFilter] = useState<FoodCategory | 'all' | 'custom'>('all');

  // New Food Form toggling & inputs
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [newFoodName, setNewFoodName] = useState('');
  const [newFoodCategory, setNewFoodCategory] = useState<FoodCategory>('protein');
  const [newFoodServing, setNewFoodServing] = useState('1 đĩa (150g)');
  const [newFoodGrams, setNewFoodGrams] = useState('150');
  const [newFoodCalories, setNewFoodCalories] = useState('');
  const [newFoodProtein, setNewFoodProtein] = useState('');
  const [newFoodCarbs, setNewFoodCarbs] = useState('');
  const [newFoodFat, setNewFoodFat] = useState('');
  const [newFoodPrepTip, setNewFoodPrepTip] = useState('');

  // Category horizontal scroll ref & mouse drag handlers
  const categoryBarRef = useRef<HTMLDivElement>(null);
  const isCategoryDownRef = useRef(false);
  const categoryStartXRef = useRef(0);
  const categoryScrollLeftRef = useRef(0);

  const handleCategoryMouseDown = (e: React.MouseEvent) => {
    if (!categoryBarRef.current) return;
    isCategoryDownRef.current = true;
    categoryStartXRef.current = e.pageX - categoryBarRef.current.offsetLeft;
    categoryScrollLeftRef.current = categoryBarRef.current.scrollLeft;
  };
  const handleCategoryMouseLeave = () => {
    isCategoryDownRef.current = false;
  };
  const handleCategoryMouseUp = () => {
    isCategoryDownRef.current = false;
  };
  const handleCategoryMouseMove = (e: React.MouseEvent) => {
    if (!isCategoryDownRef.current || !categoryBarRef.current) return;
    e.preventDefault();
    const x = e.pageX - categoryBarRef.current.offsetLeft;
    const walk = (x - categoryStartXRef.current) * 1.5;
    categoryBarRef.current.scrollLeft = categoryScrollLeftRef.current - walk;
  };

  // Combine static FOOD_DATABASE with customFoods
  const combinedFoodList = useMemo(() => {
    return [...customFoods, ...FOOD_DATABASE];
  }, [customFoods]);

  // Save customFoods to localStorage whenever it changes
  const saveCustomFoods = (updated: CustomFoodItem[]) => {
    setCustomFoods(updated);
    try {
      localStorage.setItem(STORAGE_KEY_CUSTOM_FOODS, JSON.stringify(updated));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('3s-food-db-updated'));
      }
    } catch (e) {
      console.error('Failed to persist custom foods to localStorage', e);
    }
  };

  // Listen for database updates from other components
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleDbUpdated = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_CUSTOM_FOODS);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setCustomFoods(parsed);
          }
        }
      } catch (e) {
        console.error('Error syncing custom foods', e);
      }
    };
    window.addEventListener('3s-food-db-updated', handleDbUpdated);
    return () => window.removeEventListener('3s-food-db-updated', handleDbUpdated);
  }, []);

  const resetAddEditForm = () => {
    setNewFoodName('');
    setNewFoodCategory('protein');
    setNewFoodServing('1 đĩa (150g)');
    setNewFoodGrams('150');
    setNewFoodCalories('');
    setNewFoodProtein('');
    setNewFoodCarbs('');
    setNewFoodFat('');
    setNewFoodPrepTip('');
    setEditingFoodId(null);
  };

  const handleStartEditFood = (food: FoodItem) => {
    setEditingFoodId(food.id);
    setNewFoodName(food.name);
    setNewFoodCategory(food.category);
    setNewFoodServing(food.servingLabel || `${food.defaultServingGrams}g`);
    setNewFoodGrams(String(food.defaultServingGrams));
    const grams = food.defaultServingGrams;
    const factor = grams / 100;
    setNewFoodCalories(String(Math.round(food.caloriesPer100g * factor)));
    setNewFoodProtein(String(parseFloat((food.proteinPer100g * factor).toFixed(1))));
    setNewFoodCarbs(String(parseFloat((food.carbsPer100g * factor).toFixed(1))));
    setNewFoodFat(String(parseFloat((food.fatPer100g * factor).toFixed(1))));
    setNewFoodPrepTip(food.prepTip || '');
    setShowAddForm(true);
    setModalTab('manage');
  };

  const handleOpenAddForm = () => {
    resetAddEditForm();
    setShowAddForm(true);
    setModalTab('manage');
  };

  // Auto-detect category & select appropriate food items upon opening
  useEffect(() => {
    if (!open) return;

    const queryName = (currentDish?.name || initialFoodName || '').toLowerCase().trim();

    if (queryName) {
      // Find in custom or default database
      const matched = combinedFoodList.find((f) => {
        const fn = f.name.toLowerCase();
        return queryName.includes(fn) || fn.includes(queryName);
      });

      // Infer category by keyword
      let detectedCategory: FoodCategory | 'custom' = 'custom';
      if (
        queryName.includes('rau') ||
        queryName.includes('giá') ||
        queryName.includes('đỗ') ||
        queryName.includes('muống') ||
        queryName.includes('cải') ||
        queryName.includes('súp lơ') ||
        queryName.includes('bông cải') ||
        queryName.includes('salad') ||
        queryName.includes('dưa') ||
        queryName.includes('canh') ||
        queryName.includes('măng') ||
        queryName.includes('bắp cải') ||
        queryName.includes('mướp')
      ) {
        detectedCategory = 'veggies';
      } else if (
        queryName.includes('cơm') ||
        queryName.includes('gạo') ||
        queryName.includes('lứt') ||
        queryName.includes('khoai') ||
        queryName.includes('yến mạch') ||
        queryName.includes('bánh mì') ||
        queryName.includes('bún') ||
        queryName.includes('phở') ||
        queryName.includes('bắp') ||
        queryName.includes('ngô')
      ) {
        detectedCategory = 'carbs';
      } else if (
        queryName.includes('bơ') ||
        queryName.includes('hạt') ||
        queryName.includes('sữa chua') ||
        queryName.includes('chuối') ||
        queryName.includes('táo') ||
        queryName.includes('dầu')
      ) {
        detectedCategory = 'fat';
      } else if (
        queryName.includes('thịt') ||
        queryName.includes('gà') ||
        queryName.includes('bò') ||
        queryName.includes('cá') ||
        queryName.includes('tôm') ||
        queryName.includes('trứng') ||
        queryName.includes('đậu hũ')
      ) {
        detectedCategory = 'protein';
      }

      const finalCategory = matched ? matched.category : detectedCategory;
      setActiveCategory(finalCategory);

      if (matched) {
        setSourceFood(matched);
      }

      // Pick a smart target replacement in the same category
      const candidates = combinedFoodList.filter(
        (f) => f.category === finalCategory && f.id !== matched?.id
      );
      if (candidates.length > 0) {
        const bestTarget = candidates[0];
        setTargetFood(bestTarget);
        setTargetGrams(String(bestTarget.defaultServingGrams));
      }
    } else {
      // Default to custom available foods tab
      setActiveCategory('custom');
      if (customFoods.length > 0) {
        setTargetFood(customFoods[0]);
        setTargetGrams(String(customFoods[0].defaultServingGrams));
      }
    }

    if (initialGrams) {
      setSourceGrams(initialGrams);
    }
  }, [open, currentDish, initialFoodName, initialGrams, combinedFoodList, customFoods]);

  // When target food changes, sync its default serving grams
  const handleSelectTargetFood = (food: FoodItem) => {
    setTargetFood(food);
    setTargetGrams(String(food.defaultServingGrams));
  };

  const handleChooseForSwap = (food: FoodItem) => {
    handleSelectTargetFood(food);
    setActiveCategory(food.category as any);
    setModalTab('swap');
  };

  const handleAddNewFood = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFoodName.trim()) return;

    const grams = parseFloat(newFoodGrams) || 150;
    const p = parseFloat(newFoodProtein) || 0;
    const c = parseFloat(newFoodCarbs) || 0;
    const f = parseFloat(newFoodFat) || 0;
    const kcal = parseFloat(newFoodCalories) || Math.round(p * 4 + c * 4 + f * 9);

    // Calculate per 100g
    const factor = grams > 0 ? 100 / grams : 1;
    const p100 = parseFloat((p * factor).toFixed(1));
    const c100 = parseFloat((c * factor).toFixed(1));
    const f100 = parseFloat((f * factor).toFixed(1));
    const kcal100 = Math.round(kcal * factor);

    if (editingFoodId) {
      // Sửa món ăn hiện có
      const existsInCustom = customFoods.some((f) => f.id === editingFoodId);
      let nextCustomList: CustomFoodItem[];
      if (existsInCustom) {
        nextCustomList = customFoods.map((f) =>
          f.id === editingFoodId
            ? {
                ...f,
                name: newFoodName.trim(),
                category: newFoodCategory,
                caloriesPer100g: kcal100,
                proteinPer100g: p100,
                carbsPer100g: c100,
                fatPer100g: f100,
                defaultServingGrams: grams,
                servingLabel: newFoodServing.trim() || `${grams}g`,
                prepTip: newFoodPrepTip.trim() || undefined,
              }
            : f
        );
      } else {
        // Nếu sửa món mặc định, sao chép thành món tùy chỉnh có sẵn
        const overrideItem: CustomFoodItem = {
          id: `custom_edit_${editingFoodId}_${Date.now()}`,
          name: newFoodName.trim(),
          category: newFoodCategory,
          categoryLabel: 'Món tự thêm',
          caloriesPer100g: kcal100,
          proteinPer100g: p100,
          carbsPer100g: c100,
          fatPer100g: f100,
          unit: 'phần',
          defaultServingGrams: grams,
          servingLabel: newFoodServing.trim() || `${grams}g`,
          prepTip: newFoodPrepTip.trim() || undefined,
          isCustom: true,
        };
        nextCustomList = [overrideItem, ...customFoods];
      }
      saveCustomFoods(nextCustomList);
    } else {
      // Thêm món mới
      const newFood: CustomFoodItem = {
        id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: newFoodName.trim(),
        category: newFoodCategory,
        categoryLabel: 'Món tự thêm',
        caloriesPer100g: kcal100,
        proteinPer100g: p100,
        carbsPer100g: c100,
        fatPer100g: f100,
        unit: 'phần',
        defaultServingGrams: grams,
        servingLabel: newFoodServing.trim() || `${grams}g`,
        prepTip: newFoodPrepTip.trim() || undefined,
        isCustom: true,
      };

      const nextCustomList = [newFood, ...customFoods];
      saveCustomFoods(nextCustomList);

      // Select the newly added food immediately
      handleSelectTargetFood(newFood);
      setActiveCategory('custom');
    }

    resetAddEditForm();
    setShowAddForm(false);
    setModalTab('swap');
  };

  const handleDeleteCustomFood = (foodId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = customFoods.filter((f) => f.id !== foodId && f.id !== `custom_edit_${foodId}`);
    saveCustomFoods(updated);
    if (targetFood.id === foodId) {
      const fallback = updated[0] || FOOD_DATABASE[0];
      handleSelectTargetFood(fallback);
    }
  };

  // Filtered foods for Manage Tab
  const filteredManageFoods = useMemo(() => {
    return combinedFoodList.filter((f) => {
      if (manageCategoryFilter === 'custom') {
        if (!(f as CustomFoodItem).isCustom) return false;
      } else if (manageCategoryFilter !== 'all') {
        if (f.category !== manageCategoryFilter) return false;
      }
      if (manageSearchQuery.trim()) {
        const q = manageSearchQuery.toLowerCase().trim();
        const matchName = f.name.toLowerCase().includes(q);
        const matchTip = f.prepTip?.toLowerCase().includes(q);
        if (!matchName && !matchTip) return false;
      }
      return true;
    });
  }, [combinedFoodList, manageCategoryFilter, manageSearchQuery]);

  if (!open) return null;

  // Source item attributes
  const isActualDishMode = Boolean(currentDish);
  const sourceName = currentDish?.name || sourceFood.name;
  const sourceAmount = currentDish?.amount || `${sourceGrams}g`;
  const sourceMealName = currentDish?.mealName;
  const sourceCalories = isActualDishMode
    ? currentDish!.calories
    : Math.round(sourceFood.caloriesPer100g * ((parseFloat(sourceGrams) || 100) / 100));
  const sourceProtein = isActualDishMode
    ? currentDish!.protein ?? 0
    : parseFloat((sourceFood.proteinPer100g * ((parseFloat(sourceGrams) || 100) / 100)).toFixed(1));
  const sourceCarbs = isActualDishMode
    ? currentDish!.carbs ?? 0
    : parseFloat((sourceFood.carbsPer100g * ((parseFloat(sourceGrams) || 100) / 100)).toFixed(1));
  const sourceFat = isActualDishMode
    ? currentDish!.fat ?? 0
    : parseFloat((sourceFood.fatPer100g * ((parseFloat(sourceGrams) || 100) / 100)).toFixed(1));

  // Target item calculations
  const parsedTargetGrams = parseFloat(targetGrams) || targetFood.defaultServingGrams;
  const factorB = parsedTargetGrams / 100;
  const targetCalories = Math.round(targetFood.caloriesPer100g * factorB);
  const targetProtein = parseFloat((targetFood.proteinPer100g * factorB).toFixed(1));
  const targetCarbs = parseFloat((targetFood.carbsPer100g * factorB).toFixed(1));
  const targetFat = parseFloat((targetFood.fatPer100g * factorB).toFixed(1));
  const calDiff = targetCalories - sourceCalories;

  const targetServingDisplay =
    parsedTargetGrams === targetFood.defaultServingGrams && targetFood.servingLabel
      ? targetFood.servingLabel
      : `${parsedTargetGrams}g`;

  const handleCategoryChange = (cat: FoodCategory | 'all' | 'custom') => {
    setActiveCategory(cat);
    if (cat === 'custom') {
      if (customFoods.length > 0) {
        setTargetFood(customFoods[0]);
        setTargetGrams(String(customFoods[0].defaultServingGrams));
      }
    } else if (cat !== 'all') {
      const list = combinedFoodList.filter((f) => f.category === cat);
      if (list.length > 0) {
        const nextTarget = list.find((f) => f.id !== sourceFood.id) || list[0];
        setTargetFood(nextTarget);
        setTargetGrams(String(nextTarget.defaultServingGrams));
      }
    }
  };

  const handleApply = () => {
    if (onApplySwap) {
      onApplySwap({
        name: targetFood.name,
        amount: targetServingDisplay,
        calories: targetCalories,
        protein: targetProtein,
        carbs: targetCarbs,
        fat: targetFat,
        prepTip: targetFood.prepTip,
      });
    }
    onClose();
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-label="Thay thế món ăn tương đương macro">
      <style>{`
        .swapper-modal-box {
          max-width: 720px;
          width: 95%;
          max-height: 92vh;
          overflow-y: auto;
          background: #ffffff;
          border-radius: 16px;
          padding: 20px 22px;
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
        }
        .swapper-category-bar {
          display: flex;
          gap: 6px;
          overflow-x: auto;
          white-space: nowrap;
          padding-bottom: 6px;
          -webkit-overflow-scrolling: touch;
          scroll-behavior: smooth;
        }
        .swapper-category-bar::-webkit-scrollbar {
          height: 4px;
        }
        .swapper-category-bar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 4px;
        }
        .swapper-category-bar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        .swapper-category-bar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        .swapper-cards-grid {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          gap: 14px;
          align-items: stretch;
          margin-bottom: 16px;
        }
        .swapper-arrow-cell {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 6px;
        }
        .swapper-arrow-icon {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #ecfdf5;
          border: 1.5px solid #6ee7b7;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #059669;
          transition: transform 0.2s;
        }
        .swapper-footer-row {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }

        @media (max-width: 640px) {
          .swapper-modal-box {
            padding: 14px 12px !important;
            width: 96% !important;
            max-height: 94vh !important;
            border-radius: 14px !important;
          }
          .swapper-header-title {
            font-size: 1.02rem !important;
            line-height: 1.3 !important;
          }
          .swapper-category-container {
            margin-bottom: 10px !important;
          }
          .swapper-cards-grid {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
            margin-bottom: 14px !important;
          }
          .swapper-arrow-cell {
            flex-direction: row !important;
            gap: 8px !important;
            margin: 2px 0 !important;
          }
          .swapper-arrow-icon {
            width: 32px !important;
            height: 32px !important;
            transform: rotate(90deg);
          }
          .swapper-footer-row {
            flex-direction: column-reverse !important;
            gap: 8px !important;
          }
          .swapper-footer-row button {
            width: 100% !important;
            justify-content: center !important;
            padding: 10px 16px !important;
          }
        }
      `}</style>
      <div className="modal swapper-modal-box">
        {/* Header */}
        <div
          className="swapper-header-row"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #e2e8f0',
            paddingBottom: '12px',
            marginBottom: '14px',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: '#0284c7',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <ArrowRightLeft size={18} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h2 className="swapper-header-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#003b70' }}>
                Công Cụ Đổi Món Tương Đương Macro
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                {targetItemLabel || currentDish
                  ? `Đang đổi cho món: "${targetItemLabel || sourceName}".`
                  : 'Chọn món và quy đổi tương đương để đảm bảo chuẩn Calo & Macro theo thực đơn của học viên.'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => {
                if (modalTab === 'manage' && showAddForm) {
                  setShowAddForm(false);
                  resetAddEditForm();
                } else {
                  handleOpenAddForm();
                }
              }}
              aria-label="+ Thêm Món Mới"
              style={{
                background: showAddForm && modalTab === 'manage' ? '#f1f5f9' : '#0284c7',
                color: showAddForm && modalTab === 'manage' ? '#0f172a' : '#ffffff',
                border: '1px solid #0284c7',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                whiteSpace: 'nowrap',
              }}
            >
              {showAddForm && modalTab === 'manage' ? <X size={14} /> : <Plus size={14} />}
              <span>{showAddForm && modalTab === 'manage' ? 'Đóng Form' : '+ Thêm Món Mới'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                color: '#64748b',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
              title="Đóng modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 2 Top-level Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            borderBottom: '2px solid #e2e8f0',
            marginBottom: '14px',
            gap: '8px',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setModalTab('swap');
              setShowAddForm(false);
            }}
            style={{
              padding: '8px 14px',
              fontSize: '0.84rem',
              fontWeight: 800,
              background: 'transparent',
              border: 'none',
              borderBottom: modalTab === 'swap' ? '3px solid #0284c7' : '3px solid transparent',
              color: modalTab === 'swap' ? '#003b70' : '#64748b',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '-2px',
            }}
          >
            <ArrowRightLeft size={15} /> Đổi Món Tương Đương
          </button>

          <button
            type="button"
            onClick={() => setModalTab('manage')}
            style={{
              padding: '8px 14px',
              fontSize: '0.84rem',
              fontWeight: 800,
              background: 'transparent',
              border: 'none',
              borderBottom: modalTab === 'manage' ? '3px solid #0284c7' : '3px solid transparent',
              color: modalTab === 'manage' ? '#003b70' : '#64748b',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '-2px',
            }}
          >
            <Layers size={15} /> Quản Lý Kho Món ({combinedFoodList.length})
          </button>
        </div>

        {/* TAB 1: ĐỔI MÓN TƯƠNG ĐƯƠNG (SWAPPER) */}
        {modalTab === 'swap' && (
          <>
            {/* Category Tabs Slider with Navigation Arrows, Wheel Scroll & Drag Support */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px', position: 'relative' }}>
              <button
                type="button"
                onClick={() => categoryBarRef.current?.scrollBy({ left: -160, behavior: 'smooth' })}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#475569',
                  flexShrink: 0,
                }}
                title="Cuộn sang trái"
              >
                <ChevronLeft size={16} />
              </button>

              <div
                ref={categoryBarRef}
                className="swapper-category-bar"
                onWheel={(e) => {
                  if (categoryBarRef.current && e.deltaY !== 0) {
                    categoryBarRef.current.scrollLeft += e.deltaY;
                  }
                }}
                onMouseDown={handleCategoryMouseDown}
                onMouseLeave={handleCategoryMouseLeave}
                onMouseUp={handleCategoryMouseUp}
                onMouseMove={handleCategoryMouseMove}
                style={{
                  display: 'flex',
                  gap: '6px',
                  overflowX: 'auto',
                  whiteSpace: 'nowrap',
                  paddingBottom: '6px',
                  flex: 1,
                  minWidth: 0,
                  cursor: 'grab',
                  userSelect: 'none',
                }}
              >
                {[
                  { id: 'custom', label: 'Món Có Sẵn & Tự Thêm', badge: customFoods.length },
                  { id: 'protein', label: 'Nhóm Đạm (Protein)' },
                  { id: 'carbs', label: 'Nhóm Tinh Bột (Carbs)' },
                  { id: 'veggies', label: 'Rau Củ & Chất Xơ' },
                  { id: 'fat', label: 'Nhóm Chất Béo (Fat)' },
                  { id: 'all', label: 'Tất Cả Món Ăn' },
                ].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleCategoryChange(c.id as any)}
                    style={{
                      background: activeCategory === c.id ? '#003b70' : '#f8fafc',
                      color: activeCategory === c.id ? '#ffffff' : '#334155',
                      border: '1px solid',
                      borderColor: activeCategory === c.id ? '#003b70' : '#cbd5e1',
                      borderRadius: '6px',
                      padding: '5px 10px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span>{c.label}</span>
                    {c.badge !== undefined && (
                      <span
                        style={{
                          background: activeCategory === c.id ? '#0284c7' : '#e2e8f0',
                          color: activeCategory === c.id ? '#ffffff' : '#475569',
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          padding: '1px 5px',
                          borderRadius: '8px',
                        }}
                      >
                        {c.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => categoryBarRef.current?.scrollBy({ left: 160, behavior: 'smooth' })}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#475569',
                  flexShrink: 0,
                }}
                title="Cuộn sang phải"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Side-by-Side Current Dish vs New Dish */}
            <div className="swapper-cards-grid">
              {/* Món Ăn Gốc (Current Dish) */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '14px',
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '10px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '4px' }}>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        color: '#475569',
                        textTransform: 'uppercase',
                        background: '#e2e8f0',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        letterSpacing: '0.5px',
                      }}
                    >
                      Món Ăn Gốc Trong Thực Đơn
                    </span>
                    {sourceMealName && (
                      <span style={{ fontSize: '0.74rem', color: '#0284c7', fontWeight: 700 }}>
                        {sourceMealName}
                      </span>
                    )}
                  </div>

                  {isActualDishMode ? (
                    /* Display exact current dish from meal plan */
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
                        {sourceName}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>Định lượng:</span>
                        <strong style={{ color: '#003b70' }}>{sourceAmount}</strong>
                      </div>
                      {currentDish?.prepTip && (
                        <div style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic', marginTop: '4px' }}>
                          {currentDish.prepTip}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Standalone calculator mode: modern food selector */
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ marginBottom: '8px' }}>
                        <ModernFoodSelector
                          id={sourceFoodId}
                          label="Chọn món gốc"
                          selectedFood={sourceFood}
                          foods={combinedFoodList}
                          onSelect={(f) => {
                            setSourceFood(f);
                            setSourceGrams(String(f.defaultServingGrams));
                          }}
                          onDeleteCustomFood={handleDeleteCustomFood}
                          accentColor="blue"
                        />
                      </div>

                      <label
                        htmlFor={sourceGramsId}
                        style={{ display: 'block', fontSize: '0.74rem', color: '#475569', fontWeight: 600, marginBottom: '2px' }}
                      >
                        Khối lượng (gram)
                      </label>
                      <input
                        id={sourceGramsId}
                        type="number"
                        step="5"
                        value={sourceGrams}
                        onChange={(e) => setSourceGrams(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '7px 10px',
                          borderRadius: '8px',
                          border: '1.5px solid #cbd5e1',
                          fontSize: '0.88rem',
                          fontWeight: 800,
                          color: '#0f172a',
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Nutrients of Source Dish */}
                <div style={{ background: '#ffffff', padding: '10px 12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div
                    style={{
                      fontSize: '1.05rem',
                      fontWeight: 900,
                      color: '#003b70',
                      marginBottom: '6px',
                    }}
                  >
                    {sourceCalories} kcal
                  </div>
                  <div style={{ display: 'flex', gap: '6px', fontSize: '0.74rem', flexWrap: 'wrap' }}>
                    <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 7px', borderRadius: '4px', fontWeight: 700 }}>
                      P: {sourceProtein}g
                    </span>
                    <span style={{ background: '#fef3c7', color: '#b45309', padding: '2px 7px', borderRadius: '4px', fontWeight: 700 }}>
                      C: {sourceCarbs}g
                    </span>
                    <span style={{ background: '#fdf2f8', color: '#be185d', padding: '2px 7px', borderRadius: '4px', fontWeight: 700 }}>
                      F: {sourceFat}g
                    </span>
                  </div>
                </div>
              </div>

              {/* Center Swap Arrow */}
              <div className="swapper-arrow-cell">
                <div className="swapper-arrow-icon">
                  <ArrowRightLeft size={18} />
                </div>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase' }}>
                  Đổi sang
                </span>
              </div>

              {/* Món Đổi Sang (Target Food) */}
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1.5px solid #86efac',
                  borderRadius: '14px',
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '10px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '4px' }}>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        color: '#15803d',
                        textTransform: 'uppercase',
                        background: '#dcfce7',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        letterSpacing: '0.5px',
                      }}
                    >
                      Món Đổi Sang (Tương Đương)
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 700 }}>
                      {(targetFood as CustomFoodItem).isCustom ? 'Món có sẵn' : targetFood.categoryLabel}
                    </span>
                  </div>

                  {/* Clean Modern Food Selector Dropdown */}
                  <div style={{ marginBottom: '10px' }}>
                    <ModernFoodSelector
                      id={targetFoodId}
                      label="Chọn món thay thế"
                      selectedFood={targetFood}
                      foods={combinedFoodList}
                      onSelect={handleSelectTargetFood}
                      onDeleteCustomFood={handleDeleteCustomFood}
                      accentColor="green"
                    />
                  </div>

                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span style={{ fontSize: '0.74rem', color: '#166534', fontWeight: 600 }}>
                        Khối lượng cần ăn chuẩn
                      </span>
                      <span style={{ fontSize: '0.72rem', color: '#15803d', fontWeight: 700 }}>
                        {targetServingDisplay}
                      </span>
                    </div>
                    <div
                      style={{
                        background: '#ffffff',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: '1.5px solid #22c55e',
                        fontSize: '1rem',
                        fontWeight: 900,
                        color: '#15803d',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="number"
                          step="10"
                          min="10"
                          value={targetGrams}
                          onChange={(e) => setTargetGrams(e.target.value)}
                          style={{
                            width: '70px',
                            padding: '2px 4px',
                            borderRadius: '4px',
                            border: '1px solid #86efac',
                            fontSize: '0.95rem',
                            fontWeight: 900,
                            color: '#15803d',
                            textAlign: 'center',
                          }}
                        />
                        <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>gram</span>
                      </div>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#16a34a' }}>Chuẩn khẩu phần</span>
                    </div>
                  </div>
                </div>

                {/* Nutrients of Target Dish */}
                <div style={{ background: '#ffffff', padding: '10px 12px', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                  <div
                    style={{
                      fontSize: '1.05rem',
                      fontWeight: 900,
                      color: '#15803d',
                      marginBottom: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>{targetCalories} kcal</div>
                    <span
                      style={{
                        fontSize: '0.76rem',
                        fontWeight: 800,
                        color: calDiff > 0 ? '#ea580c' : calDiff < 0 ? '#16a34a' : '#64748b',
                        background: calDiff > 0 ? '#ffedd5' : '#dcfce7',
                        padding: '2px 6px',
                        borderRadius: '4px',
                      }}
                    >
                      {calDiff > 0 ? `+${calDiff} kcal` : calDiff < 0 ? `${calDiff} kcal` : '0 kcal'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', fontSize: '0.74rem', flexWrap: 'wrap' }}>
                    <span style={{ background: '#f0fdf4', color: '#166534', padding: '2px 7px', borderRadius: '4px', fontWeight: 700 }}>
                      P: {targetProtein}g
                    </span>
                    <span style={{ background: '#fef3c7', color: '#b45309', padding: '2px 7px', borderRadius: '4px', fontWeight: 700 }}>
                      C: {targetCarbs}g
                    </span>
                    <span style={{ background: '#fdf2f8', color: '#be185d', padding: '2px 7px', borderRadius: '4px', fontWeight: 700 }}>
                      F: {targetFat}g
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="swapper-footer-row">
              <button
                type="button"
                className="button"
                onClick={onClose}
                style={{ padding: '8px 18px', fontSize: '0.85rem' }}
              >
                Đóng
              </button>

              {onApplySwap ? (
                <button
                  type="button"
                  className="button button-primary"
                  onClick={handleApply}
                  style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#ffffff',
                    border: 'none',
                    padding: '8px 22px',
                    fontSize: '0.88rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
                  }}
                >
                  <Check size={16} /> Áp Dụng Thay Món Này
                </button>
              ) : (
                <button
                  type="button"
                  className="button button-primary"
                  onClick={onClose}
                  style={{ padding: '8px 20px', fontSize: '0.88rem' }}
                >
                  <Check size={16} /> Đã hiểu & Áp dụng
                </button>
              )}
            </div>
          </>
        )}

        {/* TAB 2: QUẢN LÝ KHO MÓN ĂN (THÊM • SỬA • XÓA) */}
        {modalTab === 'manage' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Toolbar: Search + Categories Filter + Add Button */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 240px', position: 'relative' }}>
                <input
                  type="text"
                  value={manageSearchQuery}
                  onChange={(e) => setManageSearchQuery(e.target.value)}
                  placeholder="Tìm món ăn trong kho..."
                  style={{
                    width: '100%',
                    padding: '7px 10px 7px 32px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.82rem',
                  }}
                />
                <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              </div>

              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {[
                  { id: 'all', label: 'Tất cả' },
                  { id: 'custom', label: `Món tự thêm (${customFoods.length})` },
                  { id: 'protein', label: 'Đạm' },
                  { id: 'carbs', label: 'Tinh bột' },
                  { id: 'veggies', label: 'Rau củ' },
                  { id: 'fat', label: 'Chất béo' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setManageCategoryFilter(cat.id as any)}
                    style={{
                      background: manageCategoryFilter === cat.id ? '#003b70' : '#f1f5f9',
                      color: manageCategoryFilter === cat.id ? '#ffffff' : '#475569',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '5px 10px',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Collapsible Add / Edit Custom Food Form */}
            {showAddForm && (
              <form
                onSubmit={handleAddNewFood}
                style={{
                  background: '#f8fafc',
                  border: '1.5px dashed #0284c7',
                  borderRadius: '10px',
                  padding: '14px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#003b70' }}>
                    {editingFoodId ? 'Chỉnh Sửa Món Ăn Trong Kho' : 'Tự Thêm Món Mới Vào Kho Dữ Liệu Có Sẵn'}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      resetAddEditForm();
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                  >
                    <X size={16} />
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', marginBottom: '8px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#475569', marginBottom: '2px' }}>
                      Tên món ăn <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={newFoodName}
                      onChange={(e) => setNewFoodName(e.target.value)}
                      placeholder="VD: Cá bống kho tộ, Bò bít tết..."
                      style={{ width: '100%', padding: '5px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Nhóm thực phẩm
                    </label>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {[
                        { id: 'protein', label: 'Đạm' },
                        { id: 'carbs', label: 'Tinh bột' },
                        { id: 'veggies', label: 'Rau củ' },
                        { id: 'fat', label: 'Chất béo' },
                      ].map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setNewFoodCategory(cat.id as FoodCategory)}
                          style={{
                            background: newFoodCategory === cat.id ? '#003b70' : '#ffffff',
                            color: newFoodCategory === cat.id ? '#ffffff' : '#475569',
                            border: '1px solid',
                            borderColor: newFoodCategory === cat.id ? '#003b70' : '#cbd5e1',
                            borderRadius: '4px',
                            padding: '3px 8px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#475569', marginBottom: '2px' }}>
                      Định lượng khẩu phần
                    </label>
                    <input
                      type="text"
                      value={newFoodServing}
                      onChange={(e) => setNewFoodServing(e.target.value)}
                      placeholder="VD: 1 đĩa (150g), 1 bát con..."
                      style={{ width: '100%', padding: '5px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#475569', marginBottom: '2px' }}>
                      Khối lượng (gram)
                    </label>
                    <input
                      type="number"
                      value={newFoodGrams}
                      onChange={(e) => setNewFoodGrams(e.target.value)}
                      placeholder="VD: 150"
                      style={{ width: '100%', padding: '5px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(65px, 1fr))', gap: '6px', marginBottom: '8px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#475569', marginBottom: '2px' }}>Calo (kcal)</label>
                    <input
                      type="number"
                      value={newFoodCalories}
                      onChange={(e) => setNewFoodCalories(e.target.value)}
                      placeholder="Tự tính"
                      style={{ width: '100%', padding: '5px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#1d4ed8', marginBottom: '2px' }}>Protein (g)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={newFoodProtein}
                      onChange={(e) => setNewFoodProtein(e.target.value)}
                      placeholder="VD: 25"
                      style={{ width: '100%', padding: '5px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#b45309', marginBottom: '2px' }}>Carbs (g)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={newFoodCarbs}
                      onChange={(e) => setNewFoodCarbs(e.target.value)}
                      placeholder="VD: 5"
                      style={{ width: '100%', padding: '5px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#be185d', marginBottom: '2px' }}>Fat (g)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={newFoodFat}
                      onChange={(e) => setNewFoodFat(e.target.value)}
                      placeholder="VD: 4"
                      style={{ width: '100%', padding: '5px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '8px' }}>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#475569', marginBottom: '2px' }}>
                    Cách chế biến / Ghi chú (tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={newFoodPrepTip}
                    onChange={(e) => setNewFoodPrepTip(e.target.value)}
                    placeholder="VD: Ướp tiêu gừng, kho nhạt lửa nhỏ..."
                    style={{ width: '100%', padding: '5px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      resetAddEditForm();
                    }}
                    style={{ background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '6px', padding: '5px 12px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 700 }}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    style={{
                      background: '#0284c7',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '5px 14px',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Check size={13} /> {editingFoodId ? 'Lưu Thay Đổi Món Ăn' : 'Lưu Vào Kho Món Có Sẵn'}
                  </button>
                </div>
              </form>
            )}

            {/* Food Cards List */}
            <div style={{ maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
              {filteredManageFoods.map((item) => {
                const isCust = Boolean((item as CustomFoodItem).isCustom);
                return (
                  <div
                    key={item.id}
                    style={{
                      background: '#ffffff',
                      border: isCust ? '1.5px solid #bfdbfe' : '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ flex: '1 1 220px', minWidth: '180px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '0.92rem', color: '#0f172a' }}>{item.name}</strong>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: isCust ? '#dbeafe' : '#f1f5f9',
                            color: isCust ? '#1d4ed8' : '#475569',
                          }}
                        >
                          {isCust ? 'Món tự thêm' : item.categoryLabel}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '3px' }}>
                        Khẩu phần: <strong style={{ color: '#003b70' }}>{item.servingLabel || `${item.defaultServingGrams}g`}</strong> • {item.caloriesPer100g} kcal/100g
                      </div>
                      <div style={{ display: 'flex', gap: '8px', fontSize: '0.72rem', marginTop: '3px', flexWrap: 'wrap' }}>
                        <span style={{ color: '#1d4ed8', fontWeight: 700 }}>Protein: {item.proteinPer100g}g</span>
                        <span style={{ color: '#b45309', fontWeight: 700 }}>Carbs: {item.carbsPer100g}g</span>
                        <span style={{ color: '#be185d', fontWeight: 700 }}>Fat: {item.fatPer100g}g</span>
                        {item.prepTip && <span style={{ color: '#64748b', fontStyle: 'italic' }}>({item.prepTip})</span>}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => handleChooseForSwap(item)}
                        style={{
                          background: '#ecfdf5',
                          color: '#059669',
                          border: '1px solid #a7f3d0',
                          borderRadius: '6px',
                          padding: '5px 10px',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                        title="Chọn món này để đổi sang thực đơn"
                      >
                        <ArrowRightLeft size={13} /> Đổi món này
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStartEditFood(item)}
                        style={{
                          background: '#eff6ff',
                          color: '#1d4ed8',
                          border: '1px solid #bfdbfe',
                          borderRadius: '6px',
                          padding: '5px 9px',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                        title="Chỉnh sửa thông tin món ăn"
                      >
                        <Edit3 size={13} /> Sửa
                      </button>

                      {isCust && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteCustomFood(item.id, e)}
                          style={{
                            background: '#fff1f2',
                            color: '#e11d48',
                            border: '1px solid #fecdd3',
                            borderRadius: '6px',
                            padding: '5px 8px',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                          title="Xóa món ăn này khỏi kho"
                        >
                          <Trash2 size={13} /> Xóa
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {filteredManageFoods.length === 0 && (
                <div style={{ textAlign: 'center', padding: '30px 10px', color: '#64748b', fontSize: '0.85rem' }}>
                  Không tìm thấy món ăn nào phù hợp với bộ lọc tìm kiếm.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
