import type { LeadIntakeField } from "../../../../../../shared/marketing-suite/lead-intake";

export interface LeadIntakeTemplate {
  id: string;
  name: string;
  description: string;
  goal: string;
  fields: LeadIntakeField[];
}

const name: LeadIntakeField = { key: "ho_va_ten", label: "Họ và tên", type: "text", required: true, question: "Tên khách tự cung cấp" };
const phone: LeadIntakeField = { key: "so_dien_thoai", label: "Số điện thoại", type: "phone", required: true, question: "Số điện thoại liên hệ của khách, không lấy số của nhân viên kỹ thuật" };
const need: LeadIntakeField = { key: "nhu_cau", label: "Nhu cầu", type: "long_text", required: true, question: "Sản phẩm, dịch vụ hoặc nhu cầu khách đang quan tâm" };

export const LEAD_INTAKE_TEMPLATES: LeadIntakeTemplate[] = [
  {
    id: "basic", name: "Cơ bản", description: "Lấy thông tin liên hệ và nhu cầu tư vấn.",
    goal: "Thu thập thông tin liên hệ và nhu cầu của khách để tư vấn",
    fields: [name, phone, need],
  },
  {
    id: "telecom", name: "Nhà mạng", description: "Đọc ảnh thuê bao, yêu cầu đấu nối và công việc kỹ thuật. Nhận diện từng hồ sơ bằng Account/Mã thuê bao.",
    goal: "Đọc thông tin nhà mạng từ ảnh vào đúng hồ sơ theo Account/Mã thuê bao; chỉ lưu thông tin có trong ảnh hoặc do khách cung cấp",
    fields: [
      { key: "account", label: "Mã thuê bao", type: "text", required: true, question: "Account hoặc mã thuê bao của khách; giữ nguyên mã, không lấy số điện thoại hay mã yêu cầu thay thế" },
      { ...name, required: false, question: "Tên khách hàng hoặc người đứng tên thuê bao, không lấy tên người xử lý hay nhân viên kỹ thuật" },
      { ...phone, required: false },
      { key: "dia_chi_lap_dat", label: "Địa chỉ lắp đặt", type: "long_text", required: false, question: "Địa chỉ lắp đặt hoặc địa chỉ thuê bao của khách, không lấy địa chỉ kết cuối thay thế" },
      { key: "ma_yeu_cau", label: "Mã yêu cầu", type: "text", required: false, question: "Mã yêu cầu đấu nối hiển thị trong ảnh" },
      { key: "tong_tien", label: "Tổng tiền", type: "currency", required: false, question: "Tổng tiền hiển thị trong yêu cầu đấu nối, không tự tính hoặc suy đoán" },
      { key: "nhan_vien_ky_thuat", label: "Nhân viên kỹ thuật", type: "text", required: false, question: "Nhân viên kỹ thuật hoặc người xử lý công việc; không phải tên khách hàng" },
      { key: "so_dien_thoai_ky_thuat", label: "Số điện thoại nhân viên kỹ thuật", type: "phone", required: false, question: "Số điện thoại người xử lý hoặc nhân viên kỹ thuật; không dùng làm số điện thoại khách hàng" },
      { key: "ma_ket_cuoi", label: "Mã kết cuối", type: "text", required: false, question: "Mã kết cuối trong thông tin hạ tầng hoặc mô tả công việc" },
      { key: "ma_tram", label: "Mã trạm", type: "text", required: false, question: "Mã trạm trong thông tin hạ tầng" },
      { key: "trang_thai_cong_viec", label: "Trạng thái công việc", type: "text", required: false, question: "Trạng thái công việc hoặc yêu cầu hiển thị trong ảnh" },
    ],
  },
  {
    id: "healthcare", name: "Đặt lịch khám", description: "Thông tin người đi khám, gói quan tâm và ngày dự kiến. Không mặc định hỏi ngày sinh.",
    goal: "Tư vấn gói khám và thu thập thông tin người đi khám khi khách có nhu cầu đặt lịch; không tự xác nhận lịch đã được cơ sở chấp thuận",
    fields: [
      { ...name, question: "Họ tên người đi khám do khách cung cấp" }, phone,
      { ...need, question: "Gói khám hoặc dịch vụ khách muốn đặt, chỉ lấy thông tin đã trao đổi" },
      { key: "gioi_tinh", label: "Giới tính", type: "single_select", options: ["Nam", "Nữ", "Khác"], required: false, question: "Giới tính người đi khám do khách cung cấp; không suy đoán từ tên hoặc gói khám" },
      { key: "ngay_hen", label: "Ngày khám dự kiến", type: "date", required: false, question: "Ngày khách muốn đi khám, chỉ ghi nhận dự kiến, không tự xác nhận còn lịch" },
    ],
  },
  {
    id: "education", name: "Tư vấn khóa học", description: "Khóa học quan tâm, trình độ hiện tại và thời gian học phù hợp.",
    goal: "Thu thập nhu cầu học và thông tin liên hệ để tư vấn khóa học phù hợp",
    fields: [name, phone, { ...need, question: "Khóa học hoặc mục tiêu học khách đang quan tâm" },
      { key: "trinh_do", label: "Trình độ hiện tại", type: "text", required: false, question: "Trình độ hoặc kinh nghiệm hiện tại do khách chia sẻ" },
      { key: "thoi_gian_hoc", label: "Thời gian học phù hợp", type: "text", required: false, question: "Khung giờ hoặc thời gian khách có thể học" },
    ],
  },
  {
    id: "sales", name: "Bán hàng", description: "Sản phẩm khách quan tâm, số lượng và địa chỉ nhận hàng.",
    goal: "Tư vấn sản phẩm và thu thập thông tin đặt hàng khi khách muốn mua; không tự chốt giá hoặc cam kết giao hàng",
    fields: [name, phone, { ...need, question: "Sản phẩm hoặc mặt hàng khách muốn mua" },
      { key: "so_luong", label: "Số lượng", type: "number", required: false, question: "Số lượng khách muốn mua, không tự mặc định" },
      { key: "dia_chi_nhan_hang", label: "Địa chỉ nhận hàng", type: "long_text", required: false, question: "Địa chỉ khách cung cấp để nhận hàng khi có nhu cầu đặt mua" },
    ],
  },
];

// These names describe the same intake fields even when a Page uses a custom key.
const aliases: Record<string, string> = {
  account: "ma_thue_bao", subscriber_code: "ma_thue_bao", telecom_subscriber_code: "ma_thue_bao",
  so_thue_bao: "ma_thue_bao", thue_bao: "ma_thue_bao", tai_khoan_thue_bao: "ma_thue_bao",
  name: "ho_va_ten", full_name: "ho_va_ten", ho_ten: "ho_va_ten", ten_khach_hang: "ho_va_ten",
  phone: "so_dien_thoai", sdt: "so_dien_thoai", dien_thoai: "so_dien_thoai",
};
function identity(value: string) {
  const key = value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return aliases[key] || key;
}

export function missingTemplateFields(existing: LeadIntakeField[], template: LeadIntakeTemplate) {
  const used = new Set(existing.flatMap(field => [identity(field.key), identity(field.label)]));
  return template.fields.filter(field => !used.has(identity(field.key)) && !used.has(identity(field.label)));
}
