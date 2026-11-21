import fs from 'node:fs';
import path from 'node:path';
import type { QueryFilter } from 'mongoose';
import FoodImage, { type IFoodImage } from '../models/FoodImage.js';
import { generateImage, type AspectRatio } from './imageProvider.js';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';
import { isCloudinaryConfigured, uploadFoodImageToCloudinary } from './cloudinaryService.js';

export const UPLOADS_DIR = path.resolve(process.cwd(), process.env.GYM_EMBEDDED === '1' ? 'uploads/gym/food-images' : 'uploads/food-images');

/**
 * Đảm bảo thư mục lưu trữ ảnh vật lý tồn tại
 */
export function ensureFoodImagesDir(): string {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  return UPLOADS_DIR;
}

/**
 * Tạo prompt ẩm thực Việt Nam siêu chân thật cho AI (Google Gemini 3.1 Flash Image)
 */
export function buildVietnameseFoodPrompt(mealName: string, foodItems?: string[]): string {
  const cleanName = mealName.trim();
  const detailItems = [...new Set((foodItems || [])
    .map((it) => it.trim())
    .filter((it) => it && it !== cleanName))];
  const detailStr = detailItems.length > 0 ? `, gồm có: ${detailItems.join(', ')}` : '';
  return [
    `Tạo một ảnh chụp món ăn chân thực để minh họa thực đơn dinh dưỡng: ${cleanName}${detailStr}.`,
    'Thể hiện chính xác món ăn, nguyên liệu và cách chế biến được mô tả; giữ đặc trưng của món, không tự thay thế nguyên liệu. Với món Việt, thể hiện đúng cách chế biến và trình bày đời thường tại Việt Nam.',
    'Nếu có định lượng, dùng làm tham chiếu cho tỷ lệ và khẩu phần nhìn thấy, không viết số lên ảnh. Nếu không có định lượng, thể hiện một khẩu phần ăn thông thường cho một người.',
    'Một món đơn: chỉ chụp món đó. Món kết hợp như bánh mì kẹp hoặc salad: trình bày thành một món hoàn chỉnh, thấy rõ các thành phần chính. Một bữa gồm nhiều món riêng: đặt đầy đủ các món trong cùng khung hình, mỗi món có bát hoặc đĩa phù hợp, không trộn tất cả vào một món.',
    'Món ăn là chủ thể, chiếm khoảng 75% khung hình, nằm giữa ảnh và không bị cắt mất; chụp cận góc nghiêng 45 độ hoặc hơi từ trên xuống để thấy rõ toàn bộ món. Bát đĩa trơn trên mặt bàn sạch, nền trung tính đơn giản.',
    'Phong cách ảnh chụp thực phẩm đời thực: ánh sáng cửa sổ dịu, bóng đổ tự nhiên, màu sắc trung thực, kết cấu nguyên liệu và độ chín rõ ràng, độ bóng vừa phải, các chi tiết không hoàn hảo tự nhiên. Lấy nét rõ món ăn, không làm mờ các món trong cùng bữa.',
    'Không tự thêm món phụ, rau trang trí, nước chấm hoặc đồ uống ngoài mô tả. Không người, bàn tay, cảnh quán ăn đông đúc, bao bì, chữ, nhãn, logo, watermark hoặc khung infographic. Không minh họa, hoạt hình, 3D, CGI, bề mặt nhựa hay màu bão hòa quá mức. Chỉ xuất một ảnh món ăn, không ghép nhiều ảnh.',
  ].join(' ');
}

/**
 * Chuẩn hóa tên món ăn tiếng Việt sang không dấu, viết thường, loại bỏ ký tự đặc biệt
 * Ví dụ: "Ức Gà Áp Chảo (150g)!" -> "uc ga ap chao"
 */
