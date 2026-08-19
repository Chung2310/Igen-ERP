export interface ICustomerTier {
  code: string;
  name: string;
  minSpend: number;
}

export interface ICustomerSettings {
  companyCode: string;
  customerTiers: ICustomerTier[];
  createdAt?: Date;
  updatedAt?: Date;
}
