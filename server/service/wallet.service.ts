import { WalletModel } from "../model/wallet.model";
import { TransactionModel } from "../model/transaction.model";

// Bảng giá dịch vụ API (đơn vị: USD)
export const API_COSTS = {
  GEMINI_CHAT: 0.01,           // $0.01 cho mỗi câu hỏi chat
  GEMINI_MARKETING: 0.01,      // $0.01 cho mỗi lần tạo gợi ý/content pillars/ideas/develop
  GEMINI_IMAGE: 0.10,          // $0.10 cho mỗi ảnh sinh ra
  GEMINI_VIDEO: 0.50,          // $0.50 cho mỗi video sinh ra
  GEMINI_OPTIMIZE: 0.01,       // $0.01 cho mỗi lần tối ưu kịch bản/prompt
  GEMINI_FAQ: 0.02,            // $0.02 cho mỗi lần đồng bộ Drive/FAQ
  ELEVENLABS_TTS_CHAR: 0.00005, // $0.00005 cho mỗi ký tự sinh giọng nói
  ELEVENLABS_MIN: 0.01,        // $0.01 phí tối thiểu ElevenLabs
  HEYGEN_VIDEO: 1.00,          // $1.00 cho mỗi video avatar HeyGen
};

export const walletService = {
  /**
   * Kiểm tra xem người dùng có đủ số dư ví để thực hiện yêu cầu không
   * @param userId ID người dùng
   * @param amount Số tiền USD cần kiểm tra
   */
  async checkBalance(userId: string, amount: number): Promise<void> {
    if (amount <= 0) return;

    let wallet = await WalletModel.findOne({ userId });
    if (!wallet) {
      // Tự động khởi tạo ví mới nếu chưa tồn tại
      wallet = new WalletModel({ userId, balance: 0 });
      await wallet.save();
    }

    if (wallet.balance < amount) {
      const error: any = new Error("Số dư ví không đủ. Vui lòng nạp thêm tiền vào ví để tiếp tục sử dụng dịch vụ.");
      error.statusCode = 402; // Payment Required
      throw error;
    }
  },

  /**
   * Khấu trừ số dư ví người dùng sau khi API thực hiện thành công
   * @param userId ID người dùng
   * @param amount Số tiền USD khấu trừ
   * @param description Mô tả chi tiết giao dịch
   */
  async deductBalance(userId: string, amount: number, description: string): Promise<any> {
    if (amount <= 0) return null;

    // 1. Khấu trừ số dư ví người dùng sử dụng findOneAndUpdate nguyên tử
    const wallet = await WalletModel.findOneAndUpdate(
      { userId },
      { $inc: { balance: -amount }, $set: { updatedAt: new Date() } },
      { upsert: true, returnDocument: "after" }
    );

    // 2. Sinh mã đơn hàng ngẫu nhiên duy nhất dạng số nguyên
    let orderCode: number;
    let existing: any;
    do {
      orderCode = Math.floor(10000000 + Math.random() * 90000000);
      existing = await TransactionModel.findOne({ orderCode });
    } while (existing);

    // 3. Ghi nhận giao dịch trừ tiền thành công
    const transaction = new TransactionModel({
      userId,
      orderCode,
      amount,
      type: "payment",
      status: "success",
      description,
      createdAt: new Date(),
      completedAt: new Date(),
    });
    await transaction.save();

    console.log(`[Wallet Service] Khấu trừ thành công $${amount} USD từ User ID: ${userId} (${description}). Số dư mới: $${wallet.balance} USD.`);
    return { wallet, transaction };
  }
};
