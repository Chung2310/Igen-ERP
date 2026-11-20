import { Schema, model, Document, Types } from "mongoose";

export interface IContactHistory {
  date: Date;
  note: string;
  updatedBy?: Types.ObjectId | null;
  status: string;
}

export interface ICustomerLead extends Document {
  companyCode: string;
  branchId?: Types.ObjectId | null;
  branchCode?: string;
  branchName?: string;
  fullName: string;
  phone: string;
  normalizedPhone: string;
  email?: string;
  address?: string;
  serviceInterest?: string;
  preferredContactTime?: string;
  notes?: string;
  source: string;
  qrCampaign?: string;
  status: "new" | "contacted" | "in_consultation" | "converted" | "cancelled";
  assignedTo?: Types.ObjectId | null;
  contactHistory: IContactHistory[];
  isDeleted: boolean;
  deletedAt?: Date | null;
  deletedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const ContactHistorySchema = new Schema(
  {
    date: { type: Date, default: Date.now },
    note: { type: String, required: true, trim: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    status: { type: String, required: true },
  },
  { _id: false },
);

const CustomerLeadSchema = new Schema<ICustomerLead>(
  {
    companyCode: { type: String, required: true, uppercase: true, trim: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", default: null, index: true },
    branchCode: { type: String, default: "", trim: true },
    branchName: { type: String, default: "", trim: true },
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    normalizedPhone: { type: String, required: true, trim: true, index: true },
    email: { type: String, default: "", trim: true },
    address: { type: String, default: "", trim: true },
    serviceInterest: { type: String, default: "", trim: true },
    preferredContactTime: { type: String, default: "", trim: true },
    notes: { type: String, default: "" },
    source: {
      type: String,
      default: "qr_code",
      index: true,
    },
    qrCampaign: { type: String, default: "Quầy tiếp tân", trim: true },
    status: {
      type: String,
      enum: ["new", "contacted", "in_consultation", "converted", "cancelled"],
      default: "new",
      index: true,
    },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
    contactHistory: { type: [ContactHistorySchema], default: () => [] },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, versionKey: false },
);

CustomerLeadSchema.index({ companyCode: 1, isDeleted: 1, createdAt: -1 });
CustomerLeadSchema.index({ companyCode: 1, branchId: 1, status: 1 });

export const CustomerLeadModel = model<ICustomerLead>("CustomerLead", CustomerLeadSchema);
