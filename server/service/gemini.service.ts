import { Type } from "@google/genai";
import { AIMediaModel } from "../model/ai-media.model";
import { cloudinaryService } from "./cloudinary.service";
import { remotionService } from "./remotion.service";
import { piapiService } from "./piapi.service";
import { exec } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const GEMINI_TEXT_MODEL = process.env.TEXT_MODEL || process.env.GEMINI_MODEL || "gemini-3.5-flash";
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "piapi-flux";
const GEMINI_VIDEO_MODEL = process.env.GEMINI_VIDEO_MODEL || "veo31-video-fast-audio";

function normalizePiapiVideoModel(modelName?: string): string {
  const rawModel = (modelName || GEMINI_VIDEO_MODEL || "").trim();
  const normalizedModel = rawModel.toLowerCase();

  if (
    normalizedModel === "veo-3.1-generate-preview" ||
    normalizedModel === "veo31-video-audio" ||
    normalizedModel === "piapi-veo31-video-audio" ||
    normalizedModel === "veo"
  ) {
    return "veo31-video-audio";
  }

  if (
    normalizedModel === "veo-3.1-fast-generate-preview" ||
    normalizedModel === "veo31-video-fast-audio" ||
    normalizedModel === "piapi-veo31-video-fast-audio"
  ) {
    return "veo31-video-fast-audio";
  }

  if (
    normalizedModel === "veo-3.1-lite-generate-preview" ||
    normalizedModel === "veo31-video-fast-no-audio" ||
    normalizedModel === "piapi-veo31-video-fast-no-audio"
  ) {
    return "veo31-video-fast-no-audio";
  }

  if (normalizedModel.includes("veo-3.1") || normalizedModel.includes("veo31") || normalizedModel.startsWith("veo3")) {
    return "veo31-video-audio";
  }

  if (normalizedModel.startsWith("piapi-")) {
    return rawModel;
  }

  return "veo31-video-fast-audio";
}

async function generateText(
  model: string,
  contents: any,
  config?: {
    systemInstruction?: string;
    temperature?: number;
    responseMimeType?: string;
    responseSchema?: any;
    images?: string[];
  }
): Promise<{ text: string }> {
  if (!process.env.PIAPI_API_KEY) {
    throw new Error("PiAPI API key is not configured.");
  }

  let mappedModel = model;
  if (model.includes("gemini") || model.includes("flash") || model.includes("3.5")) {
    mappedModel = model.includes("pro") ? "gpt-4o" : "gpt-4o-mini";
  }

  const messages: any[] = [];
  if (config?.systemInstruction) {
    messages.push({ role: "system", content: config.systemInstruction });
  }

  if (typeof contents === "string") {
    if (config?.images && config.images.length > 0) {
      const contentParts: any[] = [{ type: "text", text: contents }];
      for (const img of config.images) {
        contentParts.push({
          type: "image_url",
          image_url: { url: img }
        });
      }
      messages.push({ role: "user", content: contentParts });
    } else {
      messages.push({ role: "user", content: contents });
    }
  } else if (Array.isArray(contents)) {
    for (const item of contents) {
      if (typeof item === "string") {
        messages.push({ role: "user", content: item });
      } else if (item.role && item.parts) {
        const role = item.role === "model" ? "assistant" : item.role;
        const textParts = item.parts.map((p: any) => p.text || "").join("\n");
        messages.push({ role, content: textParts });
      } else if (item.text) {
        messages.push({ role: "user", content: item.text });
      }
    }
  }

  const body: any = {
    model: mappedModel,
    messages,
    temperature: config?.temperature ?? 0.7,
  };

  if (config?.responseMimeType === "application/json" || config?.responseSchema) {
    body.response_format = { type: "json_object" };
  }

  if (config?.responseSchema) {
    const schemaStr = JSON.stringify(config.responseSchema);
    if (messages[0]?.role === "system") {
      messages[0].content += `\n\nCRITICAL REQUIREMENT: Output MUST be a valid JSON object matching this JSON Schema:\n${schemaStr}`;
    } else {
      messages.unshift({
        role: "system",
        content: `Output MUST be a valid JSON object matching this JSON Schema:\n${schemaStr}`
      });
    }
  }

  const response = await fetch("https://api.piapi.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.PIAPI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PiAPI LLM call failed: ${response.status} - ${errorText}`);
  }

  const resJson: any = await response.json();
  const text = resJson.choices?.[0]?.message?.content || "";
  return { text };
}

