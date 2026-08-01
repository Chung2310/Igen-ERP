import { BRAND_LOGO_URL, BRAND_NAME } from "../config/brand";
import type { TabType } from "../types";

export type SeoMeta = {
  title: string;
  description: string;
  keywords: string;
  path: string;
  image?: string;
  robots?: string;
  type?: "website" | "article";
  priority?: string;
  changeFrequency?: "daily" | "weekly" | "monthly";
};

export const SEO_BASE_URL = "https://erp.igentechsolutions.com";
export const SEO_DEFAULT_IMAGE = BRAND_LOGO_URL;
export const SEO_DEFAULT_LOCALE = "vi_VN";

export function buildDocumentTitle(title: string) {
  const normalized = title.trim();
  return normalized.includes(BRAND_NAME) ? normalized : `${normalized} | ${BRAND_NAME}`;
}

export const DEFAULT_SEO: SeoMeta = {
  title: "Nền tảng quản trị doanh nghiệp tích hợp AI",
  description:
    "iGen ERP là nền tảng quản trị doanh nghiệp tích hợp AI thế hệ mới, hỗ trợ quản lý kho vận, nhân sự, tiếp thị tự động, quản lý khách hàng đa kênh và tối ưu hiệu suất vận hành doanh nghiệp.",
  keywords:
    "iGen ERP, ERP tích hợp AI, phần mềm quản trị doanh nghiệp, quản lý nhân sự HRM, quản lý kho thông minh, marketing AI, sales CRM đa kênh, tối ưu vận hành",
  path: "/",
  image: SEO_DEFAULT_IMAGE,
  robots: "index, follow",
  type: "website",
  priority: "1.0",
  changeFrequency: "weekly",
};

export const AUTH_SEO: SeoMeta = {
  title: "Đăng nhập - Quản trị doanh nghiệp thông minh",
  description:
    "Đăng nhập vào iGen ERP để quản lý vận hành, nhân sự, kho, tiếp thị và khách hàng trên một nền tảng doanh nghiệp tích hợp AI.",
  keywords:
    "đăng nhập iGen ERP, hệ thống ERP doanh nghiệp, cổng quản trị AI, phần mềm ERP",
  path: "/dang-nhap",
  image: SEO_DEFAULT_IMAGE,
  robots: "noindex, nofollow",
  type: "website",
  priority: "0.3",
  changeFrequency: "monthly",
};

export const PRIVACY_SEO: SeoMeta = {
  title: "Chính sách bảo mật",
  description: "Chính sách bảo mật thông tin người dùng và dữ liệu của iGen ERP.",
  keywords: "chính sách bảo mật, bảo mật dữ liệu, igen erp",
  path: "/privacy-policy",
  image: SEO_DEFAULT_IMAGE,
  robots: "index, follow",
  type: "website",
  priority: "0.5",
  changeFrequency: "monthly",
};

export const TERMS_SEO: SeoMeta = {
  title: "Điều khoản dịch vụ",
  description: "Điều khoản dịch vụ và thỏa thuận sử dụng phần mềm quản trị doanh nghiệp iGen ERP.",
  keywords: "điều khoản dịch vụ, thoả thuận sử dụng, igen erp",
  path: "/terms-of-service",
  image: SEO_DEFAULT_IMAGE,
  robots: "index, follow",
  type: "website",
  priority: "0.5",
  changeFrequency: "monthly",
};

export const DELETION_SEO: SeoMeta = {
  title: "Yêu cầu xóa dữ liệu người dùng",
  description: "Hướng dẫn xóa dữ liệu người dùng và tra cứu trạng thái yêu cầu xóa thông tin trên hệ thống iGen ERP.",
  keywords: "xóa dữ liệu người dùng, bảo mật dữ liệu, user data deletion, igen erp",
  path: "/user-data-deletion",
  image: SEO_DEFAULT_IMAGE,
  robots: "index, follow",
  type: "website",
  priority: "0.5",
  changeFrequency: "monthly",
};

