import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth";
import { companyHeyGenService } from "../service/company-heygen.service.ts";

function companyCode(req: AuthenticatedRequest) {
  const code = String(req.user?.companyCode || "").trim();
  if (!code) throw new Error("Tài khoản chưa được gắn mã doanh nghiệp.");
  return code;
}

function sendError(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return res.status(400).json({ status: "error", message });
}

export const companyHeyGenController = {
  async get(req: AuthenticatedRequest, res: Response) {
    try {
      return res.json({ status: "success", data: await companyHeyGenService.getConfig(companyCode(req)) });
    } catch (error) {
      return sendError(res, error);
    }
  },

  async update(req: AuthenticatedRequest, res: Response) {
    try {
      return res.json({
        status: "success",
        data: await companyHeyGenService.updateConfig(companyCode(req), req.body.apiKey),
      });
    } catch (error) {
      return sendError(res, error);
    }
  },

  async clear(req: AuthenticatedRequest, res: Response) {
    try {
      return res.json({ status: "success", data: await companyHeyGenService.clearConfig(companyCode(req)) });
    } catch (error) {
      return sendError(res, error);
    }
  },
};