import { Document } from "mongoose";

export interface IProduct extends Document {
  sku: string;
  name: string;
  category: string;
  stock: number;
  minStockAlert: number;
  price: number;
  demandForecast: "Tăng mạnh" | "Ổn định" | "Giảm nhẹ";
  imageUrl: string;
  companyCode: string;
}
