import { AI_CREDITS_ENABLED } from "../../shared/features";
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

export const SEO_BASE_URL = "https://luxdefa.vn";
export const SEO_DEFAULT_IMAGE = BRAND_LOGO_URL;
export const SEO_DEFAULT_LOCALE = "vi_VN";

export function buildDocumentTitle(title: string) {
  const normalized = title.trim();
  return normalized.includes(BRAND_NAME) ? normalized : `${normalized} | ${BRAND_NAME}`;
}

export const DEFAULT_SEO: SeoMeta = {
  title: "Hệ thống quản lý y tế thông minh",
  description:
    "Lux Care là hệ thống quản trị y tế và vận hành thông minh thế hệ mới, hỗ trợ quản lý nhân sự, đào tạo, giao tiếp nội bộ và quản lý thiết bị y tế chuyên nghiệp.",
  keywords: "Lux Care, quản trị y tế, quản lý thiết bị y tế, quản lý nhân sự, Luxdefa, hệ thống y tế",
  path: "/",
  image: SEO_DEFAULT_IMAGE,
  robots: "index, follow",
  type: "website",
  priority: "1.0",
  changeFrequency: "weekly",
};

export const AUTH_SEO: SeoMeta = {
  title: "Đăng nhập - Cổng quản trị y tế Lux Care",
  description: "Đăng nhập vào hệ thống Lux Care để quản lý vận hành, nhân sự, thiết bị và tài nguyên y tế.",
  keywords: "đăng nhập Lux Care, cổng quản trị y tế, quản lý thiết bị y tế",
  path: "/dang-nhap",
  image: SEO_DEFAULT_IMAGE,
  robots: "noindex, nofollow",
  type: "website",
  priority: "0.3",
  changeFrequency: "monthly",
};

export const PRIVACY_SEO: SeoMeta = {
  title: "Chính sách bảo mật",
  description: "Chính sách bảo mật thông tin người dùng và bảo vệ dữ liệu của hệ thống Lux Care.",
  keywords: "chính sách bảo mật, bảo mật dữ liệu, lux care",
  path: "/privacy-policy",
  image: SEO_DEFAULT_IMAGE,
  robots: "index, follow",
  type: "website",
  priority: "0.5",
  changeFrequency: "monthly",
};

export const TERMS_SEO: SeoMeta = {
  title: "Điều khoản dịch vụ",
  description: "Điều khoản dịch vụ và thỏa thuận sử dụng phần mềm quản lý y tế Lux Care.",
  keywords: "điều khoản dịch vụ, thoả thuận sử dụng, lux care",
  path: "/terms-of-service",
  image: SEO_DEFAULT_IMAGE,
  robots: "index, follow",
  type: "website",
  priority: "0.5",
  changeFrequency: "monthly",
};

export const DELETION_SEO: SeoMeta = {
  title: "Yêu cầu xóa dữ liệu người dùng",
  description: "Hướng dẫn xóa dữ liệu người dùng và tra cứu trạng thái yêu cầu xóa thông tin trên hệ thống Lux Care.",
  keywords: "xóa dữ liệu người dùng, bảo mật dữ liệu, user data deletion, lux care",
  path: "/user-data-deletion",
  image: SEO_DEFAULT_IMAGE,
  robots: "index, follow",
  type: "website",
  priority: "0.5",
  changeFrequency: "monthly",
};

export const CUSTOMER_LEAD_FORM_SEO: SeoMeta = {
  title: "Đăng ký Tư vấn & Tiếp nhận dịch vụ",
  description: "Biểu mẫu đăng ký tư vấn và tiếp nhận thông tin khách hàng trực tuyến từ Lux Care.",
  keywords: "đăng ký tư vấn, tiếp nhận khách hàng, dịch vụ y tế, lux care",
  path: "/tiep-nhan-khach-hang",
  image: SEO_DEFAULT_IMAGE,
  robots: "noindex, follow",
  type: "website",
  priority: "0.8",
  changeFrequency: "weekly",
};

