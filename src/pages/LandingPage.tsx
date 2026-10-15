import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  MessageSquare,
  ShoppingBag,
  Users,
  ShieldCheck,
  Globe,
  Database,
  Lock,
  ChevronRight,
  Menu,
  X,
  ChevronDown,
  MapPin,
  ExternalLink,
  Bot,
  Check,
  CalendarCheck,
  CreditCard,
  FileSpreadsheet,
  Sparkles,
  Zap,
  GraduationCap,
  BookOpen,
  BriefcaseBusiness,
  ShoppingCart,
  Landmark,
  Wrench,
  ContactRound,
  Phone
} from "../components/landing/LandingUiIcons";
import { LandingIcon, type LandingIconName } from "../components/landing/LandingIcon";
import { TikTokSyncIllustration } from "../components/landing/TikTokSyncIllustration";
import {
  BRAND_NAME,
  PRIVACY_POLICY_URL,
  SUPPORT_URL,
  TERMS_OF_SERVICE_URL,
  USER_DATA_DELETION_URL,
} from "../config/brand";
import { SEOHead } from "../seo/SEOHead";

const megaMenuArt: Record<string, LandingIconName> = {
  "Tạo nội dung & Video AI": "content",
  "Đồng bộ TikTok Shop": "retail",
  "Hộp thư đa kênh": "inbox",
  "Quản lý khách hàng 360": "customers",
  "Trợ lý AI trả lời 24/7": "assistant",
  "Bán lẻ tại quầy": "checkout",
  "Đơn hàng & Đổi trả": "orders",
  "Cổng thanh toán đa kênh": "payment",
  "Báo cáo ca thu ngân": "reports",
  "Tuyển dụng ứng viên": "recruitment",
  "Hồ sơ người lao động": "people",
  "Chấm công Face ID & QR": "attendance",
  "Bảng lương & KPI": "payroll",
  "Hồ sơ học viên 360": "students",
  "Lớp học & Điểm danh": "classes",
  "Thu học phí & Công nợ": "tuition",
  "Khóa học & Chứng chỉ": "courses",
};

const solutionPreviewBars = [
  [38, 58, 46, 76, 61, 88, 70],
  [48, 64, 55, 83, 69, 94, 78],
  [42, 60, 73, 57, 82, 68, 89],
  [36, 53, 67, 62, 80, 74, 92],
];

const industries: Array<{
  label: string;
  title: string;
  description: string;
  points: [string, string, string];
  image: string;
  icon: LandingIconName;
}> = [
  {
    label: "Giáo dục",
    title: "Quản lý trung tâm giáo dục liền mạch",
    description: "Theo dõi hành trình học viên và vận hành lớp học trên cùng một nền tảng.",
    points: ["Tập trung hồ sơ học viên, lớp học và lịch học", "Điểm danh và theo dõi quá trình học tập", "Quản lý học phí, công nợ và biên lai"],
    image: "/industry-education.jpg",
    icon: "education",
  },
  {
    label: "Xây dựng",
    title: "Kết nối đội ngũ tại công trình",
    description: "Dùng các công cụ nhân sự và chấm công để phối hợp lực lượng lao động theo đội, nhóm.",
    points: ["Tập trung hồ sơ và hợp đồng người lao động", "Theo dõi chấm công bằng Face ID, QR và GPS", "Trao đổi công việc qua kênh nội bộ"],
    image: "/industry-construction.jpg",
    icon: "construction",
  },
  {
    label: "Sản xuất",
    title: "Theo dõi nhân sự và hàng hóa dễ dàng",
    description: "Nắm thông tin ngày công, đội ngũ và tồn kho trong nhịp vận hành hằng ngày.",
    points: ["Quản lý hồ sơ nhân sự và ca làm việc", "Theo dõi chấm công và ngày công", "Xem dữ liệu hàng hóa và tồn kho tập trung"],
    image: "/industry-manufacturing.jpg",
    icon: "manufacturing",
  },
  {
    label: "Bán lẻ",
    title: "Bán hàng nhanh, quản lý gọn",
    description: "Từ quầy bán đến đơn hàng và khách hàng, mọi thao tác đều nằm trong một luồng làm việc.",
    points: ["Bán tại quầy, xử lý đơn và đổi trả", "Thanh toán đa kênh, báo cáo ca thu ngân", "Kết nối khách hàng và hội thoại đa kênh"],
    image: "/industry-retail.jpg",
    icon: "retail",
  },
  {
    label: "Cung ứng lao động",
    title: "Quản lý nguồn lao động từ tuyển dụng đến chấm công",
    description: "Liên kết hồ sơ ứng viên, người lao động và quá trình làm việc trên một hệ thống.",
    points: ["Tuyển dụng và sàng lọc ứng viên", "Quản lý hồ sơ, hợp đồng người lao động", "Theo dõi chấm công và hiệu suất làm việc"],
    image: "/industry-labor.jpg",
    icon: "labor",
  },
  {
    label: "Y tế",
    title: "Phối hợp đội ngũ chăm sóc thuận tiện",
    description: "Ứng dụng các công cụ nhân sự và trao đổi nội bộ cho môi trường làm việc cần sự phối hợp liên tục.",
    points: ["Quản lý hồ sơ và lịch làm việc của nhân sự", "Theo dõi chấm công, phân ca cho đội ngũ", "Giữ thông tin trao đổi nội bộ tập trung"],
    image: "/industry-healthcare.jpg",
    icon: "healthcare",
  },
  {
    label: "Marketing",
    title: "Sáng tạo và chăm sóc khách hàng với AI",
    description: "Lên nội dung, quản lý hội thoại và phản hồi khách hàng từ nhiều kênh trong một nơi.",
    points: ["Tạo nội dung và kịch bản video bằng AI", "Gom hội thoại Facebook và Zalo", "Phân luồng khách hàng, AI hỗ trợ trả lời 24/7"],
    image: "/industry-marketing.jpg",
    icon: "marketing",
  },
];

function LandingBrandMark() {
  return (
    <img
      src="/logo-igenerp.png"
      alt={BRAND_NAME}
      className="h-[60px] sm:h-[76px] w-auto object-contain shrink-0"
    />
  );
}

