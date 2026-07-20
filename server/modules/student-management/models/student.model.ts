import { Schema, model } from "mongoose";
import { IStudent } from "../interfaces/student.interface";

const uploadedFileSchema = new Schema({
  name: { type: String, required: true },
  url: { type: String, required: true },
  type: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
});

const progressSchema = new Schema({
  theory: {
    completed: { type: Boolean, default: false },
    score: { type: Schema.Types.Mixed, default: 0 },
    lastDate: { type: String, default: "" },
  },
  practice: {
    hoursDone: { type: Number, default: 0 },
    totalHours: { type: Number, default: 20 },
  },
  cabin: {
    hoursDone: { type: Number, default: 0 },
    totalHours: { type: Number, default: 3 },
  },
  dat: {
    kmDone: { type: Number, default: 0 },
    totalKm: { type: Number, default: 810 },
  },
  sim: {
    completed: { type: Boolean, default: false },
    lastDate: { type: String, default: "" },
  },
});

const studentExamSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  date: { type: String, required: true },
  type: { type: String, enum: ["Tốt nghiệp", "Sát hạch"], required: true },
  status: { type: String, enum: ["Sắp thi", "Đã thi"], required: true },
  result: {
    theory: { type: Schema.Types.Mixed, default: 0 },
    practice: { type: Schema.Types.Mixed, default: 0 },
    simulation: { type: Schema.Types.Mixed, default: 0 },
    overall: { type: String, enum: ["Đậu", "Trượt", "Chưa có"], default: "Chưa có" },
  },
});

const studentPaymentSchema = new Schema({
  id: { type: String, required: true },
  amount: { type: Number, required: true },
  date: { type: String, required: true },
  method: { type: String, enum: ["Tiền mặt", "Chuyển khoản"], required: true },
  note: { type: String, default: "" },
  recipient: { type: String, required: true },
});

const installmentStatusSchema = new Schema({
  installmentNo: { type: Number, required: true },     // Số thứ tự đợt
  percent: { type: Number, required: true },           // % học phí gốc
  amountDue: { type: Number, required: true },         // Số tiền phải đóng
  status: {
    type: String,
    enum: ["Đã gửi", "Đã thu", "Chưa gửi"],
    default: "Chưa gửi",
    required: true,
  },
  sentAt: { type: String, default: "" },
  paidAt: { type: String, default: "" },
  notificationId: { type: String, default: "" },
});

const studentSchema = new Schema<IStudent>(
  {
    customFields: { type: Schema.Types.Mixed, default: {} },
    fullName: { type: String, required: true, trim: true },
    slug: { type: String, trim: true, index: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true, index: true },
    referral: { type: String, default: "" },
    birthday: { type: String, default: "" },
    idCard: { type: String, default: "" },
    // Hạng bằng lái — riêng ngành lái xe, ngành khác để trống
    rank: { type: String, default: "", trim: true, index: true },
    courseId: { type: String, default: "", trim: true, index: true },
    registrationDate: { type: String, required: true },
    enrollmentDate: { type: String, default: "" },
    fee: { type: String, required: true },
    paidAmount: { type: Number, default: 0 },
    address: { type: String, default: "" },
    status: {
      type: [String],
      enum: ["Chờ KSK", "Đã KSK", "Đã nộp HS", "Đang học", "Đang thi", "Đã đậu", "Thi lại", "Nghỉ học", "Nợ học phí"],
      default: ["Chờ KSK"],
      required: true,
      index: true,
    },
    ownerId: { type: String, required: true, index: true },
    healthCheckDate: { type: String, default: "" },
    healthCheckNotes: { type: String, default: "" },
    healthCheckFiles: [uploadedFileSchema],
    idCardFrontFile: { type: uploadedFileSchema, default: undefined },
    idCardBackFile: { type: uploadedFileSchema, default: undefined },
    portraitFile: { type: uploadedFileSchema, default: undefined },
    progress: { type: progressSchema, default: () => ({}) },
    exams: [studentExamSchema],
    paymentHistory: [studentPaymentSchema],
    installmentStatus: [installmentStatusSchema],
    examId: { type: String, default: "" },
    examName: { type: String, default: "" },
    examDate: { type: String, default: "" },
    idCardFront: { type: String, default: "" },
    idCardBack: { type: String, default: "" },
    partnerId: { type: String, default: "", index: true },
  },
  {
    timestamps: true,
  }
);

export function slugify(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/([^a-z0-9\s-])/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

studentSchema.pre("save", function (this: IStudent) {
  if (this.isModified("fullName") || !this.slug) {
    this.slug = slugify(this.fullName);
  }
});

// Add index on fullName and phone for search
studentSchema.index({ fullName: "text", phone: "text" });

export const Student = model<IStudent>("Student", studentSchema);
