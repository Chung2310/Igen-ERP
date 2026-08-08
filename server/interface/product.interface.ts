import { Document } from "mongoose";

export interface IProduct extends Document {
  sku: string;
  name: string;
  category: string;
  brand?: string;
  unit: string;
  stock: number;
  minStockAlert: number;
  price: number;
  costPrice?: number;
  description?: string;
  status: "Active" | "Inactive";
  demandForecast: "Tăng mạnh" | "Ổn định" | "Giảm nhẹ";
  imageUrl: string;
  uploadToken?: string;
  companyCode: string;
  branchId?: string;
}
