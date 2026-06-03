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

  // Automatically analyze target objectives and generate core content pillars via AI
  app.post("/api/gemini/marketing-pillars", async (req, res) => {
    const { campaignTopic } = req.body;
    const client = getGeminiClient();

    if (!client) {
      // High-quality contextual Vietnamese mock content pillars
      let mockPillars = [
        {
          id: "giao_duc_gia_tri",
          title: "Giáo dục & Giá trị hữu ích",
          ratio: "35% tỉ trọng",
          description: `Giải đáp trực quan, hướng dẫn tối ưu và chia sẻ kiến thức nền tảng giúp khách hàng hiểu sâu về giá trị dòng sản phẩm liên quan "${campaignTopic || "Sản phẩm công nghệ"}".`
        },
        {
          id: "cau_chuyen_social_proof",
          title: "Trải nghiệm & Câu chuyện thực tế",
          ratio: "40% tỉ trọng",
          description: `Kịch bản review thực tế, kết quả và phát biểu từ khách hàng uy tín, tạo dựng lòng tin tuyệt đối cho thương hiệu.`
        },
        {
          id: "uu_dai_tuong_tac",
          title: "Ưu đãi & Kích cầu hành động",
          ratio: "25% tỉ trọng",
          description: "Chiến dịch giờ vàng, đặc quyền dùng thử hoặc voucher độc quyền nhằm thúc giục khách hàng ra quyết định mua sắm ngay lập tức."
        }
      ];

      const topicLower = campaignTopic ? campaignTopic.toLowerCase() : "";
      if (topicLower.includes("bàn phím") || topicLower.includes("keyboard") || topicLower.includes("workspace")) {
        mockPillars = [
          {
            id: "kien_thuc_cong_thai_hoc",
            title: "Kiến thức & Trải nghiệm Công thái học",
            ratio: "35% tỉ trọng",
            description: "Hướng dẫn tư thế ngồi gõ phím chuẩn khoa học, cách test switch phím cơ, mẹo lập trình không mỏi tay cho coder chuyên nghiệp."
          },
          {
            id: "review_coder_thuc_te",
            title: "Đánh giá & Trải nghiệm Lập trình viên",
            ratio: "40% tỉ trọng",
            description: "Cảm âm đầm chắc của iGen Workspace V2, quá trình tăng 150% hiệu suất viết mã của kiến trúc sư phần mềm."
          },
          {
            id: "uu_dai_ra_mat",
            title: "Ưu đãi đặc quyền Early Bird",
            ratio: "25% tỉ trọng",
            description: "Quà tặng kệ kê tay gỗ sồi cao cấp và chiết khấu 10% ra mắt độc quyền dành cho 50 khách hàng đầu tiên."
          }
        ];
      } else if (topicLower.includes("tai nghe") || topicLower.includes("nghe nhạc") || topicLower.includes("pro max")) {
        mockPillars = [
          {
            id: "am_thanh_bao_ve_tai",
            title: "Khoa học Âm thanh & Sức khỏe tai",
            ratio: "30% tỉ trọng",
            description: "Nguyên lý hoạt động của chống ồn chủ động ANC và cách bảo vệ thính lực khi đeo tai nghe cường độ cao thường xuyên."
          },
          {
            id: "phong_cach_unboxing",
            title: "Đập hộp & Định hình Phong cách sống",
            ratio: "45% tỉ trọng",
            description: "Phối đồ thời trang dạo phố sành điệu cùng Pro Max, tạo phong thái năng động tự tin cho giới trẻ công nghệ."
          },
          {
            id: "uu_dai_gio_vang",
            title: "Flash Sale giờ vàng - Săn cực đỉnh",
            ratio: "25% tỉ trọng",
            description: "Cơ hội săn deal giảm giá sốc đến 45% độc quyền trong khung giờ trưa từ 12h - 14h, số lượng cực hạn."
          }
        ];
      } else if (topicLower.includes("vip") || topicLower.includes("voucher") || topicLower.includes("tri ân")) {
        mockPillars = [
          {
            id: "dac_quyen_thanh_vien",
            title: "Giá trị đặc quyền Tri ân",
            ratio: "35% tỉ trọng",
            description: "Chi tiết đặc quyền thăng hạng thẻ, chính sách bảo hành trọn đời và tích điểm đổi quà VIP của hệ sinh thái iGen."
          },
          {
            id: "cau_chuyen_thanh_cong",
            title: "Khoảnh khắc & Khách hàng VIP",
            ratio: "40% tỉ trọng",
            description: "Ghi dấu những bức ảnh, cuộc hẹn và cảm ơn chân thành từ iGen ERP tới các đối tác doanh nghiệp lớn đồng hành lâu năm."
          },
          {
            id: "uu_dai_han_muc",
            title: "Quà tặng và Voucher VIP độc bản",
            ratio: "25% tỉ trọng",
            description: "Gửi mã voucher VIP-10 độc bá kèm hộp quà tặng chạm khắc thủ công đặc biệt thiết kế riêng cho khách hàng VIP."
          }
        ];
      }

      setTimeout(() => {
        res.json({ pillars: mockPillars, isMock: true });
      }, 700);
      return;
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

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              pillars: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING, description: "ID ngắn gọn viết liền không dấu, ví dụ: 'giao_duc'" },
                    title: { type: Type.STRING, description: "Tiêu đề tiếng Việt của trụ cột nội dung" },
                    ratio: { type: Type.STRING, description: "Tỉ trọng phân bổ, ví dụ: '35% tỉ trọng'" },
                    description: { type: Type.STRING, description: "Hướng dẫn đề xuất triển khai chi tiết đối với chủ đề" }
                  },
                  required: ["id", "title", "ratio", "description"]
                },
                description: "Danh sách đúng 3 trụ cột nội dung"
              }
            },
            required: ["pillars"]
          }
        }
      });

      const responseText = response.text || "{}";
      const parsedData = JSON.parse(responseText.trim());
      res.json({ pillars: parsedData.pillars || [], isMock: false });
    } catch (error: any) {
      console.error("Gemini Marketing Pillars API Error:", error);
      res.status(500).json({ error: "Lỗi kết nối AI Marketing Pillars", details: error.message });
    }
  });

  // Marketing campaign ideation proxy
  app.post("/api/gemini/marketing-ideas", async (req, res) => {
    const { campaignTopic, selectedPillars } = req.body;
    const client = getGeminiClient();

    const pillarsStr = selectedPillars && selectedPillars.length > 0 
      ? `(Định hướng Trụ cột nội dung: ${selectedPillars.join(", ")})` 
      : "";

    if (!client) {
      // Simulated Campaign Ideas if no API key
      setTimeout(() => {
        const dummyResponse = {
          concepts: [
            {
              title: `Chiến dịch: Chạm Đột Phá - ${campaignTopic || "Mua Sắm Cuối Năm"}`,
              matchPercent: 95,
              summary: `Đột phá doanh số nhắm vào đối tượng trẻ tuổi. ${pillarsStr ? `Tập trung sâu vào định hướng truyền thông từ các trụ cột lựa chọn: ${selectedPillars.join(", ")}.` : "Tạo lối sống trải nghiệm công nghệ đeo và phong cách sống lành mạnh."}`,
              channels: ["Tiktok Video", "Influencer Review", "Meta App ads"],
              suggestedContent: "🎬 Kịch bản Tiktok: Biến đổi phong cách thường ngày thành phong cách năng động thể thao chỉ sau 1 cái chạm màn hình X1."
            },
            {
              title: `Trải nghiệm Đỉnh Cao - Tri Ân Hội Viên`,
              matchPercent: 88,
              summary: `Quảng bá giá trị cốt lõi bền vững thông qua chuỗi bài viết phỏng vấn các đối tác trung thành thực tế đang nâng tầm công việc cùng Workspace V2. ${pillarsStr ? `Điều phối theo: ${selectedPillars.join(", ")}.` : ""}`,
              channels: ["Facebook Post", "Email Newsletter", "LinkedIn Article"],
              suggestedContent: "✍️ Facebook Post: 'Gặp gỡ anh Hùng, Giám đốc Sáng tạo, người đã nâng cấp 200% tốc độ gõ nhờ Bàn phím cơ Workspace V2...'"
            },
            {
              title: `Giờ Vàng Giá Sốc - Săn Độc Quyền AI`,
              matchPercent: 78,
              summary: `Tạo sự gấp rút bằng tính năng đếm ngược flash sale được quản lý tự động bởi thuật toán đề xuất của iGen ERP. ${pillarsStr ? `Kế thừa ý tưởng từ các Content Pillar được cấu hình: ${selectedPillars.join(", ")}.` : ""}`,
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
      const pillarsContext = selectedPillars && selectedPillars.length > 0
        ? `\nCác Trụ cột nội dung (Content Pillars) bắt buộc phải tích hợp và bám sát: ${selectedPillars.join(", ")}. Hãy sáng tạo các ý tưởng tập trung xoay quanh các trụ cột này.`
        : "";

      const prompt = `Hãy tạo 3 ý tưởng/bản nháp chiến dịch marketing chi tiết cho chủ đề/chiến dịch này: "${campaignTopic}".${pillarsContext}
Mỗi bản nháp phải có thông tin:
1. title: Tiêu đề chiến dịch sáng tạo
2. matchPercent: Độ tương thích thương hiệu (%) (đại lượng số nguyên từ 70 đến 98)
3. summary: Tóm tắt ý tưởng cốt lõi, trong đó có nêu rõ sự kết hợp với các trụ cột nội dung đã chọn.
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
