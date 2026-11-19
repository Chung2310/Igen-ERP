import type { AssistantDocumentFormat } from "../../src/shared/assistant-document";

/** Reviewed guidance is bundled locally; generation never downloads third-party instructions. */
export const DOCUMENT_RULES_VERSION = "igen-documents-2026-11-19.2";
export const documentRuleSources = [
  { id: "anthropic-xlsx", url: "https://github.com/anthropics/skills/blob/main/skills/xlsx/SKILL.md", reviewedAt: "2026-11-13" },
  { id: "anthropic-docx", url: "https://github.com/anthropics/skills/blob/main/skills/docx/SKILL.md", reviewedAt: "2026-11-13" },
  { id: "anthropic-pdf", url: "https://github.com/anthropics/skills/blob/main/skills/pdf/SKILL.md", reviewedAt: "2026-11-13" },
  { id: "openai-pdf", url: "https://github.com/openai/skills/blob/main/skills/.curated/pdf/SKILL.md", reviewedAt: "2026-11-13" },
] as const;

const commonRules = `QUY ƯỚC TÀI LIỆU IGEN
- Ưu tiên yêu cầu cụ thể về ngôn ngữ, tên, thứ tự cột và phạm vi sửa. Giữ nguyên phần không được yêu cầu thay đổi.
- Bám sát quy ước của file mẫu và yêu cầu định dạng cụ thể nếu có. Với Word/PDF mới, tự bố trí theo loại tài liệu (hợp đồng, đơn, biên bản, công văn, báo cáo, kế hoạch). Tiêu đề chính căn giữa. Quốc hiệu, tiêu ngữ và khối ký tên căn giữa, dòng địa danh/ngày tháng căn phải khi phù hợp, không bắt người dùng nhắc từng mục. Nội dung điều khoản và thông tin các bên căn trái. Bảng có tiêu đề cột căn giữa, số căn phải, boolean căn giữa, văn bản căn trái. Không đổi chuỗi mã hoặc số điện thoại thành số.
- Phân biệt số liệu được cung cấp với giả định; không bịa nguồn hoặc số liệu. Thiếu dữ kiện quan trọng thì hỏi lại.
- Dùng tiêu đề rõ nghĩa, nội dung hoàn chỉnh và đơn vị nhất quán. Không để mã công cụ hoặc lời nhắc nội bộ trong tài liệu.
- Nếu cần ghi giả định/nguồn, dùng mục riêng trong sections; chỉ ghi nguồn thật sự đã được cung cấp. Không tự thêm số liệu minh họa vào dữ liệu thực.
- Gán sections.role theo vai trò: body (thân bài, căn trái), masthead (quốc hiệu/tiêu ngữ), subtitle (phụ đề), date (địa danh/ngày tháng), signature (khối ký tên). Tách từng khối có vai trò khác nhau. alignment tường minh luôn ưu tiên hơn role. Không thêm quốc hiệu hoặc khối ký tên vào tài liệu không cần chúng.
- Chỉ dùng cấu trúc mà bộ xuất hỗ trợ. Ứng dụng chưa có bộ tính công thức, biểu đồ, ảnh, logo hoặc mẫu tải lên; không khẳng định đã tạo những phần này.`;

const spreadsheetRules = `BẢNG TÍNH
- Giữ chính xác tên sheet, nhãn cột, thứ tự và kiểu dữ liệu; không đổi mã có số 0 đầu thành số.
- Khi sửa bảng được tải lên, giữ đủ tất cả tiêu đề cột và dòng dữ liệu; chỉ sửa ô được yêu cầu. Nếu chưa rõ giá trị đúng, hỏi lại thay vì tự đoán.
- Ghi đơn vị trong nhãn khi cần. Không tự đổi chuỗi ngày, tỷ lệ hoặc tiền nếu chưa rõ quy ước.
- Không tạo công thức dạng chuỗi, không tự điền kết quả tính toán chưa được kiểm chứng. Nếu yêu cầu phụ thuộc công thức, trả document:null và giải thích giới hạn để người dùng chọn dữ liệu tĩnh đã xác nhận.
- Chỉ thêm ví dụ khi người dùng yêu cầu mẫu/minh họa và ghi rõ đó là ví dụ.`;

