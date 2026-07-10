/**
 * Chatbot Service
 * ───────────────
 * Trợ lý ảo AI cho hệ thống iGen ERP. Truy vấn dữ liệu thời gian thực thuộc
 * doanh nghiệp của người dùng (theo companyCode) rồi dựng system prompt giàu
 * ngữ cảnh, gọi OpenRouter (có fallback 3 tầng) để sinh câu trả lời.
 */

import { openrouterChat, type OpenRouterMessage } from "./openrouter.service";
import { CRMTicketModel } from "../model/crm-ticket.model";
import { ProductModel } from "../model/product.model";
import { KanbanTaskModel } from "../model/kanban-task.model";
import { ProjectModel } from "../model/project.model";
import { MarketingContentModel } from "../model/marketing-content.model";
import { WalletModel } from "../model/wallet.model";

export interface ChatbotMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatbotUser {
  id: string;
  email: string;
  role: string;
  companyCode?: string;
}

export class ChatbotService {
  static async getResponse(user: ChatbotUser, messages: ChatbotMessage[]): Promise<string> {
    const companyCode = user.companyCode;
    const model = process.env.CHATBOT_MODEL?.trim() || process.env.OPENROUTER_MODEL?.trim() || "google/gemini-2.5-flash";

    if (!companyCode) {
      // Không có doanh nghiệp gắn với tài khoản → trả lời chung chung, không có dữ liệu nội bộ
      const generalPrompt: OpenRouterMessage = {
        role: "system",
        content:
          "Bạn là trợ lý ảo AI của hệ thống iGen ERP. Tài khoản hiện tại chưa được gắn với doanh nghiệp nào " +
          "nên bạn không truy cập được dữ liệu nội bộ. Hãy hỗ trợ người dùng bằng kiến thức chung về vận hành, " +
          "CRM, marketing, kho hàng, dự án... và trả lời bằng tiếng Việt lịch sự, ngắn gọn, có cấu trúc.",
      };
      const { text } = await openrouterChat({
        model,
        messages: [generalPrompt, ...this.normalizeMessages(messages)],
      });
      return text;
    }

    // 1. Truy vấn dữ liệu doanh nghiệp song song
    const [tickets, products, tasks, projects, marketingContents, wallet] = await Promise.all([
      CRMTicketModel.find({ companyCode }).lean(),
      ProductModel.find({ companyCode }).lean(),
      KanbanTaskModel.find({ companyCode }).lean(),
      ProjectModel.find({ companyCode }).lean(),
      MarketingContentModel.find({ companyCode }).sort({ generatedAt: -1 }).limit(50).lean(),
      WalletModel.findOne({ userId: user.id }).lean(),
    ]);

    // 2. Tổng quan CRM (pipeline khách hàng theo trạng thái)
    const crmStatusLabels: Record<string, string> = {
      cold: "Tiềm năng lạnh", warm: "Tiềm năng ấm", hot: "Tiềm năng nóng",
      won: "Đã chốt", upsell: "Bán thêm",
    };
    const crmStatusCounts: Record<string, number> = {};
    let pipelineValue = 0;
    tickets.forEach((t) => {
      const st = t.status || "cold";
      crmStatusCounts[st] = (crmStatusCounts[st] || 0) + 1;
      pipelineValue += t.value || 0;
    });
    const crmSummary = Object.entries(crmStatusCounts)
      .map(([st, count]) => `${crmStatusLabels[st] || st}: ${count} khách`)
      .join(", ");

    const crmLimit = 40;
    const crmList = tickets.slice(0, crmLimit).map((t) => {
      return `- ${t.customerName}${t.company ? ` (${t.company})` : ""} | trạng thái: ${crmStatusLabels[t.status] || t.status} | giá trị: ${(t.value || 0).toLocaleString("vi-VN")}đ${t.productOfChoice ? ` | quan tâm: ${t.productOfChoice}` : ""}${t.phone ? ` | SĐT: ${t.phone}` : ""}`;
    }).join("\n");
    const crmTruncate = tickets.length > crmLimit ? `\n(Chỉ hiển thị ${crmLimit}/${tickets.length} khách hàng đầu tiên)` : "";

    // 3. Kho hàng / sản phẩm
    const lowStock = products.filter((p) => (p.stock || 0) <= (p.minStockAlert ?? 15));
    const inventoryValue = products.reduce((sum, p) => sum + (p.stock || 0) * (p.price || 0), 0);
    const productLimit = 40;
    const productList = products.slice(0, productLimit).map((p) => {
      const low = (p.stock || 0) <= (p.minStockAlert ?? 15) ? " ⚠️ SẮP HẾT" : "";
      return `- ${p.name} (SKU: ${p.sku}) | tồn: ${p.stock ?? 0} ${p.unit} | giá: ${(p.price || 0).toLocaleString("vi-VN")}đ | ${p.category}${low}`;
    }).join("\n");
    const productTruncate = products.length > productLimit ? `\n(Chỉ hiển thị ${productLimit}/${products.length} sản phẩm đầu tiên)` : "";

    // 4. Dự án & công việc (Kanban)
    const taskStatusCounts: Record<string, number> = {};
    tasks.forEach((t) => {
      const st = t.status || "N/A";
      taskStatusCounts[st] = (taskStatusCounts[st] || 0) + 1;
    });
    const taskSummary = Object.entries(taskStatusCounts)
      .map(([st, count]) => `${st}: ${count} việc`)
      .join(", ");
    const projectList = projects.slice(0, 20).map((p) => `- ${p.name}`).join("\n");

    // 5. Marketing content gần đây
    const mktStatusCounts: Record<string, number> = {};
    marketingContents.forEach((m) => {
      const st = m.status || "draft";
      mktStatusCounts[st] = (mktStatusCounts[st] || 0) + 1;
    });
    const mktSummary = Object.entries(mktStatusCounts)
      .map(([st, count]) => `${st}: ${count}`)
      .join(", ");
    const mktList = marketingContents.slice(0, 10).map((m) => {
      return `- [${m.channel}] ${m.title} (${m.status})`;
    }).join("\n");

    // 6. Ví / số dư
    const walletInfo = wallet
      ? `${(wallet.balance || 0).toLocaleString("vi-VN")} ${wallet.currency || "USD"}`
      : "Chưa khởi tạo ví.";

    // 7. Dựng System Prompt giàu ngữ cảnh
    const systemPrompt: OpenRouterMessage = {
      role: "system",
      content: `Bạn là trợ lý ảo AI của hệ thống iGen ERP, hỗ trợ trực tiếp cho nhân sự của doanh nghiệp (mã: ${companyCode}).
Bạn có quyền truy cập dữ liệu thời gian thực dưới đây. Hãy trả lời chính xác các câu hỏi về khách hàng (CRM), kho hàng, dự án, công việc, marketing và tài chính dựa trên dữ liệu này.

═══ DỮ LIỆU THỜI GIAN THỰC CỦA DOANH NGHIỆP ═══

【1】TỔNG QUAN CRM (khách hàng tiềm năng):
- Phân bố: ${crmSummary || "Chưa có khách hàng nào."}
- Tổng giá trị pipeline: ${pipelineValue.toLocaleString("vi-VN")}đ
Danh sách chi tiết:${crmTruncate}
${crmList || "- Chưa có khách hàng nào."}

【2】KHO HÀNG / SẢN PHẨM:
- Tổng số mặt hàng: ${products.length} | Số mặt hàng sắp hết tồn: ${lowStock.length}
- Tổng giá trị tồn kho (ước tính): ${inventoryValue.toLocaleString("vi-VN")}đ
Danh sách:${productTruncate}
${productList || "- Chưa có sản phẩm nào."}

【3】DỰ ÁN & CÔNG VIỆC:
- Tổng số dự án: ${projects.length}
${projectList || "- Chưa có dự án nào."}
- Công việc (Kanban) theo trạng thái: ${taskSummary || "Chưa có công việc nào."}

【4】MARKETING CONTENT (gần đây):
- Theo trạng thái: ${mktSummary || "Chưa có nội dung nào."}
${mktList || "- Chưa có nội dung marketing nào."}

【5】TÀI CHÍNH:
- Số dư ví của bạn: ${walletInfo}

═══ QUY TẮC PHẢN HỒI ═══
- Trả lời bằng tiếng Việt, lịch sự, chuyên nghiệp, ngắn gọn và có cấu trúc (dùng dấu đầu dòng, **in đậm** khi cần).
- Chỉ dựa trên dữ liệu thực tế ở trên. Nếu người dùng hỏi về đối tượng không có trong dữ liệu, hãy báo lịch sự rằng không tìm thấy trong hệ thống của doanh nghiệp.
- Khi được hỏi về con số (doanh thu pipeline, tồn kho, số dư...), trả lời trực tiếp con số thực tế đã thống kê ở trên.
- Nếu được hỏi kiến thức nghiệp vụ chung (quy trình bán hàng, quản lý kho, marketing...), trả lời theo chuyên môn của bạn.
- Tuyệt đối không bịa dữ liệu không có trong ngữ cảnh.`,
    };

    const { text } = await openrouterChat({
      model,
      messages: [systemPrompt, ...this.normalizeMessages(messages)],
    });
    return text;
  }

  /** Lọc bỏ system message từ client và chuẩn hoá role về user/assistant */
  private static normalizeMessages(messages: ChatbotMessage[]): OpenRouterMessage[] {
    return messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content } as OpenRouterMessage));
  }
}