export function normalizeFoodName(str: string): string {
  if (!str || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .replace(/\([^)]*\)/g, '') // xóa nội dung trong ngoặc đơn như định lượng (150g)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Trích xuất mảng từ khóa từ tên món ăn
 */
export function extractKeywords(str: string): string[] {
  const norm = normalizeFoodName(str);
  if (!norm) return [];
  const words = norm.split(' ').filter((w) => w.length > 1);
  const keywords = new Set<string>();
  keywords.add(norm);
  words.forEach((w) => keywords.add(w));
  // Bi-grams (cụm 2 từ liền nhau)
  for (let i = 0; i < words.length - 1; i++) {
    keywords.add(`${words[i]} ${words[i + 1]}`);
  }
  return Array.from(keywords);
}

/**
 * Bộ lọc loại bỏ toàn bộ dữ liệu ảnh mock, ảnh seed cũ không có thực
 */
const NOT_MOCK_IMAGE_FILTER: QueryFilter<IFoodImage> = {
  source: { $ne: 'SEED' },
  imageUrl: { $not: /^\/images\/dishes|unsplash\.com/i },
};

/**
 * Tìm ảnh món ăn trong kho dựa theo tên món ăn hoặc các món con trong bữa
 */
export async function findMatchingFoodImage(
  mealName: string,
  itemNames: string[] = []
): Promise<IFoodImage | null> {
  const normMeal = normalizeFoodName(mealName);

  // 1. Chỉ lấy khi tên món ăn trùng khớp chính xác với món đã từng tạo trước đây
  if (normMeal && normMeal.length >= 2) {
    const exact = await FoodImage.findOne({ normalizedName: normMeal, ...NOT_MOCK_IMAGE_FILTER });
    if (exact) return exact;
  }

  // 2. Nếu tên bữa ăn chung chung (vd: "Bữa Sáng", "Bữa Trưa") và có món con cụ thể, kiểm tra xem có món nào trùng tên chính xác không
  const isGenericMealName = ['bua sang', 'bua trua', 'bua toi', 'bua phu', 'bua an'].includes(normMeal);
  if (isGenericMealName && itemNames.length > 0) {
    for (const item of itemNames) {
      const normItem = normalizeFoodName(item);
      if (!normItem || normItem.length < 2) continue;

      const itemExact = await FoodImage.findOne({ normalizedName: normItem, ...NOT_MOCK_IMAGE_FILTER });
      if (itemExact) return itemExact;
    }
  }

  return null;
}

/**
 * Lưu Buffer ảnh vào Cloudinary (hoặc folder vật lý nếu dev offline) và lưu bản ghi vào MongoDB
 */
export async function saveFoodImageToStorage(options: {
  buffer: Buffer;
  name: string;
  category?: string;
  mimeType?: string;
  source?: 'AI' | 'UPLOAD' | 'SEED';
  prompt?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  keywords?: string[];
  userId?: string;
}): Promise<IFoodImage> {
  const {
    buffer,
    name,
    category = 'OTHER',
    mimeType = 'image/jpeg',
    source = 'AI',
    prompt = '',
    calories,
    protein,
    carbs,
    fat,
    keywords: customKeywords,
    userId,
  } = options;

  const norm = normalizeFoodName(name);
  if (!norm) {
    throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Tên món ăn không hợp lệ.' });
  }

  const slug = norm.replace(/\s+/g, '_').slice(0, 80) || 'mon_an';
  let imageUrl: string;
  let localPath: string | undefined;

  // Đẩy thẳng lên Cloudinary nếu đã cấu hình (môi trường Production / Staging)
  if (isCloudinaryConfigured()) {
    const uploadRes = await uploadFoodImageToCloudinary(buffer, slug);
    imageUrl = uploadRes.secure_url;
  } else {
    // Dự phòng lưu cục bộ cho môi trường dev offline khi chưa có Cloudinary credentials
    const dir = ensureFoodImagesDir();
    const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
    const filename = `${slug}_${Date.now()}.${ext}`;
    localPath = path.join(dir, filename);
    fs.writeFileSync(localPath, buffer);
    imageUrl = `${process.env.GYM_EMBEDDED === '1' ? '/uploads/gym' : '/uploads'}/food-images/${filename}`;
  }

  const autoKeywords = extractKeywords(name);
  const combinedKeywords = Array.from(new Set([...autoKeywords, ...(customKeywords || [])]));

  // Lưu hoặc cập nhật trong cơ sở dữ liệu
  const foodImage = await FoodImage.findOneAndUpdate(
    { normalizedName: norm },
    {
      name: name.trim(),
      normalizedName: norm,
      keywords: combinedKeywords,
      category: category.toUpperCase(),
      imageUrl,
      ...(localPath ? { localPath } : { $unset: { localPath: 1 } }),
      fileSize: buffer.length,
      mimeType,
      source,
      prompt,
      ...(calories !== undefined ? { calories } : {}),
      ...(protein !== undefined ? { protein } : {}),
      ...(carbs !== undefined ? { carbs } : {}),
      ...(fat !== undefined ? { fat } : {}),
      createdBy: userId || null,
      $inc: { usageCount: 1 },
    },
    { new: true, upsert: true }
  );

  return foodImage;
}


/**
 * Lấy ảnh món ăn từ kho (nếu đã có) HOẶC gọi AI tạo mới và lưu vào kho (nếu chưa có)
 */
export async function getOrGenerateMealImage(params: {
  mealName: string;
  foodItems?: string[];
  prompt?: string;
  userId: string;
  requestKey: string;
  aspectRatio?: AspectRatio;
  forceRegenerate?: boolean;
}): Promise<{
  imageUrl: string;
  name: string;
  source: 'CACHE' | 'AI';
  reused: boolean;
  cost?: number;
  message: string;
}> {
  const { mealName, foodItems = [], prompt, userId, requestKey, aspectRatio = '4:3', forceRegenerate = false } = params;

  // BƯỚC 1: Tìm kiếm trong kho ảnh món ăn có sẵn (nếu không ép vẽ lại)
  if (!forceRegenerate) {
    const existing = await findMatchingFoodImage(mealName, foodItems);
    if (existing) {
      existing.usageCount = (existing.usageCount || 0) + 1;
      await existing.save();

      return {
        imageUrl: existing.imageUrl,
        name: existing.name,
        source: 'CACHE',
        reused: true,
        message: 'Tạo ảnh thành công!',
      };
    }
  }

  // BƯỚC 2: Chưa có trong kho (hoặc ép vẽ mới) -> Gọi AI sinh ảnh mới theo từng món ăn
  const isGenericPrompt =
    !prompt ||
    prompt.trim().length <= 10 ||
    prompt.toLowerCase().includes('professional food photography');

  const defaultPrompt = isGenericPrompt
    ? buildVietnameseFoodPrompt(mealName, foodItems)
    : prompt!.trim();

  let aiResult;
  try {
    aiResult = await generateImage(
      { userId, taskType: 'IMAGE_GENERATION', requestKey: `${requestKey}:meal-image` },
      { prompt: defaultPrompt, aspectRatio, outputFormat: 'jpeg' }
    );
  } catch {
    // Fallback: Nếu tài khoản PT hết credit ví hoặc upstream gặp sự cố, tạo trực tiếp qua generator để không làm gián đoạn
    aiResult = await generateImage({ prompt: defaultPrompt, aspectRatio, outputFormat: 'jpeg' });
  }

  const buffer = Buffer.from(aiResult.b64Json, 'base64');

  // BƯỚC 3: Lưu ảnh AI mới sinh vào folder kho ảnh và MongoDB theo quy cách tên món để tái sử dụng mãi mãi
  const saved = await saveFoodImageToStorage({
    buffer,
    name: mealName,
    mimeType: aiResult.mediaType || 'image/jpeg',
    source: 'AI',
    prompt: defaultPrompt,
    userId,
  });

  return {
    imageUrl: saved.imageUrl,
    name: saved.name,
    source: 'AI',
    reused: false,
    cost: aiResult.cost,
    message: 'Tạo ảnh thành công!',
  };
}

/**
 * Lấy danh sách ảnh trong kho thư viện (kèm thống kê tổng quát)
 */
export async function listFoodImages(query: {
  page?: number;
  limit?: number;
  search?: string;
  source?: string;
  category?: string;
}) {
  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(query.limit || 24)));
  const filter: Record<string, any> = {};

  // Luôn lọc bỏ dữ liệu mock / seed cũ nếu không được chỉ định rõ ràng
  if (!query.source || query.source.toUpperCase() === 'ALL') {
    filter.source = { $ne: 'SEED' };
    filter.imageUrl = { $not: /^\/images\/dishes|unsplash\.com/i };
  } else if (['AI', 'UPLOAD'].includes(query.source.toUpperCase())) {
    filter.source = query.source.toUpperCase();
    filter.imageUrl = { $not: /^\/images\/dishes|unsplash\.com/i };
  }

  if (query.category && query.category.toUpperCase() !== 'ALL') {
    filter.category = query.category.toUpperCase();
  }

  if (query.search && query.search.trim()) {
    const norm = normalizeFoodName(query.search.trim());
    filter.$or = [
      { normalizedName: { $regex: norm, $options: 'i' } },
      { name: { $regex: query.search.trim(), $options: 'i' } },
      { keywords: norm },
    ];
  }

  const [items, total, stats] = await Promise.all([
    FoodImage.find(filter)
      .sort({ usageCount: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    FoodImage.countDocuments(filter),
    FoodImage.aggregate([
      { $match: { source: { $ne: 'SEED' }, imageUrl: { $not: /^\/images\/dishes|unsplash\.com/i } } },
      {
        $group: {
          _id: null,
          totalImages: { $sum: 1 },
          totalUsage: { $sum: '$usageCount' },
          aiCount: { $sum: { $cond: [{ $eq: ['$source', 'AI'] }, 1, 0] } },
          uploadCount: { $sum: { $cond: [{ $eq: ['$source', 'UPLOAD'] }, 1, 0] } },
        },
      },
    ]),
  ]);

  const summary = stats[0] || {
    totalImages: total,
    totalUsage: 0,
    aiCount: 0,
    uploadCount: 0,
  };

  // Ước tính chi phí AI tiết kiệm được: mỗi lượt tái sử dụng ~500đ / 0.02$
  const estimatedSavingsVnd = Math.max(0, (summary.totalUsage - summary.totalImages) * 500);

  return {
    items,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    summary: {
      ...summary,
      estimatedSavingsVnd,
    },
  };
}

/**
 * Xóa một ảnh món ăn khỏi kho và xóa file vật lý
 */
export async function deleteFoodImage(id: string): Promise<boolean> {
  const doc = await FoodImage.findById(id);
  if (!doc) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Không tìm thấy ảnh món ăn trong kho.' });

  if (doc.localPath && fs.existsSync(doc.localPath)) {
    try {
      fs.unlinkSync(doc.localPath);
    } catch {
      // Bỏ qua lỗi xóa file vật lý nếu file không tồn tại
    }
  }

  await doc.deleteOne();
  return true;
}

/**
 * Chỉnh sửa toàn bộ thông tin món ăn trong kho (Tên món, từ khóa, danh mục, calo, macro, prompt, link ảnh, file vật lý, lượt dùng)
 */
export async function updateFoodImage(
  id: string,
  updates: {
    name?: string;
    keywords?: string[] | string;
    category?: string;
    prompt?: string;
    imageUrl?: string;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    usageCount?: number;
    source?: 'AI' | 'UPLOAD' | 'SEED';
    buffer?: Buffer;
    mimeType?: string;
    userId?: string;
  }
): Promise<IFoodImage> {
  const doc = await FoodImage.findById(id);
  if (!doc) {
    throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Không tìm thấy ảnh món ăn trong kho.' });
  }

  // 1. Tên món ăn: tính lại normalizedName và cập nhật keywords
  if (updates.name && typeof updates.name === 'string' && updates.name.trim()) {
    const trimmed = updates.name.trim();
    const norm = normalizeFoodName(trimmed);
    if (!norm) {
      throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Tên món ăn không hợp lệ.' });
    }
    doc.name = trimmed;
    doc.normalizedName = norm;
    // Tự động sinh từ khóa cơ bản từ tên
    const baseKeywords = extractKeywords(trimmed);
    doc.keywords = Array.from(new Set([...(doc.keywords || []), ...baseKeywords]));
  }

  // 2. Từ khóa đối soát (Keywords/Tags) bổ sung hoặc ghi đè
  if (updates.keywords !== undefined) {
    let kwList: string[] = [];
    if (Array.isArray(updates.keywords)) {
      kwList = updates.keywords.map((k) => String(k).trim()).filter(Boolean);
    } else if (typeof updates.keywords === 'string') {
      kwList = updates.keywords
        .split(/[,;\n]/)
        .map((k) => k.trim())
        .filter(Boolean);
    }
    if (kwList.length > 0) {
      const normalizedKeywords = kwList.map((k) => normalizeFoodName(k)).filter(Boolean);
      doc.keywords = Array.from(new Set([...(doc.keywords || []), ...kwList, ...normalizedKeywords]));
    }
  }

  // 3. Danh mục phân loại (Category)
  if (updates.category !== undefined) {
    doc.category = updates.category.trim().toUpperCase() || 'OTHER';
  }

  // 4. Prompt / Mô tả
  if (updates.prompt !== undefined) {
    doc.prompt = updates.prompt.trim();
  }

  // 5. URL ảnh trực tiếp (nếu người dùng dán link ảnh online)
  if (updates.imageUrl && typeof updates.imageUrl === 'string' && updates.imageUrl.trim()) {
    doc.imageUrl = updates.imageUrl.trim();
  }

  // 6. Calo và Macros (Dinh dưỡng)
  if (updates.calories !== undefined) {
    doc.calories = updates.calories !== null && !isNaN(Number(updates.calories)) ? Number(updates.calories) : undefined;
  }
  if (updates.protein !== undefined) {
    doc.protein = updates.protein !== null && !isNaN(Number(updates.protein)) ? Number(updates.protein) : undefined;
  }
  if (updates.carbs !== undefined) {
    doc.carbs = updates.carbs !== null && !isNaN(Number(updates.carbs)) ? Number(updates.carbs) : undefined;
  }
  if (updates.fat !== undefined) {
    doc.fat = updates.fat !== null && !isNaN(Number(updates.fat)) ? Number(updates.fat) : undefined;
  }

  // 7. Lượt sử dụng (Usage count)
  if (updates.usageCount !== undefined && !isNaN(Number(updates.usageCount))) {
    doc.usageCount = Math.max(0, Number(updates.usageCount));
  }

  // 8. Nguồn (Source)
  if (updates.source && ['AI', 'UPLOAD', 'SEED'].includes(updates.source.toUpperCase())) {
    doc.source = updates.source.toUpperCase() as 'AI' | 'UPLOAD' | 'SEED';
  }

  // 9. Nếu có tải file ảnh mới thay thế (đẩy lên Cloudinary hoặc ghi đè file vật lý trên ổ đĩa)
  if (updates.buffer && updates.buffer.length > 0) {
    const slug = (doc.normalizedName || 'food').replace(/\s+/g, '_').slice(0, 80);

    if (isCloudinaryConfigured()) {
      const uploadRes = await uploadFoodImageToCloudinary(updates.buffer, slug);
      doc.imageUrl = uploadRes.secure_url;
      doc.fileSize = updates.buffer.length;
      doc.mimeType = updates.mimeType || 'image/jpeg';
      doc.source = 'UPLOAD';
      if (doc.localPath && fs.existsSync(doc.localPath)) {
        try { fs.unlinkSync(doc.localPath); } catch {}
        doc.localPath = undefined;
      }
    } else {
      const dir = ensureFoodImagesDir();
      const ext = (updates.mimeType || '').includes('png') ? 'png' : (updates.mimeType || '').includes('webp') ? 'webp' : 'jpg';
      const filename = `${slug}_${Date.now()}.${ext}`;
      const newPath = path.join(dir, filename);

      // Xóa file ảnh cũ nếu có
      if (doc.localPath && fs.existsSync(doc.localPath)) {
        try {
          fs.unlinkSync(doc.localPath);
        } catch {}
      }

      fs.writeFileSync(newPath, updates.buffer);
      doc.imageUrl = `${process.env.GYM_EMBEDDED === '1' ? '/uploads/gym' : '/uploads'}/food-images/${filename}`;
      doc.localPath = newPath;
      doc.fileSize = updates.buffer.length;
      doc.mimeType = updates.mimeType || 'image/jpeg';
      doc.source = 'UPLOAD';
    }
  }

  await doc.save();
  return doc;
}

/**
 * Tái tạo lại ảnh bằng AI trực tiếp cho một món ăn đã có trong kho
 */
export async function regenerateFoodImageWithAi(
  id: string,
  options: {
    prompt?: string;
    aspectRatio?: AspectRatio;
    userId: string;
    requestKey: string;
  }
): Promise<IFoodImage> {
  const doc = await FoodImage.findById(id);
  if (!doc) {
    throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Không tìm thấy ảnh món ăn trong kho.' });
  }

  const isGenericPrompt =
    !options.prompt ||
    options.prompt.trim().length <= 10 ||
    options.prompt.toLowerCase().includes('professional food photography') ||
    (Boolean(doc.prompt) && doc.prompt!.toLowerCase().includes('professional food photography'));

  const promptToUse = isGenericPrompt
    ? buildVietnameseFoodPrompt(doc.name)
    : options.prompt && options.prompt.trim().length > 10
    ? options.prompt.trim()
    : doc.prompt && doc.prompt.trim().length > 10
    ? doc.prompt.trim()
    : buildVietnameseFoodPrompt(doc.name);

  let aiResult;
  try {
    aiResult = await generateImage(
      { userId: options.userId, taskType: 'IMAGE_GENERATION', requestKey: `${options.requestKey}:regenerate-image` },
      { prompt: promptToUse, aspectRatio: options.aspectRatio || '4:3', outputFormat: 'jpeg' }
    );
  } catch {
    aiResult = await generateImage({ prompt: promptToUse, aspectRatio: options.aspectRatio || '4:3', outputFormat: 'jpeg' });
  }

  const buffer = Buffer.from(aiResult.b64Json, 'base64');
  const slug = (doc.normalizedName || 'food').replace(/\s+/g, '_').slice(0, 80);

  if (isCloudinaryConfigured()) {
    const uploadRes = await uploadFoodImageToCloudinary(buffer, slug);
    doc.imageUrl = uploadRes.secure_url;
    doc.fileSize = buffer.length;
    doc.mimeType = aiResult.mediaType || 'image/jpeg';
    doc.source = 'AI';
    doc.prompt = promptToUse;

    if (doc.localPath && fs.existsSync(doc.localPath)) {
      try { fs.unlinkSync(doc.localPath); } catch {}
      doc.localPath = undefined;
    }
  } else {
    const dir = ensureFoodImagesDir();
    const ext = (aiResult.mediaType || '').includes('png') ? 'png' : 'jpg';
    const filename = `${slug}_${Date.now()}.${ext}`;
    const newPath = path.join(dir, filename);

    // Xóa ảnh vật lý cũ nếu tồn tại
    if (doc.localPath && fs.existsSync(doc.localPath)) {
      try {
        fs.unlinkSync(doc.localPath);
      } catch {}
    }

    fs.writeFileSync(newPath, buffer);

    doc.imageUrl = `${process.env.GYM_EMBEDDED === '1' ? '/uploads/gym' : '/uploads'}/food-images/${filename}`;
    doc.localPath = newPath;
    doc.fileSize = buffer.length;
    doc.mimeType = aiResult.mediaType || 'image/jpeg';
    doc.source = 'AI';
    doc.prompt = promptToUse;
  }

  await doc.save();
  return doc;
}

