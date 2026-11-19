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
    id: "telecom", name: "Nhà mạng", description: "Thông tin khách hàng để đối soát FPT theo Số hợp đồng, VNPT theo Account; giữ dịch vụ và mốc thời gian.",
    goal: "Đọc thông tin khách hàng nhà mạng từ ảnh. FPT nhận diện bằng Số hợp đồng, VNPT bằng Account. Chỉ lưu dữ kiện có trong ảnh hoặc khách cung cấp; không thu thập chi phí hay hỏi để điền đủ mọi cột.",
    fields: [
      { key: "nha_mang", label: "Nhà mạng", type: "single_select", options: ["FPT", "VNPT"], required: false, question: "Nhà mạng FPT hoặc VNPT được ghi rõ trong tài liệu hoặc do khách cung cấp; không suy đoán từ tên khách" },
      { key: "so_hop_dong", label: "Số hợp đồng", type: "text", required: false, question: "Số HĐ hoặc mã hợp đồng FPT; giữ số 0 đầu, không dùng số hóa đơn, mã yêu cầu hay Account thay thế" },
      { key: "account", label: "Mã khách hàng / Account", type: "text", required: false, question: "Account hoặc mã thuê bao VNPT; giữ nguyên mã, không lấy số điện thoại hay mã yêu cầu thay thế" },
      { ...name, required: false, question: "Tên khách hàng hoặc người đứng tên thuê bao; không lấy tên nhân viên kỹ thuật hay người xử lý" },
      { key: "dia_chi_lap_dat", label: "Địa chỉ", type: "long_text", required: false, question: "Địa chỉ khách hàng hoặc địa chỉ lắp đặt gồm tòa nhà và căn hộ nếu có; không dùng địa chỉ kết cuối thay thế" },
      { key: "dich_vu", label: "Dịch vụ", type: "long_text", required: false, question: "Các dịch vụ của khách được ghi rõ như Internet, Fiber, FTTH, MyTV, truyền hình; giữ đủ các dịch vụ" },
      { key: "ky_doi_soat", label: "Kỳ đối soát", type: "text", required: false, question: "Tháng, quý hoặc khoảng thời gian của bảng kê; không lấy ngày gửi ảnh thay thế" },
      { key: "moc_hoa_mang", label: "Mốc hòa mạng / kích hoạt", type: "text", required: false, question: "Ngày Online, hòa mạng hoặc kích hoạt thuê bao. Nếu chỉ có tháng/năm thì giữ tháng/năm; không tự thêm ngày, không lấy ngày giao việc hoặc hẹn khách thay thế" },
      { ...phone, required: false },
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
