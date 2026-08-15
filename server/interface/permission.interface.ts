import { Document } from "mongoose";

export interface IPermission extends Document {
  code: string;
  name: string;
  module: string;
  group: string;
  action: "read" | "manage";
  description?: string;
  createdAt: Date;
}