export const TAB_SEO_MAP: Partial<Record<TabType, SeoMeta>> = {
  ...(AI_CREDITS_ENABLED ? {
    "VÍ & NẠP TIỀN": {
      title: "Ví & Nạp tiền",
      description: "Xem số dư Credit, nạp tiền và theo dõi lịch sử giao dịch của bạn.",
      keywords: "ví cá nhân, nạp tiền, Credit, lịch sử giao dịch",
      path: "/vi-nap-tien",
      robots: "noindex, nofollow",
    },
  } : {}),
  "KHO TRI THỨC": { title: "Kho tri thức", description: "Quản lý, phân loại và tra cứu tài liệu doanh nghiệp.", keywords: "kho tri thức, tài liệu", path: "/kho-tri-thuc", robots: "noindex, nofollow" },
  "TỔNG QUAN": {
    title: "Tổng quan vận hành - Dashboard điều hành thông minh",
    description:
      "Báo cáo tổng quan hiệu suất vận hành, tiến độ công việc và phân tích hoạt động tự động với AI trên Lux Care.",
    keywords: "dashboard vận hành, tổng quan y tế, báo cáo điều hành, dashboard AI, Lux Care",
    path: "/tong-quan",
    priority: "0.9",
    changeFrequency: "daily",
  },
  "NHÂN SỰ": {
    title: "Quản lý nhân sự HRM - Sơ đồ tổ chức, KPI và Đào tạo",
    description:
      "Giải pháp HRM toàn diện trên Lux Care giúp quản lý hồ sơ nhân sự, vẽ sơ đồ tổ chức tự động, thiết lập KPI và số hóa tài liệu đào tạo nội bộ.",
    keywords: "quản lý nhân sự, HRM, KPI nhân viên, đào tạo nội bộ, sơ đồ tổ chức, quản lý nhân sự y tế",
    path: "/nhan-su",
    priority: "0.8",
    changeFrequency: "weekly",
  },
  "QUẢN LÝ TÀI NGUYÊN": {
    title: "Quản lý tài nguyên - Lưu trữ và đồng bộ Google Drive",
    description:
      "Không gian quản lý tài nguyên, tài liệu nội bộ và liên kết đồng bộ trực tiếp với tài khoản Google Drive cá nhân của nhân viên trên Lux Care.",
    keywords: "quản lý tài nguyên, lưu trữ tài liệu, đồng bộ google drive, thư mục tài nguyên, lux care",
    path: "/quan-ly-tai-nguyen",
    priority: "0.8",
    changeFrequency: "weekly",
  },
  "TRÒ CHUYỆN": {
    title: "Trò chuyện nội bộ - Trực quan, Thời gian thực",
    description:
      "Trực tiếp trao đổi công việc, trò chuyện 1-1 hoặc tạo phòng chat nhóm giữa các tài khoản nhân viên tại Lux Care.",
    keywords: "chat nội bộ, chat nhóm, chat 1-1, trò chuyện nội bộ, nhắn tin realtime, socket.io chat, lux care",
    path: "/tro-chuyen",
    priority: "0.7",
    changeFrequency: "weekly",
  },
  "QUẢN LÝ KHÁCH HÀNG": {
    title: "Quản lý khách hàng - Hồ sơ, chăm sóc và lịch sử tương tác",
    description:
      "Phân khu quản lý khách hàng trong Lux Care giúp lưu trữ hồ sơ, theo dõi lịch sử tương tác và tối ưu hoạt động chăm sóc khách hàng.",
    keywords: "quản lý khách hàng, CRM, chăm sóc khách hàng, hồ sơ khách hàng, lịch sử tương tác, Lux Care",
    path: "/quan-ly-khach-hang",
    priority: "0.8",
    changeFrequency: "weekly",
  },
  "QUẢN LÝ ỨNG VIÊN": {
    title: "Quản lý ứng viên - Tuyển dụng, hồ sơ và quy trình phỏng vấn",
    description:
      "Phân khu quản lý ứng viên trong Lux Care giúp tập trung hồ sơ ứng viên, theo dõi các vòng tuyển dụng và quản lý lịch phỏng vấn hiệu quả.",
    keywords: "quản lý ứng viên, tuyển dụng, hồ sơ ứng viên, lịch phỏng vấn, quy trình tuyển dụng, Lux Care",
    path: "/quan-ly-ung-vien",
    priority: "0.8",
    changeFrequency: "weekly",
  },
  "PHÂN TÍCH & BÁO CÁO": {
    title: "Phân tích & Báo cáo - Doanh thu và hiệu quả kinh doanh",
    description:
      "Tổng hợp và phân tích doanh thu, công nợ, chi phí theo thời gian và chi nhánh. Khu vực dành riêng cho quản trị viên.",
    keywords: "báo cáo doanh thu, phân tích kinh doanh, dashboard admin, báo cáo Lux Care",
    path: "/phan-tich",
    robots: "noindex, nofollow",
    priority: "0.2",
    changeFrequency: "daily",
  },
  "QUẢN TRỊ USER": {
    title: "Quản trị người dùng - Phân quyền và cấu hình tài khoản",
    description: "Quản lý tài khoản người dùng, phân quyền truy cập hệ thống và quản trị thông tin đơn vị tập trung.",
    keywords: "quản trị user, phân quyền người dùng, quản trị tài khoản, admin Lux Care",
    path: "/quan-tri-user",
    robots: "noindex, nofollow",
    priority: "0.2",
    changeFrequency: "monthly",
  },
  "CÀI ĐẶT": {
    title: "Cài đặt hệ thống - Hồ sơ, tích hợp và cấu hình nền tảng",
    description:
      "Thiết lập thông tin hồ sơ doanh nghiệp, cấu hình tùy chỉnh hiển thị, tích hợp AI Copilot và kết nối tài khoản.",
    keywords: "cài đặt Lux Care, cấu hình hệ thống, settings Lux Care, liên kết tài khoản",
    path: "/cai-dat",
    robots: "noindex, nofollow",
    priority: "0.2",
    changeFrequency: "monthly",
  },
  "TÀI NGUYÊN": {
    title: "Tài nguyên - Quản lý tài liệu & Drive nội bộ",
    description:
      "Lưu trữ và quản lý tài liệu nội bộ, kết nối Google Drive và chia sẻ tài nguyên doanh nghiệp tập trung trên Lux Care.",
    keywords: "tài liệu nội bộ, google drive, quản lý tài nguyên, lưu trữ doanh nghiệp, tài nguyên Lux Care",
    path: "/tai-nguyen",
    robots: "noindex, nofollow",
    priority: "0.5",
    changeFrequency: "weekly",
  },
  "HƯỚNG DẪN": {
    title: "Hướng dẫn sử dụng - Cẩm nang thao tác hệ thống",
    description:
      "Hướng dẫn sử dụng chi tiết từng phân hệ trong Lux Care bằng ngôn ngữ giản dị, trực quan dành cho người dùng không chuyên.",
    keywords: "hướng dẫn sử dụng, cẩm nang Lux Care, tài liệu hướng dẫn, lux care, hỗ trợ sử dụng",
    path: "/huong-dan",
    robots: "noindex, nofollow",
    priority: "0.5",
    changeFrequency: "weekly",
  },
  "QUẢN LÝ THIẾT BỊ": {
    title: "Quản lý thiết bị - Theo dõi tài sản và mượn trả",
    description: "Quản lý thiết bị y tế, tình trạng mượn trả, lịch sử sử dụng và bảo trì thiết bị trong Lux Care.",
    keywords: "quản lý thiết bị, thiết bị y tế, mượn trả thiết bị, tài sản bệnh viện, lux care",
    path: "/quan-ly-thiet-bi",
    priority: "0.7",
    changeFrequency: "weekly",
  },
  "QUẢN LÝ VẬT TƯ": {
    title: "Quản lý vật tư tiêu hao - Tồn kho, hạn dùng và tài liệu",
    description: "Quản lý danh mục vật tư tiêu hao y tế, kiểm soát tồn kho, theo dõi hạn sử dụng, kiểm định và hồ sơ tài liệu đính kèm.",
    keywords: "quản lý vật tư, vật tư y tế tiêu hao, tồn kho vật tư, hạn sử dụng vật tư, kiểm định vật tư, lux care",
    path: "/quan-ly-vat-tu",
    priority: "0.7",
    changeFrequency: "weekly",
  },
};

export const PUBLIC_SEO_PAGES: SeoMeta[] = [DEFAULT_SEO, TAB_SEO_MAP["TỔNG QUAN"], TAB_SEO_MAP["NHÂN SỰ"]];

export function getSeoForTab(tab: TabType): SeoMeta {
  const tabSeo = TAB_SEO_MAP[tab];

  return {
    ...DEFAULT_SEO,
    ...tabSeo,
    image: tabSeo?.image || SEO_DEFAULT_IMAGE,
    type: tabSeo?.type || "website",
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
  if (
    normalized === "/tiep-nhan-khach-hang" ||
    normalized === "/dang-ky-tu-van" ||
    normalized === "/khao-sat-khach-hang"
  ) {
    return CUSTOMER_LEAD_FORM_SEO;
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
    ([, meta]) => meta.path.toLowerCase() === normalized.toLowerCase(),
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
