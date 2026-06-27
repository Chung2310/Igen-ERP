import { ICRMTicket } from "../interface/crm-ticket.interface";
import { geminiService } from "./gemini.service";
import { cloudinaryService } from "./cloudinary.service";
import { TelegramProcessedUpdateModel } from "../model/telegram-processed-update.model";
import { TelegramSessionModel } from "../model/telegram-session.model";
import { UserModel } from "../model/user.model";
import bcrypt from "bcryptjs";

const TELEGRAM_API_BASE_URL = process.env.TELEGRAM_API_BASE_URL || "https://api.telegram.org";

let pollingActive = false;
let lastOffset = 0;

/** Danh sách role được phép sử dụng lệnh quản trị */
const ADMIN_ROLES = ["admin", "superadmin"];

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
      const url = `${TELEGRAM_API_BASE_URL}/bot${botToken}/sendMessage`;
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
      const url = `${TELEGRAM_API_BASE_URL}/bot${botToken}/sendPhoto`;
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
      const url = `${TELEGRAM_API_BASE_URL}/bot${botToken}/sendVideo`;
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
   * Helper xóa tin nhắn trên Telegram (dùng để xóa tin nhắn chứa mật khẩu)
   */
  async deleteMessage(chatId: string | number, messageId: number): Promise<void> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return;

    try {
      const url = `${TELEGRAM_API_BASE_URL}/bot${botToken}/deleteMessage`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[Telegram Bot] Không thể xóa tin nhắn ${messageId}: ${errText}`);
      }
    } catch (err) {
      console.warn("[Telegram Bot] Lỗi khi xóa tin nhắn:", err);
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
        const url = `${TELEGRAM_API_BASE_URL}/bot${botToken}/getUpdates?offset=${lastOffset + 1}&timeout=30`;
        const response = await fetch(url, { method: "GET" });
        if (!response.ok) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
          continue;
        }

        const body: any = await response.json();
        if (body.ok && Array.isArray(body.result)) {
          for (const update of body.result) {
            lastOffset = Math.max(lastOffset, update.update_id);

            // === CHỐNG TRÙNG LẶP: Thử chèn update_id vào MongoDB ===
            try {
              await TelegramProcessedUpdateModel.create({ updateId: update.update_id });
            } catch (dupErr: any) {
              if (dupErr?.code === 11000) {
                // Đã có tiến trình khác xử lý update này rồi → bỏ qua
                continue;
              }
              console.error("[Telegram Bot] Lỗi ghi update_id vào DB:", dupErr);
            }

            if (update.message) {
              const text = (update.message.text || update.message.caption || "").trim();
              const photo = update.message.photo;
              const chatId = update.message.chat.id;
              const messageId = update.message.message_id;

              if (text.startsWith("/")) {
                this.handleCommand(chatId, text, photo, messageId).catch((err) => {
                  console.error("[Telegram Bot] Lỗi khi thực thi lệnh:", err);
                });
              }
            }
          }
        }
      } catch (err: any) {
        const errStr = err?.message || String(err);
        const isTimeout = errStr.includes("ETIMEDOUT") || errStr.includes("fetch failed") || errStr.includes("timeout") || err?.code === "ETIMEDOUT";
        if (isTimeout) {
          console.warn(`[Telegram Bot] Lỗi kết nối API getUpdates (Timeout/Network): ${errStr}. Sẽ thử lại sau 5s...`);
        } else {
          console.error("[Telegram Bot] Lỗi kết nối API getUpdates:", err);
        }
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  },

  /**
   * Phân tích và điều phối các câu lệnh được nhập từ Telegram Chat
   */
  async handleCommand(chatId: number, text: string, photo?: any[], messageId?: number): Promise<void> {
    const spaceIndex = text.indexOf(" ");
    const command = spaceIndex === -1 ? text : text.substring(0, spaceIndex);
    const args = spaceIndex === -1 ? "" : text.substring(spaceIndex + 1).trim();

    // === XỬ LÝ ĐĂNG NHẬP ===
    if (command === "/login") {
      // Luôn xóa tin nhắn chứa mật khẩu ngay lập tức
      if (messageId) {
        await this.deleteMessage(chatId, messageId);
      }

      const parts = args.split(/\s+/);
      if (parts.length < 2) {
        await this.sendMessage(chatId, "⚠️ Sử dụng: <code>/login email mật_khẩu</code>\nVí dụ: <code>/login admin@igen.com 123456</code>\n\n🔒 <i>Tin nhắn chứa mật khẩu đã được xóa tự động để bảo mật.</i>");
        return;
      }

      const [email, password] = parts;
      try {
        const user = await UserModel.findOne({ email: email.toLowerCase().trim() });
        if (!user || !user.password) {
          await this.sendMessage(chatId, "❌ Email hoặc mật khẩu không đúng.\n🔒 <i>Tin nhắn đăng nhập đã được xóa tự động.</i>");
          return;
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          await this.sendMessage(chatId, "❌ Email hoặc mật khẩu không đúng.\n🔒 <i>Tin nhắn đăng nhập đã được xóa tự động.</i>");
          return;
        }

        // Xóa session cũ nếu userId đã liên kết với chat khác
        await TelegramSessionModel.deleteMany({ $or: [{ telegramChatId: chatId }, { userId: user._id }] });

        await TelegramSessionModel.create({
          telegramChatId: chatId,
          userId: user._id,
          email: user.email,
          displayName: user.displayName || email,
          role: user.role || "user",
          companyCode: user.companyCode || "",
        });

        await this.sendMessage(chatId, [
          "✅ <b>Đăng nhập thành công!</b>",
          `👤 Xin chào, <b>${user.displayName}</b>`,
          `📧 Email: <code>${user.email}</code>`,
          `🔑 Vai trò: <b>${user.role || "user"}</b>`,
          `🏢 Công ty: <b>${user.companyName || user.companyCode || "Chưa thiết lập"}</b>`,
          "",
          "🔒 <i>Tin nhắn đăng nhập đã được xóa tự động để bảo mật.</i>",
          "Gõ /help để xem danh sách lệnh khả dụng.",
        ].join("\n"));
      } catch (err: any) {
        console.error("[Telegram Bot] Lỗi xử lý đăng nhập:", err);
        await this.sendMessage(chatId, "❌ Lỗi hệ thống khi đăng nhập. Vui lòng thử lại sau.");
      }
      return;
    }

    // === XỬ LÝ ĐĂNG XUẤT ===
    if (command === "/logout") {
      try {
        const deleted = await TelegramSessionModel.findOneAndDelete({ telegramChatId: chatId });
        if (deleted) {
          await this.sendMessage(chatId, "👋 <b>Đã đăng xuất thành công.</b>\nGõ /login để đăng nhập lại.");
        } else {
          await this.sendMessage(chatId, "⚠️ Bạn chưa đăng nhập.");
        }
      } catch (err: any) {
        console.error("[Telegram Bot] Lỗi xử lý đăng xuất:", err);
        await this.sendMessage(chatId, "❌ Lỗi hệ thống khi đăng xuất.");
      }
      return;
    }

    // === TRA CỨU SESSION HIỆN TẠI ===
    let session: any = null;
    try {
      session = await TelegramSessionModel.findOne({ telegramChatId: chatId }).lean();
    } catch (err) {
      console.error("[Telegram Bot] Lỗi tra cứu session:", err);
    }

    // === LỆNH CÔNG KHAI: /start, /help ===
    if (command === "/start" || command === "/help") {
      if (!session) {
        // Chưa đăng nhập → hiển thị hướng dẫn đăng nhập
        const guestHelp = [
          "🤖 <b>Chào mừng bạn đến với iGEN ERP Bot!</b>",
          "Để sử dụng bot, bạn cần đăng nhập bằng tài khoản ERP.",
          "",
          "📌 <b>Hướng dẫn đăng nhập:</b>",
          "<code>/login email mật_khẩu</code>",
          "Ví dụ: <code>/login admin@igen.com 123456</code>",
          "",
          "🔒 <i>Tin nhắn chứa mật khẩu sẽ được xóa tự động sau khi xác thực.</i>",
        ].join("\n");
        await this.sendMessage(chatId, guestHelp);
      } else {
        const isAdmin = ADMIN_ROLES.includes(session.role);
        const helpLines = [
          `🤖 <b>Xin chào, ${session.displayName}!</b>`,
          `📧 ${session.email} | 🔑 ${session.role}`,
          "",
          "📌 <b>Danh sách câu lệnh:</b>",
          "• <code>/help</code> - Hiển thị hướng dẫn sử dụng bot.",
          "• <code>/image [mô tả]</code> - Sinh ảnh nghệ thuật AI.",
          "• <code>/video [mô tả]</code> - Sinh video ngắn AI.",
        ];
        if (isAdmin) {
          helpLines.push("• <code>/stats</code> hoặc <code>/report</code> - Báo cáo thống kê CRM và giao dịch.");
          helpLines.push("• <code>/warning_stock</code> hoặc <code>/lowstock</code> - Kiểm tra sản phẩm sắp hết hàng.");
        }
        helpLines.push("• <code>/logout</code> - Đăng xuất khỏi bot.");
        await this.sendMessage(chatId, helpLines.join("\n"));
      }
      return;
    }

    // === CÁC LỆNH CÒN LẠI: YÊU CẦU ĐĂNG NHẬP ===
    if (!session) {
      await this.sendMessage(chatId, "🔒 Bạn cần đăng nhập trước khi sử dụng lệnh này.\nGõ: <code>/login email mật_khẩu</code>");
      return;
    }

    // === KIỂM TRA QUYỀN QUẢN TRỊ CHO LỆNH NHẠY CẢM ===
    const adminCommands = ["/stats", "/report", "/warning_stock", "/lowstock"];
    if (adminCommands.includes(command) && !ADMIN_ROLES.includes(session.role)) {
      await this.sendMessage(chatId, "⛔ Bạn không có quyền sử dụng lệnh này. Lệnh này chỉ dành cho quản trị viên.");
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

    if (command === "/report" || command === "/stats") {
      await this.sendMessage(chatId, "📊 <b>Đang truy vấn hệ thống để lập báo cáo, vui lòng đợi...</b>");
      try {
        const { CRMTicketModel } = require("../model/crm-ticket.model");
        const { TransactionModel } = require("../model/transaction.model");
        const { ProductModel } = require("../model/product.model");

        // 1. CRM Stats
        const tickets = await CRMTicketModel.find({}).lean();
        const totalLeads = tickets.length;
        let cold = 0, warm = 0, hot = 0, won = 0, upsell = 0;
        let totalWonValue = 0;

        for (const t of tickets) {
          if (t.status === "cold") cold++;
          else if (t.status === "warm") warm++;
          else if (t.status === "hot") hot++;
          else if (t.status === "won") {
            won++;
            totalWonValue += Number(t.value || 0);
          } else if (t.status === "upsell") {
            upsell++;
            totalWonValue += Number(t.value || 0);
          }
        }

        // 2. Transaction Stats
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const allSuccessTransactions = await TransactionModel.find({ status: "success" }).lean();
        const todaySuccessTransactions = await TransactionModel.find({
          status: "success",
          createdAt: { $gte: startOfDay }
        }).lean();

        const totalTransactedAmount = allSuccessTransactions.reduce((sum: number, tx: any) => sum + Number(tx.amount || 0), 0);
        const todayTransactedAmount = todaySuccessTransactions.reduce((sum: number, tx: any) => sum + Number(tx.amount || 0), 0);

        // 3. Low stock alert stats
        const allProducts = await ProductModel.find({}).lean();
        const lowStockProducts = allProducts.filter((p: any) => {
          const stock = typeof p.stock === "number" ? p.stock : 0;
          const minAlert = typeof p.minStockAlert === "number" ? p.minStockAlert : 15;
          return stock <= minAlert;
        });

        const report = [
          "📊 <b>BÁO CÁO THỐNG KÊ DOANH NGHIỆP</b> 📊",
          "=============================",
          "👥 <b>QUẢN LÝ CƠ HỘI CRM (LEADS):</b>",
          `• Tổng số cơ hội: <b>${totalLeads}</b>`,
          `• ❄️ Thụ động (Cold): <b>${cold}</b>`,
          `• 🔥 Tiềm năng (Warm/Hot): <b>${warm + hot}</b>`,
          `• 🎉 Đã chốt đơn (Won/Upsell): <b>${won + upsell}</b>`,
          `• 💰 Tổng giá trị chốt đơn: <b>${totalWonValue.toLocaleString("vi-VN")} VND</b>`,
          "",
          "💳 <b>GIAO DỊCH & THANH TOÁN (PAYMENTS):</b>",
          `• Hôm nay: <b>+${todayTransactedAmount.toLocaleString("vi-VN")} VND</b> (${todaySuccessTransactions.length} GD thành công)`,
          `• Tổng tích lũy: <b>${totalTransactedAmount.toLocaleString("vi-VN")} VND</b> (${allSuccessTransactions.length} GD)`,
          "",
          "📦 <b>CẢNH BÁO TỒN KHO:</b>",
          `• Số sản phẩm dưới định mức: <b>${lowStockProducts.length}</b> sản phẩm`,
        ];

        if (lowStockProducts.length > 0) {
          report.push("");
          report.push("⚠️ <b>Chi tiết sản phẩm sắp hết hàng:</b>");
          lowStockProducts.slice(0, 5).forEach((p: any) => {
            report.push(`- <b>${p.name}</b> (SKU: <code>${p.sku}</code>): Tồn <b>${p.stock}</b> (Định mức: ${p.minStockAlert})`);
          });
          if (lowStockProducts.length > 5) {
            report.push(`<i>...và ${lowStockProducts.length - 5} sản phẩm khác.</i>`);
          }
        } else {
          report.push("✅ Tồn kho tất cả sản phẩm đều ở mức an toàn.");
        }

        report.push("=============================");
        report.push(`🕒 <i>Báo cáo lúc: ${new Date().toLocaleString("vi-VN")}</i>`);

        await this.sendMessage(chatId, report.join("\n"));
      } catch (err: any) {
        console.error("[Telegram Bot] Lỗi tạo báo cáo stats:", err);
        await this.sendMessage(chatId, `❌ Lỗi hệ thống khi lập báo cáo: ${err.message || err}`);
      }
      return;
    }

    if (command === "/warning_stock" || command === "/lowstock") {
      await this.sendMessage(chatId, "🔍 <b>Đang quét danh sách tồn kho thấp...</b>");
      try {
        const { ProductModel } = require("../model/product.model");
        const allProducts = await ProductModel.find({}).lean();
        const lowStockProducts = allProducts.filter((p: any) => {
          const stock = typeof p.stock === "number" ? p.stock : 0;
          const minAlert = typeof p.minStockAlert === "number" ? p.minStockAlert : 15;
          return stock <= minAlert;
        });

        if (lowStockProducts.length === 0) {
          await this.sendMessage(chatId, "✅ <b>Tất cả sản phẩm đều có mức tồn kho an toàn!</b>");
          return;
        }

        const msgLines = [
          `⚠️ <b>CÓ ${lowStockProducts.length} SẢN PHẨM SẮP HẾT HÀNG:</b>`,
          "=============================",
        ];

        lowStockProducts.forEach((p: any) => {
          msgLines.push(`• <b>${p.name}</b> (SKU: <code>${p.sku}</code>)`);
          msgLines.push(`  Tồn: <b>${p.stock}</b> / Định mức: ${p.minStockAlert} ${p.unit || "Cái"}`);
        });

        msgLines.push("=============================");
        msgLines.push("👉 <i>Vui lòng lên kế hoạch nhập hàng sớm.</i>");

        await this.sendMessage(chatId, msgLines.join("\n"));
      } catch (err: any) {
        console.error("[Telegram Bot] Lỗi quét tồn kho thấp:", err);
        await this.sendMessage(chatId, `❌ Lỗi hệ thống: ${err.message || err}`);
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

    const getFileUrl = `${TELEGRAM_API_BASE_URL}/bot${botToken}/getFile?file_id=${fileId}`;
    const res = await fetch(getFileUrl);
    if (!res.ok) throw new Error("Không thể truy vấn thông tin tệp tin từ Telegram");

    const body: any = await res.json();
    if (!body.ok || !body.result?.file_path) {
      throw new Error("Không tìm thấy đường dẫn tệp tin trên hệ thống Telegram");
    }

    const filePath = body.result.file_path;
    const downloadUrl = `${TELEGRAM_API_BASE_URL}/file/bot${botToken}/${filePath}`;
    const fileRes = await fetch(downloadUrl);
    if (!fileRes.ok) throw new Error("Không thể tải tệp tin từ Telegram");

    const arrayBuffer = await fileRes.arrayBuffer();
    return Buffer.from(arrayBuffer);
  },

  /**
   * Gửi cảnh báo khi tồn kho giảm xuống dưới ngưỡng an toàn
   */
  async sendLowStockAlert(product: any): Promise<void> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!botToken || !chatId) return;

    const message = [
      "⚠️ <b>CẢNH BÁO: TỒN KHO THẤP!</b> ⚠️",
      "=============================",
      `📦 <b>Sản phẩm:</b> ${product.name}`,
      `🏷️ <b>Mã SKU:</b> <code>${product.sku}</code>`,
      `🔴 <b>Tồn kho hiện tại:</b> <b>${product.stock}</b> ${product.unit || "Cái"}`,
      `🛡️ <b>Ngưỡng tối thiểu:</b> ${product.minStockAlert || 15} ${product.unit || "Cái"}`,
      `🏢 <b>Mã công ty:</b> <code>${product.companyCode || "unknown"}</code>`,
      "=============================",
      "👉 <i>Vui lòng lên kế hoạch nhập thêm hàng để tránh gián đoạn kinh doanh.</i>"
    ].join("\n");

    await this.sendMessage(chatId, message).catch((err) => {
      console.error("[Telegram Bot] Lỗi gửi cảnh báo tồn kho thấp:", err);
    });
  },

  /**
   * Gửi cảnh báo mất kết nối liên kết mạng xã hội (Token hết hạn/lỗi)
   */
  async sendIntegrationDisconnectAlert(
    platform: string,
    displayName: string,
    username: string,
    companyCode: string,
    reason: string
  ): Promise<void> {
    // 1. Cập nhật trạng thái isConnected = false trong DB
    try {
      const { SocialIntegrationModel } = require("../model/social-integration.model");
      await SocialIntegrationModel.findOneAndUpdate(
        { platform, username },
        { isConnected: false }
      );
      console.log(`[Telegram Service] Đã cập nhật trạng thái kết nối tài khoản ${platform} (${username}) thành disconnected.`);
    } catch (dbErr) {
      console.error("[Telegram Service] Lỗi cập nhật trạng thái liên kết trong DB:", dbErr);
    }

    // 2. Gửi tin nhắn cảnh báo tới Telegram
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!botToken || !chatId) return;

    const message = [
      "⚠️ <b>CẢNH BÁO: MẤT KẾT NỐI LIÊN KẾT MẠNG XÃ HỘI!</b> ⚠️",
      "=============================",
      `🌐 <b>Nền tảng:</b> <b>${platform}</b>`,
      `👤 <b>Tài khoản:</b> <b>${displayName}</b> (ID: <code>${username}</code>)`,
      `🏢 <b>Mã công ty:</b> <code>${companyCode || "unknown"}</code>`,
      `🔴 <b>Lý do:</b> <i>${reason}</i>`,
      "=============================",
      "👉 <i>Vui lòng truy cập Cấu hình ERP để kết nối lại tài khoản này, đảm bảo các tính năng tự động đăng bài và phản hồi khách hàng hoạt động bình thường.</i>"
    ].join("\n");

    await this.sendMessage(chatId, message).catch((err) => {
      console.error("[Telegram Bot] Lỗi gửi cảnh báo mất kết nối liên kết:", err);
    });
  },

  /**
   * Gửi cảnh báo khi tài khoản Gemini hết số dư
   */
  async sendGeminiBillingAlert(errorMessage: string): Promise<void> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!botToken || !chatId) return;

    // Tránh gửi spam tin nhắn liên tục nếu có nhiều comment/chat lỗi cùng lúc
    const now = Date.now();
    const lastAlertTime = (this as any)._lastGeminiBillingAlertTime || 0;
    if (now - lastAlertTime < 5 * 60 * 1000) { // 5 phút throttle
      return;
    }
    (this as any)._lastGeminiBillingAlertTime = now;

    const message = [
      "⚠️ <b>CẢNH BÁO: HẾT HẠN MỨC/SỐ DƯ GEMINI API!</b> ⚠️",
      "=============================",
      `🔴 <b>Lỗi:</b> <code>RESOURCE_EXHAUSTED</code>`,
      `💬 <b>Chi tiết:</b> <i>Prepayment credits are depleted. Vui lòng nạp tiền vào tài khoản Google AI Studio.</i>`,
      `📋 <b>Nội dung lỗi gốc:</b> <code>${errorMessage.slice(0, 300)}</code>`,
      "=============================",
      "👉 <i>Hệ thống sẽ tự động chuyển sang cấu hình FreeLLM Fallback (nếu có cấu hình) để duy trì trả lời tin nhắn/bình luận tạm thời. Quản trị viên vui lòng kiểm tra và thanh toán hóa đơn sớm.</i>"
    ].join("\n");

    await this.sendMessage(chatId, message).catch((err) => {
      console.error("[Telegram Bot] Lỗi gửi cảnh báo hóa đơn Gemini:", err);
    });
  },
};
