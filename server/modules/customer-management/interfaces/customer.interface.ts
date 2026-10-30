export type CustomerStatus = "active" | "inactive";
export type CustomerType = "regular" | "vat";
export type CustomerGender = "male" | "female" | "other";
export type CustomerSource = "manual" | "pos" | "import";

/** Hạng hiện tại, do hệ thống tính lại tự động dựa trên lợi nhuận gộp. */
export interface ICustomerTierState {
  code: string;
  name: string;
  minGrossProfit?: number;
  minSpend?: number;
  color?: string;
  pointMultiplier?: number;
  discountPercent?: number;
}

export interface ICustomer {
  customerKind?: "individual" | "business";
  contactName?: string;
  companyCode: string;
  branchId?: string;
  customerCode: string;
  type: CustomerType;
  name: string;
  phone: string;
  normalizedPhone: string;
  email?: string;
  avatarUrl?: string;
  dateOfBirth?: Date;
  gender?: CustomerGender;
  address?: string;
  notes?: string;
  status: CustomerStatus;
  source: CustomerSource;
  tier?: ICustomerTierState;
  tierGrossProfit?: number; // Tổng lợi nhuận gộp tích lũy trong kỳ
  tierTotalSales?: number;  // Tổng chi tiêu / doanh thu tích lũy trong kỳ
  tierUpdatedAt?: Date;

  // Điểm thưởng (Loyalty Points)
  pointsBalance?: number;      // Điểm khả dụng hiện có
  totalPointsEarned?: number;   // Tổng điểm đã tích lũy
  totalPointsRedeemed?: number; // Tổng điểm đã cấn trừ thanh toán

  createdBy: string;
  createdByName: string;
  version: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export type CustomerInput = Partial<Pick<ICustomer,
  "type" | "customerKind" | "contactName" | "name" | "phone" | "email" | "avatarUrl" | "dateOfBirth" | "gender" | "address" | "notes" | "status" | "source"
>> & { dateOfBirth?: Date | string };
