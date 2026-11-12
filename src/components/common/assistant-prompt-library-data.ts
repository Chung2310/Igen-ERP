export interface AssistantPromptTemplate {
  id: string;
  title: string;
  description: string;
  category: string;
  prompt: string;
  owner: "igen" | "user";
}

export const assistantPromptCategories = [
  "Tất cả",
  "Marketing",
  "Kinh doanh",
  "Tài chính",
  "Nhân sự",
  "Hành chính công",
  "Công nghệ thông tin",
  "Giáo dục",
] as const;

export const starterAssistantPromptTemplates: AssistantPromptTemplate[] = [
  {
    id: "igen-marketing-plan",
    title: "Lập kế hoạch nội dung mạng xã hội",
    description: "Tạo lịch nội dung theo mục tiêu, nhóm khách hàng và kênh truyền thông.",
    category: "Marketing",
    prompt: "Bạn là chuyên gia marketing. Hãy lập kế hoạch nội dung mạng xã hội trong [thời gian] cho [sản phẩm/dịch vụ], hướng đến [nhóm khách hàng]. Mục tiêu là [mục tiêu]. Trình bày thành bảng gồm ngày đăng, chủ đề, thông điệp, định dạng và lời kêu gọi hành động. Giữ giọng điệu [phong cách] và không tự thêm thông tin chưa được cung cấp.",
    owner: "igen",
  },
  {
    id: "igen-marketing-copy",
    title: "Viết bài giới thiệu sản phẩm",
    description: "Biên tập nội dung bán hàng rõ lợi ích, đúng giọng thương hiệu.",
    category: "Marketing",
    prompt: "Hãy viết bài giới thiệu [sản phẩm/dịch vụ] cho [đối tượng]. Điểm nổi bật đã xác nhận: [danh sách thông tin]. Giọng điệu: [giọng thương hiệu]. Tạo tiêu đề thu hút, phần nội dung ngắn gọn và lời kêu gọi hành động. Không phóng đại công dụng hoặc bổ sung dữ liệu ngoài thông tin tôi đưa.",
    owner: "igen",
  },
  {
    id: "igen-sales-competitor",
    title: "Phân tích đối thủ cạnh tranh",
    description: "So sánh các đối thủ theo tiêu chí và chỉ ra cơ hội hành động.",
    category: "Kinh doanh",
    prompt: "Bạn là chuyên gia phân tích kinh doanh. Dựa trên thông tin tôi cung cấp về [thị trường] và các đối thủ [danh sách], hãy lập bảng so sánh theo sản phẩm, khách hàng mục tiêu, giá trị khác biệt, kênh bán và rủi ro. Phân biệt dữ kiện với nhận định, nêu rõ phần nào còn thiếu dữ liệu và đề xuất 3 việc có thể kiểm chứng tiếp theo.",
    owner: "igen",
  },
  {
    id: "igen-sales-consultation",
    title: "Soạn kịch bản tư vấn khách hàng",
    description: "Chuẩn bị câu hỏi khám phá nhu cầu và hướng xử lý phản hồi.",
    category: "Kinh doanh",
    prompt: "Soạn kịch bản tư vấn [sản phẩm/dịch vụ] cho nhóm khách hàng [đối tượng]. Hãy gồm lời mở đầu tự nhiên, 5 câu hỏi tìm hiểu nhu cầu, cách giới thiệu lợi ích phù hợp và câu trả lời cho các băn khoăn [danh sách băn khoăn]. Giữ giọng tư vấn chân thành, không gây áp lực và không cam kết điều chưa được xác nhận.",
    owner: "igen",
  },
  {
    id: "igen-finance-report",
    title: "Tóm tắt báo cáo tài chính",
    description: "Diễn giải các chỉ số chính, biến động và điểm cần kiểm tra.",
    category: "Tài chính",
    prompt: "Bạn là chuyên viên phân tích tài chính. Hãy đọc số liệu trong [báo cáo/kỳ], tóm tắt doanh thu, chi phí, lợi nhuận, dòng tiền và các biến động đáng chú ý. So sánh với [kỳ tham chiếu] nếu có. Trình bày kết luận, nguyên nhân được dữ liệu hỗ trợ và câu hỏi cần xác minh; không suy đoán nguyên nhân khi báo cáo chưa đủ căn cứ.",
    owner: "igen",
  },
  {
    id: "igen-hr-job-description",
    title: "Viết mô tả công việc tuyển dụng",
    description: "Chuẩn hóa nhiệm vụ, yêu cầu và tiêu chí đánh giá ứng viên.",
    category: "Nhân sự",
    prompt: "Hãy soạn mô tả tuyển dụng cho vị trí [tên vị trí] thuộc [phòng ban]. Thông tin công việc: [nhiệm vụ], [địa điểm/hình thức], [thời gian], [quyền lợi đã duyệt]. Chia nội dung thành giới thiệu, trách nhiệm, yêu cầu, quyền lợi và cách ứng tuyển. Không tự đặt mức lương hoặc quyền lợi chưa được cung cấp.",
    owner: "igen",
  },
  {
    id: "igen-admin-document",
    title: "Soạn thảo văn bản hành chính",
    description: "Tạo bản nháp mạch lạc theo mục đích và thông tin đầu vào.",
    category: "Hành chính công",
    prompt: "Hãy tạo bản nháp [loại văn bản] với mục đích [mục đích], đơn vị ban hành [đơn vị], người nhận [đối tượng] và các thông tin đã xác nhận: [dữ liệu]. Dùng ngôn ngữ hành chính rõ ràng, bố cục phù hợp, đánh dấu [cần bổ sung] ở những trường còn thiếu. Không tự tạo số hiệu, căn cứ pháp lý hoặc thẩm quyền.",
    owner: "igen",
  },
  {
    id: "igen-it-code-review",
    title: "Viết hoặc rà soát code theo yêu cầu",
    description: "Làm rõ đầu vào, xử lý lỗi và tiêu chí nghiệm thu trước khi viết code.",
    category: "Công nghệ thông tin",
    prompt: "Bạn là kỹ sư phần mềm cấp cao. Hãy xử lý yêu cầu sau bằng [ngôn ngữ/framework]: [mô tả yêu cầu]. Trước hết nêu ngắn gọn giả định và các trường hợp biên; sau đó đề xuất cách triển khai, viết code có kiểu dữ liệu rõ ràng và giải thích cách chạy. Giữ nguyên kiến trúc hiện có, không giả định thư viện hoặc API chưa được cung cấp.",
    owner: "igen",
  },
  {
    id: "igen-education-lesson",
    title: "Soạn giáo án theo mục tiêu bài học",
    description: "Xây dựng hoạt động, học liệu và cách đánh giá theo từng giai đoạn.",
    category: "Giáo dục",
    prompt: "Bạn là giáo viên môn [môn học] cho [lớp/độ tuổi]. Hãy soạn giáo án bài [tên bài] trong [thời lượng], hướng đến các mục tiêu [mục tiêu]. Chia thành khởi động, khám phá kiến thức, luyện tập và vận dụng; nêu hoạt động của giáo viên, học sinh, học liệu và cách đánh giá. Điều chỉnh cho điều kiện lớp học [điều kiện].",
    owner: "igen",
  },
  {
    id: "igen-operations-weekly",
    title: "Lập kế hoạch công việc tuần",
    description: "Chuyển mục tiêu thành đầu việc, người phụ trách và mốc kiểm tra.",
    category: "Hành chính công",
    prompt: "Dựa trên mục tiêu tuần [mục tiêu] và nguồn lực [nguồn lực], hãy lập kế hoạch công việc từ [ngày bắt đầu] đến [ngày kết thúc]. Trình bày bảng gồm đầu việc, người phụ trách, hạn hoàn thành, mức ưu tiên, phụ thuộc và tiêu chí hoàn tất. Đánh dấu thông tin còn thiếu thay vì tự gán người hoặc ngày.",
    owner: "igen",
  },
];

export const initialAssistantPromptFavorites = [
  "igen-marketing-plan",
  "igen-sales-competitor",
  "igen-finance-report",
  "igen-education-lesson",
];