export const TAB_SEO_MAP: Record<TabType, SeoMeta> = {
  "TỔNG QUAN": {
    title: "Tổng quan doanh nghiệp - Dashboard điều hành thông minh",
    description:
      "Báo cáo tổng quan hiệu suất kinh doanh, doanh thu bán hàng, tiến độ công việc và phân tích vận hành doanh nghiệp tự động với AI trên iGen ERP.",
    keywords:
      "dashboard doanh nghiệp, tổng quan ERP, báo cáo điều hành, dashboard AI, iGen ERP, doanh thu erp",
    path: "/tong-quan",
    priority: "0.9",
    changeFrequency: "daily",
  },
  "NHÂN SỰ": {
    title: "Quản lý nhân sự HRM - Sơ đồ tổ chức, KPI và Đào tạo",
    description:
      "Giải pháp HRM toàn diện trên iGen ERP giúp quản lý hồ sơ nhân sự, vẽ sơ đồ tổ chức tự động, thiết lập KPI và số hóa tài liệu đào tạo nội bộ.",
    keywords:
      "quản lý nhân sự, HRM, KPI nhân viên, đào tạo nội bộ, sơ đồ tổ chức, ERP nhân sự, sơ đồ báo cáo",
    path: "/nhan-su",
    priority: "0.8",
    changeFrequency: "weekly",
  },
  "ĐỐI TÁC": {
    title: "Quản lý đối tác & cộng tác viên - Hoa hồng và giới thiệu",
    description:
      "Quản lý tập trung hồ sơ đối tác, cộng tác viên, lượt giới thiệu, cấp bậc hoa hồng và lịch sử chi trả trên iGen ERP.",
    keywords:
      "quản lý đối tác, cộng tác viên, hoa hồng, giới thiệu khách hàng, đối tác tuyển dụng, iGen ERP",
    path: "/doi-tac",
    priority: "0.7",
    changeFrequency: "weekly",
  },
  "KHO & SẢN PHẨM": {
    title: "Quản lý kho & Sản phẩm - Quản lý tồn kho theo mã sản phẩm, xuất nhập kho",
    description:
      "Tối ưu hóa quản lý chuỗi cung ứng với tính năng quản lý tồn kho theo mã sản phẩm, theo dõi lịch sử giao dịch xuất nhập kho và dự báo nhu cầu hàng hóa thông minh bằng AI.",
    keywords:
      "quản lý kho, quản lý sản phẩm, tồn kho, SKU, dự báo nhu cầu, ERP kho vận, xuất nhập kho",
    path: "/kho-san-pham",
    priority: "0.8",
    changeFrequency: "weekly",
  },
  "QUẢN LÝ TÀI NGUYÊN": {
    title: "Quản lý tài nguyên - Lưu trữ và đồng bộ Google Drive",
    description:
      "Không gian quản lý tài nguyên, tài liệu nội bộ và liên kết đồng bộ trực tiếp với tài khoản Google Drive cá nhân của nhân viên trên iGen ERP.",
    keywords:
      "quản lý tài nguyên, lưu trữ tài liệu, google drive erp, đồng bộ google drive, thư mục tài nguyên, igen erp",
    path: "/quan-ly-tai-nguyen",
    priority: "0.8",
    changeFrequency: "weekly",
  },
  "TRÒ CHUYỆN": {
    title: "Trò chuyện nội bộ - Trực quan, Thời gian thực",
    description:
      "Trực tiếp trao đổi công việc, trò chuyện 1-1 hoặc tạo phòng chat nhóm giữa các tài khoản nhân viên trong doanh nghiệp tại iGen ERP.",
    keywords:
      "chat nội bộ, chat nhóm, chat 1-1, trò chuyện nội bộ, nhắn tin realtime, socket.io chat, igen erp",
    path: "/tro-chuyen",
    priority: "0.7",
    changeFrequency: "weekly",
  },
  "QUẢN LÝ HỌC VIÊN": {
    title: "Quản lý học viên - Đào tạo, lớp học, lịch thi và học phí",
    description:
      "Phân khu quản lý học viên trong iGen ERP giúp theo dõi hồ sơ học viên, khóa học, lớp học, lịch thi, học phí, thông báo và đối tác tuyển sinh trên cùng một nền tảng.",
    keywords:
      "quản lý học viên, quản lý đào tạo, lớp học, lịch thi, học phí, đối tác tuyển sinh, erp giáo dục",
    path: "/quan-ly-hoc-vien",
    priority: "0.8",
    changeFrequency: "weekly",
  },
  "QUẢN LÝ LAO ĐỘNG": {
    title: "Quản lý lao động - Hồ sơ, ca làm và theo dõi nhân công",
    description:
      "Phân khu quản lý lao động trong iGen ERP giúp doanh nghiệp theo dõi hồ sơ người lao động, phân công công việc, ca làm và hiệu suất nhân công tập trung.",
    keywords:
      "quản lý lao động, quản lý nhân công, hồ sơ người lao động, ca làm việc, phân công công việc, ERP lao động",
    path: "/quan-ly-lao-dong",
    priority: "0.8",
    changeFrequency: "weekly",
  },
  "QUẢN LÝ KHÁCH HÀNG": {
    title: "Quản lý khách hàng - Hồ sơ, chăm sóc và lịch sử tương tác",
    description:
      "Phân khu quản lý khách hàng trong iGen ERP giúp doanh nghiệp lưu trữ hồ sơ khách hàng, theo dõi lịch sử tương tác và tối ưu hoạt động chăm sóc khách hàng.",
    keywords:
      "quản lý khách hàng, CRM, chăm sóc khách hàng, hồ sơ khách hàng, lịch sử tương tác, ERP dịch vụ",
    path: "/quan-ly-khach-hang",
    priority: "0.8",
    changeFrequency: "weekly",
  },
  "QUẢN LÝ ỨNG VIÊN": {
    title: "Quản lý ứng viên - Tuyển dụng, hồ sơ và quy trình phỏng vấn",
    description:
      "Phân khu quản lý ứng viên trong iGen ERP giúp doanh nghiệp tập trung hồ sơ ứng viên, theo dõi các vòng tuyển dụng và quản lý lịch phỏng vấn hiệu quả.",
    keywords:
      "quản lý ứng viên, tuyển dụng, hồ sơ ứng viên, lịch phỏng vấn, quy trình tuyển dụng, ERP tuyển dụng",
    path: "/quan-ly-ung-vien",
    priority: "0.8",
    changeFrequency: "weekly",
  },
  "QUẢN TRỊ USER": {
    title: "Quản trị người dùng - Phân quyền và cấu hình tài khoản",
    description:
      "Quản lý tài khoản người dùng, phân quyền truy cập hệ thống, cấu hình HeyGen  và quản trị thông tin doanh nghiệp tập trung.",
    keywords:
      "quản trị user, phân quyền người dùng, quản trị tài khoản, admin ERP, heygen user, cấu hình phân quyền",
    path: "/quan-tri-user",
    robots: "noindex, nofollow",
    priority: "0.2",
    changeFrequency: "monthly",
  },
  "CÀI ĐẶT": {
    title: "Cài đặt hệ thống - Hồ sơ, tích hợp và cấu hình nền tảng",
    description:
      "Thiết lập thông tin hồ sơ doanh nghiệp, cấu hình tùy chỉnh hiển thị, tích hợp AI Copilot và kết nối mạng xã hội.",
    keywords:
      "cài đặt ERP, cấu hình hệ thống, tích hợp AI, cấu hình doanh nghiệp, settings ERP, liên kết mạng xã hội",
    path: "/cai-dat",
    robots: "noindex, nofollow",
    priority: "0.2",
    changeFrequency: "monthly",
  },
  "TÀI NGUYÊN": {
    title: "Tài nguyên - Quản lý tài liệu & Drive nội bộ",
    description:
      "Lưu trữ và quản lý tài liệu nội bộ, kết nối Google Drive và chia sẻ tài nguyên doanh nghiệp tập trung trên iGen ERP.",
    keywords:
      "tài liệu nội bộ, google drive, quản lý tài nguyên, lưu trữ doanh nghiệp, tài nguyên ERP",
    path: "/tai-nguyen",
    robots: "noindex, nofollow",
    priority: "0.5",
    changeFrequency: "weekly",
  },
  "HƯỚNG DẪN": {
    title: "Hướng dẫn sử dụng - Cẩm nang thao tác hệ thống",
    description:
      "Hướng dẫn sử dụng chi tiết từng phân hệ trong iGen ERP bằng ngôn ngữ giản dị, trực quan dành cho người dùng không chuyên.",
    keywords:
      "hướng dẫn sử dụng, cẩm nang erp, tài liệu hướng dẫn, igen erp, hỗ trợ sử dụng",
    path: "/huong-dan",
    robots: "noindex, nofollow",
    priority: "0.5",
    changeFrequency: "weekly",
  },
};

