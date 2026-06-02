import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const PORT = 3000;

// Lazy instantiation of GoogleGenAI to prevent start crashes if GEMINI_API_KEY is missing
let aiInstance: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiInstance) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn("⚠️ GEMINI_API_KEY is not configured in environment. AI features will fallback to smart simulated responses.");
      return null;
    }
    aiInstance = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // --- API Routes ---

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", mode: process.env.NODE_ENV || "development" });
  });

  // Omni-Inbox AI response proxy
  app.post("/api/gemini/chat", async (req, res) => {
    const { message, history, aiConfig } = req.body;
    const client = getGeminiClient();

    if (!client) {
      // Return beautiful smart simulated replies if no API key
      setTimeout(() => {
        let replyText = `[Simulated AI Assistant] Cảm ơn bạn đã liên hệ! Với vai trò là Trợ lý AI (Cấu hình: ${aiConfig.autoClassify ? "Tự phân loại" : "Thông thường"}), tôi khuyên dùng giải pháp tối ưu cho nhu cầu của bạn.`;
        if (message.toLowerCase().includes("giá") || message.toLowerCase().includes("bao nhiêu")) {
          replyText = "Chào bạn! Hiện tại dòng sản phẩm Thiết bị đeo thông minh X1 đang có giá ưu đãi là 1.890.000đ (giảm từ 2.450.000đ). Trợ lý AI có thể hỗ trợ tạo đơn hàng ngay lập tức nếu bạn sẵn sàng!";
        } else if (message.toLowerCase().includes("khuyến mãi") || message.toLowerCase().includes("ưu đãi")) {
          replyText = "Dạ, bên mình đang có chương trình khuyến mãi 'SIÊU ƯU ĐÃI THÁNG 10': giảm giá lên đến 30% cho toàn bộ linh kiện robot và tặng voucher 200k cho đơn hàng sau đó. Bạn có muốn nhận mã voucher không ạ?";
        } else if (message.toLowerCase().includes("vận chuyển") || message.toLowerCase().includes("ship")) {
          replyText = "Đơn hàng của bạn sẽ được hỗ trợ Freeship toàn quốc cho các hóa đơn từ 500k trở lên. Thời gian giao hàng dự kiến là từ 2-3 ngày làm việc đối với khu vực tỉnh thành khác, Hà Nội/HCM sẽ nhận hàng trong ngày ạ!";
        }
        res.json({ text: replyText, isMock: true });
      }, 800);
      return;
    }

    try {
      // Build systemic guidelines based on config
      const systemInstruction = `
Bạn là một Trợ lý Chăm sóc Khách hàng AI đỉnh cao cho hệ thống iGen ERP doanh nghiệp.
Bạn đang hỗ trợ khách hàng trong khung chat Omni-Inbox.
Thông tin cấu hình hiện tại của bạn:
- Tự động phân loại khách hàng: ${aiConfig.autoClassify ? "Đang BẬT. Hãy phân loại khách dựa trên xu hướng hội thoại và thông báo khéo léo." : "Đang TẮT"}
- Tự động chốt đơn hàng: ${aiConfig.autoCloseDeal ? "Đang BẬT. Hãy tìm cơ hội khéo léo hướng khách hàng chốt mua sản phẩm một cách nhanh gọn, gửi thông tin tạo đơn." : "Đang TẮT"}
- Tự động xin feedback cuối hội thoại: ${aiConfig.autoFeedback ? "Đang BẬT. Nếu cuộc đối thoại đi đến hồi kết, hãy lịch sự xin ý kiến đánh giá chất lượng dịch vụ." : "Đang TẮT"}
- Hãy trả lời bằng tiếng Việt lịch sự, thân thiện, chuyên nghiệp, súc tích và sử dụng các đại từ xưng hô phù hợp như "dạ", "ạ", "mình", "quý khách".
- Với Nguyễn Thị Mai (khách VIP): hãy đối xử cực kỳ chu đáo, tặng voucher riêng VIP-10 nếu có ý than phiền hoặc hỏi giá.
`;

      // Build contents array for GenerateContent
      const contents = history.map((h: any) => ({
        role: h.sender === "user" ? "user" : "model",
        parts: [{ text: h.text }],
      }));

      // Append current message
      contents.push({
        role: "user",
        parts: [{ text: message }],
      });

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents,
        config: {
          systemInstruction,
          temperature: 0.8,
        },
      });

      const text = response.text || "Xin lỗi, tôi chưa thể trả lời lúc này. Xin quý khách vui lòng thử lại.";
      res.json({ text, isMock: false });
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: "Lỗi kết nối AI Assistant", details: error.message });
    }
  });

  // Marketing campaign ideation proxy
  app.post("/api/gemini/marketing-ideas", async (req, res) => {
    const { campaignTopic } = req.body;
    const client = getGeminiClient();

    if (!client) {
      // Simulated Campaign Ideas if no API key
      setTimeout(() => {
        const dummyResponse = {
          concepts: [
            {
              title: `Chiến dịch: Chạm Đột Phá - ${campaignTopic || "Mua Sắm Cuối Năm"}`,
              matchPercent: 95,
              summary: "Đột phá doanh số bằng cách nhắm vào nhóm khách hàng trẻ tuổi, tạo xu hướng trải nghiệm công nghệ đeo và phong cách sống lành mạnh.",
              channels: ["Tiktok Video", "Influencer Review", "Meta App ads"],
              suggestedContent: "🎬 Kịch bản Tiktok: Biến đổi phong cách thường ngày thành phong cách năng động thể thao chỉ sau 1 cái chạm màn hình X1."
            },
            {
              title: `Trải nghiệm Đỉnh Cao - Tri Ân Hội Viên`,
              matchPercent: 88,
              summary: "Quảng bá giá trị cốt lõi bền vững thông qua chuỗi bài viết phỏng vấn các khách hàng trung thành thực tế đang nâng tầm công việc cùng Workspace V2.",
              channels: ["Facebook Post", "Email Newsletter", "LinkedIn Article"],
              suggestedContent: "✍️ Facebook Post: 'Gặp gỡ anh Hùng, Giám đốc Sáng tạo, người đã nâng cấp 200% tốc độ gõ nhờ Bàn phím cơ Workspace V2...'"
            },
            {
              title: `Giờ Vàng Giá Sốc - Săn Độc Quyền AI`,
              matchPercent: 78,
              summary: "Tạo sự gấp rút bằng tính năng đếm ngược flash sale được quản lý tự động bởi thuật toán đề xuất của iGen ERP.",
              channels: ["Instagram Story", "Zalo OA Broadcast"],
              suggestedContent: "🔥 Tin nhắn Zalo: 'Duy nhất hôm nay! Giờ vàng từ 12h-14h, giảm giá 30% toàn bộ tai nghe Không dây Pro Max. Đặt ngay!'"
            }
          ]
        };
        res.json({ concepts: dummyResponse.concepts, isMock: true });
      }, 1000);
      return;
    }

    try {
      const prompt = `Hãy tạo 3 ý tưởng/bản nháp chiến dịch marketing chi tiết cho chủ đề/chiến dịch này: "${campaignTopic}".
Mỗi bản nháp phải có thông tin:
1. title: Tiêu đề chiến dịch
2. matchPercent: Độ tương thích thương hiệu (%) (đại lượng số nguyên từ 70 đến 98)
3. summary: Tóm tắt ý tưởng cốt lõi
4. channels: Các kênh đề xuất đăng tải (mảng string, ví dụ: ["TikTok", "Facebook", "LinkedIn"])
5. suggestedContent: Bài viết mẫu hoặc kịch bản mẫu ngắn gọn từ AI Copywriter.

Trả về kết quả ở định dạng JSON phù hợp chính xác với cấu trúc yêu cầu.`;

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              concepts: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING, description: "Tên chiến dịch sáng tạo" },
                    matchPercent: { type: Type.INTEGER, description: "Phần trăm tương ứng độ phù hợp" },
                    summary: { type: Type.STRING, description: "Tóm tắt ngắn gọn phân tích" },
                    channels: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: "Các kênh phân phối"
                    },
                    suggestedContent: { type: Type.STRING, description: "Mẫu nội dung cụ thể viết sẵn từ AI" }
                  },
                  required: ["title", "matchPercent", "summary", "channels", "suggestedContent"]
                }
              }
            },
            required: ["concepts"]
          }
        }
      });

      const responseText = response.text || "{}";
      const parsedData = JSON.parse(responseText.trim());
      res.json({ concepts: parsedData.concepts || [], isMock: false });
    } catch (error: any) {
      console.error("Gemini Marketing Tool API Error:", error);
      res.status(500).json({ error: "Lỗi kết nối AI Marketing Tool", details: error.message });
    }
  });

  // --- Vite & Production static file server ---

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server running on http://localhost:${PORT}`);
  });
}

startServer();
