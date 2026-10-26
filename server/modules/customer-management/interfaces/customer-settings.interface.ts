export interface ICustomerTier {
  code: string;
  name: string;
  minGrossProfit?: number;
  minSpend?: number;
  pointMultiplier?: number;
  discountPercent?: number;
  color?: string;
}

export interface ICustomerPointsPolicy {
  enabled: boolean;
  grossProfitPerPoint: number; // VD: 10.000đ lãi gộp = 1 điểm (mặc định 10000)
  pointRedeemValue: number;    // VD: 1 điểm = 1.000đ cấn trừ (mặc định 1000, 100đ = 100k)
  maxRedeemPercent: number;    // Giới hạn trần thanh toán tối đa bằng điểm (VD: 50%)
  minOrderTotalForRedeem: number; // Giá trị đơn tối thiểu để dùng điểm (VD: 50.000đ)
  allowRepairRedeem: boolean;  // Cho phép cấn trừ điểm trên phiếu sửa chữa
  allowRetailRedeem: boolean;  // Cho phép cấn trừ điểm trên đơn bán lẻ
}

export interface ICustomerSettings {
  companyCode: string;
  tierEvaluationMetric?: "gross_profit" | "sales"; // Căn cứ xếp hạng VIP (mặc định "gross_profit")
  evaluationWindow?: "rolling12Months" | "allTime"; // Chu kỳ xét hạng (mặc định "rolling12Months")
  customerTiers: ICustomerTier[];
  pointsPolicy?: ICustomerPointsPolicy;
  createdAt?: Date;
  updatedAt?: Date;
}
