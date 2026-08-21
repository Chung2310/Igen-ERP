import type { Response } from "express";
import { KnowledgeDocumentModel } from "../model/knowledge.model";
import { knowledgeIngestService } from "../service/knowledge-ingest.service";
export const knowledgeController = {
  async list(req: any, res: Response) { const data = await KnowledgeDocumentModel.find({ companyCode: req.user.companyCode }).sort({ updatedAt: -1 }).lean(); res.json({ status: "success", data }); },
  async sync(req: any, res: Response) { const data = await knowledgeIngestService.syncCompanyDrive(req.user.companyCode); res.json({ status: "success", data }); },
  async remove(req: any, res: Response) { const doc = await KnowledgeDocumentModel.findOneAndDelete({ _id: req.params.id, companyCode: req.user.companyCode }); if (!doc) return res.status(404).json({ status: "error", message: "Không tìm thấy tài liệu." }); res.json({ status: "success" }); },
};