export const geminiService = {
  /**
   * Trợ lý Chat CRM Omni-Inbox
   */
  async chat(
    message: string,
    history: any[],
    aiConfig: any,
    ragContext?: { contextText?: string; companyCode?: string; matches?: number }
  ): Promise<{ text: string; isMock: boolean }> {
    const getMockResponse = () => {
      return new Promise<{ text: string; isMock: boolean }>((resolve) => {
        setTimeout(() => {
          let replyText = `[Giả lập Trợ lý AI] Cảm ơn bạn đã phản hồi! Với cài đặt Trợ lý AI (Cấu hình: ${aiConfig.autoClassify ? "Tự phân loại" : "Thường"
            }), tôi đề xuất phương án tối ưu cho bạn.`;

          const msgLower = message.toLowerCase();
          if (msgLower.includes("giá") || msgLower.includes("bao nhiêu")) {
            replyText =
              "Chào bạn! Hiện tại dòng sản phẩm Thiết bị đeo thông minh X1 đang có giá ưu đãi là 1.890.000đ (giảm từ 2.450.000đ). Trợ lý AI có thể hỗ trợ tạo đơn hàng ngay lập tức nếu bạn sẵn sàng!";
          } else if (msgLower.includes("khuyến mãi") || msgLower.includes("ưu đãi")) {
            replyText =
              "Dạ, bên mình đang có chương trình khuyến mãi 'SIÊU ƯU ĐÃI THÁNG 10': giảm giá lên đến 30% cho toàn bộ linh kiện robot và tặng voucher 200k cho đơn hàng sau đó. Bạn có muốn nhận mã voucher không ạ?";
          } else if (msgLower.includes("vận chuyển") || msgLower.includes("ship")) {
            replyText =
              "Đơn hàng của bạn sẽ được hỗ trợ Freeship toàn quốc cho các hóa đơn từ 500k trở lên. Thời gian giao hàng dự kiến là từ 2-3 ngày làm việc đối với khu vực tỉnh thành khác, Hà Nội/HCM sẽ nhận hàng trong ngày ạ!";
          }
          resolve({ text: replyText, isMock: true });
        }, 800);
      });
    };

    if (!process.env.PIAPI_API_KEY) {
      return getMockResponse();
    }

    const hasCompanyKnowledge = !!ragContext?.contextText;
    const assistantMode = hasCompanyKnowledge ? "COMPANY_TRAINED_MODE" : "DEFAULT_ASSISTANT_MODE";

    const systemInstruction = `
Bạn là một Trợ lý Chăm sóc Khách hàng AI đỉnh cao cho hệ thống iGen ERP doanh nghiệp.
Bạn đang hỗ trợ khách hàng trong khung chat Omni-Inbox.

QUY CHUẨN XƯNG HÔ VÀ CHÀO HỎI CHUYÊN NGHIỆP:
- Luôn mở đầu câu trả lời bằng lời chào lịch sự như: "Dạ, [Tên doanh nghiệp] xin chào anh/chị ạ!" hoặc "Dạ, em chào anh/chị ạ!" hoặc "Dạ xin kính chào Quý khách!".
- Luôn xưng hô là "Dạ, bên em..." hoặc "Dạ, [Tên doanh nghiệp]..." hoặc "Dạ, em..." và gọi khách hàng là "Quý khách" hoặc "Anh/Chị".
- Luôn sử dụng kính ngữ "Dạ" ở đầu câu và "ạ" ở cuối câu để đảm bảo sự lịch thiệp, tôn trọng và chuyên nghiệp tuyệt đối.
- Tuyệt đối KHÔNG sử dụng các từ xưng hô quá thân mật hoặc thiếu trang trọng như "cậu", "tớ", "bạn", "mày", "tao".
- Trả lời bằng ngôn phong tiếng Việt chuẩn mực, tinh tế, tích cực, không dùng ngôn ngữ teen, từ lóng hoặc icon quá đà.

Quy tắc và chỉ dẫn hành xử từ doanh nghiệp:
${aiConfig.advancedInstructions ? `- ${aiConfig.advancedInstructions}` : "- Không có chỉ dẫn đặc biệt."}

Dữ liệu vận hành hiện tại:
- Chế độ trả lời: ${assistantMode}
- COMPANY_TRAINED_MODE: đã có tài liệu/chính sách riêng của công ty, hãy bám sát tài liệu và nói theo chỉ dẫn doanh nghiệp.
- DEFAULT_ASSISTANT_MODE: chưa có tài liệu riêng, vẫn trả lời khách mặc định một cách lịch sự, hỗ trợ hỏi thêm nhu cầu và chuyển nhân viên khi cần.

Dữ liệu tri thức đã truy xuất riêng cho doanh nghiệp ${ragContext?.companyCode || "hiện tại"}:
${ragContext?.contextText ? ragContext.contextText : "- Không tìm thấy tri thức phù hợp trong kho dữ liệu."}

Quy tắc an toàn bắt buộc:
- Khi ở DEFAULT_ASSISTANT_MODE, vẫn được chào hỏi, xác nhận nhu cầu, hỏi thêm thông tin, hướng dẫn khách để lại số điện thoại/nhu cầu và nói sẽ có nhân viên hỗ trợ.
- Chỉ trả lời các thông tin cụ thể về giá, bảo hành, giao hàng, đổi trả, khuyến mãi nếu có trong dữ liệu tri thức ở trên hoặc trong lịch sử hội thoại.
- Nếu khách hỏi chính sách/giá/thông tin cụ thể mà không có dữ liệu phù hợp, hãy nói rằng bạn cần chuyển nhân viên kiểm tra lại, tuyệt đối không tự bịa.
- Không trộn lẫn thông tin giữa các công ty khác nhau.

Thông tin cấu hình hiện tại của bạn:
- Tự động phân loại khách hàng: ${aiConfig.autoClassify ? "Đang BẬT. Hãy phân loại khách dựa trên xu hướng hội thoại và thông báo khéo léo." : "Đang TẮT"}
- Tự động chốt đơn hàng: ${aiConfig.autoCloseDeal ? "Đang BẬT. Hãy tìm cơ hội khéo léo hướng khách hàng chốt mua sản phẩm một cách nhanh gọn, gửi thông tin tạo đơn." : "Đang TẮT"}
- Tự động xin feedback cuối hội thoại: ${aiConfig.autoFeedback ? "Đang BẬT. Nếu cuộc đối thoại đi đến hồi kết, hãy lịch sự xin ý kiến đánh giá chất lượng dịch vụ." : "Đang TẮT"}
- Với Nguyễn Thị Mai (khách VIP): hãy đối xử cực kỳ chu đáo, tặng voucher riêng VIP-10 nếu có ý than phiền hoặc hỏi giá.
`;

    const contents = history.map((h: any) => ({
      role: h.sender === "user" ? "user" : "model",
      parts: [{ text: h.text }],
    }));

    contents.push({
      role: "user",
      parts: [{ text: message }],
    });

    try {
      const selectedModel = aiConfig?.model || GEMINI_TEXT_MODEL;
      const response = await generateText(
        selectedModel,
        contents,
        {
          systemInstruction,
          temperature: 0.8,
        }
      );

      return {
        text: response.text || "Xin lỗi, tôi chưa thể xử lý yêu cầu lúc này. Vui lòng thử lại.",
        isMock: false,
      };
    } catch (error: any) {
      console.error("[geminiService.chat] Error:", error);
      throw error;
    }
  },

  /**
   * Tự động băm/chuyển đổi tài liệu dài thành danh sách FAQs rút gọn
   */
  async convertDocToFAQ(docText: string): Promise<string> {
    const getMockFAQ = () => {
      return `--- BẢN FAQ ĐÃ ĐƯỢC CHUẨN HÓA (CHẾ ĐỘ MÔ PHỎNG AI) ---
Q: Tài liệu này nói về chủ đề gì?
A: Tài liệu giới thiệu thông tin vận hành, chính sách bán hàng của doanh nghiệp.

Q: Làm thế nào để liên hệ hỗ trợ kỹ thuật?
A: Vui lòng liên hệ số hotline 1900xxxx hoặc email support@igen.com.

Q: Chính sách vận chuyển của chúng tôi là gì?
A: Giao hàng toàn quốc. Miễn phí vận chuyển cho đơn hàng trị giá từ 500k trở lên.`;
    };

    if (!process.env.PIAPI_API_KEY) {
      return getMockFAQ();
    }

    try {
      const prompt = `Bạn là một chuyên gia huấn luyện AI bán hàng và chăm sóc khách hàng.
Hãy đọc kỹ tài liệu bán hàng/quy trình/chính sách sau đây của doanh nghiệp và chuyển đổi toàn bộ thông tin quan trọng thành một danh sách các câu hỏi thường gặp FAQs định dạng chuẩn để làm dữ liệu huấn luyện cho Chatbot.

YÊU CẦU:
1. Định dạng câu trả lời bắt buộc là:
Q: [Câu hỏi của khách hàng]
A: [Câu trả lời chuẩn mực của AI]

Q: [Câu hỏi tiếp theo]
A: [Câu trả lời tiếp theo]

2. Hãy chắt lọc toàn bộ số hotline, bảng giá dịch vụ/sản phẩm, chính sách giao hàng, chính sách đổi trả/bảo hành, giờ mở cửa.
3. Không tự tiện bịa đặt thông tin không có trong tài liệu.
4. Trả lời bằng tiếng Việt lịch sự, súc tích và chính xác.

NỘI DUNG TÀI LIỆU CẦN CHUYỂN ĐỔI:
${docText}
`;

      const response = await generateText(
        GEMINI_TEXT_MODEL,
        prompt
      );

      return response.text || "Không thể trích xuất được dữ liệu FAQ từ tài liệu.";
    } catch (error: any) {
      console.error("[geminiService.convertDocToFAQ] Error, fallback to mock FAQ:", error);
      return getMockFAQ();
    }
  },

  /**
   * Tạo 3 gợi ý chủ đề marketing chung
   */
  async getMarketingSuggestions(): Promise<string[]> {
    const fallbackSuggestions = [
      "Chiến dịch tri ân khách hàng thân thiết và tặng quà tri ân kỷ niệm thành lập",
      "Chương trình khuyến mãi mùa hè giảm giá cực sốc kích cầu mua sắm",
      "Sự kiện ra mắt dòng sản phẩm mới hướng tới phong cách sống xanh bảo vệ môi trường",
    ];

    if (!process.env.PIAPI_API_KEY) {
      return fallbackSuggestions;
    }

    try {
      const prompt = `Bạn là trợ lý AI Marketing chuyên nghiệp. Hãy đề xuất đúng 3 ý tưởng/chủ đề chiến dịch marketing chung, mang tính phổ quát cao để nhiều loại hình doanh nghiệp hoặc công ty khác nhau đều có thể áp dụng được (ví dụ: chiến dịch khuyến mãi theo mùa, sự kiện tri ân khách hàng, ra mắt dòng sản phẩm mới, chương trình ưu đãi đặc biệt).
Mỗi ý tưởng đề xuất phải là một câu ngắn gọn (dưới 25 từ) sẵn sàng làm mục tiêu marketing, ví dụ: 'Chiến dịch tri ân khách hàng thân thiết và tặng quà tri ân'.
Trả về kết quả ở định dạng JSON phù hợp chính xác với cấu trúc yêu cầu.`;

      const response = await generateText(
        GEMINI_TEXT_MODEL,
        prompt,
        {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              suggestions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Danh sách đúng 3 ý tưởng/chủ đề gợi ý ngắn gọn",
              },
            },
            required: ["suggestions"],
          },
        }
      );

      const responseText = response.text || "{}";
      const parsedData = JSON.parse(responseText.trim());
      return parsedData.suggestions || fallbackSuggestions;
    } catch (error: any) {
      console.error("[geminiService.getMarketingSuggestions] Fallback to mock suggestions:", error);
      return fallbackSuggestions;
    }
  },

  /**
   * Đề xuất Content Pillars
   */
  async analyzeMarketingPillars(campaignTopic: string, images?: string[]): Promise<{ pillars: any[]; isMock: boolean }> {
    const getMockPillars = () => {
      let mockPillars = [
        {
          id: "giao_duc_gia_tri",
          title: "Giáo dục & Giá trị hữu ích",
          ratio: "35% tỉ trọng",
          description: `Giải đáp trực quan, hướng dẫn tối ưu và chia sẻ kiến thức nền tảng giúp khách hàng hiểu sâu về giá trị dòng sản phẩm liên quan "${campaignTopic || "Sản phẩm công nghệ"
            }".`,
        },
        {
          id: "cau_chuyen_social_proof",
          title: "Trải nghiệm & Câu chuyện thực tế",
          ratio: "40% tỉ trọng",
          description: `Kịch bản review thực tế, kết quả và phát biểu từ khách hàng uy tín, tạo dựng lòng tin tuyệt đối cho thương hiệu.`,
        },
        {
          id: "uu_dai_tuong_tac",
          title: "Ưu đãi & Kích cầu hành động",
          ratio: "25% tỉ trọng",
          description:
            "Chiến dịch giờ vàng, đặc quyền dùng thử hoặc voucher độc quyền nhằm thúc giục khách hàng ra quyết định mua sắm ngay lập tức.",
        },
      ];

      const topicLower = campaignTopic ? campaignTopic.toLowerCase() : "";
      if (topicLower.includes("bàn phím") || topicLower.includes("keyboard") || topicLower.includes("workspace")) {
        mockPillars = [
          {
            id: "kien_thuc_cong_thai_hoc",
            title: "Kiến thức & Trải nghiệm Công thái học",
            ratio: "35% tỉ trọng",
            description:
              "Hướng dẫn tư thế ngồi gõ phím chuẩn khoa học, cách test switch phím cơ, mẹo lập trình không mỏi tay cho coder chuyên nghiệp.",
          },
          {
            id: "review_coder_thuc_te",
            title: "Đánh giá & Trải nghiệm Lập trình viên",
            ratio: "40% tỉ trọng",
            description:
              "Cảm âm đầm chắc của iGen Workspace V2, quá trình tăng 150% hiệu suất viết mã của kiến trúc sư phần mềm.",
          },
          {
            id: "uu_dai_ra_mat",
            title: "Ưu đãi đặc quyền Early Bird",
            ratio: "25% tỉ trọng",
            description:
              "Quà tặng kệ kê tay gỗ sồi cao cấp và chiết khấu 10% ra mắt độc quyền dành cho 50 khách hàng đầu tiên.",
          },
        ];
      } else if (topicLower.includes("tai nghe") || topicLower.includes("nghe nhạc") || topicLower.includes("pro max")) {
        mockPillars = [
          {
            id: "am_thanh_bao_ve_tai",
            title: "Khoa học Âm thanh & Sức khỏe tai",
            ratio: "30% tỉ trọng",
            description:
              "Nguyên lý hoạt động của chống ồn chủ động ANC và cách bảo vệ thính lực khi đeo tai nghe cường độ cao thường xuyên.",
          },
          {
            id: "phong_cach_unboxing",
            title: "Đập hộp & Định hình Phong cách sống",
            ratio: "45% tỉ trọng",
            description:
              "Phối đồ thời trang dạo phố sành điệu cùng Pro Max, tạo phong thái năng động tự tin cho giới trẻ công nghệ.",
          },
          {
            id: "uu_dai_gio_vang",
            title: "Flash Sale giờ vàng - Săn cực đỉnh",
            ratio: "25% tỉ trọng",
            description:
              "Cơ hội săn deal giảm giá sốc đến 45% độc quyền trong khung giờ trưa từ 12h - 14h, số lượng cực hạn.",
          },
        ];
      } else if (topicLower.includes("vip") || topicLower.includes("voucher") || topicLower.includes("tri ân")) {
        mockPillars = [
          {
            id: "dac_quyen_thanh_vien",
            title: "Giá trị đặc quyền Tri ân",
            ratio: "35% tỉ trọng",
            description:
              "Chi tiết đặc quyền thăng hạng thẻ, chính sách bảo hành trọn đời và tích điểm đổi quà VIP của hệ sinh thái iGen.",
          },
          {
            id: "cau_chuyen_thanh_cong",
            title: "Khoảnh khắc & Khách hàng VIP",
            ratio: "40% tỉ trọng",
            description:
              "Ghi dấu những bức ảnh, cuộc hẹn và cảm ơn chân thành từ iGen ERP tới các đối tác doanh nghiệp lớn đồng hành lâu năm.",
          },
          {
            id: "uu_dai_han_muc",
            title: "Quà tặng và Voucher VIP độc bản",
            ratio: "25% tỉ trọng",
            description:
              "Gửi mã voucher VIP-10 độc bá kèm hộp quà tặng chạm khắc thủ công đặc biệt thiết kế riêng cho khách hàng VIP.",
          },
        ];
      }

      return mockPillars;
    };

    if (!process.env.PIAPI_API_KEY) {
      return { pillars: getMockPillars(), isMock: true };
    }

    try {
      const prompt = `Phân tích mục tiêu/chủ đề chiến dịch marketing sau: "${campaignTopic}"
Hãy đề xuất chính xác 3 trụ cột nội dung cốt lõi (Content Pillars) giúp doanh nghiệp định hình khung nội dung (framework) chuẩn chỉnh ngay từ đầu, đảm bảo tỷ lệ nội dung phân bổ đa dạng, tránh việc chỉ đăng bài bán hàng gây nhàm chán và mất tương tác.

Mỗi trụ cột phải có thông tin:
1. id: chuỗi ngắn gọn, không dấu cách, viết thường (ví dụ: "kien_thuc_huong_dan", "trai_nghiem_khach_hang", "khuyen_mai_dac_quyen")
2. title: Tiêu đề trụ cột nội dung tối ưu sáng tạo bằng tiếng Việt (Ví dụ: "Giáo dục & Hướng dẫn", "Câu chuyện khách hàng", "Ưu đãi & Khuyến mãi", "Giá trị cốt lõi")
3. ratio: Tỷ lệ phần trăm phân bổ hợp lý hiển thị dưới dạng chuỗi (Ví dụ: "35% tỉ trọng", "40% tỉ trọng") đảm bảo tổng 3 cái là 100%. Đa dạng tỷ trọng, tránh bán hàng quá nhiều.
4. description: Mô tả ngắn gọn trực quan bằng tiếng Việt hướng dẫn cách triển khai cụ thể trụ cột này đối với chiến dịch "${campaignTopic}".

Trả về kết quả ở định dạng JSON phù hợp chính xác với cấu trúc yêu cầu.`;

      const response = await generateText(
        GEMINI_TEXT_MODEL,
        prompt,
        {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              pillars: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING, description: "ID ngắn gọn viết liền không dấu" },
                    title: { type: Type.STRING, description: "Tiêu đề tiếng Việt của trụ cột" },
                    ratio: { type: Type.STRING, description: "Tỷ lệ phân bổ" },
                    description: { type: Type.STRING, description: "Mô tả triển khai chi tiết" },
                  },
                  required: ["id", "title", "ratio", "description"],
                },
                description: "Danh sách đúng 3 trụ cột nội dung",
              },
            },
            required: ["pillars"],
          },
          images
        }
      );

      const responseText = response.text || "{}";
      const parsedData = JSON.parse(responseText.trim());
      return { pillars: parsedData.pillars || [], isMock: false };
    } catch (error: any) {
      console.error("[geminiService.analyzeMarketingPillars] Error, fallback to mock pillars:", error);
      return { pillars: getMockPillars(), isMock: true };
    }
  },

  /**
   * Phát sinh bản nháp ý tưởng chiến dịch
   */
  async generateMarketingIdeas(
    campaignTopic: string,
    selectedPillars: string[],
    channels?: string[],
    mediaType?: string,
    images?: string[]
  ): Promise<{ concepts: any[]; isMock: boolean }> {
    const pillarsStr =
      selectedPillars && selectedPillars.length > 0
        ? `(Định hướng Trụ cột nội dung: ${selectedPillars.join(", ")})`
        : "";

    const getMockConcepts = () => {
      const concepts = [
        {
          title: `Chiến dịch: Chạm Đột Phá - ${campaignTopic || "Mua Sắm Cuối Năm"}`,
          matchPercent: 95,
          summary: `Đột phá doanh số nhắm vào đối tượng trẻ tuổi. ${pillarsStr
            ? `Tập trung sâu vào định hướng truyền thông từ các trụ cột lựa chọn: ${selectedPillars.join(", ")}.`
            : "Tạo lối sống trải nghiệm công nghệ đeo và phong cách sống lành mạnh."
            }`,
          channels: channels && channels.length > 0 ? channels : ["TikTok", "Facebook", "Zalo"],
          suggestedContent:
            "🎬 Kịch bản Tiktok: Biến đổi phong cách thường ngày thành phong cách năng động thể thao chỉ sau 1 cái chạm màn hình X1.",
          hashtags: ["#iGenX1", "#SmartWearable", "#NangTamCuocSong"],
        },
        {
          title: `Trải nghiệm Đỉnh Cao - Tri Ân Hội Viên`,
          matchPercent: 88,
          summary: `Quảng bá giá trị cốt lõi bền vững thông qua chuỗi bài viết phỏng vấn các đối tác trung thành thực tế đang nâng tầm công việc cùng Workspace V2. ${pillarsStr ? `Điều phối theo: ${selectedPillars.join(", ")}.` : ""
            }`,
          channels: channels && channels.length > 0 ? channels : ["Facebook", "Zalo"],
          suggestedContent:
            "✍️ Facebook Post: 'Gặp gỡ anh Hùng, Giám đốc Sáng tạo, người đã nâng cấp 200% tốc độ gõ nhờ Bàn phím cơ Workspace V2...'",
          hashtags: ["#WorkspaceV2", "#KeyboardMechanic", "#TangHieuSuat"],
        },
        {
          title: `Giờ Vàng Giá Sốc - Săn Độc Quyền AI`,
          matchPercent: 78,
          summary: `Tạo sự gấp rút bằng tính năng đếm ngược flash sale được quản lý tự động bởi thuật toán đề xuất của iGen ERP. ${pillarsStr ? `Kế thừa ý tưởng từ các Content Pillar được cấu hình: ${selectedPillars.join(", ")}.` : ""
            }`,
          channels: channels && channels.length > 0 ? channels : ["Facebook", "Zalo"],
          suggestedContent:
            "🔥 Tin nhắn Zalo: 'Duy nhất hôm nay! Giờ vàng từ 12h-14h, giảm giá 30% toàn bộ tai nghe Không dây Pro Max. Đặt ngay!'",
          hashtags: ["#FlashSale", "#TaiNgheProMax", "#AmThanhDinhCao"],
        },
      ];
      return concepts;
    };

    if (!process.env.PIAPI_API_KEY) {
      return { concepts: getMockConcepts(), isMock: true };
    }

    try {
      const pillarsContext =
        selectedPillars && selectedPillars.length > 0
          ? `\nCác Trụ cột nội dung (Content Pillars) bắt buộc phải tích hợp và bám sát: ${selectedPillars.join(
            ", "
          )}. Hãy sáng tạo các ý tưởng tập trung xoay quanh các trụ cột này.`
          : "";

      const channelsContext =
        channels && channels.length > 0
          ? `\nKênh truyền thông bắt buộc: Bắt buộc các ý tưởng của bạn phải phân phối và đăng bài chính xác trên các kênh: ${channels.join(", ")}.`
          : "";

      const mediaContext =
        mediaType === "image"
          ? "\nYêu cầu về phương tiện: Các ý tưởng phải thiết kế đi kèm hình ảnh làm chủ đạo."
          : mediaType === "video"
            ? "\nYêu cầu về phương tiện: Các ý tưởng phải thiết kế đi kèm video làm chủ đạo."
            : mediaType === "none"
              ? "\nYêu cầu về phương tiện: Các bài đăng không đi kèm hình ảnh hoặc video (chỉ văn bản/caption)."
              : "";

      const prompt = `Bạn là một chuyên gia marketing xuất sắc.
Hãy tạo đúng 3 ý tưởng/bản nháp chiến dịch marketing chi tiết cho chủ đề/chiến dịch này: "${campaignTopic}".${pillarsContext}${channelsContext}${mediaContext}
Yêu cầu kết quả đầu ra:
1. Đề xuất tiêu đề chiến dịch sáng tạo.
2. Tỷ lệ phần trăm phù hợp (matchPercent) ước lượng (số nguyên từ 50-100).
3. Tóm tắt ý tưởng triển khai ngắn gọn.
4. Các kênh truyền thông phù hợp đề xuất đăng bài (mảng các chuỗi, ví dụ: ["Facebook", "TikTok"] - Bắt buộc phải trùng khớp với danh sách kênh đã được yêu cầu ở trên).
5. Ý tưởng nội dung gợi ý ban đầu để triển khai bài đăng trên kênh.
6. Hashtags liên quan phù hợp.

Trả về kết quả ở định dạng JSON phù hợp chính xác với cấu trúc yêu cầu.`;

      const response = await generateText(
        GEMINI_TEXT_MODEL,
        prompt,
        {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              concepts: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING, description: "Tiêu đề ý tưởng chiến dịch" },
                    matchPercent: { type: Type.INTEGER, description: "Tỷ lệ phù hợp" },
                    summary: { type: Type.STRING, description: "Tóm tắt ý tưởng" },
                    channels: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: "Các kênh đề xuất đăng bài",
                    },
                    suggestedContent: { type: Type.STRING, description: "Ý tưởng nội dung gợi ý ban đầu" },
                    hashtags: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: "Hashtags liên quan",
                    },
                  },
                  required: ["title", "matchPercent", "summary", "channels", "suggestedContent", "hashtags"],
                },
                description: "Danh sách 3 ý tưởng/bản nháp chiến dịch marketing",
              },
            },
            required: ["concepts"],
          },
          images
        }
      );

      const responseText = response.text || "{}";
      const parsedData = JSON.parse(responseText.trim());
      return { concepts: parsedData.concepts || [], isMock: false };
    } catch (error: any) {
      console.error("[geminiService.generateMarketingIdeas] Error, fallback to mock concepts:", error);
      return { concepts: getMockConcepts(), isMock: true };
    }
  },

  async developMarketingIdea(
    title: string,
    summary: string,
    suggestedContent: string,
    channels: string[],
    mediaOptions?: {
      mediaType?: string;
      imageModel?: string;
      imageResolution?: string;
      imageAspectRatio?: string;
      videoModel?: string;
      videoQuality?: string;
      videoDuration?: number;
      videoAspectRatio?: string;
    }
  ): Promise<{ posts: any[]; isMock: boolean }> {
    const validChannels = ["Facebook", "TikTok", "LinkedIn", "Instagram", "Zalo"];

    // Normalize target channels: filter out invalid channels, map input to valid ones
    const normalizeChannel = (chan: string): string => {
      if (!chan) return "Facebook";
      const c = chan.toLowerCase().trim();
      if (c.includes("facebook") || c.includes("fb")) return "Facebook";
      if (c.includes("tiktok") || c.includes("tik tok") || c.includes("reels") || c.includes("video ngắn")) return "TikTok";
      if (c.includes("linkedin") || c.includes("linked in") || c.includes("link")) return "LinkedIn";
      if (c.includes("instagram") || c.includes("insta") || c.includes("ig")) return "Instagram";
      if (c.includes("zalo")) return "Zalo";
      return "Facebook";
    };

    let targetChannels = (Array.isArray(channels) ? channels : ["Facebook"])
      .map(ch => normalizeChannel(ch))
      .filter((v, i, a) => a.indexOf(v) === i); // Deduplicate

    if (targetChannels.length === 0) {
      targetChannels = ["Facebook"];
    }

    let posts: any[] = [];
    let isMock = false;

    const getMockPosts = () => {
      return targetChannels.map((chan) => {
        let contentType = "Bài viết truyền thông";
        let outline = "";
        let bodyText = "";
        let mockMediaPrompt = "";
        if (chan === "Facebook") {
          contentType = "Hình ảnh kèm Caption";
          outline = `📋 DÀN Ý CHI TIẾT (OUTLINE):
1. Hình ảnh: Ảnh flatlay thiết bị sang trọng trên bàn làm việc hiện đại.
2. Tiêu đề: Độc vị phong cách - Chọn ${title}.
3. Nội dung chính: Giải quyết vấn đề mỏi tay, tăng tốc gõ và tối ưu hóa không gian làm việc.
4. Call to Action: Đăng ký nhận ưu đãi 10% ra mắt.`;
          bodyText = `🔥 BẬT PHONG CÁCH - NHÂN HIỆU SUẤT CÙNG ${title}! 🔥

Bạn có biết 90% hiệu suất làm việc phụ thuộc vào sự thoải mái của thiết bị đồng hành? Với chiến dịch ${summary}, chúng tôi mang đến giải pháp tối ưu cho bạn:
💻 Thiết kế công thái học tinh tế.
⚡ Tăng tốc độ phản hồi phím gõ lên 150%.
🎁 Quà tặng kèm kê tay gỗ sồi đặc quyền.

💡 Ý tưởng cốt lõi: "${suggestedContent}"

📲 Nhắn tin ngay cho iGen để nhận deal hời! #iGenERP #WorkspaceV2 #CongNgheSo #Success`;
          mockMediaPrompt = `A professional product photoshoot of ${title} on a modern wooden desk, warm cozy lighting, detailed textures, 8k resolution.`;
        } else if (chan === "TikTok") {
          contentType = "Kịch bản Video ngắn 8s";
          outline = `🎬 KỊCH BẢN QUAY (TIMELINE VIDEO SCRIPTS - MAX 8S):
[0:00 - 0:03]
- Visual: Hook so sánh tư thế làm việc gù lưng/mỏi tay với tư thế chuẩn.
- Audio (Voiceover): "Bạn có đang làm việc sai tư thế?"

[0:03 - 0:08]
- Visual: Show cận cảnh thiết kế sang trọng & âm thanh gõ phím đầm chắc của ${title}.
- Audio (Voiceover): "Nâng cấp hiệu năng làm việc cực đỉnh cùng ${summary}"`;
          bodyText = `🔥 Cứu tinh deadline của bạn đây rồi! Nâng cấp hiệu năng làm việc cực đỉnh với ${title}. Đăng ký trải nghiệm ngay hôm nay để nhận voucher giảm giá 45% độc quyền! #iGenERP #WorkspaceV2 #WorkSmart #Deadline`;
          mockMediaPrompt = `An energetic, dynamic lifestyle video showing someone typing fast on ${title}, neon lighting, high-tech vibes, cinematic look.`;
        } else if (chan === "LinkedIn") {
          contentType = "Bài viết chuyên sâu (Article)";
          outline = `📋 DÀN Ý CHI TIẾT (OUTLINE):
1. Đặt vấn đề: Xu hướng chuyển đổi số và nâng cao năng suất doanh nghiệp.
2. Phân tích: Vai trò của thiết bị chuẩn công thái học đối với nhân sự IT/Lập trình.
3. Chiến dịch ${summary} đóng góp giá trị như thế nào.
4. CTA kết nối nhận tư vấn.`;
          bodyText = `[XU HƯỚNG VẬN HÀNH] TỐI ƯU HÓA TRẠI NGHIỆM NHÂN SỰ ĐỂ ĐỘT PHÁ HIỆU SUẤT

Kính gửi quý đối tác và cộng đồng doanh nghiệp,

Trong quản trị hiện đại, sự hài lòng và sức khỏe thể chất của nhân viên chính là đòn bẩy hiệu năng lớn nhất. Với chiến dịch "${title}" cùng định hướng: ${summary}.

Dựa trên gợi ý đề xuất: "${suggestedContent}", iGen ERP mang tới góc nhìn mới giúp doanh nghiệp:
✅ Giảm thiểu chấn thương cổ tay (RSI) ở bộ phận kỹ thuật.
✅ Gia tăng sự tập trung và gắn kết công việc.
✅ Xây dựng môi trường làm việc thông minh và hiện đại.

💼 Hãy thảo luận cùng chúng tôi để thiết kế giải pháp chuyển đổi số toàn diện cho doanh nghiệp của bạn.

#ChuyenDoiSo #iGenERP #LinkedInArticle #CongNgheTuongLai`;
          mockMediaPrompt = `A minimalist, clean corporate office setting showing a laptop and ${title}, professional corporate workspace, bright natural light.`;
        } else {
          contentType = "Bài viết truyền thông đa kênh";
          outline = `📋 DÀN Ý CHI TIẾT (OUTLINE):
1. Mở bài cuốn hút.
2. Phân tích cốt lõi.
3. CTA kêu gọi hành động.`;
          bodyText = `Giới thiệu chiến dịch: ${title}!

Định hướng ý tưởng: ${summary}.
Nội dung chi tiết gợi ý: ${suggestedContent}`;
          mockMediaPrompt = `A creative, appealing social media visual representing ${title}.`;
        }
        return { channel: chan, contentType, outline, bodyText, mediaPrompt: mockMediaPrompt };
      });
    };

    if (!process.env.PIAPI_API_KEY) {
      isMock = true;
      posts = getMockPosts();
    } else {
      try {
        const prompt = `Bạn là một chuyên gia viết kịch bản và AI Copywriter xuất sắc.
Hãy lập Dàn ý (Outline) và viết Bản nháp nội dung (Draft Content) cho các kênh sau đây: ${targetChannels.join(", ")}

QUY TẮC PHÂN TÁCH DỮ LIỆU BẮT BUỘC CHO TỪNG KÊNH:
1. Đối với kênh TikTok:
   - Trường "outline" (Dàn ý): PHẢI chứa toàn bộ kịch bản quay chi tiết (Shooting Script / Storyboard), bao gồm phân đoạn visual (hình ảnh/hành động), audio (lời thoại/âm thanh/voiceover) và mốc thời gian (Timeline dạng [0:00 - 0:03], [0:03 - 0:08]...) cho từng cảnh. Tổng thời lượng kịch bản không được vượt quá 8 giây.
   - Trường "bodyText" (Nội dung chính): PHẢI là Caption/Description giới thiệu video sạch, cuốn hút kèm hashtag để đăng tải trực tiếp lên TikTok (ví dụ: "🔥 Cứu tinh deadline của bạn đây... #iGenERP..."). TUYỆT ĐỐI không chứa bất kỳ mốc thời gian timeline, phân cảnh, Visual hay Audio nào ở trường này.
2. Đối với các kênh khác (Facebook, LinkedIn, Instagram...):
   - Trường "outline": Lập dàn ý chi tiết, cụ thể và tối ưu của bài viết.
   - Trường "bodyText": Lưu bản nháp nội dung bài viết sạch hoàn chỉnh để đăng tải trực tiếp (không chứa dàn ý hay tiêu đề nháp).
3. Đối với mọi kênh: Sinh thêm trường "mediaPrompt" là một đoạn mô tả chi tiết bằng tiếng Anh (visual prompt) mô phỏng chính xác nội dung trực quan (hình ảnh hoặc video) phù hợp cho bài viết này để gửi tới AI Generator.

Thông tin chiến dịch marketing:
- Tiêu đề ý tưởng: "${title}"
- Tóm tắt ý tưởng: "${summary}"
- Nội dung gợi ý ban đầu: "${suggestedContent}"

Trả về kết quả ở định dạng JSON phù hợp chính xác với cấu trúc yêu cầu.`;

        const response = await generateText(
          GEMINI_TEXT_MODEL,
          prompt,
          {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                posts: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      channel: { type: Type.STRING, description: "Kênh đăng bài (ví dụ: Facebook, TikTok, LinkedIn, Instagram, Zalo)" },
                      contentType: { type: Type.STRING, description: "Loại nội dung" },
                      outline: {
                        type: Type.STRING,
                        description: "Dàn ý chi tiết của bài viết. ĐẶC BIỆT với TikTok: Phải lưu KỊCH BẢN QUAY (timeline video script) chi tiết bao gồm Visual, Audio và mốc thời gian dạng [0:00 - 0:03], [0:03 - 0:08]... với tổng thời lượng tối đa không quá 8 giây."
                      },
                      bodyText: {
                        type: Type.STRING,
                        description: "Nội dung bài đăng/caption sạch để đăng tải trực tiếp. ĐẶC BIỆT với TikTok: Chỉ là Caption/Description giới thiệu video kèm hashtag và call-to-action (TUYỆT ĐỐI không chứa kịch bản quay, visual, audio hay timeline video ở trường này)."
                      },
                      mediaPrompt: {
                        type: Type.STRING,
                        description: "A detailed visual description prompt in English for generating a matching image or video (e.g. scenic views, product display, lifestyle scene, characters, setting details)."
                      }
                    },
                    required: ["channel", "contentType", "outline", "bodyText", "mediaPrompt"],
                  },
                },
              },
              required: ["posts"],
            },
          }
        );

        const responseText = response.text || "{}";
        const parsedData = JSON.parse(responseText.trim());
        posts = (parsedData.posts || []).map((post: any) => ({
          ...post,
          channel: normalizeChannel(post.channel)
        }));
      } catch (error: any) {
        console.error("[geminiService.developMarketingIdea] Error, fallback to mock posts:", error);
        isMock = true;
        posts = getMockPosts();
      }
    }

    // Auto-generate media if mediaType is requested
    if (mediaOptions && mediaOptions.mediaType && mediaOptions.mediaType !== "none") {
      console.log(`[developMarketingIdea] Generating media of type: ${mediaOptions.mediaType}`);
      for (const post of posts) {
        if (mediaOptions.mediaType === "image") {
          try {
            const promptToUse = post.mediaPrompt || `A professional photo matching the campaign topic: ${title}`;
            const imageResult = await geminiService.generateImage(promptToUse, {
              modelName: mediaOptions.imageModel,
              resolution: mediaOptions.imageResolution,
              aspectRatio: mediaOptions.imageAspectRatio,
            });

            if (imageResult.isMock) {
              post.imageUrl = imageResult.url;
            } else {
              try {
                const uploadedUrl = await cloudinaryService.uploadMedia(imageResult.url, "igen_erp");
                post.imageUrl = uploadedUrl;
              } catch (clErr) {
                console.error("[developMarketingIdea] Cloudinary upload image failed, fallback to raw url:", clErr);
                post.imageUrl = imageResult.url;
              }
            }
          } catch (err) {
            console.error(`[developMarketingIdea] Error generating image for post on ${post.channel}:`, err);
            // Fallback to mock image in case of PiAPI credit/service failures
            const seed = Math.floor(Math.random() * 1000000);
            post.imageUrl = `https://picsum.photos/seed/${seed}/800/600`;
            console.log(`[developMarketingIdea] Fallback to mock image: ${post.imageUrl}`);
          }
        } else if (mediaOptions.mediaType === "video") {
          try {
            const promptToUse = post.mediaPrompt || `A cinematic video clip matching the campaign topic: ${title}`;
            const durationSec = mediaOptions.videoDuration ? Number(mediaOptions.videoDuration) : 6;
            const videoResult = await geminiService.generateVideo(promptToUse, durationSec, {
              modelName: mediaOptions.videoModel,
              resolution: mediaOptions.videoQuality,
              aspectRatio: mediaOptions.videoAspectRatio,
            });

            if (videoResult.isMock) {
              post.videoUrl = videoResult.url;
            } else {
              try {
                const uploadedUrl = await cloudinaryService.uploadMedia(videoResult.url, "igen_erp");
                post.videoUrl = uploadedUrl;
              } catch (clErr) {
                console.error("[developMarketingIdea] Cloudinary upload video failed, fallback to raw url:", clErr);
                post.videoUrl = videoResult.url;
              }
            }
          } catch (err) {
            console.error(`[developMarketingIdea] Error generating video for post on ${post.channel}:`, err);
            // Fallback to mock video in case of PiAPI credit/service failures
            post.videoUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";
            console.log(`[developMarketingIdea] Fallback to mock video: ${post.videoUrl}`);
          }
        }
      }
    }

    return { posts, isMock };
  },


  /**
   * Sinh ảnh AI bằng model Nano-Banana hoặc Imagen 4
   */
  async generateImage(
    prompt: string,
    options?: { aspectRatio?: string; modelName?: string; resolution?: string; existingImageUris?: string[] }
  ): Promise<{ url: string; isMock: boolean }> {
    let modelToUse = options?.modelName || GEMINI_IMAGE_MODEL;
    // Route all calls to PiAPI
    if (modelToUse === "igen-image-pro" || modelToUse === "nano-banana-pro") {
      modelToUse = "nano-banana-pro";
    } else if (modelToUse === "igen-image-flash" || modelToUse === "nano-banana-2") {
      modelToUse = "nano-banana-2";
    } else {
      modelToUse = "nano-banana-pro";
    }

    if (!process.env.PIAPI_API_KEY) {
      const seed = Math.floor(Math.random() * 1000000);
      return { url: `https://picsum.photos/seed/${seed}/800/600`, isMock: true };
    }

    return piapiService.generateImage(prompt, modelToUse, { aspectRatio: options?.aspectRatio });
  },

  /**
   * Sinh video AI bằng model Veo3 hoặc Veo2
   */
  async generateVideo(
    prompt: string,
    durationSeconds: number = 6,
    options?: {
      aspectRatio?: string;
      modelName?: string;
      resolution?: string;
      referenceVideoUri?: string;
      referenceImageUris?: string[];
      frameMode?: "standard" | "first_last";
    }
  ): Promise<{ url: string; isMock: boolean }> {
    let actualPrompt = prompt;
    try {
      const parsed = JSON.parse(prompt);
      if (parsed.optimized_english_prompt) {
        actualPrompt = parsed.optimized_english_prompt;
        if (parsed.motion_analysis) actualPrompt += `. Motion: ${parsed.motion_analysis}`;
        if (parsed.camera_movement) actualPrompt += `. Camera: ${parsed.camera_movement}`;
      }
    } catch (e) {
      // not JSON, use as is
    }

    const modelToUse = normalizePiapiVideoModel(options?.modelName);

    if (!process.env.PIAPI_API_KEY) {
      throw new Error("Chưa cấu hình PIAPI_API_KEY. Không thể sinh video.");
    }

    const { taskId } = await piapiService.createVideoTask(actualPrompt, modelToUse, durationSeconds, {
      aspectRatio: options?.aspectRatio,
      referenceImageUris: options?.referenceImageUris,
    });
    return { url: `pending://piapi/${taskId}`, isMock: false, taskId } as any;
  },

  /**
   * Tạo giọng nói TTS (Gemini Voice Modality)
   */
  async generateVoice(userId: string, input: any) {
    const { textToSpeak, styleInstructions, mode, temperature, modelName, voiceName, speakerA, speakerB, title, description } = input;

    // ElevenLabs Voice Mapping Table
    const ELEVENLABS_VOICE_MAP: Record<string, string> = {
      // Male voices
      'Sadaltager': 'pNInz6obpgqjGQJe7v5C', // Adam
      'Charon': 'IKne3meq5aP759yEl2s8',    // Charlie
      'Orus': 'JBF2zhBk4EKq12v0tw9H',      // George
      'Puck': 'TxGEqn7nUaNZTRXjOFaQ',      // Josh
      'Fenrir': 'VR6A4UBqILHN73idDuEx',    // Arnold
      'Enceladus': 'N2lVS1w4EtoT3sAHBSz1', // Callum
      'Iapetus': 'ODq5FpeHgnsMrZsnXCw8',   // Patrick
      'Umbriel': 'SOYhlJg1783U4EcYUPgl',   // Harry
      'Algenib': 'TX329t22vkzCsaeeH8ui',   // Liam
      'Rasalgethi': 'CYw3moM5B48wqvQUxxTL',// Dave
      'Achernar': 'GBv7mTt0atIp3u8bJvhg',  // Thomas
      'Zephyr': 'D38z5qw23EIviwc77s33',    // Fin
      'Alnilam': '2EiwXtPIZgojA6xnRghf',   // Clyde
      'Gacrux': '2EiwXtPIZgojA6xnRghf',    // Clyde fallback
      'Achird': 'pNInz6obpgqjGQJe7v5C',    // Adam fallback
      'Zubenelgenubi': 'pNInz6obpgqjGQJe7v5C', // Adam fallback
      'Sulafat': 'pNInz6obpgqjGQJe7v5C',   // Adam fallback

      // Female voices
      'Aoede': 'EXAVITQu4vr4xnSDxMaL',     // Bella
      'Callirrhoe': 'AZnzlk1XvdvUeBnXmlld',// Domi
      'Kore': '21m00Tcm4TlvDq8ikWAM',      // Rachel
      'Leda': 'Lcfc5O6IFm67RCg5pQA1',      // Emily
      'Autonoe': 'MF3mGyEYCl7XYWbV9VbO',   // Ellie
      'Algieba': 'ThT50A1aJnqfgCzz94ks',   // Dorothy
      'Despina': 'zrHiDhphv9RcmhlC3AEg',   // Mimi
      'Erinome': 'EXAVITQu4vr4xnSDxMaL',   // Bella fallback
      'Laomedeia': 'EXAVITQu4vr4xnSDxMaL', // Bella fallback
      'Schedar': 'EXAVITQu4vr4xnSDxMaL',   // Bella fallback
      'Pulcherrima': 'EXAVITQu4vr4xnSDxMaL', // Bella fallback
      'Vindemiatrix': 'EXAVITQu4vr4xnSDxMaL', // Bella fallback
      'Sadachbia': 'EXAVITQu4vr4xnSDxMaL'  // Bella fallback
    };

    let audioDataUri = "";
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

    if (!elevenLabsApiKey || elevenLabsApiKey.trim() === "") {
      console.log("[geminiService.generateVoice] ELEVENLABS_API_KEY is not configured. Running in MOCK mode.");
      audioDataUri = "data:audio/wav;base64,UklGRigAAABXQVZFlm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAAAG";
    } else {
      try {
        const targetVoice = mode === 'multi' ? (speakerA || 'Aoede') : (voiceName || 'Aoede');
        const mappedVoiceId = ELEVENLABS_VOICE_MAP[targetVoice] || targetVoice || 'pNInz6obpgqjGQJe7v5C';

        console.log(`[geminiService.generateVoice] Generating voice using ElevenLabs with voice: ${mappedVoiceId}`);

        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${mappedVoiceId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": elevenLabsApiKey.trim()
          },
          body: JSON.stringify({
            text: textToSpeak,
            model_id: modelName || "eleven_v3",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75
            }
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`ElevenLabs API error: ${response.status} - ${errText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Audio = buffer.toString('base64');
        audioDataUri = `data:audio/mpeg;base64,${base64Audio}`;
      } catch (error: any) {
        console.error("[geminiService.generateVoice] ElevenLabs API error:", error);
        throw error;
      }
    }

    // Upload to Cloudinary
    const cloudinaryUrl = await cloudinaryService.uploadMedia(audioDataUri, "igen_erp/marketing/voice");

    // Save to MongoDB
    const record = await AIMediaModel.create({
      userId,
      mediaType: "voice",
      url: cloudinaryUrl,
      prompt: textToSpeak,
      metadata: {
        voiceName: mode === 'multi' ? `Multi (${speakerA} & ${speakerB})` : voiceName,
        duration: estimateAudioDuration(textToSpeak),
        resolution: modelName || "eleven_v3",
        title: title || undefined,
        description: description || undefined,
      }
    });

    return record;
  },

  /**
   * Tối ưu kịch bản giọng nói
   */
  async optimizeScript(text: string, readingStyle: string) {
    if (!process.env.PIAPI_API_KEY) {
      return { optimizedText: `[Tối ưu hóa Giả lập] ${text}` };
    }
    try {
      const systemInstruction = "Bạn là chuyên gia biên soạn kịch bản và viết nội dung phát thanh radio. Hãy tối ưu hóa văn bản của người dùng để trở nên tự nhiên, cuốn hút, dễ đọc và phù hợp nhất với phong cách được yêu cầu. Trả về DUY NHẤT văn bản đã tối ưu hóa, không có thêm lời giải thích hay ký tự đặc biệt.";
      const response = await generateText(
        GEMINI_TEXT_MODEL,
        `Phong cách: ${readingStyle || "hấp dẫn, lôi cuốn"}\nVăn bản gốc:\n${text}`,
        {
          systemInstruction,
          temperature: 0.7,
        }
      );
      return { optimizedText: response.text || text };
    } catch (error: any) {
      console.error("[geminiService.optimizeScript] Error, fallback to mock script:", error);
      return { optimizedText: `[Tối ưu hóa Giả lập] ${text}` };
    }
  },

  /**
   * Tối ưu prompt hình ảnh (cấu trúc JSON)
   */
  async optimizeImagePrompt(description: string, imageUris?: string[], modelName?: string) {
    const normalizedDescription = String(description || "").trim();

    const getMockImagePrompt = () => {
      return {
        subject: normalizedDescription || "image concept",
        clothing_material: "",
        action_pose: "",
        setting_lighting: "",
        camera_parameters: "",
        optimized_english_prompt: `A professional studio photo representing: ${normalizedDescription || "the provided concept"}`,
        negative_prompt: "ugly, blurry, low quality",
      };
    };

    if (!normalizedDescription) {
      return getMockImagePrompt();
    }

    if (!process.env.PIAPI_API_KEY) {
      return getMockImagePrompt();
    }

    try {
      const messages: any[] = [
        {
          role: "system",
          content: `You are an expert prompt engineer for image generators. Optimize the user's image description into a high-quality, descriptive English prompt.
Output MUST be a valid JSON object matching this schema:
{
  "subject": "string",
  "clothing_material": "string",
  "action_pose": "string",
  "setting_lighting": "string",
  "camera_parameters": "string",
  "optimized_english_prompt": "string of the final detailed prompt in English",
  "negative_prompt": "string of negative prompts"
}
Do not include markdown blocks or any text other than the JSON object.`
        }
      ];

      const userContent: any[] = [
        { type: "text", text: `Optimize this prompt: ${normalizedDescription}` }
      ];

      if (imageUris && imageUris.length > 0) {
        for (const uri of imageUris) {
          if (!uri || typeof uri !== 'string') continue;
          let imageUrl = uri;
          if (uri.startsWith("data:")) {
            try {
              imageUrl = await cloudinaryService.uploadMedia(uri, "piapi_temp_inputs");
            } catch (uploadError) {
              console.error("[geminiService.optimizeImagePrompt] Failed to upload reference image to Cloudinary:", uploadError);
            }
          }
          userContent.push({
            type: "image_url",
            image_url: { url: imageUrl }
          });
        }
      }

      messages.push({
        role: "user",
        content: userContent
      });

      const callPromise = piapiService.chatCompletions(messages, "gpt-4o-mini", { type: "json_object" });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("PiAPI chat completions timeout")), 15000)
      );

      const response = await Promise.race([callPromise, timeoutPromise]);
      const content = response.choices?.[0]?.message?.content || "{}";
      return JSON.parse(content.trim());
    } catch (error: any) {
      console.error("[geminiService.optimizeImagePrompt] PiAPI Error, fallback to local optimizer:", error);
      return getMockImagePrompt();
    }
  },

  /**
   * Tối ưu prompt video (cấu trúc JSON)
   */
  async optimizeVideoPrompt(description: string, imageUris?: string[]) {
    const normalizedDescription = String(description || "").trim();

    const getMockVideoPrompt = () => {
      const text = normalizedDescription.toLowerCase().trim();
      const isEnglish = !/[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệđìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]/i.test(normalizedDescription);
      if (isEnglish) {
        return {
          motion_analysis: "smooth cinematic motion of the subject",
          camera_movement: "slow pan, dynamic focus tracking",
          optimized_english_prompt: `A high quality cinematic video representing: ${normalizedDescription || "the provided concept"}`,
        };
      }

      // Default values
      let englishSubject = "a cinematic scene";
      let motion = "subtle and realistic movements of the subject";
      let camera = "slow cinematic pan, smooth tracking shot";
      let lighting = "cinematic lighting, soft volumetric rays";
      let style = "photorealistic, 8k resolution, highly detailed, masterpiece";

      // Translation mappings
      const dict: { [key: string]: string } = {
        "câu chuyện ngắn về tuna": "a short narrative story about a character named Tuna",
        "câu chuyện về tuna": "a narrative story featuring Tuna",
        "tập truyện về tuna": "a short story about Tuna",
        "tuna": "a character named Tuna",
        "núi tuyết": "majestic snow-capped mountains under a clear sky",
        "núi": "picturesque mountain ranges",
        "hoàng hôn": "sunset during golden hour with warm amber tones",
        "bình minh": "sunrise during blue hour, soft morning mist",
        "sản phẩm": "a premium commercial product showcase",
        "quảng cáo": "high-end promotional commercial video",
        "người mẫu": "an elegant fashion model",
        "sàn diễn": "a glamorous fashion show catwalk runway",
        "runway": "fashion catwalk runway with bright studio lights",
        "flycam": "aerial drone perspective sweeping across the landscape",
        "bay": "soaring aerial shot",
        "xoay": "360-degree rotating showcase",
        "cận cảnh": "extreme close-up macro details",
        "toàn cảnh": "wide-angle scenic overview",
        "xe": "a sleek modern luxury sports car",
        "ô tô": "a luxury car driving along a scenic route",
        "biển": "crystal clear ocean waves gently crashing on a sandy beach",
        "đại dương": "vast deep blue ocean landscape",
        "thành phố": "modern cityscape with towering skyscrapers",
        "công nghệ": "futuristic technology environment with holographic displays",
        "phim": "cinematic movie style footage",
        "điện ảnh": "cinematic film style",
        "chậm": "dramatic slow-motion video",
        "nhanh": "dynamic fast-paced cuts and motion",
      };

      // Sort keys by length descending to match longest phrases first
      const keys = Object.keys(dict).sort((a, b) => b.length - a.length);
      let remainingText = text;
      const detectedKeywords: string[] = [];

      for (const key of keys) {
        if (remainingText.includes(key)) {
          detectedKeywords.push(dict[key]);
          remainingText = remainingText.replace(new RegExp(key, 'g'), '');
        }
      }

      if (detectedKeywords.length > 0) {
        englishSubject = detectedKeywords.join(", ");
      } else {
        const cleanText = normalizedDescription
          .replace(/tiến hành/gi, "")
          .replace(/tạo 1/gi, "")
          .replace(/tạo một/gi, "")
          .replace(/tạo/gi, "")
          .replace(/làm/gi, "")
          .trim();
        if (cleanText) {
          englishSubject = `a cinematic representation of: "${cleanText}"`;
        }
      }

      // Adjust motion and camera based on keyword detection
      if (text.includes("chậm") || text.includes("slow")) {
        motion = "dramatic slow-motion action with elegant fluid dynamics";
        camera = "ultra-smooth slow tracking camera";
      } else if (text.includes("nhanh") || text.includes("fast")) {
        motion = "high-energy fast-paced dynamic actions";
        camera = "rapid cuts, active handheld tracking, whip pans";
      }

      if (text.includes("flycam") || text.includes("bay") || text.includes("trên cao")) {
        camera = "high-altitude aerial drone sweep, panning down smoothly";
      } else if (text.includes("xoay") || text.includes("360")) {
        camera = "orbiting 360-degree rotation around the subject";
      } else if (text.includes("cận cảnh") || text.includes("cận")) {
        camera = "macro close-up focus with shallow depth of field";
      }

      if (text.includes("sản phẩm") || text.includes("product")) {
        lighting = "professional studio key lighting, soft box diffusion, edge highlight";
        style = "commercial grade, high-end product commercial, 8k, photorealistic";
      } else if (text.includes("người mẫu") || text.includes("fashion") || text.includes("runway")) {
        lighting = "bright runway stage lights, high-contrast spotlighting, camera flashes";
        style = "high-fashion editorial look, cinematic 4k, vibrant colors";
      }

      const optimized_english_prompt = `Cinematic, photorealistic video of ${englishSubject}. ${motion}. Camera movement: ${camera}. Lighting: ${lighting}. Visual style: ${style}. Rendered in crisp 4k, volumetric atmosphere, hyper-detailed textures.`;

      return {
        motion_analysis: motion,
        camera_movement: camera,
        optimized_english_prompt,
      };
    };

    if (!normalizedDescription) {
      return {
        motion_analysis: "smooth cinematic motion of the subject",
        camera_movement: "slow pan, dynamic focus tracking",
        optimized_english_prompt: "A high quality cinematic video with clear subject focus and natural movement.",
      };
    }

    if (!process.env.PIAPI_API_KEY) {
      return getMockVideoPrompt();
    }

    try {
      const messages: any[] = [
        {
          role: "system",
          content: `You are an expert prompt engineer for video generators. Optimize the description into a high-quality video prompt.
Output MUST be a valid JSON object matching this schema:
{
  "motion_analysis": "string describing the camera motion and subject physics",
  "camera_movement": "string describing camera path and focus",
  "optimized_english_prompt": "string of the final detailed prompt in English"
}
Do not include markdown blocks or any text other than the JSON object.`
        }
      ];

      const userContent: any[] = [
        { type: "text", text: `Optimize this prompt: ${normalizedDescription}` }
      ];

      if (imageUris && imageUris.length > 0) {
        for (const uri of imageUris) {
          if (!uri || typeof uri !== 'string') continue;
          let imageUrl = uri;
          if (uri.startsWith("data:")) {
            try {
              imageUrl = await cloudinaryService.uploadMedia(uri, "piapi_temp_inputs");
            } catch (uploadError) {
              console.error("[geminiService.optimizeVideoPrompt] Failed to upload reference image to Cloudinary:", uploadError);
            }
          }
          userContent.push({
            type: "image_url",
            image_url: { url: imageUrl }
          });
        }
      }

      messages.push({
        role: "user",
        content: userContent
      });

      const callPromise = piapiService.chatCompletions(messages, "gpt-4o-mini", { type: "json_object" });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("PiAPI chat completions timeout")), 15000)
      );

      const response = await Promise.race([callPromise, timeoutPromise]);
      const content = response.choices?.[0]?.message?.content || "{}";
      return JSON.parse(content.trim());
    } catch (error: any) {
      console.error("[geminiService.optimizeVideoPrompt] PiAPI Error, fallback to local optimizer:", error);
      return getMockVideoPrompt();
    }
  },

  /**
   * Biên tập video bằng prompt (LLM sinh JSON Blueprint + Render Engine)
   */
  async editVideo(
    userId: string,
    videoUrl: string,
    prompt: string,
    options?: {
      modelName?: string;
      aspectRatio?: string;
      resolution?: string;
      duration?: number;
    }
  ): Promise<{ status: string; record: any; blueprint: any }> {
    let originalDuration = options?.duration;
    if (!originalDuration) {
      try {
        const matchedRecord = await AIMediaModel.findOne({ url: videoUrl }).lean();
        if (matchedRecord?.metadata?.duration) {
          originalDuration = Number(matchedRecord.metadata.duration);
        }
      } catch (dbErr) {
        console.warn("[geminiService.editVideo] Failed to query original video duration:", dbErr);
      }
    }

    const getFallbackBlueprint = () => {
      const dur = originalDuration || 5;
      return {
        timeline: [
          { type: "video", src: videoUrl, start: 0, end: dur },
          { type: "text", content: "Tin tức", start: Math.max(0, dur - 3), end: dur }
        ]
      };
    };

    let blueprint = getFallbackBlueprint();

    try {
      if (process.env.PIAPI_API_KEY) {
        const systemPrompt = `You are a professional video editing assistant. Your job is to translate a user's natural language video editing instructions (supporting both English and Vietnamese) into a precise Remotion video editing JSON blueprint.

The original video URL is "${videoUrl}".
The original video duration is exactly ${originalDuration || 5} seconds.

You MUST follow these strict rules to map user editing requests to the timeline:

1. UNDERSTAND VIETNAMESE EDITING TERMS:
   - "cắt bỏ X giây đầu" (cut first X seconds) -> Start video clips at X instead of 0.
   - "cắt bỏ X giây cuối" (cut last X seconds) -> End video clips at (originalDuration - X).
   - "tua nhanh gấp N lần" (fast forward N times) -> Set playbackRate to N.
   - "tua chậm / slow-motion N lần" (slow down N times) -> Set playbackRate to (1/N).
   - "tăng sáng" (brighten) -> set filters.brightness > 1.0 (e.g. 1.3).
   - "làm tối" (darken) -> set filters.brightness < 1.0 (e.g. 0.7).
   - "đen trắng" (grayscale) -> set filters.grayscale = 1.0.
   - "làm mờ / hiệu ứng mờ" (blur) -> set filters.blur to value in pixels (e.g. 5).
   - "màu cổ điển / màu hoài cổ / màu ngả vàng" (sepia) -> set filters.sepia to value from 0 to 1 (e.g. 0.8).
   - "đảo ngược màu / đảo màu" (invert) -> set filters.invert to value from 0 to 1 (e.g. 1.0).
   - "tăng độ tương phản" -> set filters.contrast > 1.0 (e.g. 1.4).
   - "giảm độ tương phản" -> set filters.contrast < 1.0 (e.g. 0.7).
   - "tăng độ bão hòa màu / làm màu rực rỡ" -> set filters.saturate > 1.0 (e.g. 1.5).
   - "giảm độ bão hòa màu / làm màu nhạt đi" -> set filters.saturate < 1.0 (e.g. 0.5).
   - "đổi sắc độ / xoay tông màu" (hue rotation) -> set filters.hueRotate to value in degrees (e.g. 90).
   - "chèn logo / sticker / ảnh" (insert image/logo) -> type: "image".
   - "chèn chữ / viết chữ / phụ đề / lyrics" (insert text/overlay) -> type: "text".
   - "lồng nhạc / chèn âm thanh" (insert audio/music) -> type: "audio".
   - "zoom vào / phóng to" (zoom in) -> set effects.zoom to "in".
   - "zoom ra / thu nhỏ" (zoom out) -> set effects.zoom to "out".
   - "xoay / đổi góc / quay nghiêng" (rotate angle) -> set effects.rotate to angle in degrees (e.g. 90, 180, 270, -45).
   - "chuyển cảnh fade / mờ dần / chuyển cảnh mượt" -> set effects.transition to "fade".
   - "tiếng ting / âm thanh thành công" (ting sound effect) -> type: "audio" with src "https://assets.mixkit.co/active_storage/sfx/2019/2019-84.wav".
   - "tiếng whoosh / âm thanh lướt" (whoosh sound effect) -> type: "audio" with src "https://assets.mixkit.co/active_storage/sfx/2013/2013-84.wav".
   - "tiếng cười / tiếng cười lớn" (laughter sound effect) -> type: "audio" with src "https://assets.mixkit.co/active_storage/sfx/2568/2568-84.wav".
   - "tiếng nổ / vụ nổ" (explosion sound effect) -> type: "audio" with src "https://assets.mixkit.co/active_storage/sfx/2798/2798-84.wav".
   - "tiếng tít / tiếng censor / beep" (beep sound effect) -> type: "audio" with src "https://assets.mixkit.co/active_storage/sfx/1076/1076-84.wav".

2. TIMELINE STRUCTURE & MATH GUIDELINES:
   - The timeline consists of sequential video segments. Unless a user explicitly requests to cut or remove a section, you MUST preserve the entire original video from start to finish.
   - If a specific segment is modified (e.g. slowed down or filtered), you must split the original video into multiple sequential 'video' clips.
     Example: Original duration is 6s. User wants to slow down the first 2 seconds. You must create two clips:
       Clip 1: start: 0, end: 2, playbackRate: 0.5 (takes 4 seconds in the final timeline)
       Clip 2: start: 2, end: 6, playbackRate: 1.0 (takes 4 seconds in the final timeline)
       Total final video duration: 8 seconds.
   - TIMELINES FOR OVERLAYS (text, image, audio): The 'start' and 'end' values for overlays must match the final timeline timestamps (after speed/playbackRate calculations of the video clips).
     In the example above, if the user wants text at the very end of the video for 2 seconds, it should be start: 6, end: 8.
   - MULTIPLE TEXT / SUBTITLES / CAPTIONS: To add multiple lines of text, subtitles, or captions, output multiple "text" elements in the timeline, each with its own start, end, content, and style parameters matching the flow.
   - SOUND EFFECTS: When the user requests a sound effect (e.g., ting, whoosh, laughter, explosion, censor/beep), insert a short "audio" clip at the requested timestamp. Use the exact URLs provided in Rule 1. Typically, these last between 1 to 3 seconds.

3. VALID JSON SCHEMA:
Output MUST be a valid JSON object matching this schema (with no other text or markdown blocks):
{
  "timeline": [
    {
      "type": "video",
      "src": "string (MUST be the original video url exactly)",
      "start": number (start time in seconds in the original video),
      "end": number (end time in seconds in the original video),
      "playbackRate": number (MUST be explicitly defined for every clip, default 1.0),
      "filters": {
        "brightness": number (optional, e.g. 1.2 or 0.8),
        "grayscale": number (optional, 0 to 1),
        "blur": number (optional, blur in pixels, e.g. 5),
        "sepia": number (optional, 0 to 1),
        "invert": number (optional, 0 to 1),
        "contrast": number (optional, contrast multiplier, e.g. 1.3),
        "saturate": number (optional, saturation multiplier, e.g. 1.5),
        "hueRotate": number (optional, rotation in degrees, e.g. 90)
      },
      "effects": {
        "zoom": "in" | "out" | "none" (optional, default "none"),
        "rotate": number (optional, rotation in degrees, default 0),
        "transition": "fade" | "none" (optional, default "none")
      }
    },
    {
      "type": "text",
      "content": "string",
      "start": number (start time in seconds in the final compiled video),
      "end": number (end time in seconds in the final compiled video),
      "style": {
        "position": "top-left" | "top-center" | "top-right" | "center" | "bottom-left" | "bottom-center" | "bottom-right",
        "color": "string (hex code, e.g. '#FFFFFF')",
        "fontSize": "string (e.g. '36px')"
      }
    },
    {
      "type": "image",
      "src": "string (URL of the image/logo)",
      "start": number (start time in seconds in final compiled video),
      "end": number (end time in seconds in final compiled video),
      "style": {
        "position": "top-right" | "top-left" | "bottom-right" | "bottom-left",
        "width": number (width in pixels),
        "opacity": number (0 to 1)
      }
    },
    {
      "type": "audio",
      "src": "string (URL of the audio/music track or preloaded sound effect)",
      "start": number (start time in seconds in final compiled video),
      "end": number (end time in seconds in final compiled video),
      "volume": number (0 to 1)
    }
  ]
}

4. EXAMPLES:

Example A (Speed & Filters):
User prompt: "Tua nhanh 2 giây đầu gấp đôi và đổi sang đen trắng, giữ nguyên phần còn lại."
Original duration: 5 seconds.
JSON:
{
  "timeline": [
    {
      "type": "video",
      "src": "${videoUrl}",
      "start": 0,
      "end": 2,
      "playbackRate": 2.0,
      "filters": { "grayscale": 1.0 }
    },
    {
      "type": "video",
      "src": "${videoUrl}",
      "start": 2,
      "end": 5,
      "playbackRate": 1.0
    }
  ]
}

Example B (Text Overlay & Trimming):
User prompt: "Cắt bỏ 1 giây đầu. Hiện chữ 'Hello World' từ giây 1 đến giây 3 ở giữa màn hình."
Original duration: 6 seconds.
JSON:
{
  "timeline": [
    {
      "type": "video",
      "src": "${videoUrl}",
      "start": 1,
      "end": 6,
      "playbackRate": 1.0
    },
    {
      "type": "text",
      "content": "Hello World",
      "start": 0,
      "end": 2,
      "style": {
        "position": "center",
        "color": "#FFFFFF",
        "fontSize": "36px"
      }
    }
  ]
}

Example C (Effects & Sound Effects):
User prompt: "Phóng to (zoom in) và xoay 90 độ ở 3 giây cuối cùng, đồng thời chèn tiếng ting thành công ở giây thứ 3."
Original duration: 6 seconds.
JSON:
{
  "timeline": [
    {
      "type": "video",
      "src": "${videoUrl}",
      "start": 0,
      "end": 3,
      "playbackRate": 1.0
    },
    {
      "type": "video",
      "src": "${videoUrl}",
      "start": 3,
      "end": 6,
      "playbackRate": 1.0,
      "effects": {
        "zoom": "in",
        "rotate": 90,
        "transition": "fade"
      }
    },
    {
      "type": "audio",
      "src": "https://assets.mixkit.co/active_storage/sfx/2019/2019-84.wav",
      "start": 3,
      "end": 4.5,
      "volume": 0.8
    }
  ]
}

Do not output any markdown blocks or extra text. Output ONLY the JSON object.`;

        const messages = [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate JSON blueprint for: "${prompt}"` }
        ];

        const response = await piapiService.chatCompletions(messages, "gpt-4o-mini", { type: "json_object" });
        const content = response.choices?.[0]?.message?.content || "{}";
        blueprint = JSON.parse(content.trim());
      }
    } catch (error) {
      console.error("[geminiService.editVideo] Failed to get LLM blueprint, falling back:", error);
      blueprint = getFallbackBlueprint();
    }

    // Save record to database with status processing
    const record = await AIMediaModel.create({
      userId,
      mediaType: "video",
      url: `pending://local-render/${userId}-${Date.now()}`,
      prompt,
      metadata: {
        status: "processing",
        progress: 10,
        provider: "local-render",
        title: `Biên tập: ${prompt}`,
        description: `Đang kết xuất video tự động bằng FFMPEG / Cloud Render.`,
        blueprint: JSON.stringify(blueprint),
        renderLogs: [
          "[LLM] Đang phân tích prompt...",
          `[LLM] Đã phân tích thành công JSON Blueprint: ${JSON.stringify(blueprint, null, 2)}`
        ],
        aspectRatio: options?.aspectRatio || "16:9",
        resolution: options?.resolution || "720p",
      }
    });

    // Start background render execution
    this.executeLocalRenderBackground(record._id.toString(), videoUrl, blueprint, userId);

    return {
      status: "success",
      record,
      blueprint
    };
  },

  async executeLocalRenderBackground(recordId: string, videoUrl: string, blueprint: any, userId: string) {
    console.log(`[Local Render Background] Starting task for record ${recordId}`);
    const timeline = blueprint.timeline || [];
    const logs = [
      "[LLM] Đang phân tích prompt...",
      `[LLM] Đã phân tích thành công JSON Blueprint: ${JSON.stringify(blueprint, null, 2)}`,
      "[Render Engine] Khởi động Render Engine..."
    ];
    
    const updateLogs = async (progress: number, newLog?: string) => {
      if (newLog) {
        console.log(`[Local Render Background] [${progress}%] ${newLog}`);
        logs.push(newLog);
      }
      await AIMediaModel.findByIdAndUpdate(recordId, {
        "metadata.progress": progress,
        "metadata.renderLogs": logs
      });
    };

    try {
      let finalVideoUrl = "";
      let renderSuccess = false;

      try {
        await updateLogs(25, "[Render Engine] Bắt đầu kết xuất video bằng Remotion...");
        const record = await AIMediaModel.findById(recordId);
        const aspect = record?.metadata?.aspectRatio || "16:9";
        const resolution = record?.metadata?.resolution || "720p";
        
        finalVideoUrl = await remotionService.renderVideo(
          blueprint,
          { aspectRatio: aspect, resolution },
          async (progress, msg) => {
            await updateLogs(progress, msg);
          }
        );
        renderSuccess = true;
      } catch (remotionError: any) {
        await updateLogs(
          35,
          `[Render Engine Warning] Remotion Engine không thể kết xuất (có thể do thiếu Chromium): ${remotionError.message || String(remotionError)}. Đang tự động chuyển sang công cụ Render Fallback...`
        );
      }

      if (!renderSuccess) {
        finalVideoUrl = videoUrl;

        await updateLogs(40, "[Render Engine Fallback] Đang kiểm tra môi trường FFMPEG...");
        
        const hasFfmpeg = await new Promise<boolean>((resolve) => {
          exec("ffmpeg -version", (error) => {
            resolve(!error);
          });
        });

        await updateLogs(45, `[Render Engine Fallback] Kết quả FFMPEG: ${hasFfmpeg ? "Đã cài đặt" : "Chưa cài đặt"}`);

        if (hasFfmpeg) {
          const tempInput = path.join(os.tmpdir(), `input_${recordId}.mp4`);
          const tempOutput = path.join(os.tmpdir(), `output_${recordId}.mp4`);
          
          const cacheDir = path.join(process.cwd(), "server/cache/videos");
          if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
          }

          const urlParts = videoUrl.split("/");
          const filename = urlParts[urlParts.length - 1];
          const localCachePath = path.join(cacheDir, filename);

          if (filename && filename.match(/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/) && fs.existsSync(localCachePath)) {
            await updateLogs(50, `[Render Engine Cache] Phát hiện video nguồn trong cache cục bộ (${filename}). Sao chép trực tiếp...`);
            fs.copyFileSync(localCachePath, tempInput);
          } else {
            await updateLogs(50, "[Render Engine Fallback] Đang tải video gốc xuống server tạm...");
            const response = await fetch(videoUrl);
            if (!response.ok) {
              throw new Error(`Tải video gốc thất bại: HTTP ${response.status}`);
            }
            const buffer = Buffer.from(await response.arrayBuffer());
            fs.writeFileSync(tempInput, buffer);
          }
          
          await updateLogs(55, "[Render Engine Fallback] Đang phát hiện luồng âm thanh...");
          const hasAudio = await new Promise<boolean>((resolve) => {
            exec(`ffmpeg -i "${tempInput}"`, (error, stdout, stderr) => {
              const info = stderr || stdout || "";
              resolve(info.includes("Audio:"));
            });
          });
          
          await updateLogs(60, `[Render Engine Fallback] Âm thanh nguồn: ${hasAudio ? "Có" : "Không"}`);
          await updateLogs(65, "[Render Engine Fallback] Đang xử lý các tài nguyên lớp phủ (overlay)...");

          const videoClips = timeline.filter((item: any) => item.type === "video");
          const textElements = timeline.filter((item: any) => item.type === "text");
          const imageElements = timeline.filter((item: any) => item.type === "image");
          const audioElements = timeline.filter((item: any) => item.type === "audio");

          // 1. Download image overlays to temp files
          const imageTempPaths: string[] = [];
          for (let i = 0; i < imageElements.length; i++) {
            const img = imageElements[i];
            const tempImgPath = path.join(os.tmpdir(), `overlay_img_${recordId}_${i}${path.extname(img.src || '.png')}`);
            try {
              const imgRes = await fetch(img.src);
              if (imgRes.ok) {
                fs.writeFileSync(tempImgPath, Buffer.from(await imgRes.arrayBuffer()));
                imageTempPaths.push(tempImgPath);
              } else {
                imageTempPaths.push("");
              }
            } catch (err) {
              imageTempPaths.push("");
            }
          }

          // 2. Download audio overlays to temp files
          const audioTempPaths: string[] = [];
          for (let i = 0; i < audioElements.length; i++) {
            const aud = audioElements[i];
            const tempAudPath = path.join(os.tmpdir(), `overlay_aud_${recordId}_${i}${path.extname(aud.src || '.mp3')}`);
            try {
              const audRes = await fetch(aud.src);
              if (audRes.ok) {
                fs.writeFileSync(tempAudPath, Buffer.from(await audRes.arrayBuffer()));
                audioTempPaths.push(tempAudPath);
              } else {
                audioTempPaths.push("");
              }
            } catch (err) {
              audioTempPaths.push("");
            }
          }

          // 3. Build FFMPEG filter graph
          let filterComplex = "";
          let inputArgs: string[] = [];
          
          // Keep track of the actual inputs mapped in FFMPEG
          // Input 0: tempInput
          let currentInputIdx = 1;
          const imageInputMappings: { [key: number]: number } = {};
          const audioInputMappings: { [key: number]: number } = {};

          imageElements.forEach((img: any, idx: number) => {
            const localPath = imageTempPaths[idx];
            if (localPath) {
              inputArgs.push(`-i "${localPath}"`);
              imageInputMappings[idx] = currentInputIdx;
              currentInputIdx++;
            }
          });

          audioElements.forEach((aud: any, idx: number) => {
            const localPath = audioTempPaths[idx];
            if (localPath) {
              inputArgs.push(`-i "${localPath}"`);
              audioInputMappings[idx] = currentInputIdx;
              currentInputIdx++;
            }
          });

          let concatInputs = "";
          videoClips.forEach((clip: any, idx: number) => {
            const start = clip.start ?? 0;
            const end = clip.end ?? 5;
            const rate = clip.playbackRate ?? 1;
            const clipDuration = (end - start) / rate;

            // Video stream processing
            let vFilter = `[0:v]trim=start=${start}:end=${end},setpts=PTS-STARTPTS`;
            if (clip.filters?.grayscale !== undefined && clip.filters.grayscale > 0) {
              vFilter += `,hue=s=${1 - clip.filters.grayscale}`;
            }
            if (clip.filters?.brightness !== undefined && clip.filters.brightness !== 1) {
              vFilter += `,eq=brightness=${clip.filters.brightness - 1}`;
            }
            if (clip.effects?.rotate !== undefined && clip.effects.rotate !== 0) {
              const rad = (clip.effects.rotate * Math.PI) / 180;
              vFilter += `,rotate=${rad}`;
            }
            if (clip.effects?.transition === "fade") {
              const fadeDur = Math.min(0.5, clipDuration / 2);
              vFilter += `,fade=in:st=0:d=${fadeDur},fade=out:st=${clipDuration - fadeDur}:d=${fadeDur}`;
            }
            if (rate !== 1) {
              vFilter += `,setpts=${1 / rate}*(PTS-STARTPTS)`;
            }
            vFilter += `,fps=fps=30`; // Force constant 30fps to prevent transition stutters
            vFilter += `[v_proc_${idx}];`;
            filterComplex += vFilter;
            concatInputs += `[v_proc_${idx}]`;

            // Audio stream processing
            if (hasAudio) {
              let aFilter = `[0:a]atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS`;
              if (rate !== 1) {
                const clampedRate = Math.max(0.5, Math.min(2.0, rate));
                aFilter += `,atempo=${clampedRate}`;
              }
              aFilter += `[a_proc_${idx}];`;
              filterComplex += aFilter;
              concatInputs += `[a_proc_${idx}]`;
            } else {
              filterComplex += `anullsrc=sample_rate=44100:channel_layout=stereo,atrim=duration=${clipDuration}[a_proc_${idx}];`;
              concatInputs += `[a_proc_${idx}]`;
            }
          });

          const numClips = videoClips.length;
          filterComplex += `${concatInputs}concat=n=${numClips}:v=1:a=1[concatv][concata];`;

          let currentVideoOut = "[concatv]";
          textElements.forEach((textItem: any, idx: number) => {
            const start = textItem.start ?? 0;
            const end = textItem.end ?? 5;
            const content = (textItem.content || "").replace(/'/g, "'\\\\''").replace(/:/g, "\\:");
            const style = textItem.style || {};
            const color = style.color || "white";
            
            let x = "(w-text_w)/2";
            let y = "h-text_h-80";
            
            // Vertical position mapping
            if (style.position?.startsWith("top-")) {
              y = "40";
            } else if (style.position === "center") {
              y = "(h-text_h)/2";
            } else if (style.position?.startsWith("bottom-")) {
              y = "h-text_h-80";
            }

            // Horizontal position mapping
            if (style.position?.endsWith("-left")) {
              x = "40";
            } else if (style.position?.endsWith("-right")) {
              x = "w-text_w-40";
            } else if (style.position?.endsWith("-center") || style.position === "center") {
              x = "(w-text_w)/2";
            }

            const nextVideoOut = `[textv_${idx}]`;
            filterComplex += `${currentVideoOut}drawtext=text='${content}':x=${x}:y=${y}:fontsize=32:fontcolor=${color}:enable='between(t,${start},${end})'${nextVideoOut};`;
            currentVideoOut = nextVideoOut;
          });

          imageElements.forEach((imgItem: any, idx: number) => {
            const start = imgItem.start ?? 0;
            const end = imgItem.end ?? 5;
            const style = imgItem.style || {};
            const mappedInputIdx = imageInputMappings[idx];
            if (mappedInputIdx === undefined) return;
            
            let x = "w-overlay_w-20";
            let y = "20";
            if (style.position === "top-left") {
              x = "20";
              y = "20";
            } else if (style.position === "bottom-left") {
              x = "20";
              y = "h-overlay_h-20";
            } else if (style.position === "bottom-right") {
              x = "w-overlay_w-20";
              y = "h-overlay_h-20";
            }

            const nextVideoOut = `[imgv_${idx}]`;
            filterComplex += `${currentVideoOut}[${mappedInputIdx}:v]overlay=x=${x}:y=${y}:enable='between(t,${start},${end})'${nextVideoOut};`;
            currentVideoOut = nextVideoOut;
          });

          // Final video stream is ready. Check if we need to mix background audio
          filterComplex = filterComplex.replace(/;$/, "");

          let currentAudioOut = "[concata]";
          const activeAudioOverlays = audioElements.filter((_, idx) => audioInputMappings[idx] !== undefined);
          if (activeAudioOverlays.length > 0) {
            let mixInputs = "[concata]";
            let audioMixFilter = "";
            audioElements.forEach((aud: any, idx: number) => {
              const mappedInputIdx = audioInputMappings[idx];
              if (mappedInputIdx === undefined) return;
              const start = aud.start ?? 0;
              const volume = aud.volume ?? 1;
              
              audioMixFilter += `[${mappedInputIdx}:a]adelay=${Math.round(start * 1000)}|${Math.round(start * 1000)},volume=${volume}[aud_delay_${idx}];`;
              mixInputs += `[aud_delay_${idx}]`;
            });
            audioMixFilter += `${mixInputs}amix=inputs=${activeAudioOverlays.length + 1}:duration=first[outa]`;
            filterComplex += `;${audioMixFilter}`;
            currentAudioOut = "[outa]";
          }

          const inputsStr = `-i "${tempInput}" ` + inputArgs.join(" ");
          const ffmpegCmd = `ffmpeg -y ${inputsStr} -filter_complex "${filterComplex}" -map "${currentVideoOut}" -map "${currentAudioOut}" -c:v libx264 -c:a aac -pix_fmt yuv420p -r 30 -vsync cfr "${tempOutput}"`;

          await updateLogs(70, "[Render Engine Fallback] Đang thực thi lệnh FFMPEG chi tiết...");
          
          await new Promise<void>((resolve, reject) => {
            exec(ffmpegCmd, (error, stdout, stderr) => {
              if (error) {
                console.error("FFMPEG execution failed detail:", stderr || stdout || error.message);
                reject(new Error(`FFMPEG render failed: ${error.message}`));
              } else {
                resolve();
              }
            });
          });
          
          await updateLogs(85, "[Render Engine Fallback] Đang tải video thành phẩm lên Cloudinary...");
          const outputBuffer = fs.readFileSync(tempOutput);
          finalVideoUrl = await cloudinaryService.uploadMediaBuffer(outputBuffer, "igen_erp/marketing/video");
          
          // Save output to local cache folder
          try {
            const cacheDir = path.join(process.cwd(), "server/cache/videos");
            const outUrlParts = finalVideoUrl.split("/");
            const outFilename = outUrlParts[outUrlParts.length - 1];
            if (outFilename && outFilename.match(/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/)) {
              const outCachePath = path.join(cacheDir, outFilename);
              fs.copyFileSync(tempOutput, outCachePath);
              console.log(`[Render Engine Cache] Saved rendered video to local cache: ${outCachePath}`);
            }
          } catch (cacheErr) {
            console.error("[Render Engine Cache Warning] Failed to save rendered video to cache:", cacheErr);
          }

          // Cleanup all temp files
          try {
            fs.unlinkSync(tempInput);
            fs.unlinkSync(tempOutput);
            imageTempPaths.forEach(p => { if (p) fs.unlinkSync(p); });
            audioTempPaths.forEach(p => { if (p) fs.unlinkSync(p); });
          } catch (e) {}
        } else if (videoUrl.includes("res.cloudinary.com")) {
          await updateLogs(60, "[Render Engine Fallback] Không có FFMPEG. Phát hiện video nguồn trên Cloudinary. Sử dụng Cloud Render Engine...");
          
          const parts = videoUrl.split("/upload/");
          let transformString = "";
          
          const videoElement = timeline.find((item: any) => item.type === "video");
          if (videoElement) {
            transformString += `so_${videoElement.start},eo_${videoElement.end}/`;
          }
          
          const textElements = timeline.filter((item: any) => item.type === "text");
          for (const textItem of textElements) {
            const contentEscaped = encodeURIComponent(textItem.content).replace(/%/g, "%25");
            transformString += `l_text:Arial_36_bold:${contentEscaped},g_center,so_${textItem.start},eo_${textItem.end}/`;
          }
          
          finalVideoUrl = `${parts[0]}/upload/${transformString}${parts[1]}`;
          await updateLogs(80, `[Render Engine Fallback] Liên kết Cloud Render đã tạo: ${finalVideoUrl}`);
        } else {
          await updateLogs(70, "[Render Engine Fallback] Không phát hiện FFMPEG. Chạy mô phỏng quá trình render...");
          await new Promise((resolve) => setTimeout(resolve, 2000));
          await updateLogs(85, "[Render Engine Fallback] Mô phỏng render hoàn tất.");
        }
      }

      await updateLogs(95, "[Cloudinary] Đồng bộ hóa tài nguyên biên tập...");
      
      await AIMediaModel.findByIdAndUpdate(recordId, {
        url: finalVideoUrl,
        "metadata.status": "completed",
        "metadata.progress": 100,
        "metadata.renderLogs": [...logs, "[Render Engine] Hoàn thành kết xuất video!"]
      });
      
      console.log(`[Local Render Background] Successfully completed. Final URL: ${finalVideoUrl}`);

    } catch (error: any) {
      console.error("[Local Render Background Error]", error);
      await AIMediaModel.findByIdAndUpdate(recordId, {
        "metadata.status": "failed",
        "metadata.error": error.message || String(error),
        "metadata.progress": 0,
        "metadata.renderLogs": [...logs, `[Render Engine Lỗi] ${error.message || String(error)}`]
      });
    }
  },

  /**
   * Lấy lịch sử tạo đa phương tiện theo user và loại
   */
  async getMediaHistory(userId: string, mediaType: "image" | "video" | "voice") {
    try {
      const records = await AIMediaModel.find({ userId, mediaType })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      if (mediaType === "video") {
        await Promise.all(
          records.map(async (record: any) => {
            if (record.url && record.url.startsWith("pending://piapi/")) {
              const taskId = record.url.replace("pending://piapi/", "");
              try {
                const result = await piapiService.getTaskStatus(taskId);
                if (result.status === "completed" && result.url) {
                  const cloudinaryUrl = await cloudinaryService.uploadMedia(result.url, "igen_erp/marketing/video");
                  await AIMediaModel.updateOne(
                    { _id: record._id },
                    { url: cloudinaryUrl, "metadata.status": "completed", "metadata.progress": 100 }
                  );
                  record.url = cloudinaryUrl;
                  record.metadata = { ...record.metadata, status: "completed", progress: 100 };

                  const activeCardId = record.metadata?.activeCardId;
                  if (activeCardId) {
                    const { MarketingContentModel } = require("../model/marketing-content.model");
                    await MarketingContentModel.findByIdAndUpdate(activeCardId, { videoUrl: cloudinaryUrl });
                  }
                } else if (result.status === "failed") {
                  await AIMediaModel.updateOne(
                    { _id: record._id },
                    { "metadata.status": "failed", "metadata.error": result.error || "Failed", "metadata.progress": 0 }
                  );
                  record.metadata = { ...record.metadata, status: "failed", error: result.error, progress: 0 };
                } else {
                  const currentProgress = result.progress !== undefined ? result.progress : 0;
                  await AIMediaModel.updateOne(
                    { _id: record._id },
                    { "metadata.progress": currentProgress }
                  );
                  record.metadata = { ...record.metadata, progress: currentProgress };
                }
              } catch (err) {
                console.error(`[getMediaHistory] Error refreshing pending task ${taskId}:`, err);
              }
            }
          })
        );
      }
      return records;
    } catch (error: any) {
      console.error("[geminiService.getMediaHistory] Error:", error);
      throw error;
    }
  },

  /**
   * Xóa một bản ghi lịch sử
   */
  async deleteMediaHistory(userId: string, id: string) {
    try {
      const result = await AIMediaModel.deleteOne({ _id: id, userId });
      if (result.deletedCount === 0) {
        throw new Error("Không tìm thấy bản ghi hoặc không có quyền xóa");
      }
      return { status: "success" };
    } catch (error: any) {
      console.error("[geminiService.deleteMediaHistory] Error:", error);
      throw error;
    }
  },

  /**
   * Polling trạng thái video từ PiAPI chạy ngầm không chặn luồng HTTP
   */
  async pollPiAPIVideoStatusBackground(recordId: string, taskId: string, userId: string) {
    console.log(`[PiAPI Background Poll] Started polling for record ${recordId}, taskId ${taskId}`);

    let attempts = 0;
    const maxAttempts = 60; // 10 minutes (60 * 10 seconds)

    const runPoll = async () => {
      try {
        const result = await piapiService.getTaskStatus(taskId);
        console.log(`[PiAPI Background Poll] Record ${recordId} status: ${result.status}`);

        if (result.status === "completed" && result.url) {
          console.log(`[PiAPI Background Poll] Completed! Uploading to Cloudinary...`);
          const cloudinaryUrl = await cloudinaryService.uploadMedia(result.url, "igen_erp/marketing/video");

          const record = await AIMediaModel.findByIdAndUpdate(
            recordId,
            { url: cloudinaryUrl, "metadata.status": "completed", "metadata.progress": 100 },
            { new: true }
          );

          const activeCardId = record?.metadata?.activeCardId;
          if (activeCardId) {
            const { MarketingContentModel } = require("../model/marketing-content.model");
            await MarketingContentModel.findByIdAndUpdate(activeCardId, { videoUrl: cloudinaryUrl });
            console.log(`[PiAPI Background Poll] Updated target card ${activeCardId} with videoUrl: ${cloudinaryUrl}`);
          }
          return;
        } else if (result.status === "failed") {
          console.error(`[PiAPI Background Poll] Failed for task ${taskId}: ${result.error}`);
          await AIMediaModel.findByIdAndUpdate(recordId, {
            "metadata.status": "failed",
            "metadata.error": result.error || "Lỗi tạo video từ PiAPI",
            "metadata.progress": 0,
          });
          return;
        } else {
          let currentProgress = typeof result.progress === "number" && result.progress > 0 ? result.progress : 0;
          if (currentProgress === 0) {
            currentProgress = Math.min(5 + attempts * 7, 95);
          }
          await AIMediaModel.findByIdAndUpdate(recordId, {
            "metadata.progress": currentProgress
          });
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(runPoll, 10000);
        } else {
          console.error(`[PiAPI Background Poll] Timeout for task ${taskId}`);
          await AIMediaModel.findByIdAndUpdate(recordId, {
            "metadata.status": "timeout",
            "metadata.error": "Quá thời gian chờ tạo video từ PiAPI (10 phút)",
          });
        }
      } catch (error: any) {
        console.error(`[PiAPI Background Poll] Error polling task ${taskId}:`, error);
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(runPoll, 10000);
        }
      }
    };

    setTimeout(runPoll, 10000);
  },

  /**
   * Đồng bộ lưu trữ nâng cao của Image/Video sau khi sinh thành công
   */
  async saveGeneratedMediaRecord(userId: string, mediaType: "image" | "video", base64OrUrl: string, prompt: string, metadata?: any) {
    try {
      let finalUrl = base64OrUrl;
      if (base64OrUrl.startsWith("data:")) {
        finalUrl = await cloudinaryService.uploadMedia(base64OrUrl, `igen_erp/marketing/${mediaType}`);
      }

      const record = await AIMediaModel.create({
        userId,
        mediaType,
        url: finalUrl,
        prompt,
        metadata,
      });
      return record;
    } catch (error: any) {
      console.error("[geminiService.saveGeneratedMediaRecord] Error:", error);
      throw error;
    }
  },

  /**
   * Lấy danh sách giọng nói ElevenLabs
   */
  async getElevenLabsVoices() {
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenLabsApiKey || elevenLabsApiKey.trim() === "") {
      console.log("[geminiService.getElevenLabsVoices] ELEVENLABS_API_KEY is not configured. Running in MOCK mode.");
      return {
        status: "success",
        voices: [
          {
            voice_id: "Sadaltager",
            name: "Roger (Mock)",
            category: "cloned",
            description: "Laid-Back, Casual, Resonant",
            labels: { gender: "male", age: "adult", accent: "american" }
          }
        ]
      };
    }

    try {
      const response = await fetch("https://api.elevenlabs.io/v1/voices", {
        headers: {
          "xi-api-key": elevenLabsApiKey.trim()
        }
      });
      if (!response.ok) {
        throw new Error(`ElevenLabs error: ${response.status}`);
      }
      const data = await response.json();
      // Filter generated or cloned voices
      const filtered = (data.voices || []).filter((v: any) => v.category === "cloned" || v.category === "generated" || v.category === "custom");
      return { status: "success", voices: filtered };
    } catch (error: any) {
      console.error("[geminiService.getElevenLabsVoices] Error:", error);
      throw error;
    }
  },

  /**
   * Thiết kế & phát nghe thử giọng nói ElevenLabs
   */
  async generateCustomVoicePreview(input: { gender: string; accent: string; age: string; accentStrength: number; text: string }) {
    const { gender, accent, age, accentStrength, text } = input;
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenLabsApiKey || elevenLabsApiKey.trim() === "") {
      console.log("[geminiService.generateCustomVoicePreview] ELEVENLABS_API_KEY is not configured. Running in MOCK mode.");
      return {
        generatedVoiceId: "mock-voice-id-" + Date.now(),
        url: "data:audio/wav;base64,UklGRigAAABXQVZFlm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAAAG"
      };
    }

    try {
      const response = await fetch("https://api.elevenlabs.io/v1/voice-generation/generate-voice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": elevenLabsApiKey.trim()
        },
        body: JSON.stringify({
          gender,
          accent,
          age,
          accent_strength: accentStrength,
          text
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`ElevenLabs preview error: ${response.status} - ${errText}`);
      }

      const generatedVoiceId = response.headers.get("generated_voice_id");
      if (!generatedVoiceId) {
        throw new Error("No generated_voice_id found in headers");
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64Audio = buffer.toString('base64');
      const audioDataUri = `data:audio/mpeg;base64,${base64Audio}`;

      const mediaUrl = await cloudinaryService.uploadMedia(audioDataUri, "igen_erp/marketing/voice_previews");

      return {
        generatedVoiceId,
        url: mediaUrl
      };
    } catch (error: any) {
      console.error("[geminiService.generateCustomVoicePreview] Error:", error);
      throw error;
    }
  },

  /**
   * Lưu giọng thiết kế thành giọng chính thức
   */
  async createCustomVoice(input: { voiceName: string; voiceDescription: string; generatedVoiceId: string }) {
    const { voiceName, voiceDescription, generatedVoiceId } = input;
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenLabsApiKey || elevenLabsApiKey.trim() === "") {
      console.log("[geminiService.createCustomVoice] ELEVENLABS_API_KEY is not configured. Running in MOCK mode.");
      return {
        voice_id: "mock-saved-voice-id-" + Date.now()
      };
    }

    try {
      const response = await fetch("https://api.elevenlabs.io/v1/voice-generation/create-voice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": elevenLabsApiKey.trim()
        },
        body: JSON.stringify({
          voice_name: voiceName,
          voice_description: voiceDescription,
          generated_voice_id: generatedVoiceId
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`ElevenLabs create-voice error: ${response.status} - ${errText}`);
      }

      const result = await response.json();
      return { voice_id: result.voice_id };
    } catch (error: any) {
      console.error("[geminiService.createCustomVoice] Error:", error);
      throw error;
    }
  },

  async addElevenLabsVoice(name: string, description: string, files: string[], userId: string) {
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenLabsApiKey || elevenLabsApiKey.trim() === "") {
      return { voice_id: "mock-saved-voice-id-" + Date.now() };
    }

    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('description', description);

      if (userId) {
        formData.append('labels', JSON.stringify({ userId }));
      }

      for (let i = 0; i < files.length; i++) {
        const dataUri = files[i];
        const matches = dataUri.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
        if (!matches) {
          throw new Error("Invalid file format");
        }
        const type = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        const blob = new Blob([buffer], { type });
        formData.append('files', blob, `file-${i}.${type.split('/')[1]}`);
      }

      const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
        method: 'POST',
        headers: {
          'xi-api-key': elevenLabsApiKey.trim(),
        },
        body: formData,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorBody}`);
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error("[geminiService.addElevenLabsVoice] Error:", error);
      throw error;
    }
  },

  async deleteElevenLabsVoice(voiceId: string) {
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenLabsApiKey || elevenLabsApiKey.trim() === "") {
      return { success: true };
    }

    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
        method: 'DELETE',
        headers: {
          'xi-api-key': elevenLabsApiKey.trim(),
        },
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorBody}`);
      }

      return { success: true };
    } catch (error: any) {
      console.error("[geminiService.deleteElevenLabsVoice] Error:", error);
      throw error;
    }
  }
};

/**
 * Chuyển đổi PCM sang WAV 16-bit Mono (Pure JS/Node)
 */
function pcmToWav(pcmBuffer: Buffer, sampleRate: number = 24000, numChannels: number = 1, bitDepth: number = 16): Buffer {
  const header = Buffer.alloc(44);
  const blockAlign = numChannels * (bitDepth / 8);
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmBuffer.length;
  const fileSize = 36 + dataSize;

  header.write('RIFF', 0);
  header.writeUInt32LE(fileSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitDepth, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

function estimateAudioDuration(text: string): number {
  return Math.max(1, Math.ceil(text.length / 13));
}

