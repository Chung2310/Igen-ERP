import { Type } from "@google/genai";
import { getGeminiClient } from "../config/gemini";

export const geminiService = {
  /**
   * Trợ lý Chat CRM Omni-Inbox
   */
  async chat(message: string, history: any[], aiConfig: any): Promise<{ text: string; isMock: boolean }> {
    const client = getGeminiClient();

    if (!client) {
      // Logic giả lập phản hồi của tổng đài viên AI
      return new Promise((resolve) => {
        setTimeout(() => {
          let replyText = `[Giả lập Trợ lý AI] Cảm ơn bạn đã phản hồi! Với cài đặt Trợ lý AI (Cấu hình: ${
            aiConfig.autoClassify ? "Tự phân loại" : "Thường"
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
    }

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

    const contents = history.map((h: any) => ({
      role: h.sender === "user" ? "user" : "model",
      parts: [{ text: h.text }],
    }));

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

    return {
      text: response.text || "Xin lỗi, tôi chưa thể xử lý yêu cầu lúc này. Vui lòng thử lại.",
      isMock: false,
    };
  },

  /**
   * Tạo 3 gợi ý chủ đề marketing chung
   */
  async getMarketingSuggestions(): Promise<string[]> {
    const client = getGeminiClient();

    if (!client) {
      return [
        "Chiến dịch tri ân khách hàng thân thiết và tặng quà tri ân kỷ niệm thành lập",
        "Chương trình khuyến mãi mùa hè giảm giá cực sốc kích cầu mua sắm",
        "Sự kiện ra mắt dòng sản phẩm mới hướng tới phong cách sống xanh bảo vệ môi trường",
      ];
    }

    const prompt = `Bạn là trợ lý AI Marketing chuyên nghiệp. Hãy đề xuất đúng 3 ý tưởng/chủ đề chiến dịch marketing chung, mang tính phổ quát cao để nhiều loại hình doanh nghiệp hoặc công ty khác nhau đều có thể áp dụng được (ví dụ: chiến dịch khuyến mãi theo mùa, sự kiện tri ân khách hàng, ra mắt dòng sản phẩm mới, chương trình ưu đãi đặc biệt).
Mỗi ý tưởng đề xuất phải là một câu ngắn gọn (dưới 25 từ) sẵn sàng làm mục tiêu marketing, ví dụ: 'Chiến dịch tri ân khách hàng thân thiết và tặng quà tri ân'.
Trả về kết quả ở định dạng JSON phù hợp chính xác với cấu trúc yêu cầu.`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
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
      },
    });

    const responseText = response.text || "{}";
    const parsedData = JSON.parse(responseText.trim());
    return parsedData.suggestions || [];
  },

  /**
   * Đề xuất Content Pillars
   */
  async analyzeMarketingPillars(campaignTopic: string): Promise<{ pillars: any[]; isMock: boolean }> {
    const client = getGeminiClient();

    if (!client) {
      let mockPillars = [
        {
          id: "giao_duc_gia_tri",
          title: "Giáo dục & Giá trị hữu ích",
          ratio: "35% tỉ trọng",
          description: `Giải đáp trực quan, hướng dẫn tối ưu và chia sẻ kiến thức nền tảng giúp khách hàng hiểu sâu về giá trị dòng sản phẩm liên quan "${
            campaignTopic || "Sản phẩm công nghệ"
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

      return { pillars: mockPillars, isMock: true };
    }

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
      },
    });

    const responseText = response.text || "{}";
    const parsedData = JSON.parse(responseText.trim());
    return { pillars: parsedData.pillars || [], isMock: false };
  },

  /**
   * Phát sinh bản nháp ý tưởng chiến dịch
   */
  async generateMarketingIdeas(
    campaignTopic: string,
    selectedPillars: string[]
  ): Promise<{ concepts: any[]; isMock: boolean }> {
    const client = getGeminiClient();

    const pillarsStr =
      selectedPillars && selectedPillars.length > 0
        ? `(Định hướng Trụ cột nội dung: ${selectedPillars.join(", ")})`
        : "";

    if (!client) {
      const concepts = [
        {
          title: `Chiến dịch: Chạm Đột Phá - ${campaignTopic || "Mua Sắm Cuối Năm"}`,
          matchPercent: 95,
          summary: `Đột phá doanh số nhắm vào đối tượng trẻ tuổi. ${
            pillarsStr
              ? `Tập trung sâu vào định hướng truyền thông từ các trụ cột lựa chọn: ${selectedPillars.join(", ")}.`
              : "Tạo lối sống trải nghiệm công nghệ đeo và phong cách sống lành mạnh."
          }`,
          channels: ["TikTok", "Facebook", "LinkedIn"],
          suggestedContent:
            "🎬 Kịch bản Tiktok: Biến đổi phong cách thường ngày thành phong cách năng động thể thao chỉ sau 1 cái chạm màn hình X1.",
          hashtags: ["#iGenX1", "#SmartWearable", "#NangTamCuocSong"],
        },
        {
          title: `Trải nghiệm Đỉnh Cao - Tri Ân Hội Viên`,
          matchPercent: 88,
          summary: `Quảng bá giá trị cốt lõi bền vững thông qua chuỗi bài viết phỏng vấn các đối tác trung thành thực tế đang nâng tầm công việc cùng Workspace V2. ${
            pillarsStr ? `Điều phối theo: ${selectedPillars.join(", ")}.` : ""
          }`,
          channels: ["Facebook", "LinkedIn"],
          suggestedContent:
            "✍️ Facebook Post: 'Gặp gỡ anh Hùng, Giám đốc Sáng tạo, người đã nâng cấp 200% tốc độ gõ nhờ Bàn phím cơ Workspace V2...'",
          hashtags: ["#WorkspaceV2", "#KeyboardMechanic", "#TangHieuSuat"],
        },
        {
          title: `Giờ Vàng Giá Sốc - Săn Độc Quyền AI`,
          matchPercent: 78,
          summary: `Tạo sự gấp rút bằng tính năng đếm ngược flash sale được quản lý tự động bởi thuật toán đề xuất của iGen ERP. ${
            pillarsStr ? `Kế thừa ý tưởng từ các Content Pillar được cấu hình: ${selectedPillars.join(", ")}.` : ""
          }`,
          channels: ["Facebook", "Instagram"],
          suggestedContent:
            "🔥 Tin nhắn Zalo: 'Duy nhất hôm nay! Giờ vàng từ 12h-14h, giảm giá 30% toàn bộ tai nghe Không dây Pro Max. Đặt ngay!'",
          hashtags: ["#FlashSale", "#TaiNgheProMax", "#AmThanhDinhCao"],
        },
      ];
      return { concepts, isMock: true };
    }

    const pillarsContext =
      selectedPillars && selectedPillars.length > 0
        ? `\nCác Trụ cột nội dung (Content Pillars) bắt buộc phải tích hợp và bám sát: ${selectedPillars.join(
            ", "
          )}. Hãy sáng tạo các ý tưởng tập trung xoay quanh các trụ cột này.`
        : "";

    const prompt = `Hãy tạo 3 ý tưởng/bản nháp chiến dịch marketing chi tiết cho chủ đề/chiến dịch này: "${campai  async developMarketingIdea(
    title: string,
    summary: string,
    suggestedContent: string,
    channels: string[]
  ): Promise<{ posts: any[]; isMock: boolean }> {
    const client = getGeminiClient();
    const targetChannels = Array.isArray(channels) ? channels : ["Facebook"];

    if (!client) {
      const mockPosts = targetChannels.map((chan) => {
        let contentType = "Bài viết truyền thông";
        let bodyText = "";
        let outline = "";
        if (chan === "Facebook") {
          contentType = "Hình ảnh kèm Caption";
          outline = `📋 DÀN Ý CHI TIẾT (OUTLINE):\n1. Hình ảnh: Ảnh flatlay thiết bị sang trọng trên bàn làm việc hiện đại.\n2. Tiêu đề: Đọc vị phong cách - Chọn ${title}.\n3. Nội dung chính: Giải quyết vấn đề mỏi tay, tăng tốc gõ và tối ưu hóa không gian làm việc.\n4. Call to Action: Đăng ký nhận ưu đãi 10% ra mắt.`;
          bodyText = `🔥 BẬT PHONG CÁCH - NHÂN HIỆU SUẤT CÙNG ${title}! 🔥\n\nBạn có biết 90% hiệu suất làm việc phụ thuộc vào sự thoải mái của thiết bị đồng hành? Với chiến dịch ${summary}, chúng tôi mang đến giải pháp tối ưu cho bạn:\n👉 Thiết kế công thái học tinh tế.\n👉 Tăng tốc độ phản hồi phím gõ lên 150%.\n👉 Quà tặng kèm kê tay gỗ sồi đặc quyền.\n\n💡 Ý tưởng cốt lõi: "${suggestedContent}"\n\n📥 Nhắn tin ngay cho iGen để nhận deal hời! #iGenERP #WorkspaceV2 #CongNgheSo #Success`;
        } else if (chan === "TikTok") {
          contentType = "Kịch bản Video ngắn 15s-30s";
          outline = `📋 DÀN Ý CHI TIẾT (OUTLINE):\n1. 0-3s: Hook so sánh tư thế làm việc gù lưng/mỏi tay với tư thế chuẩn.\n2. 3-10s: Show cận cảnh thiết kế sang trọng & âm thanh gõ phím đầm chắc.\n3. 10-15s: Kêu gọi hành động nhấp vào giỏ hàng.`;
          bodyText = `🎬 [KỊCH BẢN TIKTOK: CỨU TINH DEADLINE]\n\n[Cảnh 1 - 0-3s]: Cận cảnh lập trình viên mệt mỏi, gõ phím rít kẹt kêu lọc cọc. Nhạc nền trầm buồn.\n- Text: "Khi deadline đến mà bàn phím lại phản chủ..."\n\n[Cảnh 2 - 3-10s]: Chuyển cảnh cực nhanh! Bàn tay đặt lên bàn phím ${title}. Ánh sáng lung linh, tiếng clicky giòn giã kích thích thính giác. Nhạc chuyển sôi động.\n- Voiceover: "Nâng cấp năng suất cùng Workspace V2 với ý tưởng: ${summary}"\n\n[Cảnh 3 - 10-15s]: Chỉ tay về phía giỏ hàng TikTok Shop.\n- Voiceover: "Nhận voucher giảm giá 45% ngay hôm nay!"`;
        } else if (chan === "LinkedIn") {
          contentType = "Bài viết chuyên sâu (Article)";
          outline = `📋 DÀN Ý CHI TIẾT (OUTLINE):\n1. Đặt vấn đề: Xu hướng chuyển đổi số và nâng cao năng suất doanh nghiệp.\n2. Phân tích: Vai trò của thiết bị chuẩn công thái học đối với nhân sự IT/Lập trình.\n3. Chiến dịch ${summary} đóng góp giá trị như thế nào.\n4. CTA kết nối nhận tư vấn.`;
          bodyText = `[XU HƯỚNG VẬN HÀNH] TỐI ƯU HÓA TRẠI NGHIỆM NHÂN SỰ ĐỂ ĐỘT PHÁ HIỆU SUẤT\n\nKính gửi quý đối tác và cộng đồng doanh nghiệp,\n\nTrong quản trị hiện đại, sự hài lòng và sức khỏe thể chất của nhân viên chính là đòn bẩy hiệu năng lớn nhất. Với chiến dịch "${title}" cùng định hướng: ${summary}.\n\nDựa trên gợi ý đề xuất: "${suggestedContent}", iGen ERP mang tới góc nhìn mới giúp doanh nghiệp:\n✅ Giảm thiểu chấn thương cổ tay (RSI) ở bộ phận kỹ thuật.\n✅ Gia tăng sự tập trung và gắn kết công việc.\n✅ Xây dựng môi trường làm việc thông minh và hiện đại.\n\n💼 Hãy thảo luận cùng chúng tôi để thiết kế giải pháp chuyển đổi số toàn diện cho doanh nghiệp của bạn.\n\n#ChuyenDoiSo #iGenERP #LinkedInArticle #CongNgheTuongLai`;
        } else {
          contentType = "Bài viết truyền thông đa kênh";
          outline = `📋 DÀN Ý CHI TIẾT (OUTLINE):\n1. Mở bài cuốn hút.\n2. Phân tích cốt lõi.\n3. CTA kêu gọi hành động.`;
          bodyText = `Giới thiệu chiến dịch: ${title}!\n\nĐịnh hướng ý tưởng: ${summary}.\nNội dung chi tiết gợi ý: ${suggestedContent}`;
        }
        return { channel: chan, contentType, outline, bodyText };
      });
      return { posts: mockPosts, isMock: true };
    }

    const prompt = `Bạn là một chuyên gia viết kịch bản và AI Copywriter xuất sắc.
Hãy lập dàn ý (Outline) chi tiết và viết bản nháp bài đăng (Draft Content) hoàn chỉnh cho từng kênh sau đây: ${targetChannels.join(
      ", "
    )}
Thông tin chiến dịch marketing:
- Tiêu đề ý tưởng: "${title}"
- Tóm tắt ý tưởng: "${summary}"
- Nội dung gợi ý ban đầu: "${suggestedContent}"

Yêu cầu cho từng kênh:
1. Lập dàn ý (Outline) cụ thể, tối ưu và lưu vào trường "outline" trong JSON trả về.
2. Viết bản nháp nội dung chi tiết (Draft Content) hoàn chỉnh, hấp dẫn, đúng văn văn phong đặc thù của kênh truyền thông đó và lưu vào trường "bodyText" trong JSON trả về. 
Lưu ý quan trọng: Trường "bodyText" PHẢI chứa nội dung bài đăng sạch, KHÔNG được chứa phần dàn ý ở đầu, KHÔNG được dính các tiêu đề nháp như "(DRAFT CONTENT)", "[DRAFT CONTENT]", "# BẢN NHÁP CHI TIẾT", v.v. để người dùng có thể đăng tải trực tiếp.

Trả về kết quả ở định dạng JSON phù hợp chính xác với cấu trúc yêu cầu.`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            posts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  channel: { type: Type.STRING, description: "Kênh đăng bài" },
                  contentType: { type: Type.STRING, description: "Loại nội dung" },
                  outline: { type: Type.STRING, description: "Dàn ý chi tiết của bài viết" },
                  bodyText: { type: Type.STRING, description: "Nội dung bài viết sạch hoàn chỉnh để đăng tải" },
                },
                required: ["channel", "contentType", "outline", "bodyText"],
              },
            },
          },
          required: ["posts"],
        },
      },
    });

    const responseText = response.text || "{}";
    const parsedData = JSON.parse(responseText.trim());
    return { posts: parsedData.posts || [], isMock: false };
  },�� hài lòng và sức khỏe thể chất của nhân viên chính là đòn bẩy hiệu năng lớn nhất. Với chiến dịch "${title}" cùng định hướng: ${summary}.\n\nDựa trên gợi ý đề xuất: "${suggestedContent}", iGen ERP mang tới góc nhìn mới giúp doanh nghiệp:\n✅ Giảm thiểu chấn thương cổ tay (RSI) ở bộ phận kỹ thuật.\n✅ Gia tăng sự tập trung và gắn kết công việc.\n✅ Xây dựng môi trường làm việc thông minh và hiện đại.\n\n💼 Hãy thảo luận cùng chúng tôi để thiết kế giải pháp chuyển đổi số toàn diện cho doanh nghiệp của bạn.\n\n#ChuyenDoiSo #iGenERP #LinkedInArticle #CongNgheTuongLai`;
        } else {
          contentType = "Bài viết truyền thông đa kênh";
          bodyText = `📋 DÀN Ý CHI TIẾT (OUTLINE):\n1. Mở bài cuốn hút.\n2. Phân tích cốt lõi.\n3. CTA kêu gọi hành động.\n\n✍️ NỘI DUNG CHI TIẾT (DRAFT CONTENT):\nGiới thiệu chiến dịch: ${title}!\n\nĐịnh hướng ý tưởng: ${summary}.\nNội dung chi tiết gợi ý: ${suggestedContent}`;
        }
        return { channel: chan, contentType, bodyText };
      });
      return { posts: mockPosts, isMock: true };
    }

    const prompt = `Bạn là một chuyên gia viết kịch bản và AI Copywriter xuất sắc.
Hãy lập dàn ý (Outline) chi tiết và viết bản nháp bài đăng (Draft Content) hoàn chỉnh cho từng kênh sau đây: ${targetChannels.join(
      ", "
    )}
Thông tin chiến dịch marketing:
- Tiêu đề ý tưởng: "${title}"
- Tóm tắt ý tưởng: "${summary}"
- Nội dung gợi ý ban đầu: "${suggestedContent}"

Yêu cầu cho từng kênh:
1. Lập dàn ý (Outline) cụ thể, tối ưu.
2. Viết bản nháp nội dung chi tiết (Draft Content) hoàn chỉnh, hấp dẫn, đúng văn phong đặc thù của kênh truyền thông đó (Facebook cần biểu tượng sinh động và CTA, TikTok cần kịch bản quay/giọng nói/visual chi tiết kèm mốc thời gian, LinkedIn cần chuyên nghiệp sâu sắc dạng bài viết doanh nghiệp).

Trả về kết quả ở định dạng JSON phù hợp chính xác với cấu trúc yêu cầu.`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            posts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  channel: { type: Type.STRING, description: "Kênh đăng bài" },
                  contentType: { type: Type.STRING, description: "Loại nội dung" },
                  bodyText: { type: Type.STRING, description: "Dàn ý và bài đăng chi tiết dạng Markdown" },
                },
                required: ["channel", "contentType", "bodyText"],
              },
            },
          },
          required: ["posts"],
        },
      },
    });

    const responseText = response.text || "{}";
    const parsedData = JSON.parse(responseText.trim());
    return { posts: parsedData.posts || [], isMock: false };
  },
};
