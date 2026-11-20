import { Types } from 'mongoose';
import CustomerProfile from '../models/CustomerProfile.js';
import InBodyRecord from '../models/InBodyRecord.js';
import AssistantSuggestion from '../models/AssistantSuggestion.js';
import AssistantConversation from '../models/AssistantConversation.js';
import { generateText } from './aiProvider.js';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';
import type { AuthenticatedUser } from '../types/express.js';
import { recordAudit } from './auditService.js';
import { searchVectors } from './vectorSearchProvider.js';
export async function getConversation(user: AuthenticatedUser, id: string) { const item = await AssistantConversation.findOne({ _id: id, ptId: new Types.ObjectId(user.id) }); if (!item) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Không tìm thấy hội thoại.' }); return item; }
export async function listSuggestions(user: AuthenticatedUser, query: Record<string, unknown>) { const page = Number(query.page || 1); const limit = Number(query.limit || 20); const filter: Record<string, unknown> = { ptId: new Types.ObjectId(user.id) }; if (typeof query.customerId === 'string') filter.customerId = new Types.ObjectId(query.customerId); if (['PT_REVIEW_REQUIRED', 'APPROVED', 'REJECTED'].includes(String(query.reviewStatus))) filter.reviewStatus = query.reviewStatus; const [items, total] = await Promise.all([AssistantSuggestion.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), AssistantSuggestion.countDocuments(filter)]); return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } }; }
export async function getSuggestion(user: AuthenticatedUser, id: string) { const item = await AssistantSuggestion.findOne({ _id: id, ptId: new Types.ObjectId(user.id) }); if (!item) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Không tìm thấy đề xuất.' }); return item; }
export async function applySuggestion(user: AuthenticatedUser, id: string) { const item = await AssistantSuggestion.findOne({ _id: id, ptId: new Types.ObjectId(user.id), reviewStatus: 'APPROVED', appliedAt: null }); if (!item) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Không tìm thấy đề xuất đã duyệt và chưa sử dụng.' }); item.appliedAt = new Date(); await item.save(); await recordAudit({ actor: user, action: 'ASSISTANT_SUGGESTION_APPLIED', resourceType: 'assistantSuggestion', resourceId: id, customerId: item.customerId }); return item; }
function cleanNaturalText(text: string): string {
  if (!text) return '';
  return text
    // Loại bỏ markdown headers (#, ##, ###, etc.)
    .replace(/^#{1,6}\s+/gm, '')
    // Loại bỏ in đậm / in nghiêng (**text**, *text*, __text__, _text_)
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    // Loại bỏ dấu hoa thị đầu dòng (*)
    .replace(/^\*\s+/gm, '- ')
    // Loại bỏ backticks
    .replace(/`{1,3}/g, '')
    .trim();
}

export async function createSuggestion(user: AuthenticatedUser, payload: { customerId?: string; scenario: string; requestType: string; history?: Array<{ role: string; content: string }> }, requestKey: string) {
  let customer = null;
  if (payload.customerId) {
    customer = await CustomerProfile.findById(payload.customerId).lean();
    if (!customer) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Không tìm thấy khách hàng.' });
    if (user.role === 'PT' && String(customer.assignedPtId) !== user.id) throw new AppError({ status: 403, code: ERROR_CODES.AUTHORIZATION, message: 'Bạn không có quyền sử dụng dữ liệu khách hàng này.' });
  } else if (user.role === 'CUSTOMER') {
    customer = await CustomerProfile.findOne({ userId: new Types.ObjectId(user.id) }).lean();
  }
  // Tự động đọc chỉ số InBody mới nhất nếu có học viên
  let latestInBody = null;
  if (customer?._id) {
    latestInBody = await InBodyRecord.findOne({ customerId: customer._id }).sort({ measurementDate: -1, createdAt: -1 }).lean();
  }

  let profileContext = '';
  if (customer) {
    profileContext = `\nHỒ SƠ NGƯỜI DÙNG / HỌC VIÊN:
- Họ và tên: ${customer.fullName}
- Mục tiêu ban đầu: ${customer.initialGoal || 'Rèn luyện sức khỏe & vóc dáng'}
- Giới tính: ${customer.gender === 'FEMALE' ? 'Nữ' : customer.gender === 'MALE' ? 'Nam' : 'Khác'}
- Chiều cao / Cân nặng ban đầu: ${customer.height ? customer.height + ' cm' : 'Chưa rõ'} | ${customer.initialWeight ? customer.initialWeight + ' kg' : 'Chưa rõ'}
- Tiền sử chấn thương / y tế: ${customer.medicalNotes || 'Không có ghi nhận đặc biệt'}`;
  }

  let inbodyContext = '';
  if (latestInBody) {
    const measureDate = latestInBody.measurementDate ? new Date(latestInBody.measurementDate).toLocaleDateString('vi-VN') : 'Gần nhất';
    inbodyContext = `\nCHỈ SỐ ĐO INBODY MỚI NHẤT (${measureDate}):
- Cân nặng hiện tại: ${latestInBody.weight} kg
- Khối lượng cơ xương (SMM): ${latestInBody.muscleMass ? latestInBody.muscleMass + ' kg' : 'Chưa có'}
- Phần trăm mỡ cơ thể (%PBF): ${latestInBody.bodyFatPercentage ? latestInBody.bodyFatPercentage + '%' : 'Chưa có'}
- Khối lượng mỡ (BFM): ${latestInBody.bodyFatMass ? latestInBody.bodyFatMass + ' kg' : 'Chưa có'}
- Mức mỡ nội tạng (Visceral Fat Level): ${latestInBody.visceralFatLevel ?? 'Chưa có'}
- Tỷ lệ trao đổi chất cơ bản (BMR): ${latestInBody.bmr ? latestInBody.bmr + ' kcal' : 'Chưa có'}
- Điểm đánh giá InBody: ${latestInBody.inbodyScore ?? 'Chưa có'}
- Ghi chú ưu tiên: ${latestInBody.priorities || latestInBody.recommendation || 'Tập trung tối ưu tỷ lệ cơ - mỡ'}`;
  }

  let historyContext = '';
  if (payload.history && payload.history.length > 0) {
    const recent = payload.history.slice(-8);
    historyContext = `\nLỊCH SỬ TRAO ĐỔI TRONG PHIÊN CHAT NÀY:\n` + recent.map((m) => `${m.role === 'USER' ? 'Người dùng' : 'Trợ lý AI'}: ${m.content}`).join('\n');
  }

  // 1. RAG RETRIEVAL: Tìm kiếm các đoạn tri thức chuẩn từ kho tài liệu 3S-Gym
  let knowledgeContext = '';
  let citations: Array<{ documentId: string; title: string }> = [];

  try {
    const hits = await searchVectors(payload.scenario, { status: 'PUBLISHED' }, 4);
    if (hits && hits.length > 0) {
      const rawCitations = hits
        .filter((h) => h.documentId && h.title)
        .map((h) => ({ documentId: h.documentId, title: h.title! }));

      // Loại bỏ duplicate citations
      const uniqueCitations = Array.from(new Map(rawCitations.map((c) => [c.documentId, c])).values());
      citations = uniqueCitations;

      knowledgeContext = `\n=== TÀI LIỆU & QUY CHUẨN TỪ KHO TRI THỨC 3S-GYM (BẮT BUỘC BÁM SÁT ĐỂ TRẢ LỜI) ===\n` +
        hits.map((h, idx) => `[Tài liệu ${idx + 1}: ${h.title || 'Tài liệu chuẩn'} (Chủ đề: ${h.topic})]\n${h.content}`).join('\n\n') +
        `\n\nNGUYÊN TẮC BẮT BUỘC VỀ KHO TRI THỨC:\n` +
        `- Nếu câu hỏi của người dùng có liên quan đến các quy định, thiết bị phần cứng, thông số kỹ thuật, bài tập, dinh dưỡng hoặc quy chuẩn trong tài liệu ở trên: Bạn BẮT BUỘC phải trả lời chính xác, bám sát các số liệu và giải pháp có trong tài liệu.\n` +
        `- Tuyệt đối không bịa đặt hoặc suy diễn sai lệch so với tài liệu tri thức nội bộ 3S-Gym đã cung cấp.`;
    }
  } catch (err) {
    console.warn('[assistantService] Không thể thực hiện RAG vector search:', err);
  }

  const prompt = `Bạn là Trợ lý Chuyên gia Sức khỏe, Thể hình & Dinh dưỡng Toàn diện của hệ thống 3S-Gym (3S-Gym Comprehensive Health, Fitness & Coaching Intelligence).
Bạn sở hữu toàn diện nền tảng tri thức khoa học thể thao cập nhật nhất từ các tổ chức chuẩn mực quốc tế (NSCA, NASM, ACSM, ISSA, ISSN, Precision Nutrition, PubMed), am hiểu sâu sắc cơ sinh học vận động, giải phẫu chức năng, phân tích InBody, cùng kinh nghiệm dinh dưỡng và lối sống thực tế tại Việt Nam.

Bạn có nhiệm vụ giải đáp CHÍNH XÁC, CHUYÊN SÂU và THỰC TẾ GẦN NHƯ TẤT CẢ mọi câu hỏi và tình huống từ KHÁCH HÀNG / HỘI VIÊN cũng như HUẤN LUYỆN VIÊN.
${profileContext}
${inbodyContext}
${historyContext}
${knowledgeContext}

CÂU HỎI MỚI NHẤT HOẶC TÌNH HUỐNG HIỆN TẠI:
"${payload.scenario}"

HỆ THỐNG NGUYÊN TẮC PHẢN HỒI (CỰC KỲ QUAN TRỌNG):

1. THẤU HIỂU & ĐỊNH HƯỚNG THEO ĐỐI TƯỢNG:
   - Nếu có dữ liệu HỒ SƠ / INBODY ở trên: Tự động phân tích và lồng ghép số liệu cụ thể của học viên (% mỡ, cơ, mỡ nội tạng...) để đưa ra lời khuyên cá nhân hóa chính xác nhất.
   - Nếu có LỊCH SỬ TRAO ĐỔI ở trên: Ghi nhớ liền mạch các thông tin đã bàn luận ở các câu hỏi trước, không hỏi lại những gì người dùng đã cung cấp.
   - Nếu câu hỏi từ KHÁCH HÀNG hoặc mang tính đời thường (hỏi giảm cân, tăng cân, thực đơn, đau mỏi, cách tập, thắc mắc InBody...): Trả lời bằng ngôn ngữ tự nhiên, gần gũi, tích cực, dễ hiểu 100%, giải thích kèm ví dụ món ăn Việt Nam quen thuộc và chia thành các bước thực hành đơn giản.
   - Nếu câu hỏi từ Huấn luyện viên hoặc chuyên sâu kỹ thuật (giáo án Periodization, RPE/RIR, Hypertrophy mechanics, sửa lỗi form bài tập, cues khẩu lệnh, test thể lực, xử lý từ chối...): Cung cấp kiến thức chuyên sâu, thông số cụ thể (sets, reps, rest, tempo, RPE, cơ chủ vận/đối vận), phân tích cơ sinh học và giải pháp thực chiến đỉnh cao.

2. BAO QUÁT ĐẦY ĐỦ CÁC LĨNH VỰC CHUYÊN MÔN:
   - DINH DƯỠNG & MACROS: Nguyên tắc calo in/out, thâm hụt (300-500 calo) hoặc thặng dư (200-300 calo), đạm 1.6-2.2g/kg, chất béo tốt, tinh bột phức hợp, thực phẩm bổ sung (Whey, Creatine 3-5g, Omega-3...), thực đơn món Việt Nam linh hoạt.
   - GIÁO ÁN & TẬP LUYỆN: Phân bổ lịch tập (Fullbody, Upper/Lower, PPL), nguyên tắc Progressive Overload, Volume tối ưu (10-20 sets/nhóm cơ/tuần), kỹ thuật bài tập chuẩn form (Squat, Deadlift, Bench Press, Hip Thrust, Lat Pulldown...).
   - SỬA LỖI TƯ THẾ & PHỤC HỒI: Hướng dẫn cues chỉnh form (gù lưng, võng lưng APT, đầu gối chụm valgus, đau khớp khi tập), giải pháp giãn cơ, mobility, giấc ngủ 7-8 tiếng và quản lý stress.
   - ĐỌC VÀ TƯ VẤN INBODY: Diễn giải cân nặng, khối cơ xương (SMM), khối mỡ (BFM), % mỡ (PBF), mỡ nội tạng (Visceral Fat), BMR, nước và định hướng cải thiện chỉ số.

3. XƯNG HÔ LỊCH THIỆP, THÂN THIỆN & KHÁCH QUAN:
   - Xưng hô "Chào bạn" và "tôi" / "3S-Gym". Không xưng hô "anh/em", "thầy/trò", không phán xét, luôn mang năng lượng hỗ trợ nhiệt tình, khoa học và đáng tin cậy.

4. KHÔNG DÙNG KÝ TỰ MARKDOWN:
   - Tuyệt đối KHÔNG sử dụng các ký tự markdown như **, ##, ###, *, __ hay code block. Hãy trình bày bằng văn bản thuần tự nhiên, ngắt đoạn rõ ràng, thoáng mắt, các ý chính dùng dấu gạch đầu dòng (-) nhẹ nhàng.`;

  let rawContent = '';
  try {
    rawContent = await generateText({ userId: user.id, taskType: 'TEXT_ASSISTANT', requestKey: `${requestKey}:text-assistant` }, prompt);
  } catch (aiErr) {
    if (aiErr instanceof AppError && aiErr.code === ERROR_CODES.INSUFFICIENT_CREDITS) throw aiErr;
    const s = payload.scenario.toLowerCase();
    if (s.includes('squat') || s.includes('deadlift') || s.includes('bench') || s.includes('đau lưng') || s.includes('gối')) {
      rawContent = `Chào bạn, đối với kỹ thuật chuyển động và bảo vệ khớp xương trong tập luyện, bạn cần chú ý các nguyên tắc quan trọng sau:\n\n- Về kỹ thuật cơ bản: Luôn gồng chặt cơ bụng (Bracing) bằng cách hít sâu vào bụng và siết cứng ổ bụng trước mỗi lần chuyển động để bảo vệ cột sống thắt lưng.\n- Trục khớp và tư thế: Giữ bàn chân bám chắc 3 điểm tiếp xúc trên mặt sàn (gót chân, gốc ngón cái, gốc ngón út). Đảm bảo hướng đầu gối luôn mở theo hướng mũi chân, tránh để gối chụm vào trong.\n- Phạm vi chuyển động: Chỉ hạ tạ sâu đến mức bạn vẫn kiểm soát được lưng thẳng, không để xương cụt bị cụp (butt wink) hoặc võng lưng quá mức.\n- Phục hồi và giãn cơ: Dành 5 đến 10 phút sau buổi tập để giãn cơ đùi trước, cơ mông và cơ gập hông để giảm căng thẳng cho khớp gối và vùng lưng dưới.`;
    } else if (s.includes('inbody') || s.includes('chỉ số') || s.includes('mỡ') || s.includes('cơ')) {
      rawContent = `Chào bạn, để đánh giá và cải thiện các chỉ số cơ thể qua phiếu đo InBody, bạn nên nắm rõ 3 yếu tố cốt lõi sau:\n\n- Khối cơ xương (SMM): Là lượng cơ bắp quyết định tốc độ trao đổi chất và độ săn chắc của cơ thể. Để tăng cơ, bạn cần duy trì tập kháng lực từ 3 đến 5 buổi mỗi tuần và nạp đủ 1.6 đến 2.0g đạm trên mỗi kg cân nặng.\n- Phần trăm mỡ cơ thể (PBF) và mỡ nội tạng: Mức mỡ lý tưởng cho nam là 12 đến 18%, cho nữ là 18 đến 24%. Để giảm mỡ, bạn chỉ cần duy trì mức thâm hụt năng lượng nhẹ từ 300 đến 500 calo mỗi ngày thông qua ăn uống lành mạnh kết hợp vận động.\n- Nước và khoáng chất: Uống đủ 2 đến 3 lít nước mỗi ngày để tối ưu chuyển hóa và kết quả đo InBody đạt độ chính xác cao nhất.`;
    } else {
      rawContent = `Chào bạn, để đạt được mục tiêu thể hình và sức khỏe tối ưu, bạn nên áp dụng lộ trình toàn diện sau:\n\n- Về dinh dưỡng: Điều chỉnh lượng calo phù hợp với mục tiêu (giảm bớt khoảng 300 đến 500 calo nếu muốn giảm mỡ, hoặc ăn thêm lượng nhỏ thức ăn giàu dinh dưỡng nếu muốn tăng cân/tăng cơ). Bổ sung đủ đạm từ thịt nạc, trứng, cá, ức gà, đậu hũ và ăn nhiều rau xanh trong mỗi bữa ăn.\n- Về tập luyện: Duy trì tập kháng lực 3 đến 4 buổi mỗi tuần để phát triển cơ bắp và đốt cháy năng lượng, kết hợp đi bộ nhanh hoặc đạp xe 20 đến 30 phút để rèn luyện tim mạch.\n- Về phục hồi: Đảm bảo giấc ngủ đủ 7 đến 8 tiếng mỗi đêm và uống đủ 2 lít nước mỗi ngày để cơ thể tái tạo mô cơ và đào thải độc tố tốt nhất.\n\nNếu bạn muốn có một kế hoạch chi tiết cho từng giai đoạn, bạn có thể thực hiện đo InBody tại phòng tập 3S-Gym để được hướng dẫn sát nhất với thể trạng của mình nhé.`;
    }
  }

  const content = cleanNaturalText(rawContent);

  return AssistantSuggestion.create({
    customerId: customer?._id,
    ptId: user.id,
    requestType: payload.requestType,
    scenario: payload.scenario,
    content,
    citations,
    customerContextFields: customer ? ['fullName', 'initialGoal'] : [],
    safetyWarnings: ['Nội dung do AI đề xuất, PT phải kiểm tra trước khi sử dụng.'],
    reviewStatus: 'PT_REVIEW_REQUIRED',
    appliedAt: null,
  });
}
export async function reviewSuggestion(user: AuthenticatedUser, id: string, approve: boolean, editedContent?: string) {
  const item = await AssistantSuggestion.findOne({ _id: id, ptId: new Types.ObjectId(user.id), reviewStatus: 'PT_REVIEW_REQUIRED' });
  if (!item) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Không tìm thấy đề xuất đang chờ duyệt.' });
  item.reviewStatus = approve ? 'APPROVED' : 'REJECTED'; item.reviewedAt = new Date(); if (editedContent) item.editedContent = editedContent;
  const saved = await item.save();
  await recordAudit({ actor: user, action: approve ? 'ASSISTANT_SUGGESTION_APPROVED' : 'ASSISTANT_SUGGESTION_REJECTED', resourceType: 'assistantSuggestion', resourceId: id, customerId: item.customerId });
  return saved;
}
async function assertCustomer(user: AuthenticatedUser, customerId: string) {
  const customer = await CustomerProfile.findById(customerId).lean();
  if (!customer) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Không tìm thấy khách hàng.' });
  if (user.role === 'PT' && String(customer.assignedPtId) !== user.id) {
    throw new AppError({ status: 403, code: ERROR_CODES.AUTHORIZATION, message: 'Bạn không có quyền quản lý khách hàng này.' });
  }
  if (user.role === 'CUSTOMER' && String(customer.userId) !== user.id && String(customer._id) !== customerId) {
    throw new AppError({ status: 403, code: ERROR_CODES.AUTHORIZATION, message: 'Bạn không có quyền truy cập dữ liệu này.' });
  }
  return customer;
}
export async function createConversation(user: AuthenticatedUser, payload: { customerId?: string; title: string }) {
  let custId = payload.customerId;
  if (custId) {
    await assertCustomer(user, custId);
  } else if (user.role === 'CUSTOMER') {
    const myProfile = await CustomerProfile.findOne({ userId: new Types.ObjectId(user.id) }).lean();
    if (myProfile) custId = String(myProfile._id);
  }
  return AssistantConversation.create({
    customerId: custId ? new Types.ObjectId(custId) : undefined,
    title: payload.title,
    ptId: user.id,
    messages: [],
  });
}
export async function listConversations(user: AuthenticatedUser, query: Record<string, unknown>) { const page = Number(query.page || 1); const limit = Number(query.limit || 20); const filter: Record<string, unknown> = { ptId: new Types.ObjectId(user.id) }; if (typeof query.customerId === 'string') filter.customerId = new Types.ObjectId(query.customerId); const [items, total] = await Promise.all([AssistantConversation.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), AssistantConversation.countDocuments(filter)]); return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } }; }
export async function addConversationMessage(user: AuthenticatedUser, id: string, payload: { content: string; requestType: string }, requestKey: string) {
  const conversation = await AssistantConversation.findOne({ _id: id, ptId: new Types.ObjectId(user.id) });
  if (!conversation) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Không tìm thấy hội thoại.' });
  const rawMessages = Array.isArray(conversation.messages) ? conversation.messages : [];
  const history = rawMessages.map((m: any) => ({
    role: String(m.role || 'USER'),
    content: String(m.content || ''),
  }));
  const suggestion = await createSuggestion(user, {
    customerId: conversation.customerId ? String(conversation.customerId) : undefined,
    scenario: payload.content,
    requestType: payload.requestType || 'GENERAL',
    history,
  }, requestKey);
  const now = new Date();
  conversation.messages.push(
    { role: 'USER', content: payload.content, createdAt: now },
    { role: 'ASSISTANT', content: suggestion.content, suggestionId: suggestion._id, citations: suggestion.citations, reviewStatus: suggestion.reviewStatus, createdAt: new Date() }
  );
  return conversation.save();
}
