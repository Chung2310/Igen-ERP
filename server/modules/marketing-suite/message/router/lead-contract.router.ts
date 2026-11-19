import { Router, type Request, type Response, type NextFunction } from "express";
import mongoose from "mongoose";
import multer from "multer";
import { requirePermission, type AuthenticatedRequest } from "../../../../middleware/auth";
import { normalizeLeadContractProvider, type LeadContractPhoto } from "../../../../../shared/marketing-suite/telecom-invoice";
import { CRMTicketModel } from "../model/crm-ticket.model";
import { LeadContractModel, LeadContractPhotoModel } from "../model/lead-contract.model";
import { TelecomInvoiceSettingsModel } from "../model/telecom-invoice.model";
import { normalizeContractPhotoValues } from "../service/lead-contract-ocr";
import { reconcileLeadContracts } from "../service/lead-contract-reconciliation";
import { recordLeadContractPhoto, type StoredContractPhoto } from "../service/lead-contract.service";

export const leadContractRouter = Router();
const manage = requirePermission("omni-inbox:manage");
const read = requirePermission(["omni-inbox:read", "omni-inbox:manage"]);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 3, fieldSize: 1024 } }).single("file");
const reviewFilter = () => ({ $or: [{ status: "review" as const }, { status: "reading" as const, leaseUntil: { $lte: new Date() } }] });

function run(action: (req: AuthenticatedRequest, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => { void action(req as AuthenticatedRequest, res).catch(next); };
}

function publicPhoto(photo: StoredContractPhoto): LeadContractPhoto {
  return { id: String(photo._id), provider: photo.provider, platform: photo.platform, pageId: photo.pageId,
    conversationId: photo.conversationId, receivedAt: photo.receivedAt.toISOString(), contractCode: photo.contractCode,
    values: photo.values, fields: photo.fields, contractFieldKey: photo.contractFieldKey,
    issue: photo.issue ?? (photo.status === "reading" ? "Ảnh chưa đọc xong. Có thể kiểm tra và điền thủ công." : undefined) };
}

leadContractRouter.get("/lead-contracts/providers", read, run(async (req, res) => {
  const scope = { companyCode: req.user!.companyCode };
  const groups = await Promise.all([
    TelecomInvoiceSettingsModel.distinct("contractProvider", { ...scope, mode: "contract" }),
    TelecomInvoiceSettingsModel.distinct("zalo.contractProvider", { ...scope, "zalo.mode": "contract" }),
    LeadContractModel.distinct("provider", scope),
  ]);
  const providers = [...new Set(groups.flat().flatMap(value => normalizeLeadContractProvider(value) ?? []))].sort((a, b) => a.localeCompare(b, "vi"));
  return res.json({ status: "success", data: providers });
}));

leadContractRouter.post("/lead-contracts/reconcile", manage, (req, res, next) => {
  upload(req, res, error => {
    if (error) return res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400)
      .json({ status: "error", message: "Chọn một file .xlsx tối đa 5 MB." });
    next();
  });
}, run(async (req, res) => {
  const provider = normalizeLeadContractProvider(req.body?.provider);
  if (!provider || !req.file?.originalname.toLowerCase().endsWith(".xlsx")) {
    return res.status(400).json({ status: "error", message: "Chọn nhà cung cấp và file bảng kê .xlsx." });
  }
  const data = await reconcileLeadContracts(req.user!.companyCode, provider, Number(req.body.year), Number(req.body.quarter), req.file.buffer);
  return res.json({ status: "success", data });
}));

leadContractRouter.get("/lead-contracts/review", manage, run(async (req, res) => {
  const before = typeof req.query.before === "string" && mongoose.isValidObjectId(req.query.before) ? req.query.before : undefined;
  const photos = await LeadContractPhotoModel.find({ companyCode: req.user!.companyCode, ...reviewFilter(),
    ...(before ? { _id: { $lt: before } } : {}) }).sort({ _id: -1 }).limit(21).lean();
  return res.json({ status: "success", data: { items: photos.slice(0, 20).map(publicPhoto), before: photos.length > 20 ? String(photos[19]._id) : undefined } });
}));

leadContractRouter.post("/lead-contracts/review/:id", manage, run(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ status: "error", message: "Mã ảnh không hợp lệ." });
  const rawValues = req.body?.values;
  if (!rawValues || typeof rawValues !== "object" || Array.isArray(rawValues) || Object.keys(rawValues).length > 30) {
    return res.status(400).json({ status: "error", message: "Các trường cần kiểm tra chưa hợp lệ." });
  }
  const photo = await LeadContractPhotoModel.findOneAndUpdate({ companyCode: req.user!.companyCode, _id: req.params.id, ...reviewFilter() },
    { $set: { status: "review" }, $unset: { leaseUntil: 1 } }, { returnDocument: "after" }).lean();
  if (!photo) return res.status(404).json({ status: "error", message: "Ảnh này đã được xử lý hoặc không tồn tại." });
  const values = normalizeContractPhotoValues(photo.fields, photo.contractFieldKey, rawValues);
  const result = await recordLeadContractPhoto(photo, values, true);
  if (!result.leadId) return res.status(422).json({ status: "error", message: result.issue });
  return res.json({ status: "success", data: { leadId: result.leadId } });
}));

leadContractRouter.get("/leads/:id/contract-photos", read, run(async (req, res) => {
  const companyCode = req.user!.companyCode;
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ status: "error", message: "ID Lead không hợp lệ." });
  if (!await CRMTicketModel.exists({ companyCode, _id: req.params.id })) return res.status(404).json({ status: "error", message: "Không tìm thấy Lead." });
  const before = typeof req.query.before === "string" && mongoose.isValidObjectId(req.query.before) ? req.query.before : undefined;
  const photos = await LeadContractPhotoModel.find({ companyCode, leadId: req.params.id, status: "recorded",
    ...(before ? { _id: { $lt: before } } : {}) }).sort({ _id: -1 }).limit(21).lean();
  return res.json({ status: "success", data: { items: photos.slice(0, 20).map(publicPhoto), before: photos.length > 20 ? String(photos[19]._id) : undefined } });
}));
