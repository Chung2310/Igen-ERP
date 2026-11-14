import type { CustomerKind, CustomerModule, CustomerType } from "./types";

export const customerKindLabels = {
  individual: "Cá nhân",
  business: "Doanh nghiệp / tổ chức",
  unclassified: "Chưa phân loại",
} satisfies Record<CustomerKind | "unclassified", string>;

export const customerInvoiceLabels = {
  regular: "Không mặc định xuất VAT",
  vat: "Mặc định xuất VAT",
} satisfies Record<CustomerType, string>;

export const customerModuleLabels = { students: "Học viên", healthcare: "Bệnh nhân" } satisfies Record<CustomerModule, string>;
