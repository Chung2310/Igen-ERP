import { getAccessToken } from "./authService";

export interface TransactionInfo {
  _id: string;
  userId: string;
  orderCode: number;
  amount: number;
  type: "deposit" | "payment" | "withdraw";
  status: "pending" | "success" | "failed";
  paymentLinkId?: string;
  checkoutUrl?: string;
  description?: string;
  createdAt: string;
  completedAt?: string;
}

export const walletService = {
  // Lấy số dư ví của người dùng đang đăng nhập
  async getWalletBalance(): Promise<number> {
    const res = await fetch("/api/v1/wallet/balance", {
      headers: {
        "Authorization": `Bearer ${getAccessToken()}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Không thể lấy số dư ví");
    }

    const result = await res.json();
    return result.balance;
  },

  // Lấy lịch sử giao dịch
  async getTransactionHistory(): Promise<TransactionInfo[]> {
    const res = await fetch("/api/v1/wallet/transactions", {
      headers: {
        "Authorization": `Bearer ${getAccessToken()}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Không thể lấy lịch sử giao dịch");
    }

    const result = await res.json();
    return result.data || [];
  },

  // Tạo liên kết thanh toán nạp tiền
  async createDepositLink(amount: number, description?: string): Promise<{
    checkoutUrl: string;
    orderCode: number;
    paymentLinkId: string;
    isMock: boolean;
  }> {
    const res = await fetch("/api/v1/wallet/deposit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify({ amount, description }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Không thể tạo liên kết nạp tiền");
    }

    const result = await res.json();
    return result.data;
  },

  // Giả lập thanh toán thành công (cho Mock Mode)
  async confirmMockPayment(orderCode: number): Promise<any> {
    const res = await fetch("/api/v1/wallet/webhook-mock", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify({ orderCode }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Lỗi khi xác nhận thanh toán giả lập");
    }

    return await res.json();
  },

  // Kiểm tra trạng thái giao dịch
  async checkTransactionStatus(orderCode: number): Promise<{
    transactionStatus: "pending" | "success" | "failed";
    amount?: number;
  }> {
    const res = await fetch(`/api/v1/wallet/check/${orderCode}`, {
      headers: {
        "Authorization": `Bearer ${getAccessToken()}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Không thể kiểm tra trạng thái giao dịch");
    }

    const result = await res.json();
    return result;
  },
};
