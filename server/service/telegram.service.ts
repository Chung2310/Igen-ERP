import { ICRMTicket } from "../interface/crm-ticket.interface";
import { geminiService } from "./gemini.service";
import { cloudinaryService } from "./cloudinary.service";

let pollingActive = false;
let lastOffset = 0;

export const telegramService = {
  /**
   * Gửi thông báo chốt đơn thành công sang Telegram
   */
  async sendLeadWonNotification(lead: ICRMTicket): Promise<void> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      console.warn("[TelegramService] TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID chưa được cấu hình trong file .env");
      return;
    }

    try {
      // 1. Xây dựng danh sách sản phẩm chi tiết kèm số lượng và đơn giá
      let productsText = "";
      if (Array.isArray(lead.selectedProducts) && lead.selectedProducts.length > 0) {
        productsText = lead.selectedProducts
          .map((prod) => {
            const price = prod.price || 0;
            const quantity = prod.quantity || 1;
            const subtotal = price * quantity;
            return `• <b>${prod.name}</b>\n  Số lượng: <code>${quantity}</code> x <code>${price.toLocaleString("vi-VN")} đ</code>\n  Thành tiền: <b>${subtotal.toLocaleString("vi-VN")} đ</b>`;
          })
          .join("\n\n");
      } else if (lead.productOfChoice) {
        productsText = `• <b>${lead.productOfChoice}</b>`;
      } else {
        productsText = "• Không có thông tin sản phẩm cụ thể.";
      }

      // 2. Định dạng thông điệp HTML gửi tới Telegram
      const message = [
        "🎉 <b>THÔNG BÁO CHỐT ĐƠN THÀNH CÔNG!</b> 🎉",
        "=============================",
        `👤 <b>Khách hàng:</b> ${lead.customerName}`,
        `🏢 <b>Công ty:</b> ${lead.company || "Cá nhân"}`,
        `📞 <b>Số điện thoại:</b> ${lead.phone || "Chưa bổ sung"}`,
        `✉️ <b>Email:</b> ${lead.email || "Chưa bổ sung"}`,
        "-----------------------------",
        "📦 <b>Chi tiết đơn hàng:</b>",
        productsText,
        "-----------------------------",
        `💰 <b>Tổng giá trị đơn hàng:</b> <code>${(lead.value || 0).toLocaleString("vi-VN")} đ</code>`,
        "=============================",
      ].join("\n");

      await this.sendMessage(chatId, message);
    } catch (error) {
      console.error("[TelegramService] Gặp lỗi khi gửi thông báo tới Telegram:", error);
    }
  },

  /**
   * Helper gửi tin nhắn văn bản định dạng HTML
   */
  async sendMessage(chatId: string | number, text: string): Promise<any> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return;

    try {
      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: "HTML",
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[Telegram Bot] sendMessage error: ${response.status} - ${errText}`);
      }
      return response.json();
    } catch (err) {
      console.error("[Telegram Bot] Failed to execute sendMessage request:", err);
    }
  },

  /**
   * Helper gửi ảnh lên Telegram qua URL
   */
  async sendPhoto(chatId: string | number, photoUrl: string, caption: string): Promise<any> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return;

    try {
      const url = `https://api.telegram.org/bot${botToken}/sendPhoto`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          photo: photoUrl,
          caption: caption,
          parse_mode: "HTML",
        }),
      });
      return response.json();
    } catch (err) {
      console.error("[Telegram Bot] Failed to execute sendPhoto request:", err);
    }
  },

  /**
   * Helper gửi video lên Telegram qua URL
   */
  async sendVideo(chatId: string | number, videoUrl: string, caption: string): Promise<any> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return;

    try {
      const url = `https://api.telegram.org/bot${botToken}/sendVideo`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          video: videoUrl,
          caption: caption,
          parse_mode: "HTML",
        }),
      });
      return response.json();
    } catch (err) {
      console.error("[Telegram Bot] Failed to execute sendVideo request:", err);
    }
  },

  /**
   * Khởi động vòng lặp Polling chạy nền nhận và xử lý lệnh từ người dùng
   */
  async startPolling(): Promise<void> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.warn("[Telegram Bot] Chưa cấu hình TELEGRAM_BOT_TOKEN trong .env. Bỏ qua chạy Telegram Polling.");
      return;
    }

    if (pollingActive) return;
    pollingActive = true;
    console.log("[Telegram Bot] Đã khởi chạy dịch vụ Telegram Polling nhận tin nhắn.");

    this.pollLoop().catch((err) => {
      console.error("[Telegram Bot] Lỗi nghiêm trọng trong vòng lặp Polling:", err);
      pollingActive = false;
    });
  },

  /**
   * Vòng lặp lấy thông tin tin nhắn liên tục (Long Polling)
   */
  async pollLoop(): Promise<void> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    while (pollingActive) {
      try {
        const url = `https://api.telegram.org/bot${botToken}/getUpdates?offset=${lastOffset + 1}&timeout=30`;
        const response = await fetch(url, { method: "GET" });
        if (!response.ok) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
          continue;
        }

        const body: any = await response.json();
        if (body.ok && Array.isArray(body.result)) {
          for (const update of body.result) {
            lastOffset = Math.max(lastOffset, update.update_id);
            if (update.message) {
              const text = (update.message.text || update.message.caption || "").trim();
              const photo = update.message.photo;
              const chatId = update.message.chat.id;

              if (text.startsWith("/")) {
                this.handleCommand(chatId, text, photo).catch((err) => {
                  console.error("[Telegram Bot] Lỗi khi thực thi lệnh:", err);
                });
              }
            }
          }
        }
      } catch (err) {
        console.error("[Telegram Bot] Lỗi kết nối API getUpdates:", err);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  },

  /**
   * Phân tích và điều phối các câu lệnh được nhập từ Telegram Chat
   */
  async handleCommand(chatId: number, text: string, photo?: any[]): Promise<void> {
    const spaceIndex = text.indexOf(" ");
    const command = spaceIndex === -1 ? text : text.substring(0, spaceIndex);
    const args = spaceIndex === -1 ? "" : text.substring(spaceIndex + 1).trim();

    if (command === "/start" || command === "/help") {
      const welcome = [
        "🤖 <b>Chào mừng bạn đến với iGEN ERP Bot!</b>",
        "Tôi có thể giúp bạn tạo ảnh và video nghệ thuật từ AI. Các lệnh được hỗ trợ:",
        "• /help - Hiển thị hướng dẫn sử dụng bot.",
        "• <code>/image [mô tả]</code> - Sinh ảnh nghệ thuật AI (Ví dụ: <code>/image phi hành gia cưỡi ngựa trên sao hỏa</code>).",
        "• <code>/video [mô tả]</code> - Sinh video ngắn AI (Ví dụ: <code>/video sóng biển rì rào hoàng hôn</code>).",
      ].join("\n");
      await this.sendMessage(chatId, welcome);
      return;
    }

    if (command === "/image") {
      if (!args) {
        await this.sendMessage(chatId, "⚠️ Vui lòng cung cấp mô tả ảnh. Ví dụ: <code>/image chú mèo con bay trên đám mây</code>");
        return;
      }

      let refImageUrl: string | undefined = undefined;
      if (photo && photo.length > 0) {
        await this.sendMessage(chatId, "📥 <b>Đang tải ảnh tham chiếu từ Telegram...</b>");
        try {
          const fileId = photo[photo.length - 1].file_id;
          const buffer = await this.downloadTelegramFile(fileId);
          refImageUrl = await cloudinaryService.uploadMediaBuffer(buffer, "telegram_refs");
        } catch (err: any) {
          console.error("[Telegram Bot] Lỗi tải ảnh tham chiếu:", err);
          await this.sendMessage(chatId, `⚠️ Không thể xử lý ảnh tham chiếu: ${err.message || err}. Hệ thống sẽ tạo ảnh không có ảnh tham chiếu.`);
        }
      }

      await this.sendMessage(chatId, `🎨 <b>Đang gửi yêu cầu tạo ảnh AI...</b>\nMô tả: <i>${args}</i>${refImageUrl ? "\n📎 <i>Có ảnh tham chiếu đi kèm</i>" : ""}\nVui lòng đợi trong giây lát.`);

      try {
        const result = await geminiService.generateImage(
          args,
          refImageUrl ? { existingImageUris: [refImageUrl] } : undefined
        );
        if (result && result.url) {
          const sendRes = await this.sendPhoto(chatId, result.url, `🎨 <b>Ảnh được tạo thành công!</b>\nMô tả: <i>${args}</i>`);
          if (!sendRes || !sendRes.ok) {
            // Gửi tin nhắn dạng văn bản kèm liên kết nếu Telegram không hiển thị được ảnh trực tiếp
            await this.sendMessage(
              chatId,
              `🎨 <b>Ảnh được tạo thành công!</b>\nMô tả: <i>${args}</i>\n\n🔗 <a href="${result.url}">Nhấn vào đây để tải và xem ảnh trực tiếp</a>`
            );
          }
        } else {
          await this.sendMessage(chatId, "❌ Quá trình tạo ảnh không thành công. Hãy thử lại mô tả khác.");
        }
      } catch (err: any) {
        console.error("[Telegram Bot] Lỗi tạo ảnh:", err);
        await this.sendMessage(chatId, `❌ Lỗi hệ thống khi tạo ảnh: ${err.message || err}`);
      }
      return;
    }

    if (command === "/video") {
      if (!args) {
        await this.sendMessage(chatId, "⚠️ Vui lòng cung cấp mô tả video. Ví dụ: <code>/video dòng thác đổ trong rừng nguyên sinh</code>");
        return;
      }

      let refImageUrl: string | undefined = undefined;
      if (photo && photo.length > 0) {
        await this.sendMessage(chatId, "📥 <b>Đang tải ảnh tham chiếu từ Telegram...</b>");
        try {
          const fileId = photo[photo.length - 1].file_id;
          const buffer = await this.downloadTelegramFile(fileId);
          refImageUrl = await cloudinaryService.uploadMediaBuffer(buffer, "telegram_refs");
        } catch (err: any) {
          console.error("[Telegram Bot] Lỗi tải ảnh tham chiếu:", err);
          await this.sendMessage(chatId, `⚠️ Không thể xử lý ảnh tham chiếu: ${err.message || err}. Hệ thống sẽ tạo video không có ảnh tham chiếu.`);
        }
      }

      await this.sendMessage(chatId, `🎬 <b>Đang gửi yêu cầu sinh video AI...</b>\nMô tả: <i>${args}</i>${refImageUrl ? "\n📎 <i>Có ảnh tham chiếu đi kèm</i>" : ""}\nQuá trình này có thể tốn từ 15-45 giây, vui lòng kiên nhẫn đợi.`);

      try {
        const result = await geminiService.generateVideo(
          args,
          6,
          refImageUrl ? { referenceImageUris: [refImageUrl] } : undefined
        );
        if (result && result.url) {
          const sendRes = await this.sendVideo(chatId, result.url, `🎬 <b>Video được tạo thành công!</b>\nMô tả: <i>${args}</i>`);
          if (!sendRes || !sendRes.ok) {
            // Gửi tin nhắn dạng văn bản kèm liên kết nếu Telegram không hiển thị được video trực tiếp
            await this.sendMessage(
              chatId,
              `🎬 <b>Video được tạo thành công!</b>\nMô tả: <i>${args}</i>\n\n🔗 <a href="${result.url}">Nhấn vào đây để tải và xem video trực tiếp</a>`
            );
          }
        } else {
          await this.sendMessage(chatId, "❌ Quá trình tạo video không thành công. Hãy thử lại sau.");
        }
      } catch (err: any) {
        console.error("[Telegram Bot] Lỗi tạo video:", err);
        await this.sendMessage(chatId, `❌ Lỗi hệ thống khi tạo video: ${err.message || err}`);
      }
      return;
    }

    await this.sendMessage(chatId, "⚠️ Câu lệnh không được hỗ trợ. Hãy gõ /help để xem các lệnh khả dụng.");
  },

  /**
   * Tải tệp tin từ Telegram về dưới dạng Buffer
   */
  async downloadTelegramFile(fileId: string): Promise<Buffer> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) throw new Error("Chưa cấu hình TELEGRAM_BOT_TOKEN");

    const getFileUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`;
    const res = await fetch(getFileUrl);
    if (!res.ok) throw new Error("Không thể truy vấn thông tin tệp tin từ Telegram");

    const body: any = await res.json();
    if (!body.ok || !body.result?.file_path) {
      throw new Error("Không tìm thấy đường dẫn tệp tin trên hệ thống Telegram");
    }

    const filePath = body.result.file_path;
    const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
    const fileRes = await fetch(downloadUrl);
    if (!fileRes.ok) throw new Error("Không thể tải tệp tin từ Telegram");

    const arrayBuffer = await fileRes.arrayBuffer();
    return Buffer.from(arrayBuffer);
  },
};
