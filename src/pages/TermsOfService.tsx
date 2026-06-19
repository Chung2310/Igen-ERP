import { Scale } from "lucide-react";
import { SEOHead } from "../seo/SEOHead";

export default function TermsOfService() {
  const meta = {
    title: "Điều khoản dịch vụ | iGen ERP",
    description: "Điều khoản sử dụng dịch vụ và nền tảng doanh nghiệp iGen ERP.",
    keywords: "điều khoản dịch vụ, điều khoản sử dụng, igen erp",
    path: "/terms-of-service",
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <SEOHead meta={meta} />
      
      {/* Hero Section */}
      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider">
            <Scale className="h-4 w-4" />
            <span>Pháp lý</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">Terms of Service</h1>
          <p className="text-slate-500 text-xs font-medium">Cập nhật lần cuối: Ngày 19 tháng 06 năm 2026</p>
        </div>

        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
            <strong className="block text-[10px] uppercase text-slate-400 tracking-wider mb-1">Dịch vụ</strong>
            <span className="font-semibold text-slate-700">iGen ERP</span>
          </div>
          <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
            <strong className="block text-[10px] uppercase text-slate-400 tracking-wider mb-1">Nhà phát triển</strong>
            <span className="font-semibold text-slate-700">iGen Tech</span>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm prose prose-slate max-w-none text-slate-700 space-y-6">
        <p className="leading-relaxed">
          Các Điều khoản Dịch vụ này điều chỉnh việc bạn truy cập và sử dụng iGen ERP, bao gồm cả trang web, phần mềm, ứng dụng,
          mã nguồn, APIs và các dịch vụ liên quan do CÔNG TY CỔ PHẦN CÔNG NGHỆ IGEN vận hành. Bằng việc truy cập hoặc sử dụng Dịch vụ,
          bạn đồng ý chịu sự ràng buộc bởi các Điều khoản này.
        </p>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2">1. Điều kiện và Thẩm quyền</h2>
          <p>
            Bạn chỉ có thể sử dụng Dịch vụ nếu bạn có đầy đủ năng lực hành vi dân sự để giao kết hợp đồng và có thẩm quyền đại diện hợp pháp
            cho công ty, tổ chức hoặc thực thể kinh doanh của mình.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2">2. Tài khoản người dùng</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Bạn có trách nhiệm bảo mật thông tin đăng nhập tài khoản của mình.</li>
            <li>Bạn chịu trách nhiệm về tất cả các hoạt động xảy ra dưới tài khoản của bạn.</li>
            <li>Bạn phải cung cấp thông tin chính xác, đầy đủ và cập nhật khi tạo hoặc cập nhật tài khoản.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2">3. Sử dụng Dịch vụ hợp lệ</h2>
          <p>Bạn đồng ý chỉ sử dụng Dịch vụ cho các mục đích kinh doanh hợp pháp và tuân thủ các Điều khoản này.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Không được lạm dụng Dịch vụ, gây cản trở hoạt động bình thường hoặc truy cập trái phép vào hệ thống.</li>
            <li>Không truyền tải hoặc xử lý nội dung vi phạm pháp luật hoặc xâm phạm quyền của bên thứ ba.</li>
            <li>Không sử dụng Dịch vụ để phát tán mã độc, thư rác hoặc các hành vi lừa đảo trực tuyến.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2">4. Tính năng AI và Sản phẩm kết xuất từ AI</h2>
          <p>
            Dịch vụ của chúng tôi tích hợp các tính năng AI (như viết nội dung tự động, tạo video người thật, gợi ý chat tự động).
            Các kết quả từ AI chỉ mang tính chất tham khảo và có thể không chính xác 100%. Bạn tự chịu trách nhiệm kiểm duyệt thông tin
            trước khi áp dụng vào hoạt động pháp lý, tài chính hoặc vận hành của doanh nghiệp.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2">5. Sở hữu trí tuệ</h2>
          <p>
            Dịch vụ bao gồm phần mềm, giao diện, thiết kế, công nghệ nền tảng và thương hiệu đều thuộc sở hữu của chúng tôi hoặc được cấp phép
            hợp pháp. Việc bạn sử dụng Dịch vụ không đồng nghĩa với việc chuyển giao bất kỳ quyền sở hữu trí tuệ nào.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2">6. Giới hạn trách nhiệm</h2>
          <p>
            Trong phạm vi tối đa được pháp luật cho phép, chúng tôi không chịu trách nhiệm đối với bất kỳ thiệt hại gián tiếp, ngẫu nhiên hoặc
            hệ quả nào (bao gồm tổn thất về lợi nhuận, doanh thu, dữ liệu hoặc cơ hội kinh doanh) phát sinh từ việc bạn sử dụng hoặc không thể
            sử dụng Dịch vụ.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2">7. Liên hệ</h2>
          <p>Nếu bạn có bất kỳ câu hỏi nào về Điều khoản Dịch vụ này, vui lòng liên hệ với chúng tôi qua:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Trang liên hệ hỗ trợ: <a href="https://io.igentechsolutions.com/contact" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">https://io.igentechsolutions.com/contact</a></li>
            <li>Trang chủ dịch vụ: <a href="https://erp.igentechsolutions.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">https://erp.igentechsolutions.com/</a></li>
          </ul>
        </section>
      </div>
    </div>
  );
}