export const PUBLIC_SEO_PAGES: SeoMeta[] = [
  DEFAULT_SEO,
  TAB_SEO_MAP["TỔNG QUAN"],
  TAB_SEO_MAP["NHÂN SỰ"],
  TAB_SEO_MAP["KHO & SẢN PHẨM"],
  TAB_SEO_MAP["QUẢN LÝ HỌC VIÊN"],
];

export function getSeoForTab(tab: TabType): SeoMeta {
  return {
    ...DEFAULT_SEO,
    ...TAB_SEO_MAP[tab],
    image: TAB_SEO_MAP[tab].image || SEO_DEFAULT_IMAGE,
    type: TAB_SEO_MAP[tab].type || "website",
  };
}

export function getSeoForPath(requestPath: string): SeoMeta {
  const normalized = requestPath.startsWith("/") ? requestPath.toLowerCase() : `/${requestPath.toLowerCase()}`;
  if (normalized === AUTH_SEO.path.toLowerCase()) {
    return AUTH_SEO;
  }
  if (normalized === "/privacy-policy" || normalized === "/privacy-policy.html") {
    return PRIVACY_SEO;
  }
  if (normalized === "/terms-of-service" || normalized === "/terms-of-service.html") {
    return TERMS_SEO;
  }
  if (normalized === "/user-data-deletion" || normalized === "/user-data-deletion.html") {
    return DELETION_SEO;
  }
  const tab = pathToTab(normalized);
  return tab ? getSeoForTab(tab) : DEFAULT_SEO;
}

export function resolveSeoUrl(path: string) {
  return new URL(path, SEO_BASE_URL).toString();
}

export function tabToPath(tab: TabType): string {
  return TAB_SEO_MAP[tab]?.path || "/";
}

export function pathToTab(pathname: string): TabType | null {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const matched = (Object.entries(TAB_SEO_MAP) as Array<[TabType, SeoMeta]>).find(
    ([, meta]) => meta.path.toLowerCase() === normalized.toLowerCase()
  );
  return matched?.[0] || null;
}

export function tabToHash(tab: TabType): string {
  return tabToPath(tab);
}

export function hashToTab(hash: string): TabType | null {
  const normalized = hash.startsWith("#") ? hash.slice(1) : hash;
  return pathToTab(normalized);
}
