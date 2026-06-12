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
};

export const SEO_BASE_URL = "https://io.igentechsolutions.com";
export const SEO_DEFAULT_IMAGE = BRAND_LOGO_URL;

export const DEFAULT_SEO: SeoMeta = {
  title: `${BRAND_NAME} - Nền tảng quản trị doanh nghiệp tích hợp AI`,
  description:
    "iGen ERP là nền tảng quản trị doanh nghiệp tích hợp AI, hỗ trợ quản lý kho, nhân sự, marketing, CRM và vận hành trên một hệ thống đồng bộ.",
  keywords:
    "iGen ERP, ERP AI, quản trị doanh nghiệp, quản lý nhân sự, quản lý kho, marketing AI, CRM bán hàng, tự động hóa doanh nghiệp",
  path: "/",
  image: SEO_DEFAULT_IMAGE,
  robots: "index, follow",
  type: "website",
};

export const AUTH_SEO: SeoMeta = {
  title: `Đăng nhập ${BRAND_NAME} - Quản trị doanh nghiệp thông minh`,
  description:
    "Đăng nhập vào iGen ERP để quản lý vận hành, nhân sự, kho, marketing và CRM trên một nền tảng doanh nghiệp tích hợp AI.",
  keywords:
    "đăng nhập iGen ERP, hệ thống ERP doanh nghiệp, cổng quản trị AI, phần mềm ERP",
  path: "/dang-nhap",
  image: SEO_DEFAULT_IMAGE,
  robots: "noindex, nofollow",
  type: "website",
};

export const TAB_SEO_MAP: Record<TabType, SeoMeta> = {
  "TỔNG QUAN": {
    title: "Tổng quan doanh nghiệp - Dashboard điều hành iGen ERP",
    description:
      "Theo dõi doanh thu, vận hành, tiến độ công việc và các chỉ số điều hành quan trọng trên dashboard tổng quan của iGen ERP.",
    keywords:
      "dashboard doanh nghiệp, tổng quan ERP, báo cáo điều hành, dashboard AI, iGen ERP",
    path: "/tong-quan",
  },
  "NHÂN SỰ": {
    title: "Quản lý nhân sự - Hồ sơ, KPI và đào tạo",
    description:
      "Quản lý hồ sơ nhân sự, sơ đồ tổ chức, KPI, đào tạo và hiệu suất đội ngũ trong cùng một hệ thống ERP.",
    keywords:
      "quản lý nhân sự, HRM, KPI nhân viên, đào tạo nội bộ, sơ đồ tổ chức, ERP nhân sự",
    path: "/nhan-su",
  },
  "KHO & SẢN PHẨM": {
    title: "Kho và sản phẩm - Tồn kho, SKU và dự báo nhu cầu",
    description:
      "Quản lý tồn kho, SKU, giao dịch nhập xuất và dự báo nhu cầu hàng hóa bằng AI trên iGen ERP.",
    keywords:
      "quản lý kho, quản lý sản phẩm, tồn kho, SKU, dự báo nhu cầu, ERP kho vận",
    path: "/kho-san-pham",
  },
  MARKETING: {
    title: "Marketing AI - Nội dung, video, chiến dịch và ý tưởng",
    description:
      "Lập kế hoạch marketing, tạo nội dung, video AI và phát triển chiến dịch nhanh hơn với bộ công cụ Marketing AI của iGen ERP.",
    keywords:
      "marketing AI, tạo nội dung AI, tạo video AI, lập kế hoạch marketing, chiến dịch số",
    path: "/marketing",
  },
  "SALES CRM": {
    title: "Sales CRM - Chăm sóc khách hàng và quản lý hội thoại",
    description:
      "Quản lý khách hàng, hội thoại đa kênh, phản hồi AI và theo dõi pipeline bán hàng trong hệ thống CRM tích hợp.",
    keywords:
      "sales crm, quản lý khách hàng, omni channel crm, chăm sóc khách hàng, crm doanh nghiệp",
    path: "/sales-crm",
  },
  "HIỆU SUẤT AI": {
    title: "Hiệu suất AI - Theo dõi tự động hóa và chất lượng vận hành",
    description:
      "Đánh giá hiệu suất AI, theo dõi tác vụ tự động hóa và so sánh tốc độ xử lý giữa con người và hệ thống.",
    keywords:
      "hiệu suất AI, tự động hóa doanh nghiệp, AI analytics, đo lường AI, iGen ERP",
    path: "/hieu-suat-ai",
  },
  "QUẢN TRỊ USER": {
    title: "Quản trị người dùng - Phân quyền và cấu hình tài khoản",
    description:
      "Quản lý tài khoản người dùng, phân quyền truy cập, cấu hình HeyGen và quản trị doanh nghiệp tập trung.",
    keywords:
      "quản trị user, phân quyền người dùng, quản trị tài khoản, admin ERP, heygen user",
    path: "/quan-tri-user",
    robots: "noindex, nofollow",
  },
  "CÀI ĐẶT": {
    title: "Cài đặt hệ thống - Hồ sơ, tích hợp và cấu hình nền tảng",
    description:
      "Thiết lập hồ sơ doanh nghiệp, tích hợp hệ thống, cấu hình AI và tùy chỉnh vận hành trong iGen ERP.",
    keywords:
      "cài đặt ERP, cấu hình hệ thống, tích hợp AI, cấu hình doanh nghiệp, settings ERP",
    path: "/cai-dat",
    robots: "noindex, nofollow",
  },
};

export function getSeoForTab(tab: TabType): SeoMeta {
  return {
    ...DEFAULT_SEO,
    ...TAB_SEO_MAP[tab],
    image: TAB_SEO_MAP[tab].image || SEO_DEFAULT_IMAGE,
    type: TAB_SEO_MAP[tab].type || "website",
  };
}

export function resolveSeoUrl(path: string) {
  return new URL(path, SEO_BASE_URL).toString();
}

export function tabToHash(tab: TabType) {
  return TAB_SEO_MAP[tab]?.path || "/";
}

export function hashToTab(hash: string): TabType | null {
  const normalized = hash.startsWith("#") ? hash.slice(1) : hash;
  const matched = (Object.entries(TAB_SEO_MAP) as Array<[TabType, SeoMeta]>).find(
    ([, meta]) => meta.path.replace(/^\//, "") === normalized.replace(/^\//, "")
  );
  return matched?.[0] || null;
}
