import { ShieldCheck } from "lucide-react";
import { SEOHead } from "../seo/SEOHead";

export default function PrivacyPolicy() {
  const meta = {
    title: "Chính sách bảo mật | iGen ERP",
    description: "Chính sách bảo mật thông tin người dùng và dữ liệu của iGen ERP.",
    keywords: "chính sách bảo mật, bảo mật dữ liệu, igen erp",
    path: "/privacy-policy",
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <SEOHead meta={meta} />
      
      {/* Hero Section */}
      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 text-teal-700 text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="h-4 w-4" />
            <span>Pháp lý</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">Privacy Policy</h1>
          <p className="text-slate-500 text-xs font-medium">Cập nhật lần cuối: Ngày 19 tháng 06 năm 2026</p>
        </div>

        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
            <strong className="block text-[10px] uppercase text-slate-400 tracking-wider mb-1">Dịch vụ</strong>
            <span className="font-semibold text-slate-700">iGen ERP</span>
          </div>
          <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
            <strong className="block text-[10px] uppercase text-slate-400 tracking-wider mb-1">Công ty</strong>
            <span className="font-semibold text-slate-700">CÔNG TY CỔ PHẦN CÔNG NGHỆ IGEN</span>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm prose prose-slate max-w-none text-slate-700 space-y-6">
        <p className="leading-relaxed">
          Chính sách Bảo mật này mô tả cách thức iGen ERP thu thập, sử dụng, lưu trữ và bảo vệ dữ liệu cá nhân khi bạn sử dụng
          trang web, ứng dụng và các dịch vụ liên quan của chúng tôi. Bằng việc truy cập hoặc sử dụng Dịch vụ, bạn đồng ý với các
          hoạt động được mô tả trong Chính sách Bảo mật này.
        </p>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2">1. Định nghĩa</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Tài khoản</strong>: Có nghĩa là tài khoản duy nhất được tạo cho bạn để truy cập Dịch vụ của chúng tôi.</li>
            <li><strong>Công ty</strong>: CÔNG TY CỔ PHẦN CÔNG NGHỆ IGEN.</li>
            <li><strong>Cookies</strong>: Các tệp nhỏ được đặt trên thiết bị của bạn để cải thiện chức năng và phân tích việc sử dụng.</li>
            <li><strong>Dữ liệu cá nhân</strong>: Thông tin xác định hoặc có thể xác định danh tính một cá nhân một cách hợp lý.</li>
            <li><strong>Dịch vụ</strong>: Nền tảng iGen ERP và trang web liên quan của chúng tôi.</li>
            <li><strong>Dữ liệu sử dụng</strong>: Dữ liệu kỹ thuật và hành vi được thu thập tự động trong quá trình sử dụng Dịch vụ.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2">2. Dữ liệu cá nhân chúng tôi thu thập</h2>
          <p>Chúng tôi có thể thu thập các danh mục thông tin sau:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Thông tin liên hệ như họ tên, địa chỉ email, số điện thoại và thông tin công ty của bạn.</li>
            <li>Chi tiết tài khoản như thông tin đăng nhập, phân quyền vai trò và tùy chọn người dùng.</li>
            <li>Dữ liệu sử dụng như địa chỉ IP, loại trình duyệt, nhận dạng thiết bị, các trang đã truy cập và dấu thời gian.</li>
            <li>Dữ liệu hỗ trợ khách hàng như hồ sơ chat, lịch sử tạo phiếu yêu cầu và nhật ký khắc phục sự cố.</li>
            <li>Dữ liệu thanh toán hoặc giao dịch khi mua hàng hoặc nạp tiền vào ví thông qua các nhà cung cấp cổng thanh toán tích hợp.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2">3. Cách chúng tôi sử dụng dữ liệu cá nhân</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Để cung cấp, duy trì, bảo mật và cải thiện chất lượng Dịch vụ.</li>
            <li>Để quản lý tài khoản người dùng, xác thực và quản lý phân quyền.</li>
            <li>Để liên lạc với bạn về các cập nhật, thông báo dịch vụ, thanh toán và các yêu cầu hỗ trợ.</li>
            <li>Để giám sát hiệu suất sản phẩm, phát hiện lạm dụng và khắc phục các sự cố kỹ thuật.</li>
            <li>Để tuân thủ các nghĩa vụ pháp lý và thực thi các thỏa thuận cũng như chính sách nội bộ của chúng tôi.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2">4. Cookies và Công nghệ theo dõi</h2>
          <p>
            Chúng tôi sử dụng cookies và các công nghệ theo dõi tương tự để vận hành Dịch vụ, ghi nhớ tùy chọn, duy trì phiên đăng nhập và
            hiểu cách người dùng tương tác với nền tảng. Khi luật pháp yêu cầu, các cookies không thiết yếu sẽ chỉ được sử dụng khi có
            sự đồng ý hợp lệ của bạn.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2">5. Chia sẻ dữ liệu cá nhân</h2>
          <p>Chúng tôi chỉ chia sẻ thông tin khi thực sự cần thiết với:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Nhà cung cấp dịch vụ và đối tác hạ tầng hỗ trợ lưu trữ, phân tích, liên lạc, thanh toán hoặc bảo mật.</li>
            <li>Các công ty liên kết hoặc đối tác kinh doanh khi cần thiết để vận hành hoặc cải tiến Dịch vụ.</li>
            <li>Cơ quan chức năng hoặc cơ quan pháp lý khi việc tiết lộ được yêu cầu bởi luật pháp, quy định hoặc yêu cầu pháp lý hợp lệ.</li>
            <li>Các bên kế thừa liên quan đến việc sáp nhập, mua lại, tái cấu trúc hoặc bán tài sản của doanh nghiệp.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2">6. Bảo mật dữ liệu</h2>
          <p>
            Chúng tôi sử dụng các biện pháp kỹ thuật và tổ chức hợp lý về mặt thương mại để bảo vệ dữ liệu cá nhân khỏi bị truy cập trái phép,
            mất mát, lạm dụng, thay đổi hoặc tiết lộ. Không có hệ thống truyền tải hoặc lưu trữ nào có thể được đảm bảo an toàn 100%, do đó
            chúng tôi không thể hứa hẹn bảo mật tuyệt đối.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2">7. Liên hệ</h2>
          <p>Nếu bạn có bất kỳ câu hỏi nào về Chính sách Bảo mật này, bạn có thể liên hệ với chúng tôi qua:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Trang liên hệ hỗ trợ: <a href="https://io.igentechsolutions.com/contact" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">https://io.igentechsolutions.com/contact</a></li>
            <li>Trang chủ dịch vụ: <a href="https://erp.igentechsolutions.com/" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">https://erp.igentechsolutions.com/</a></li>
          </ul>
        </section>
      </div>
    </div>
  );
}
