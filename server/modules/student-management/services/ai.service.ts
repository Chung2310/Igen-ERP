import { logger } from "../config/logger";

interface AIStudentInput {
  fullName: string;
  rank?: string;
  registrationDate: string;
  status: string | string[];
  fee: string;
}

export class AIService {
  static async analyzeStudent(student: AIStudentInput): Promise<string> {
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    const model = process.env.OPENROUTER_MODEL?.trim() || "google/gemini-2.5-flash";

    if (!apiKey) {
      throw new Error("Cấu hình khóa API (OPENROUTER_API_KEY) chưa được thiết lập trên Server.");
    }

    // Học viên ngành lái xe (có hạng bằng) nhận tư vấn theo quy trình sát hạch; ngành khác nhận tư vấn lộ trình chung
    const isDriving = !!student.rank;
    const prompt = `
Bạn là một cố vấn đào tạo chuyên nghiệp của trung tâm đào tạo đa ngành${isDriving ? ' (chuyên môn sâu về đào tạo & sát hạch lái xe)' : ''}. Hãy phân tích hồ sơ học viên sau và đưa ra tư vấn lộ trình học tập${isDriving ? ', thi sát hạch' : ''}:

Học viên: ${student.fullName}
${isDriving ? `Hạng bằng đăng ký: ${student.rank}\n` : ''}Ngày đăng ký: ${student.registrationDate}
Trạng thái hiện tại: ${Array.isArray(student.status) ? student.status.join(', ') : student.status}
Học phí: ${student.fee} VND

Yêu cầu:
1. Đưa ra nhận xét về tình trạng hồ sơ.
2. Gợi ý các bước tiếp theo học viên cần thực hiện${isDriving ? ' (ví dụ: KSK, nộp ảnh, học luật, tập xe chip)' : ' (ví dụ: hoàn thiện hồ sơ, xếp lớp, lộ trình học)'}.
3. ${isDriving ? `Đưa ra lời khuyên để tỷ lệ đậu cao nhất cho hạng bằng ${student.rank}.` : 'Đưa ra lời khuyên để học viên đạt kết quả tốt nhất trong khóa học.'}
4. Trình bày ngắn gọn, chuyên nghiệp, khích lệ.

Hãy phản hồi bằng tiếng Việt, định dạng Markdown, phong cách tinh tế và truyền cảm hứng.
    `.trim();

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL,
          "X-Title": "Student Management System",
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        logger.error("[OpenRouter API Error Response]: %s", errText);
        throw new Error(`Lỗi kết nối dịch vụ OpenRouter AI (Mã lỗi: ${response.status} ${response.statusText}).`);
      }

      const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      const choice = data.choices?.[0];
      const content = choice?.message?.content;

      if (!content) {
        throw new Error("Không nhận được nội dung phản hồi hợp lệ từ mô hình AI.");
      }

      return content;
    } catch (error) {
      logger.error("[AIService Error]: %o", error);
      throw error;
    }
  }
}
