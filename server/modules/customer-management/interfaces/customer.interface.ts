export type CustomerStatus = "active" | "inactive";
export type CustomerType = "regular" | "vat";
export type CustomerGender = "male" | "female" | "other";
export type CustomerSource = "manual" | "pos" | "import";

export interface ICustomer {
  companyCode: string;
  customerCode: string;
  type: CustomerType;
  name: string;
  phone: string;
  normalizedPhone: string;
  email?: string;
  dateOfBirth?: Date;
  gender?: CustomerGender;
  address?: string;
  notes?: string;
  status: CustomerStatus;
  source: CustomerSource;
  createdBy: string;
  createdByName: string;
  version: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export type CustomerInput = Partial<Pick<ICustomer,
  "type" | "name" | "phone" | "email" | "dateOfBirth" | "gender" | "address" | "notes" | "status" | "source"
>> & { dateOfBirth?: Date | string };
