/**
 * Chatbot Service
 * ───────────────
 * Trợ lý ảo AI cho hệ thống iGen ERP. Truy vấn dữ liệu thời gian thực thuộc
 * doanh nghiệp của người dùng (theo companyCode) rồi dựng system prompt giàu
 * ngữ cảnh, gọi OpenRouter (có fallback 3 tầng) để sinh câu trả lời.
 */

import { openrouterChat, type OpenRouterMessage } from "./openrouter.service";
import { ProductModel } from "../model/product.model";
import { KanbanTaskModel } from "../model/kanban-task.model";
import { ProjectModel } from "../model/project.model";
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
          "CRM, marketing, kho hàng, dự án... Trả lời bằng tiếng Việt lịch sự, dễ hiểu, thuần văn bản (PLAIN TEXT), " +
          "TUYỆT ĐỐI KHÔNG dùng các ký tự định dạng Markdown như dấu thăng #, dấu sao **, *, gạch chân __, gạch ngược ` hay link [text](url).",
      };
      const { text } = await openrouterChat({
        model,
        messages: [generalPrompt, ...this.normalizeMessages(messages)],
      });
      return this.cleanMarkdownText(text);
    }

    // 1. Truy vấn dữ liệu doanh nghiệp song song
    const [products, tasks, projects, wallet] = await Promise.all([
      ProductModel.find({ companyCode }).lean(),
      KanbanTaskModel.find({ companyCode }).lean(),
      ProjectModel.find({ companyCode }).lean(),
      WalletModel.findOne({ userId: user.id }).lean(),
    ]);

    // 2. Kho hàng / sản phẩm
    const lowStock = products.filter((p) => (p.stock || 0) <= (p.minStockAlert ?? 15));
    const inventoryValue = products.reduce((sum, p) => sum + (p.stock || 0) * (p.price || 0), 0);
    const productLimit = 40;
    const productList = products.slice(0, productLimit).map((p) => {
      const low = (p.stock || 0) <= (p.minStockAlert ?? 15) ? " ⚠️ SẮP HẾT" : "";
      return `- ${p.name} (SKU: ${p.sku}) | tồn: ${p.stock ?? 0} ${p.unit} | giá: ${(p.price || 0).toLocaleString("vi-VN")}đ | ${p.category}${low}`;
    }).join("\n");
    const productTruncate = products.length > productLimit ? `\n(Chỉ hiển thị ${productLimit}/${products.length} sản phẩm đầu tiên)` : "";

    // 3. Dự án & công việc (Kanban)
    const taskStatusCounts: Record<string, number> = {};
    tasks.forEach((t) => {
      const st = t.status || "N/A";
      taskStatusCounts[st] = (taskStatusCounts[st] || 0) + 1;
    });
    const taskSummary = Object.entries(taskStatusCounts)
      .map(([st, count]) => `${st}: ${count} việc`)
      .join(", ");
    const projectList = projects.slice(0, 20).map((p) => `- ${p.name}`).join("\n");

    // 4. Ví / số dư
    const walletInfo = wallet
      ? `${(wallet.balance || 0).toLocaleString("vi-VN")} ${wallet.currency || "USD"}`
      : "Chưa khởi tạo ví.";

    // 5. Dựng System Prompt giàu ngữ cảnh
    const systemPrompt: OpenRouterMessage = {
      role: "system",
      content: `Bạn là trợ lý ảo AI của hệ thống iGen ERP, hỗ trợ trực tiếp cho nhân sự của doanh nghiệp (mã: ${companyCode}).
Bạn có quyền truy cập dữ liệu thời gian thực dưới đây. Hãy trả lời chính xác các câu hỏi về kho hàng, dự án, công việc và tài chính dựa trên dữ liệu này.

DỮ LIỆU THỜI GIAN THỰC CỦA DOANH NGHIỆP:

1. KHO HÀNG / SẢN PHẨM:
- Tổng số mặt hàng: ${products.length} | Số mặt hàng sắp hết tồn: ${lowStock.length}
- Tổng giá trị tồn kho (ước tính): ${inventoryValue.toLocaleString("vi-VN")}đ
Danh sách:${productTruncate}
${productList || "- Chưa có sản phẩm nào."}

2. DỰ ÁN & CÔNG VIỆC:
- Tổng số dự án: ${projects.length}
${projectList || "- Chưa có dự án nào."}
- Công việc (Kanban) theo trạng thái: ${taskSummary || "Chưa có công việc nào."}

3. TÀI CHÍNH:
- Số dư ví của bạn: ${walletInfo}

QUY TẮC PHẢN HỒI:
- Trả lời bằng tiếng Việt lịch sự, thân thiện, dễ hiểu, thuần văn bản (PLAIN TEXT).
- TUYỆT ĐỐI KHÔNG sử dụng bất kỳ ký tự định dạng Markdown nào (như dấu thăng #, ##, dấu sao **, *, gạch chân __, _, thẻ mã code, hay link).
- Để trình bày danh sách hoặc nhiều ý, chỉ dùng dấu gạch ngang (-) thuần túy ở đầu dòng hoặc đánh số thứ tự (1, 2, 3) đơn giản, xuống dòng rõ ràng.
- Chỉ dựa trên dữ liệu thực tế ở trên. Nếu người dùng hỏi về đối tượng không có trong dữ liệu, hãy báo lịch sự rằng không tìm thấy trong hệ thống của doanh nghiệp.
- Khi được hỏi về con số (doanh thu pipeline, tồn kho, số dư...), trả lời trực tiếp con số thực tế đã thống kê ở trên.
- Tuyệt đối không bịa dữ liệu không có trong ngữ cảnh.`,
    };

    const { text } = await openrouterChat({
      model,
      messages: [systemPrompt, ...this.normalizeMessages(messages)],
    });
    return this.cleanMarkdownText(text);
  }

  /** Loại bỏ toàn bộ ký tự định dạng Markdown khỏi phản hồi */
  public static cleanMarkdownText(text: string): string {
    if (!text) return "";
    return text
      // Loại bỏ khối code ```code```
      .replace(/```[\s\S]*?```/g, (match) => {
        return match.replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "");
      })
      // Loại bỏ inline code `text`
      .replace(/`([^`]+)`/g, "$1")
      // Loại bỏ bold **text** hoặc __text__
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      // Loại bỏ italic *text* hoặc _text_
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/_([^_]+)_/g, "$1")
      // Loại bỏ strikethrough ~~text~~
      .replace(/~~([^~]+)~~/g, "$1")
      // Loại bỏ tiêu đề #, ##, ### ở đầu dòng
      .replace(/^#+\s+/gm, "")
      // Loai bỏ link markdown [label](url) -> label (url)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
      // Loại bỏ trích dẫn > ở đầu dòng
      .replace(/^>\s+/gm, "")
      // Dọn dẹp dấu sao hoặc backticks còn sót
      .replace(/[*_`]/g, "")
      .trim();
  }

  /** Lọc bỏ system message từ client và chuẩn hoá role về user/assistant */
  private static normalizeMessages(messages: ChatbotMessage[]): OpenRouterMessage[] {
    return messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content } as OpenRouterMessage));
  }
}
