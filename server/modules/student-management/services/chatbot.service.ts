import { logger } from "../config/logger";
import { Student } from "../models/student.model";
import { Exam } from "../models/exam.model";
import { Payment } from "../models/payment.model";

export class ChatbotService {
  static async getResponse(ownerId: string, messages: { role: string; content: string }[]): Promise<string> {
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    const model = process.env.OPENROUTER_MODEL?.trim() || "google/gemini-2.5-flash";

    if (!apiKey) {
      throw new Error("Cấu hình khóa API (OPENROUTER_API_KEY) chưa được thiết lập trên Server.");
    }

    // 1. Query MongoDB database for data owned by this teacher (ownerId)
    const [students, exams, allPayments] = await Promise.all([
      Student.find({ ownerId }),
      Exam.find({ ownerId, status: { $in: ["Sắp diễn ra", "Đã xác nhận"] } }),
      Payment.find({ ownerId }).sort({ createdAt: -1 }),
    ]);

    // 2. Process Revenue statistics
    let totalRevenue = 0;
    let monthlyRevenue = 0;

    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentYear = now.getFullYear();

    allPayments.forEach(p => {
      totalRevenue += p.amount || 0;

      if (p.date) {
        let pMonth = -1;
        let pYear = -1;

        // Split by / or - to parse DD/MM/YYYY or YYYY-MM-DD
        const parts = p.date.split(/[/-]/);
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            // YYYY-MM-DD or YYYY/MM/DD
            pYear = parseInt(parts[0], 10);
            pMonth = parseInt(parts[1], 10);
          } else if (parts[2].length === 4) {
            // DD-MM-YYYY or DD/MM/YYYY
            pYear = parseInt(parts[2], 10);
            pMonth = parseInt(parts[1], 10);
          }
        } else {
          const d = new Date(p.date);
          if (!isNaN(d.getTime())) {
            pMonth = d.getMonth() + 1;
            pYear = d.getFullYear();
          }
        }

        if (pMonth === currentMonth && pYear === currentYear) {
          monthlyRevenue += p.amount || 0;
        }
      }
    });

    // 3. Process Student data
    const statusCounts: Record<string, number> = {};
    students.forEach(s => {
      const studentStatuses = Array.isArray(s.status) ? s.status : [s.status];
      studentStatuses.forEach((st: string) => {
        if (st) {
          statusCounts[st] = (statusCounts[st] || 0) + 1;
        }
      });
    });
    const statusSummary = Object.entries(statusCounts)
      .map(([status, count]) => `${status}: ${count} học viên`)
      .join(", ");

    const limit = 100;
    const studentList = students.slice(0, limit).map(s => {
      const datProgress = s.progress?.dat ? `${s.progress.dat.kmDone}/${s.progress.dat.totalKm} km` : '0 km';
      const theoryProgress = s.progress?.theory?.completed ? 'Lý thuyết Đạt' : 'Lý thuyết Chưa đạt';
      const statusStr = Array.isArray(s.status) ? s.status.join(', ') : s.status;
      const drivingInfo = s.rank ? `, hạng ${s.rank}, DAT: ${datProgress}, ${theoryProgress}` : '';
      return `- ${s.fullName} (${s.phone}, trạng thái: ${statusStr}, đã đóng: ${s.paidAmount?.toLocaleString('vi-VN')}đ / học phí: ${s.fee}đ${drivingInfo})`;
    }).join('\n');

    const truncateNotice = students.length > limit ? `\n(Lưu ý: Chỉ hiển thị danh sách ${limit} học viên đầu tiên để tối ưu hóa hiệu năng)` : "";

    // 4. Process Exam data
    const examList = exams.map(e => {
      return `- ${e.name} (${e.rank ? `Hạng ${e.rank}, ` : ''}Ngày dự kiến: ${e.tentativeDate}, Địa điểm: ${e.location}, Trạng thái: ${e.status})`;
    }).join('\n');

    // 5. Process Payment data (recent 10)
    const payments = allPayments.slice(0, 10);
    const paymentList = payments.map(p => {
      return `- Học viên ${p.studentName}: Nộp ${p.amount?.toLocaleString('vi-VN')}đ ngày ${p.date} (${p.note || "Không có ghi chú"})`;
    }).join('\n');

    // 6. Construct Context-Aware System Prompt
    const systemPrompt = {
      role: "system",
      content: `Bạn là trợ lý ảo hỗ trợ quản lý học viên dành riêng cho Giáo viên của trung tâm đào tạo đa ngành (lái xe, ngoại ngữ, kỹ năng...).
Bạn có quyền truy cập trực tiếp vào dữ liệu hiện tại của Giáo viên này. Hãy trả lời các thắc mắc về tình hình học viên, lịch thi, lớp học, học phí, doanh thu chính xác dựa trên dữ liệu dưới đây.

DỮ LIỆU THỜI GIAN THỰC CỦA GIÁO VIÊN:
1. Tổng quan học viên: ${statusSummary || "Chưa có học viên nào."}
2. Danh sách chi tiết học viên:${truncateNotice}
${studentList || "- Không có học viên nào."}

3. Các đợt thi sắp tới:
${examList || "- Không có đợt thi nào sắp tới."}

4. Lịch sử đóng học phí gần đây (tối đa 10 giao dịch):
${paymentList || "- Chưa có giao dịch đóng học phí nào."}

5. Thống kê doanh thu học phí của giáo viên này:
- Tổng doanh thu tích lũy: ${totalRevenue.toLocaleString('vi-VN')}đ
- Doanh thu tháng này (Tháng ${currentMonth}/${currentYear}): ${monthlyRevenue.toLocaleString('vi-VN')}đ

QUY TẮC PHẢN HỒI:
- Luôn trả lời lịch sự, chuyên nghiệp, xưng hô thân thiện (chào Thầy/Cô hoặc chào Giáo viên).
- Trả lời bằng tiếng Việt rõ ràng, ngắn gọn, có cấu trúc (sử dụng dấu đầu dòng, danh sách nếu cần thiết).
- Trả lời dựa trên dữ liệu thực tế được cung cấp ở trên. Nếu người dùng hỏi về học viên không có trong danh sách trên, hãy báo lịch sự rằng không tìm thấy học viên này trong hệ thống của Thầy/Cô.
- Nếu người dùng hỏi về doanh thu (tổng doanh thu, doanh thu tháng này,...), hãy trả lời trực tiếp con số thực tế được thống kê ở trên một cách rõ ràng.
- Nếu được hỏi về kiến thức chung của ngành đào tạo (quy chế học/thi sát hạch lái xe, chứng chỉ ngoại ngữ, chương trình kỹ năng...), hãy trả lời theo kiến thức chuyên môn của bạn về lĩnh vực tương ứng.`
    };

    const payload = {
      model: model,
      messages: [systemPrompt, ...messages],
    };

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://student.igentechsolutions.com/",
          "X-Title": "Student Management System",
        },
        body: JSON.stringify(payload),
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
      logger.error("[ChatbotService Error]: %o", error);
      throw error;
    }
  }
}
