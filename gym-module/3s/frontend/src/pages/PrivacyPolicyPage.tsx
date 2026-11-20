import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Phone } from 'lucide-react';
import './PrivacyPolicyPage.css';

const sections = [
  [
    "Phạm vi và liên hệ",
    [
      "Chính sách này áp dụng cho ứng dụng 3S Gym và website https://3s.igentechnology.net. Huấn luyện viên cá nhân có thể tự đăng ký tài khoản PT và sử dụng không gian làm việc riêng. Khi PT nhận lời mời vào gym và xác nhận chuyển dữ liệu, dữ liệu cá nhân và hồ sơ họ quản lý được chuyển sang trung tâm đó. Admin trung tâm có thể quản lý dữ liệu sau khi PT đồng ý tham gia.",
      "Để hỏi về quyền riêng tư hoặc yêu cầu xử lý dữ liệu, liên hệ 3S Wellness Fitness & Yoga qua hotline 088 9926 222 hoặc 082 333 5977; địa chỉ: Tầng 5 Tòa nhà VNPT, 33 Lý Thái Tổ, Bắc Ninh."
    ]
  ],
  [
    "Dữ liệu được xử lý",
    [
      "Tùy chức năng và vai trò sử dụng, hệ thống xử lý thông tin tài khoản và hồ sơ như tên, số điện thoại, email, ngày sinh, giới tính, địa chỉ, ảnh đại diện và thông tin chuyên môn của huấn luyện viên.",
      "Dữ liệu phục vụ tập luyện gồm lịch tập, điểm danh, gói tập, giáo án, kết quả buổi tập, mục tiêu, chỉ số cơ thể/InBody, thông tin dinh dưỡng, ảnh tiến độ và tài liệu được tải lên. Dữ liệu có thể do bạn hoặc nhân viên được phân quyền nhập để cung cấp dịch vụ.",
      "Khi sử dụng ví hoặc thanh toán, hệ thống xử lý thông tin giao dịch, số tiền, mã tham chiếu và trạng thái thanh toán. Dữ liệu kỹ thuật có thể gồm phiên đăng nhập, mã thiết bị nhận thông báo và nhật ký hoạt động, lỗi hoặc yêu cầu gửi đến máy chủ."
    ]
  ],
  [
    "Mục đích sử dụng",
    [
      "Thông tin được sử dụng để xác thực và quản lý tài khoản; cung cấp, theo dõi và cá nhân hóa dịch vụ tập luyện, dinh dưỡng; quản lý lịch, gói tập và giao dịch; gửi thông báo liên quan; hỗ trợ người dùng, xử lý lỗi và bảo vệ hệ thống.",
      "Khi bạn hoặc nhân viên sử dụng chức năng AI/OCR, nội dung liên quan được xử lý để đọc tài liệu, phân tích chỉ số, đề xuất giáo án, thực đơn hoặc tạo nội dung theo yêu cầu."
    ]
  ],
  [
    "Quyền truy cập thiết bị và lưu trữ phiên",
    [
      "Ứng dụng yêu cầu camera hoặc quyền chọn ảnh khi bạn dùng chức năng chụp/chọn ảnh. Bạn có thể từ chối hoặc thu hồi quyền trong cài đặt thiết bị; chức năng tương ứng có thể không hoạt động.",
      "Quyền thông báo dùng để gửi thông báo khi chức năng này được cấu hình và bạn cho phép. Bạn có thể tắt thông báo trong cài đặt thiết bị.",
      "Ứng dụng và website lưu thông tin phiên cùng dữ liệu cục bộ cần thiết để duy trì đăng nhập và trải nghiệm sử dụng. Đăng xuất hoặc xóa dữ liệu ứng dụng không đồng nghĩa với xóa hồ sơ đang lưu trên máy chủ."
    ]
  ],
  [
    "Người có quyền truy cập và bên cung cấp dịch vụ",
    [
      "Dữ liệu được truy cập theo vai trò và trung tâm. Với PT độc lập, dữ liệu nằm trong không gian cá nhân của PT. Khi PT xác nhận lời mời gym, toàn bộ dữ liệu trong không gian đó được chuyển sang gym và admin trung tâm có thể quản lý dữ liệu. PT cần thông báo và có sự cho phép phù hợp của học viên trước khi nhập hoặc chia sẻ dữ liệu của họ.",
      "Hệ thống tích hợp các dịch vụ kỹ thuật như lưu trữ/hạ tầng, Cloudinary cho nội dung ảnh, OpenRouter và nhà cung cấp mô hình AI cho tính năng AI/OCR, SePay cho thanh toán chuyển khoản; PayOS có thể tiếp tục xử lý các đơn đã tạo trước khi chuyển đổi và hạ tầng thông báo khi được bật. Chỉ các dịch vụ được cấu hình và sử dụng mới tham gia xử lý luồng dữ liệu tương ứng.",
      "Trước mỗi yêu cầu AI/OCR, ứng dụng hiển thị thông báo về dữ liệu gửi đi, OpenRouter và các nhà cung cấp mô hình đang cấu hình, rồi yêu cầu bạn đồng ý. Nội dung có thể gồm lời nhắc, ảnh, tài liệu, họ tên, chỉ số cơ thể và tiền sử sức khỏe liên quan. Khi xử lý hồ sơ học viên, bạn cần có sự cho phép phù hợp của học viên trước khi chia sẻ.",
      "Bạn có thể hủy yêu cầu mà vẫn sử dụng các chức năng không dùng AI. Xác nhận chỉ áp dụng cho yêu cầu đó, bao gồm xử lý nền và lần thử lại. Dữ liệu đã gửi không thể được thu hồi chỉ bằng việc hủy một yêu cầu tiếp theo. Nhà cung cấp có thể xử lý dữ liệu ngoài Việt Nam theo chính sách của họ; có thể xem chính sách OpenRouter tại https://openrouter.ai/privacy. Dữ liệu cũng có thể được cung cấp cho cơ quan có thẩm quyền khi có yêu cầu hợp lệ."
    ]
  ],
  [
    "Lưu giữ và bảo vệ dữ liệu",
    [
      "Dữ liệu được lưu để phục vụ tài khoản, lịch sử dịch vụ, hỗ trợ và các nghĩa vụ lưu giữ áp dụng. Thời gian lưu phụ thuộc loại dữ liệu và mục đích xử lý; liên hệ 3S để biết thông tin cụ thể về hồ sơ của bạn.",
      "Hệ thống sử dụng xác thực, phân quyền và các biện pháp bảo vệ thông tin đăng nhập. Bạn cần giữ bí mật mật khẩu và thông báo cho 3S khi nghi ngờ tài khoản bị truy cập trái phép."
    ]
  ],
  [
    "Yêu cầu truy cập, sửa hoặc xóa dữ liệu",
    [
      "Bạn có thể chỉnh sửa thông tin được cho phép trong hồ sơ. Để xóa tài khoản trên ứng dụng, vào Hồ sơ → Bảo mật & đổi mật khẩu → Xóa tài khoản vĩnh viễn. Bạn không cần gọi hotline để bắt đầu quy trình này.",
      "Admin gym có thể chuyển quyền cho PT đang hoạt động trước khi xóa tài khoản, hoặc xác nhận đóng trung tâm và xóa tài khoản thành viên cùng dữ liệu của trung tâm. Trung tâm chứa tài khoản quản trị hệ thống không được đóng qua luồng này.",
      "Khi PT độc lập xóa tài khoản, tài khoản và dữ liệu trong không gian cá nhân được xóa. Khi PT thuộc gym xóa tài khoản, dữ liệu vận hành được bàn giao cho admin trung tâm đang hoạt động; credit cá nhân không được chuyển. Tác vụ AI đang xử lý cần hoàn tất trước khi xóa để tránh ghi lại dữ liệu.",
      "Ảnh/file do hệ thống quản lý được đưa vào hàng đợi dọn nền; lỗi kết nối sẽ được thử lại. Tài nguyên còn được trung tâm khác sử dụng được giữ lại. File ở dịch vụ ngoài phạm vi quản lý và dữ liệu sao lưu có quy trình lưu giữ riêng; liên hệ đầu mối quyền riêng tư để biết phạm vi và thời gian xử lý cụ thể.",
      "Với yêu cầu truy cập, sửa dữ liệu khác hoặc hỗ trợ về quyền riêng tư, liên hệ hotline nêu ở trên và cung cấp tên tài khoản cùng nội dung yêu cầu; không gửi mật khẩu hoặc mã xác thực."
    ]
  ],
  [
    "Thay đổi chính sách",
    [
      "Chính sách có thể được cập nhật khi chức năng hoặc cách xử lý dữ liệu thay đổi. Phiên bản mới được công bố tại địa chỉ này với ngày cập nhật để bạn theo dõi."
    ]
  ]
];

export default function PrivacyPolicyPage() {
  return (
    <div className="privacy-page">
      <article className="privacy-card" lang="vi">
        <Link className="privacy-action" to="/"><ArrowLeft size={20} aria-hidden="true" /> Về trang chủ</Link>
        <header>
          <ShieldCheck size={32} aria-hidden="true" className="privacy-icon" />
          <p>3S Gym · 3S Wellness Fitness & Yoga</p>
          <h1>Chính sách bảo mật</h1>
          <p className="privacy-meta">Cập nhật ngày 02/10/2026</p>
        </header>
        {sections.map(([title, paragraphs], index) => (
          <section key={String(title)} aria-labelledby={'privacy-section-' + index}>
            <h2 id={'privacy-section-' + index}>{index + 1}. {title}</h2>
            {(paragraphs as string[]).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </section>
        ))}
        <a className="privacy-action" href="tel:0889926222"><Phone size={20} aria-hidden="true" /> Liên hệ về dữ liệu cá nhân: 088 9926 222</a>
      </article>
    </div>
  );
}
