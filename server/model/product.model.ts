import { Schema, model } from "mongoose";
import { IProduct } from "../interface/product.interface";

const ProductSchema = new Schema<IProduct>({
  sku: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, index: true },
  category: { type: String, required: true, index: true },
  stock: { type: Number, default: 0 },
  minStockAlert: { type: Number, default: 15 },
  price: { type: Number, required: true },
  demandForecast: { type: String, enum: ["Tăng mạnh", "Ổn định", "Giảm nhẹ"], default: "Ổn định" },
  imageUrl: { type: String, default: "" },
  companyCode: { type: String, required: true, index: true },
});

export const ProductModel = model<IProduct>("Product", ProductSchema);