export default function LandingPage() {
  const landingRef = useRef<HTMLDivElement>(null);
  const industryImagePreloads = useRef<HTMLImageElement[]>([]);
  const [solutionsOpen, setSolutionsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [activeSuite, setActiveSuite] = useState(0);
  const [activeIndustry, setActiveIndustry] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => {
      setActiveSuite((current) => (current + 1) % solutionPreviewBars.length);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [activeSuite]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => {
      setActiveIndustry((current) => (current + 1) % industries.length);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [activeIndustry]);

  useEffect(() => {
    const section = document.getElementById("linh-vuc");
    if (!section) return;

    const preloadIndustryImages = () => {
      if (industryImagePreloads.current.length) return;
      industryImagePreloads.current = industries.map(({ image }) => {
        const preload = new Image();
        preload.src = image;
        return preload;
      });
    };

    if (!window.IntersectionObserver) {
      preloadIndustryImages();
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) return;
      preloadIndustryImages();
      observer.disconnect();
    }, { rootMargin: "600px 0px" });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const root = landingRef.current;
    if (!root || !window.IntersectionObserver || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const elements = Array.from(root.querySelectorAll<HTMLElement>("[data-landing-reveal]"));
    const viewportHeight = window.innerHeight;
    elements.forEach((element) => {
      if (element.getBoundingClientRect().top < viewportHeight - 32) element.classList.add("is-visible");
    });
    root.classList.add("landing-motion-ready");

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -40px 0px" });
    elements.filter((element) => !element.classList.contains("is-visible")).forEach((element) => observer.observe(element));

    return () => {
      observer.disconnect();
      root.classList.remove("landing-motion-ready");
    };
  }, []);

  const meta = {
    title: `${BRAND_NAME} - AI Marketing, Bán lẻ, Tuyển dụng, Học viên, HRM`,
    description: "iGen ERP hỗ trợ AI marketing, bán lẻ, quản lý lao động và giáo dục trên một nền tảng.",
    keywords: "igen erp, ai marketing, ban le pos, tuyen dung hrm, quan ly hoc vien, giao duc",
    path: "/",
  };

  // Mega Menu Multi-column Data (Authentic iGen capabilities)
  const megaMenuColumns = [
    {
      title: "AI MARKETING & CSKH",
      desc: "Bộ giải pháp tiếp thị số & Trợ lý ảo đa kênh",
      items: [
        { name: "Tạo nội dung & Video AI", desc: "Viết content, kịch bản video AI tự động", icon: Sparkles, iconColor: "text-rose-500", iconBg: "bg-rose-50", link: "#giai-phap" },
        { name: "Đồng bộ TikTok Shop", desc: "Đơn hàng và số lượng hàng về một nơi", icon: ShoppingBag, iconColor: "text-[#00ADFC]", iconBg: "bg-sky-50", link: "#tich-hop-tiktok" },
        { name: "Hộp thư đa kênh", desc: "Facebook và Zalo gom một nơi", icon: MessageSquare, iconColor: "text-blue-500", iconBg: "bg-blue-50", link: "#giai-phap" },
        { name: "Quản lý khách hàng 360", desc: "Phân loại khách hàng và lịch sử mua", icon: ContactRound, iconColor: "text-amber-500", iconBg: "bg-amber-50", link: "#giai-phap" },
        { name: "Trợ lý AI trả lời 24/7", desc: "Tự động phản hồi tin nhắn & bình luận", icon: Bot, iconColor: "text-purple-500", iconBg: "bg-purple-50", link: "#giai-phap" },
      ]
    },
    {
      title: "BÁN LẺ & ĐIỂM BÁN",
      desc: "Bộ giải pháp bán lẻ, quản lý quầy & in hóa đơn",
      items: [
        { name: "Bán lẻ tại quầy", desc: "Bán hàng tại điểm, quét SKU", icon: ShoppingCart, iconColor: "text-emerald-500", iconBg: "bg-emerald-50", link: "#giai-phap" },
        { name: "Đơn hàng & Đổi trả", desc: "Xử lý đơn bán lẻ, in hóa đơn nhanh", icon: FileSpreadsheet, iconColor: "text-teal-500", iconBg: "bg-teal-50", link: "#giai-phap" },
        { name: "Cổng thanh toán đa kênh", desc: "VietQR, chuyển khoản, tiền mặt", icon: CreditCard, iconColor: "text-[#00ADFC]", iconBg: "bg-sky-50", link: "#giai-phap" },
        { name: "Báo cáo ca thu ngân", desc: "Doanh số ca kíp và đối soát tiền mặt", icon: Landmark, iconColor: "text-indigo-500", iconBg: "bg-indigo-50", link: "#giai-phap" },
      ]
    },
    {
      title: "TUYỂN DỤNG & LAO ĐỘNG",
      desc: "Bộ giải pháp tuyển dụng & quản trị nguồn nhân lực",
      items: [
        { name: "Tuyển dụng ứng viên", desc: "Quản lý tin tuyển & hồ sơ ứng viên", icon: Users, iconColor: "text-purple-500", iconBg: "bg-purple-50", link: "#giai-phap" },
        { name: "Hồ sơ người lao động", desc: "Hợp đồng lao động & sơ đồ tổ chức", icon: BriefcaseBusiness, iconColor: "text-[#00ADFC]", iconBg: "bg-sky-50", link: "#giai-phap" },
        { name: "Chấm công Face ID & QR", desc: "Nhận diện khuôn mặt AI & GPS", icon: CalendarCheck, iconColor: "text-orange-500", iconBg: "bg-orange-50", link: "#giai-phap" },
        { name: "Bảng lương & KPI", desc: "Tính tự động theo hiệu suất thực tế", icon: Landmark, iconColor: "text-emerald-500", iconBg: "bg-emerald-50", link: "#giai-phap" },
      ]
    },
    {
      title: "QUẢN LÝ HỌC VIÊN",
      desc: "Bộ giải pháp quản trị học viên & trung tâm đào tạo",
      items: [
        { name: "Hồ sơ học viên 360", desc: "Hồ sơ học viên & quá trình học tập", icon: GraduationCap, iconColor: "text-sky-500", iconBg: "bg-sky-50", link: "#giai-phap" },
        { name: "Lớp học & Điểm danh", desc: "Lịch học, sĩ số, điểm danh số hóa", icon: CalendarCheck, iconColor: "text-emerald-500", iconBg: "bg-emerald-50", link: "#giai-phap" },
        { name: "Thu học phí & Công nợ", desc: "Thu học phí & xuất biên lai tức thì", icon: CreditCard, iconColor: "text-[#00ADFC]", iconBg: "bg-sky-50", link: "#giai-phap" },
        { name: "Khóa học & Chứng chỉ", desc: "Chương trình đào tạo và cấp bằng", icon: BookOpen, iconColor: "text-amber-500", iconBg: "bg-amber-50", link: "#giai-phap" },
      ]
    },
  ];

  // Core iGen Modular Suites (Authentic iGen capabilities)
  const suites = [
    {
      title: "AI Marketing & CSKH Đa kênh",
      desc: "Tạo nội dung marketing, kịch bản video AI và quản lý hội thoại tập trung",
      apps: [
        { name: "Tạo nội dung & Video AI", desc: "Viết content, kịch bản video AI tự động", iconBg: "bg-rose-500", icon: "content" },
        { name: "Hộp thư đa kênh hội tụ", desc: "Gom tin nhắn Facebook và Zalo OA", iconBg: "bg-[#00ADFC]", icon: "inbox" },
        { name: "Tự động phân luồng khách", desc: "Phân chia khách hàng cho nhân viên sale", iconBg: "bg-blue-600", icon: "customers" },
        { name: "Trợ lý AI trả lời 24/7", desc: "Tự động trả lời bình luận, tin nhắn khách", iconBg: "bg-purple-600", icon: "assistant" },
      ],
    },
    {
      title: "Bán lẻ & Điểm bán",
      desc: "Bán hàng tại quầy, quét mã SKU, in hóa đơn và đối soát ca kíp thu ngân",
      apps: [
        { name: "Bán lẻ tại quầy", desc: "Quét mã vạch SKU, xử lý đơn nhanh chóng", iconBg: "bg-emerald-500", icon: "checkout" },
        { name: "Cổng thanh toán đa kênh", desc: "QR VietQR chuyển khoản, tiền mặt, thẻ", iconBg: "bg-[#00ADFC]", icon: "payment" },
        { name: "Quản lý đơn & Đổi trả", desc: "In hóa đơn thanh toán và xử lý đơn hoàn", iconBg: "bg-teal-500", icon: "orders" },
        { name: "Báo cáo ca thu ngân", desc: "Doanh số ca làm việc và nhân viên bán", iconBg: "bg-indigo-600", icon: "reports" },
      ],
    },
    {
      title: "Tuyển dụng & Quản trị Lao động",
      desc: "Sơ đồ tổ chức, tuyển dụng nhân tài, quản lý hồ sơ lao động và chấm công AI",
      apps: [
        { name: "Tuyển dụng ứng viên", desc: "Sàng lọc CV, lịch phỏng vấn và đánh giá", iconBg: "bg-purple-600", icon: "recruitment" },
        { name: "Hồ sơ người lao động", desc: "Hợp đồng số, hồ sơ công nhân lao động", iconBg: "bg-[#00ADFC]", icon: "people" },
        { name: "Chấm công Face ID & QR", desc: "Nhận diện khuôn mặt AI và định vị GPS", iconBg: "bg-orange-500", icon: "attendance" },
        { name: "Bảng lương & KPI", desc: "Tính tự động theo hiệu suất thực tế", iconBg: "bg-emerald-600", icon: "payroll" },
      ],
    },
    {
      title: "Quản lý Học viên & Đào tạo",
      desc: "Quản trị trung tâm, hồ sơ 360 học viên, lớp học, điểm danh và theo dõi học phí",
      apps: [
        { name: "Hồ sơ học viên 360", desc: "Theo dõi quá trình học tập và kết quả", iconBg: "bg-sky-500", icon: "students" },
        { name: "Lớp học & Điểm danh", desc: "Sắp xếp lịch học, điểm danh số tự động", iconBg: "bg-emerald-500", icon: "classes" },
        { name: "Thu học phí & Công nợ", desc: "Xuất biên lai điện tử và đối soát tức thì", iconBg: "bg-[#00ADFC]", icon: "tuition" },
        { name: "Khóa học & Chứng chỉ", desc: "Số hóa chương trình đào tạo và cấp chứng chỉ", iconBg: "bg-amber-500", icon: "courses" },
      ],
    },
  ];

  const selectedSuite = suites[activeSuite];
  const selectedIndustry = industries[activeIndustry];

  return (
    <div ref={landingRef} className="min-h-screen bg-white text-slate-900 font-sans antialiased selection:bg-[#00ADFC] selection:text-white relative">
      <SEOHead meta={meta} />

      {/* ========================================================= */}
      {/* HEADER: Clean, Compact, Height 64px, White Background     */}
      {/* ========================================================= */}
      <header
        className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-xs transition-all relative"
        onMouseLeave={() => setSolutionsOpen(false)}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 sm:h-20 flex items-center justify-between gap-6">

          {/* Logo Brand Name - Nằm riêng bên trái */}
          <a href="#tong-quan" aria-label={BRAND_NAME} className="flex items-center group shrink-0">
            <LandingBrandMark />
          </a>

          {/* Navigation links */}
          <nav className="hidden lg:flex items-center gap-4 xl:gap-6 text-[13px] font-semibold text-slate-700">
              <div
                className="relative py-2"
                onMouseEnter={() => setSolutionsOpen(true)}
              >
                <button
                  onClick={() => setSolutionsOpen(!solutionsOpen)}
                  className={`flex items-center gap-1 hover:text-[#00ADFC] transition-colors cursor-pointer focus:outline-none ${solutionsOpen ? "text-[#00ADFC]" : ""}`}
                >
                  <span>Giải pháp</span>
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${solutionsOpen ? "rotate-180" : ""}`} />
                </button>
              </div>

              <a href="#tich-hop-tiktok" className="hover:text-[#00ADFC] transition-colors py-2 flex items-center gap-1.5">
                <span>Tích hợp TikTok Shop</span>
                <span className="w-2 h-2 rounded-full bg-[#00ADFC] animate-ping" />
              </a>
              <a href="#bao-mat" className="hover:text-[#00ADFC] transition-colors py-2">Bảo mật</a>
              <a href="#faq" className="hover:text-[#00ADFC] transition-colors py-2">Hỏi đáp</a>
              <a href="#phap-ly" className="hover:text-[#00ADFC] transition-colors py-2">Liên hệ</a>
            </nav>

            {/* Right Action: Clean Buttons */}
            <div className="flex shrink-0 items-center gap-2.5">
              <div className="hidden sm:flex items-center gap-2.5">
                <a
                  href="tel:+84353710189"
                  aria-label="Gọi 0353.710.189"
                  className="hidden xl:inline-flex items-center gap-2 whitespace-nowrap text-sm font-semibold text-[#007eb8] hover:text-[#00ADFC] transition-colors mr-2"
                >
                  <Phone className="h-4 w-4" />
                  <span>0353.710.189</span>
                </a>
                <a
                  href="/dang-nhap"
                  className="landing-rainbow-border landing-rainbow-border--light text-xs font-semibold text-[#00ADFC] hover:text-[#0096df] px-4 py-2 rounded-lg transition-all"
                >
                  Đăng nhập
                </a>
                <a
                  href="/dang-nhap"
                  className="landing-rainbow-border text-xs font-semibold text-white px-5 py-2 rounded-lg transition-all shadow-md shadow-[#00ADFC]/20 hover:shadow-lg hover:shadow-[#00ADFC]/30 active:scale-[0.98]"
                >
                  Dùng thử miễn phí
                </a>
              </div>

              {/* Mobile menu trigger */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle navigation"
                className="lg:hidden p-2 text-slate-700 hover:text-[#00ADFC] focus:outline-none"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>

        </div>

        {/* Full-width Mega Menu Dropdown */}
        {solutionsOpen && (
          <div
            onMouseEnter={() => setSolutionsOpen(true)}
            onMouseLeave={() => setSolutionsOpen(false)}
            className="absolute left-1/2 -translate-x-1/2 top-full w-full max-w-7xl px-4 sm:px-6 lg:px-8 z-50 animate-scale-in"
          >
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden text-left">

              {/* Four supported product areas */}
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {megaMenuColumns.map((col, cIdx) => (
                  <div key={cIdx} className="space-y-3">
                    <div className="border-b border-slate-100 pb-2">
                      <h4 className="text-[12px] font-bold uppercase text-[#00ADFC] tracking-wider">
                        {col.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                        {col.desc}
                      </p>
                    </div>

                    <div className="space-y-1">
                      {col.items.map((item, iIdx) => (
                          <a
                            key={iIdx}
                            href={item.link}
                            onClick={() => setSolutionsOpen(false)}
                            className="flex items-start gap-3 p-2 rounded-xl hover:bg-[#f0f9ff] group/item transition-colors"
                          >
                            <LandingIcon name={megaMenuArt[item.name] ?? "marketing"} className="h-10 w-10 shrink-0 drop-shadow-sm transition-transform group-hover/item:scale-110" />
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-slate-800 group-hover/item:text-[#00ADFC] transition-colors block leading-snug truncate">
                                {item.name}
                              </span>
                              <span className="text-[11px] text-slate-400 block leading-tight truncate">
                                {item.desc}
                              </span>
                            </div>
                          </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom Bar: 3 Cards for iGen Core Strengths */}
              <div className="bg-slate-50/80 border-t border-slate-100 p-4 px-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <a
                  href="#tich-hop-tiktok"
                  onClick={() => setSolutionsOpen(false)}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-white border border-slate-200/80 hover:border-[#00ADFC] hover:shadow-md transition-all group"
                >
                  <LandingIcon name="retail" className="h-10 w-10 shrink-0 drop-shadow-sm transition-transform group-hover:scale-105" />
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-900 group-hover:text-[#00ADFC] transition-colors">
                        Tích hợp TikTok Shop Chính thức
                      </span>
                      <span className="px-1.5 py-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full uppercase">
                        Hot
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Đưa đơn hàng và số lượng hàng về iGen ERP
                    </p>
                  </div>
                </a>

                <a
                  href="#giai-phap"
                  onClick={() => setSolutionsOpen(false)}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-white border border-slate-200/80 hover:border-[#00ADFC] hover:shadow-md transition-all group"
                >
                  <LandingIcon name="assistant" className="h-10 w-10 shrink-0 drop-shadow-sm transition-transform group-hover:scale-105" />
                  <div className="text-left">
                    <span className="text-xs font-semibold text-slate-900 group-hover:text-[#00ADFC] transition-colors block">
                      Trợ lý ảo IGEN AI Thông minh
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Tự động hóa chăm sóc khách hàng và đề xuất vận hành 24/7
                    </p>
                  </div>
                </a>

                <a
                  href="#giai-phap"
                  onClick={() => setSolutionsOpen(false)}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-white border border-slate-200/80 hover:border-[#00ADFC] hover:shadow-md transition-all group"
                >
                  <LandingIcon name="reports" className="h-10 w-10 shrink-0 drop-shadow-sm transition-transform group-hover:scale-105" />
                  <div className="text-left">
                    <span className="text-xs font-semibold text-slate-900 group-hover:text-[#00ADFC] transition-colors block">
                      Hệ sinh thái Quản trị Tập trung
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Đồng bộ dữ liệu bán lẻ, nhân sự và học viên
                    </p>
                  </div>
                </a>
              </div>

            </div>
          </div>
        )}

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-100 bg-white px-4 py-4 space-y-3 text-left animate-fade-in shadow-xl">
            <div className="space-y-1 text-sm font-semibold text-slate-700">
              <div className="py-2 border-y border-slate-100 my-1">
                <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Phân hệ giải pháp</span>
                <div className="pl-2 space-y-1.5 text-xs">
                  <a href="#giai-phap" onClick={() => setMobileMenuOpen(false)} className="block py-1 text-slate-700 hover:text-[#00ADFC] font-medium">AI Marketing & CRM Đa kênh</a>
                  <a href="#giai-phap" onClick={() => setMobileMenuOpen(false)} className="block py-1 text-slate-700 hover:text-[#00ADFC] font-medium">Bán lẻ & Quầy thu ngân</a>
                  <a href="#giai-phap" onClick={() => setMobileMenuOpen(false)} className="block py-1 text-slate-700 hover:text-[#00ADFC] font-medium">Tuyển dụng & Quản lý lao động</a>
                  <a href="#giai-phap" onClick={() => setMobileMenuOpen(false)} className="block py-1 text-slate-700 hover:text-[#00ADFC] font-medium">Quản lý học viên & Đào tạo</a>
                </div>
              </div>

              <a href="#tich-hop-tiktok" onClick={() => setMobileMenuOpen(false)} className="block py-2 hover:text-[#00ADFC]">Tích hợp TikTok Shop</a>
              <a href="#bao-mat" onClick={() => setMobileMenuOpen(false)} className="block py-2 hover:text-[#00ADFC]">Bảo mật & Kiểm soát</a>
              <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="block py-2 hover:text-[#00ADFC]">Câu hỏi thường gặp</a>
              <a href="#phap-ly" onClick={() => setMobileMenuOpen(false)} className="block py-2 hover:text-[#00ADFC]">Liên hệ</a>
              <a href="tel:+84353710189" className="flex items-center gap-2 py-2 text-[#007eb8] hover:text-[#00ADFC]">
                <Phone className="h-4 w-4" /> 0353.710.189
              </a>
            </div>
            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <a href="/dang-nhap" className="landing-rainbow-border landing-rainbow-border--light flex-1 text-center py-2 text-xs font-semibold text-[#00ADFC] rounded-lg">
                Đăng nhập
              </a>
              <a href="/dang-nhap" className="landing-rainbow-border flex-1 text-center py-2 text-xs font-semibold text-white rounded-lg shadow-sm">
                Dùng thử
              </a>
            </div>
          </div>
        )}
      </header>

      <main id="main_content">
        {/* ========================================================= */}
        {/* HERO SECTION: ORIGINAL IGEN COPY & STATS WITH CLEAN GLOW */}
        {/* ========================================================= */}
        <section
          id="tong-quan"
          className="relative pt-8 pb-14 sm:pt-12 sm:pb-20 overflow-hidden text-center bg-gradient-to-b from-[#f0f9ff]/70 via-[#f8fcff]/90 to-white"
        >
          {/* Ambient Brand Color Light Meshes */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] sm:w-[950px] h-[380px] bg-gradient-to-b from-[#00ADFC]/15 via-[#00ADFC]/5 to-transparent blur-3xl pointer-events-none -z-10 animate-brand-pulse" />
          <div className="absolute top-10 left-[8%] w-72 h-72 rounded-full bg-[#00ADFC]/10 blur-3xl pointer-events-none -z-10 animate-float-gentle" />
          <div className="absolute top-16 right-[8%] w-80 h-80 rounded-full bg-cyan-400/10 blur-3xl pointer-events-none -z-10 animate-float-delayed" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 relative z-10">

            {/* Headline: Original iGen text */}
            <div data-landing-reveal className="max-w-5xl mx-auto space-y-2">
              <h1 className="text-[1.8rem] sm:text-[2.25rem] md:text-[2.7rem] lg:text-[3.15rem] font-bold text-slate-900 tracking-tight leading-tight">
                Tối ưu hóa vận hành doanh nghiệp của bạn <br />
                <span className="text-[#00ADFC]">
                  với nền tảng {BRAND_NAME}
                </span>
              </h1>

              <p className="text-xs sm:text-sm md:text-base font-semibold text-slate-700">
                AI Marketing – Bán lẻ – Tuyển dụng – Quản lý học viên – HRM
              </p>
            </div>

            {/* Action Buttons: Original iGen Action Buttons */}
            <div data-landing-reveal className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <a
                href="/dang-nhap"
                id="hero_btn_get_started"
                className="landing-rainbow-border text-white font-semibold py-2.5 px-6 rounded-xl text-xs sm:text-sm shadow-md shadow-[#00ADFC]/25 hover:shadow-lg hover:shadow-[#00ADFC]/40 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center gap-2"
              >
                <span>Bắt đầu ngay hôm nay</span>
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="#tich-hop-tiktok"
                id="hero_btn_tiktok_features"
                className="landing-rainbow-border landing-rainbow-border--light text-[#00ADFC] font-semibold py-2.5 px-6 rounded-xl text-xs sm:text-sm shadow-2xs hover:-translate-y-0.5 transition-all"
              >
                <span>Xem tích hợp TikTok Shop</span>
              </a>
            </div>


            {/* Layered hero illustration: the robot moves while the dashboard stays still */}
            <div data-landing-reveal className="relative max-w-4xl mx-auto pt-4">
              <div className="landing-hero-visual relative rounded-2xl border border-sky-100 bg-white/90 p-2 shadow-2xl shadow-[#00ADFC]/10 backdrop-blur-xs overflow-hidden">
                <div className="landing-hero-scene rounded-xl" role="img" aria-label="Robot AI của iGen ERP bay trước các bảng quản lý nhân sự, bán lẻ và giáo dục">
                  <img src="/hero-ai-agent-background-hrm-retail-edu.png" alt="" className="landing-hero-background" aria-hidden="true" />
                  <img src="/hero-ai-agent-robot.png" alt="" className="landing-hero-robot" aria-hidden="true" />
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* ========================================================= */}
        {/* SECTION 2: SOLUTION CAROUSEL */}
        {/* ========================================================= */}
        <section
          id="giai-phap"
          className="py-14 sm:py-20 bg-gradient-to-b from-[#f8fbff] via-[#edf7ff]/60 to-[#f8fbff] border-y border-sky-100/70 relative overflow-hidden"
        >
          <div className="absolute -top-32 right-1/4 w-96 h-96 bg-[#00ADFC]/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-10 w-80 h-80 bg-cyan-400/10 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div data-landing-reveal className="max-w-3xl mx-auto text-center mb-9 sm:mb-12">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#008ecf]">Hệ sinh thái quản trị doanh nghiệp toàn diện</span>
              <h2 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-semibold text-slate-900 tracking-tight">
                Một nền tảng <span className="text-slate-300 font-light mx-1">|</span> <span className="text-[#00ADFC]">Mọi giải pháp</span>
              </h2>
              <p className="mt-3 text-xs sm:text-sm text-slate-600 leading-relaxed max-w-2xl mx-auto">
                Kết nối AI Marketing, bán lẻ, nhân sự và giáo dục trong một trải nghiệm quản trị thống nhất.
              </p>
            </div>

            <div data-landing-reveal className="relative max-w-6xl mx-auto" role="region" aria-roledescription="carousel" aria-label="Các giải pháp iGen ERP">
              <button type="button" onClick={() => setActiveSuite((current) => (current - 1 + suites.length) % suites.length)} aria-label="Giải pháp trước" className="hidden xl:flex absolute -left-16 top-1/2 -translate-y-1/2 z-10 h-11 w-11 items-center justify-center rounded-full bg-white border border-sky-100 text-[#007eb8] shadow-md hover:bg-[#eaf8ff] hover:shadow-lg transition-all cursor-pointer">
                <ChevronRight className="h-5 w-5 rotate-180" />
              </button>

              <div className="landing-rainbow-card rounded-[28px] grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr] gap-4 lg:gap-8 p-5 sm:p-8 lg:p-10 shadow-[0_24px_70px_-38px_rgba(0,100,165,0.32)] text-left overflow-hidden">
                <div key={`copy-${activeSuite}`} className="landing-solution-enter flex flex-col justify-between min-w-0">
                  <div>
                    <h3 className="text-xl sm:text-2xl lg:text-[28px] leading-tight font-semibold tracking-tight text-slate-900">{selectedSuite.title}</h3>
                    <p className="mt-3 text-sm text-slate-600 leading-relaxed max-w-md">{selectedSuite.desc}</p>
                    <div className="mt-6 space-y-3">
                      {selectedSuite.apps.map((app) => (
                        <div key={app.name} className="flex items-center gap-3">
                          <span className={`h-9 w-9 shrink-0 rounded-xl ${app.iconBg} flex items-center justify-center shadow-sm`}>
                            <LandingIcon name={app.icon as LandingIconName} className="h-9 w-9" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-xs sm:text-sm font-semibold text-slate-800">{app.name}</span>
                            <span className="block text-[11px] text-slate-500 leading-snug">{app.desc}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-7 flex flex-wrap gap-3">
                    <a href="/dang-nhap" className="landing-rainbow-border inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-white text-xs sm:text-sm font-semibold shadow-md shadow-sky-200 hover:-translate-y-0.5 transition-transform">
                      Dùng thử miễn phí <ArrowRight className="h-4 w-4" />
                    </a>
                    <button type="button" onClick={() => setActiveSuite((current) => (current + 1) % suites.length)} className="landing-rainbow-border landing-rainbow-border--light inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-[#008ecf] text-xs sm:text-sm font-semibold cursor-pointer">
                      Giải pháp tiếp theo
                    </button>
                  </div>
                </div>

                <div key={`preview-${activeSuite}`} className="landing-solution-enter relative flex items-center min-w-0 rounded-[22px] bg-gradient-to-br from-[#e8f8ff] via-[#f8fcff] to-[#d7edff] p-4 sm:p-6 overflow-hidden">
                  <div className="absolute -top-16 -right-10 h-52 w-52 rounded-full bg-[#00ADFC]/20 blur-3xl" />
                  <div className="absolute -bottom-20 left-0 h-48 w-48 rounded-full bg-blue-300/25 blur-3xl" />
                  <div className="relative w-full rounded-2xl border border-white/80 bg-white shadow-[0_24px_50px_-25px_rgba(0,91,160,0.35)] overflow-hidden">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="grid h-6 w-6 place-items-center rounded-lg bg-[#00ADFC] text-white text-[10px] font-bold">iG</span>
                        <span className="text-[11px] font-semibold text-slate-800">iGen ERP</span>
                      </div>
                      <span className="text-[9px] sm:text-[10px] text-slate-400">Giao diện minh họa</span>
                    </div>
                    <div className="flex min-h-[292px] sm:min-h-[330px]">
                      <div className="w-12 sm:w-14 shrink-0 border-r border-slate-100 bg-[#f7fbff] p-2 flex flex-col items-center gap-3">
                        {selectedSuite.apps.map((app, index) => (
                          <span key={app.name} className={`grid h-8 w-8 place-items-center rounded-lg ${index === 0 ? "bg-[#dff5ff] text-[#008ecf]" : "bg-white text-slate-400"}`}>
                            <LandingIcon name={app.icon as LandingIconName} className="h-6 w-6" />
                          </span>
                        ))}
                      </div>
                      <div className="flex-1 min-w-0 p-3 sm:p-4 space-y-3">
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-slate-400">Tổng quan giải pháp</span>
                          <h4 className="text-xs sm:text-sm font-semibold text-slate-800 truncate">{selectedSuite.title}</h4>
                        </div>
                        <div className="rounded-xl border border-sky-100 bg-gradient-to-br from-white to-[#f4fbff] p-3 sm:p-4">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] sm:text-xs font-semibold text-slate-700">Hoạt động theo tuần</span>
                            <span className="h-2 w-2 rounded-full bg-[#00ADFC]" />
                          </div>
                          <div className="mt-4 flex h-24 sm:h-28 items-end justify-between gap-2 border-b border-slate-200/80">
                            {solutionPreviewBars[activeSuite].map((height, index) => (
                              <div key={index} className="flex-1 rounded-t-md bg-gradient-to-t from-[#00ADFC] to-[#9ce7ff]" style={{ height: `${height}%` }} />
                            ))}
                          </div>
                          <div className="mt-1 flex justify-between text-[8px] text-slate-400"><span>T2</span><span>T3</span><span>T4</span><span>T5</span><span>T6</span><span>T7</span><span>CN</span></div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {selectedSuite.apps.slice(0, 2).map((app, index) => (
                            <div key={app.name} className="rounded-lg border border-slate-100 bg-white p-2.5 shadow-sm min-w-0">
                              <span className={`block h-1.5 w-7 rounded-full ${index === 0 ? "bg-[#00ADFC]" : "bg-cyan-300"}`} />
                              <span className="mt-2 block text-[9px] sm:text-[10px] font-medium text-slate-600 truncate">{app.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <button type="button" onClick={() => setActiveSuite((current) => (current + 1) % suites.length)} aria-label="Giải pháp tiếp theo" className="hidden xl:flex absolute -right-16 top-1/2 -translate-y-1/2 z-10 h-11 w-11 items-center justify-center rounded-full bg-white border border-sky-100 text-[#007eb8] shadow-md hover:bg-[#eaf8ff] hover:shadow-lg transition-all cursor-pointer">
                <ChevronRight className="h-5 w-5" />
              </button>

              <div className="mt-6 flex items-center justify-center gap-3">
                <button type="button" onClick={() => setActiveSuite((current) => (current - 1 + suites.length) % suites.length)} aria-label="Giải pháp trước" className="xl:hidden grid h-9 w-9 place-items-center rounded-full border border-sky-100 bg-white text-[#007eb8] shadow-sm cursor-pointer"><ChevronRight className="h-4 w-4 rotate-180" /></button>
                {suites.map((suite, index) => (
                  <button key={suite.title} type="button" onClick={() => setActiveSuite(index)} aria-label={`Xem ${suite.title}`} aria-current={activeSuite === index ? "true" : undefined} className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${activeSuite === index ? "w-7 bg-[#00ADFC]" : "w-2 bg-sky-200 hover:bg-sky-400"}`} />
                ))}
                <button type="button" onClick={() => setActiveSuite((current) => (current + 1) % suites.length)} aria-label="Giải pháp tiếp theo" className="xl:hidden grid h-9 w-9 place-items-center rounded-full border border-sky-100 bg-white text-[#007eb8] shadow-sm cursor-pointer"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        </section>

        {/* Industries supported by the current iGen ERP modules */}
        <section id="linh-vuc" className="relative overflow-hidden bg-white py-14 sm:py-20">
          <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-[#f4fbff] to-transparent pointer-events-none" />
          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div data-landing-reveal className="mx-auto max-w-4xl text-center">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#008ecf]">Ứng dụng theo ngành nghề</span>
              <h2 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight leading-tight text-slate-900">
                Linh hoạt đáp ứng <span className="text-[#00ADFC]">đa lĩnh vực, đa ngành nghề</span> trên một nền tảng duy nhất
              </h2>
            </div>

            <div data-landing-reveal className="landing-industry-tabs -mx-4 mt-8 flex gap-2 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0 lg:justify-center" role="tablist" aria-label="Chọn ngành nghề">
              {industries.map((industry, index) => (
                <button
                  key={industry.label}
                  id={`industry-tab-${index}`}
                  type="button"
                  role="tab"
                  aria-selected={activeIndustry === index}
                  aria-controls="industry-panel"
                  onClick={() => setActiveIndustry(index)}
                  className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-xs sm:text-sm font-medium transition-all duration-200 cursor-pointer ${activeIndustry === index ? "border-[#00ADFC] bg-[#eaf8ff] text-[#007eb8] shadow-sm shadow-sky-100" : "border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:bg-sky-50"}`}
                >
                  <LandingIcon name={industry.icon} className="h-6 w-6" />
                  {industry.label}
                </button>
              ))}
            </div>

            <div data-landing-reveal id="industry-panel" role="tabpanel" aria-labelledby={`industry-tab-${activeIndustry}`} className="landing-rainbow-card mt-5 rounded-[28px] p-3 sm:p-5 lg:p-7 shadow-[0_24px_70px_-38px_rgba(0,100,165,0.28)]">
              <div key={activeIndustry} className="landing-solution-enter grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-12 items-center">
                <div className="overflow-hidden rounded-[20px] bg-[#eef9ff] border border-sky-100 shadow-sm">
                  <img src={selectedIndustry.image} alt={`Minh họa ngành ${selectedIndustry.label.toLowerCase()}`} loading="eager" width={1448} height={1086} className="block w-full aspect-[4/3] object-cover" />
                </div>
                <div className="px-2 pb-5 sm:px-4 lg:pr-8 lg:pb-0">
                  <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#008ecf]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#00ADFC]" /> {selectedIndustry.label}
                  </span>
                  <h3 className="mt-3 text-xl sm:text-2xl lg:text-[28px] font-semibold leading-tight tracking-tight text-slate-900">{selectedIndustry.title}</h3>
                  <p className="mt-3 max-w-lg text-sm leading-relaxed text-slate-600">{selectedIndustry.description}</p>
                  <ul className="mt-6 space-y-3">
                    {selectedIndustry.points.map((point) => (
                      <li key={point} className="flex items-start gap-3 rounded-xl border border-sky-100/70 bg-[#f8fcff] px-3.5 py-3 text-xs sm:text-sm leading-relaxed text-slate-700">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#00ADFC]" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                  <a href="#giai-phap" className="landing-rainbow-border mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-md shadow-sky-200 hover:-translate-y-0.5 transition-transform">
                    Xem các giải pháp <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TikTok Shop sales synchronization */}
        <section id="tich-hop-tiktok" className="py-16 sm:py-20 bg-gradient-to-b from-[#f8fbff] via-[#f0f9ff]/60 to-white border-t border-slate-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14 items-center">
              <div data-landing-reveal>
                <TikTokSyncIllustration />
              </div>

              <div data-landing-reveal className="text-left">
                <span className="inline-flex items-center rounded-full bg-[#e3f6ff] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#008fcf]">
                  Đồng bộ bán hàng
                </span>
                <h2 className="mt-4 text-2xl sm:text-3xl font-semibold leading-tight tracking-tight text-slate-900">
                  Bán hàng trên TikTok Shop, quản lý dễ dàng tại iGen ERP
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-slate-600">
                  Kết nối gian hàng một lần để đơn hàng TikTok Shop được đưa về iGen ERP. Bạn có thể theo dõi đơn, xử lý bán hàng và cập nhật số lượng hàng còn bán ở cùng một nơi.
                </p>

                <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="landing-rainbow-card rounded-2xl p-4 shadow-sm transition-transform duration-300 hover:-translate-y-0.5">
                    <h3 className="text-sm font-semibold text-slate-900">Kết nối gian hàng</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-600">Đăng nhập TikTok Shop và cho phép kết nối với iGen ERP.</p>
                  </div>
                  <div className="landing-rainbow-card rounded-2xl p-4 shadow-sm transition-transform duration-300 hover:-translate-y-0.5">
                    <h3 className="text-sm font-semibold text-slate-900">Đơn hàng về một nơi</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-600">Đơn mới được đưa về hệ thống để bạn theo dõi và xử lý.</p>
                  </div>
                  <div className="landing-rainbow-card rounded-2xl p-4 shadow-sm transition-transform duration-300 hover:-translate-y-0.5">
                    <h3 className="text-sm font-semibold text-slate-900">Theo dõi hàng còn bán</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-600">Xem số lượng hàng và cập nhật khi có thay đổi.</p>
                  </div>
                  <div className="landing-rainbow-card rounded-2xl p-4 shadow-sm transition-transform duration-300 hover:-translate-y-0.5">
                    <h3 className="text-sm font-semibold text-slate-900">Xử lý đơn thuận tiện</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-600">Giảm việc chuyển qua lại giữa nhiều màn hình khi bán hàng.</p>
                  </div>
                </div>
              </div>
            </div>

            <div data-landing-reveal className="rounded-[28px] border border-sky-100 bg-white p-6 sm:p-8 shadow-[0_18px_55px_-42px_rgba(0,120,190,0.35)]">
              <div className="text-center">
                <h3 className="text-lg sm:text-xl font-semibold text-slate-900">Kết nối TikTok Shop trong 3 bước</h3>
                <p className="mt-1.5 text-sm text-slate-600">Thao tác đơn giản ngay trong iGen ERP</p>
              </div>
              <div className="mt-7 grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                <div className="landing-rainbow-card landing-rainbow-card--soft rounded-2xl p-5 transition-transform duration-300 hover:-translate-y-0.5">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#00ADFC] text-sm font-semibold text-white">1</span>
                  <h4 className="mt-4 text-sm font-semibold text-slate-900">Chọn kết nối</h4>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600">Mở phần kết nối trong iGen ERP và chọn TikTok Shop.</p>
                </div>
                <div className="landing-rainbow-card landing-rainbow-card--soft rounded-2xl p-5 transition-transform duration-300 hover:-translate-y-0.5">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#00ADFC] text-sm font-semibold text-white">2</span>
                  <h4 className="mt-4 text-sm font-semibold text-slate-900">Đăng nhập gian hàng</h4>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600">Đăng nhập TikTok Shop và xác nhận kết nối.</p>
                </div>
                <div className="landing-rainbow-card landing-rainbow-card--soft rounded-2xl p-5 transition-transform duration-300 hover:-translate-y-0.5">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#00ADFC] text-sm font-semibold text-white">3</span>
                  <h4 className="mt-4 text-sm font-semibold text-slate-900">Bắt đầu bán hàng</h4>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600">Theo dõi đơn hàng và số lượng hàng còn bán tại iGen ERP.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
        {/* ========================================================= */}
        {/* SECTION 5: SECURITY & COMPLIANCE                          */}
        {/* ========================================================= */}
        <section id="bao-mat" className="relative overflow-hidden border-t border-[#e6f3fb] bg-gradient-to-b from-white via-[#f3faff] to-white py-16 sm:py-24">
          <div className="pointer-events-none absolute -left-32 top-1/2 h-80 w-80 -translate-y-1/2 rounded-full bg-[#00ADFC]/[0.05] blur-3xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -right-24 top-0 h-72 w-72 rounded-full bg-[#9be7ff]/20 blur-3xl" aria-hidden="true" />
          <div className="relative mx-auto max-w-6xl space-y-10 px-4 text-center sm:px-6 lg:px-8">

            <div data-landing-reveal className="mx-auto max-w-2xl space-y-3">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                Cam kết Bảo mật & Quyền kiểm soát Dữ liệu
              </h2>
              <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
                Tuân thủ các tiêu chuẩn bảo mật dữ liệu và quyền riêng tư người dùng
              </p>
            </div>

            <div data-landing-reveal className="grid grid-cols-1 gap-5 text-left md:grid-cols-3">
              <div className="landing-rainbow-card group flex h-full flex-col rounded-[24px] p-6 shadow-[0_12px_30px_-22px_rgba(0,83,143,0.35)] transition-transform duration-300 hover:-translate-y-1 sm:p-7">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#d8f4ff] to-[#9be5ff] text-[#007fb5] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_6px_14px_rgba(0,173,252,0.12)]">
                  <Lock className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-base font-semibold text-slate-900 sm:text-lg">Bảo vệ dữ liệu khi kết nối</h3>
                <p className="text-sm leading-relaxed text-slate-600">
                  Thông tin bán hàng được bảo vệ khi chuyển giữa TikTok Shop và iGen ERP.
                </p>
              </div>

              <div className="landing-rainbow-card group flex h-full flex-col rounded-[24px] p-6 shadow-[0_12px_30px_-22px_rgba(0,83,143,0.35)] transition-transform duration-300 hover:-translate-y-1 sm:p-7">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#defbf7] to-[#a8efe6] text-[#008d86] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_6px_14px_rgba(0,173,252,0.1)]">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-base font-semibold text-slate-900 sm:text-lg">Quyền ngắt kết nối</h3>
                <p className="text-sm leading-relaxed text-slate-600">
                  Bạn có toàn quyền ngắt kết nối tài khoản TikTok bất cứ lúc nào ngay trong phần cài đặt ERP.
                </p>
              </div>

              <div className="landing-rainbow-card group flex h-full flex-col rounded-[24px] p-6 shadow-[0_12px_30px_-22px_rgba(0,83,143,0.35)] transition-transform duration-300 hover:-translate-y-1 sm:p-7">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#e5efff] to-[#c6ddff] text-[#3676c7] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_6px_14px_rgba(0,173,252,0.1)]">
                  <Database className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-base font-semibold text-slate-900 sm:text-lg">Quy trình xóa sạch dữ liệu</h3>
                <p className="text-sm leading-relaxed text-slate-600">
                  Cung cấp hướng dẫn xóa dữ liệu công khai, cam kết xóa toàn bộ thông tin đồng bộ trong vòng 72h khi có yêu cầu.
                </p>
              </div>
            </div>

          </div>
        </section>

        {/* ========================================================= */}
        {/* SECTION 6: FAQ ACCORDION                                   */}
        {/* ========================================================= */}
        <section id="faq" className="border-t border-[#e6f3fb] bg-[#f7fbfe] py-16 sm:py-24">
          <div className="mx-auto max-w-4xl space-y-9 px-4 text-center sm:px-6 lg:px-8">

            <div data-landing-reveal className="space-y-3">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                Câu hỏi thường gặp
              </h2>
              <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
                Giải đáp cách kết nối gian hàng, đồng bộ đơn và quản lý dữ liệu
              </p>
            </div>

            <div data-landing-reveal className="space-y-4 text-left">
              {[
                {
                  q: "Kết nối TikTok Shop có cần đưa mật khẩu cho iGen ERP không?",
                  a: "Không. Bạn đăng nhập trên TikTok Shop và xác nhận kết nối tại đó; iGen ERP không yêu cầu bạn gửi mật khẩu gian hàng."
                },
                {
                  q: "Sau khi kết nối, thông tin nào được đồng bộ?",
                  a: "iGen ERP nhận đơn hàng từ TikTok Shop và cập nhật thông tin hàng còn bán để bạn theo dõi, xử lý đơn tại một nơi."
                },
                {
                  q: "Tôi có thể hủy liên kết tài khoản TikTok Shop bất cứ lúc nào không?",
                  a: "Có. Bạn có thể ngắt kết nối gian hàng trong phần cài đặt kết nối của iGen ERP."
                },
                {
                  q: "Làm cách nào để yêu cầu xóa toàn bộ dữ liệu đã đồng bộ khỏi hệ thống?",
                  a: "Bạn có thể xem hướng dẫn xóa dữ liệu ở cuối trang hoặc gửi yêu cầu cho bộ phận hỗ trợ."
                }
              ].map((faq, index) => {
                const isOpen = activeFaq === index;
                return (
                  <div key={index} className="landing-rainbow-card overflow-hidden rounded-[20px] shadow-[0_12px_30px_-22px_rgba(0,83,143,0.3)] transition-transform duration-300 hover:-translate-y-0.5">
                    <button
                      onClick={() => setActiveFaq(isOpen ? null : index)}
                      aria-expanded={isOpen}
                      className="flex w-full cursor-pointer items-center justify-between gap-4 p-5 text-left text-sm font-medium text-slate-900 transition-colors hover:bg-[#f8fcff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-5px] focus-visible:outline-[#00ADFC] sm:px-6 sm:py-5 sm:text-base"
                    >
                      <span>{faq.q}</span>
                      <ChevronRight className={`h-5 w-5 shrink-0 text-[#00ADFC] transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`} />
                    </button>
                    {isOpen && (
                      <div className="border-t border-[#e6f3fb] px-5 py-4 text-sm leading-relaxed text-slate-600 sm:px-6">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

          </div>
        </section>

        {/* ========================================================= */}
        {/* SECTION 7: CTA SECTION                                    */}
        {/* ========================================================= */}
        <section id="cta_section" className="relative overflow-hidden border-y border-[#d4efff] bg-gradient-to-br from-[#e4f7ff] via-[#f8fdff] to-[#d9f2ff] py-16 sm:py-20">
          <div className="pointer-events-none absolute -left-28 -top-32 h-80 w-80 rounded-full bg-[#00ADFC]/15 blur-3xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-[#73dfff]/20 blur-3xl" aria-hidden="true" />
          <div data-landing-reveal className="relative z-10 mx-auto max-w-4xl space-y-6 px-4 text-center sm:px-6 lg:px-8">
            <h2 className="text-2xl font-semibold tracking-tight text-[#075f8b] sm:text-3xl md:text-4xl">
              Sẵn sàng nâng tầm <span className="bg-gradient-to-r from-[#00ADFC] to-[#087ba9] bg-clip-text text-transparent">chuyển đổi số doanh nghiệp?</span>
            </h2>
            <p className="mx-auto max-w-xl text-sm leading-relaxed text-[#3d6d85] sm:text-base">
              Đăng ký trải nghiệm {BRAND_NAME} để khám phá AI Marketing, bán lẻ, nhân sự và quản lý học viên trên cùng một nền tảng.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <a
                href="/dang-nhap"
                id="cta_btn_free_trial"
                className="landing-rainbow-border w-full rounded-xl px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-[#00ADFC]/20 transition-transform hover:-translate-y-0.5 active:scale-[0.98] sm:w-auto"
              >
                Dùng thử miễn phí
              </a>
              <a
                href={PRIVACY_POLICY_URL}
                id="cta_btn_privacy_policy"
                className="landing-rainbow-border landing-rainbow-border--light w-full rounded-xl px-8 py-3 text-sm font-semibold text-[#007fb5] shadow-sm transition-transform hover:-translate-y-0.5 active:scale-[0.98] sm:w-auto"
              >
                Chính sách bảo mật
              </a>
            </div>
          </div>
        </section>

      </main>

      {/* ========================================================= */}
      {/* FOOTER: Clean, White/Light Slate, Compliant with all Links */}
      {/* ========================================================= */}
      <footer id="phap-ly" className="border-t border-[#e4f2fa] bg-white py-10 text-sm text-slate-600 sm:py-12">
        <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">

          <div className="grid grid-cols-1 gap-x-8 gap-y-9 border-b border-[#e4f2fa] pb-9 sm:grid-cols-2 lg:grid-cols-12 lg:gap-x-6">

            {/* Column 1: Company Profile */}
            <div className="space-y-4 text-left sm:col-span-2 lg:col-span-5 lg:pr-8">
              <div>
                <LandingBrandMark />
              </div>
              <p className="max-w-md text-sm leading-relaxed text-slate-500">
                Nền tảng hỗ trợ AI marketing, bán lẻ, quản lý lao động và giáo dục trên một hệ thống trực quan.
              </p>

              <div className="max-w-md space-y-2 border-t border-[#e4f2fa] pt-4 text-xs leading-relaxed text-slate-600">
                <div className="flex items-start gap-2">
                  <Globe className="mt-0.5 h-4 w-4 shrink-0 text-[#00ADFC]" />
                  <span><strong>Đơn vị chủ quản:</strong> CÔNG TY CỔ PHẦN CÔNG NGHỆ IGEN</span>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#00ADFC]" />
                  <span><strong>Địa chỉ:</strong> Lô LK3 LK4 Đường Lạc Long Quân, Phường Kinh Bắc, Thành phố Bắc Ninh, Tỉnh Bắc Ninh, Việt Nam</span>
                </div>
                <div className="flex items-start gap-2">
                  <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-[#00ADFC]" />
                  <span><strong>Mã số thuế:</strong> 2301355232 (Sở KH&ĐT Tỉnh Bắc Ninh cấp)</span>
                </div>
              </div>
            </div>

            {/* Column 2: Solutions */}
            <div className="space-y-4 text-left lg:col-span-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#087da9]">Phân hệ giải pháp</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><a href="#giai-phap" className="hover:text-[#00ADFC] transition-colors">AI Marketing & Đa kênh</a></li>
                <li><a href="#giai-phap" className="hover:text-[#00ADFC] transition-colors">Bán lẻ & Điểm bán POS</a></li>
                <li><a href="#giai-phap" className="hover:text-[#00ADFC] transition-colors">Tuyển dụng & Lao động</a></li>
                <li><a href="#giai-phap" className="hover:text-[#00ADFC] transition-colors">Quản lý học viên & Đào tạo</a></li>
              </ul>
            </div>

            {/* Column 3: Integrations */}
            <div className="space-y-4 text-left lg:col-span-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#087da9]">Kết nối bán hàng</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><a href="#tich-hop-tiktok" className="hover:text-[#00ADFC] transition-colors font-medium text-slate-700">Đồng bộ TikTok Shop</a></li>
                <li><span className="text-slate-400">Facebook Messenger</span></li>
                <li><span className="text-slate-400">Zalo OA Chat</span></li>
                <li><a href="#tich-hop-tiktok" className="hover:text-[#00ADFC] transition-colors">Cách kết nối TikTok Shop</a></li>
              </ul>
            </div>

            {/* Column 4: Legal & Policy (CRITICAL FOR AUDIT) */}
            <div className="space-y-4 text-left sm:col-span-2 lg:col-span-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#087da9]">Thông tin pháp lý</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href={PRIVACY_POLICY_URL} id="footer_link_privacy" className="text-slate-600 transition-colors hover:text-[#00ADFC]">
                    Chính sách bảo mật
                  </a>
                </li>
                <li>
                  <a href={TERMS_OF_SERVICE_URL} id="footer_link_terms" className="text-slate-600 transition-colors hover:text-[#00ADFC]">
                    Điều khoản dịch vụ
                  </a>
                </li>
                <li>
                  <a href={USER_DATA_DELETION_URL} id="footer_link_data_deletion" className="text-slate-600 transition-colors hover:text-[#00ADFC]">
                    Hướng dẫn xóa dữ liệu
                  </a>
                </li>
                <li>
                  <a href={SUPPORT_URL} id="footer_link_support" target="_blank" rel="noopener noreferrer" className="hover:text-[#00ADFC] transition-colors">
                    Hỗ trợ & liên hệ
                  </a>
                </li>
              </ul>

              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-[#087da9]">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#00ADFC]" />
                  <span className="text-[10px] font-medium">Đã đăng ký Bộ Công Thương</span>
                </div>
              </div>
            </div>

          </div>

          {/* Bottom copyright */}
          <div className="flex flex-col gap-3 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <span>
              © {new Date().getFullYear()} CÔNG TY CỔ PHẦN CÔNG NGHỆ IGEN. Tất cả quyền được bảo lưu.
            </span>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 font-medium text-[#087da9]">
                <ShieldCheck className="h-4 w-4" />
                Bảo mật mã hóa SSL/TLS 1.3
              </span>
            </div>
          </div>

        </div>
      </footer>

      {/* Zalo contact */}
      <div className="fixed bottom-6 right-5 z-40">
        <a
          href="https://zalo.me/0353710189"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Nhắn Zalo qua số 0353.710.189"
          title="Zalo: 0353.710.189"
          className="block h-12 w-12 rounded-xl shadow-lg shadow-blue-500/20 transition-transform hover:scale-110 active:scale-95"
        >
          <img src="/zalo-logo.svg" alt="" width={48} height={48} className="h-12 w-12" />
        </a>
      </div>

    </div>
  );
}