const formatRules: Record<AssistantDocumentFormat, string> = {
  xlsx: `${spreadsheetRules}\n- Tách bảng theo chức năng; ghi chú/nguồn ở sections. Backend giữ tên tab hợp lệ, bố trí cột, dòng tiêu đề và bộ lọc.\n- Làm theo yêu cầu căn lề của người dùng hoặc mẫu. Khi cần, khai báo headerAlignments, columnAlignments hoặc cellAlignments theo đúng thứ tự cột/dòng; dùng null cho vị trí không cần ghi đè. Khi không có chỉ định, tiêu đề cột căn giữa và ô số căn phải. Không đổi kiểu hoặc giá trị dữ liệu để định dạng.`,
  csv: `${spreadsheetRules}\n- CSV chỉ gồm một bảng. Giữ đúng bộ cột; không nhét ghi chú vào dòng dữ liệu hoặc bỏ bảng khác. CSV không lưu căn lề; nếu người dùng cần định dạng căn lề, hỏi chuyển sang XLSX. Nếu cần nhiều bảng/ghi chú ngoài cột, hỏi chuyển sang XLSX.`,
  docx: `WORD
- Dùng sections.heading cho tiêu đề, sections.text cho đoạn văn và sheets cho bảng; không giả lập bảng bằng dấu cách.
- Chia đoạn rõ ràng; không lặp ký hiệu Markdown ở đầu heading. Không thay toàn bộ nội dung khi chỉ sửa một mục.
- Dùng titleAlignment và section.alignment để diễn đạt bố cục. Với hợp đồng, titleAlignment là center nếu không có yêu cầu khác. Tách quốc hiệu/tiêu ngữ và khối ký tên thành sections riêng có alignment center, không gộp chung với điều khoản để tránh căn giữa cả thân bài. Giữ nguyên cách căn lề đã chỉ định khi chỉnh sửa tài liệu. Với bảng, có thể dùng mặc định của bộ xuất hoặc đặt headerAlignments, columnAlignments, cellAlignments để làm theo mẫu.
- Backend tạo heading, đoạn và bảng có độ rộng cố định phù hợp A4, lặp tiêu đề bảng và số trang.`,
  pdf: `PDF
- Bố cục dễ đọc và làm theo yêu cầu căn lề của người dùng hoặc mẫu; không cố nhét bảng rộng vào trang bằng chữ quá nhỏ.
- Giữ tiếng Việt và nguồn tham chiếu dễ đọc. Backend chia trang, giữ heading với nội dung tiếp theo và đánh số trang.
- Kiểm tra cấu trúc file không thay thế việc render để rà chữ tràn, bảng vỡ và ký tự lỗi; không nói đã kiểm tra trực quan nếu chưa thực hiện.`,
  txt: "VĂN BẢN THUẦN: dùng tiêu đề và đoạn văn rõ ràng, bảng phân tách bằng tab; không mô tả màu hoặc căn lề mà TXT không thể biểu diễn.",
  md: "MARKDOWN: dùng heading và bảng Markdown nhất quán; giữ nội dung và thứ tự cột, tránh HTML tùy ý hoặc placeholder nội bộ. Không thể lưu căn lề tùy chỉnh.",
  json: "JSON: file chứa cấu trúc tài liệu title/sections/sheets của ứng dụng; giữ đúng kiểu số, chuỗi, boolean và null. Nếu người dùng yêu cầu schema khác, giải thích giới hạn thay vì khẳng định đã xuất đúng schema đó.",
};

export function documentCreationRules(formats: readonly AssistantDocumentFormat[]): string {
  return [commonRules, ...[...new Set(formats)].map(format => formatRules[format])].join("\n\n");
}
