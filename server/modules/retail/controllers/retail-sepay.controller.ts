import crypto from "node:crypto";
import type { Request, Response } from "express";
import { requireRetailBranch, retailScopeFromRequest } from "../contracts";
import { buildRetailPaymentQr, matchesCompanySePayApiKey, processRetailSePayTransaction } from "../services/retail-sepay.service";
import { hasEffectiveRetailCapability } from "../permissions";

const safeEqual = (left: string, right: string) => {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

async function authenticate(req: Request) {
  const hmacSecret = process.env.SEPAY_WEBHOOK_SECRET;
  const apiKey = process.env.SEPAY_API_KEY || process.env.WEBHOOK_SECRET;
  const signature = String(req.headers["x-sepay-signature"] || "");
  if (hmacSecret && signature) {
    const timestamp = String(req.headers["x-sepay-timestamp"] || "");
    if (!/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
    const rawBody = String((req as Request & { rawBody?: string }).rawBody || "");
    const expected = `sha256=${crypto.createHmac("sha256", hmacSecret).update(`${timestamp}.${rawBody}`).digest("hex")}`;
    return safeEqual(signature, expected);
  }
  const match = String(req.headers.authorization || "").match(/^Apikey\s+(.+)$/i);
  if (!match) return false;
  if (apiKey && safeEqual(match[1], apiKey)) return true;
  return matchesCompanySePayApiKey(String((req.body || {}).accountNumber || ""), match[1]);
}

export const retailSePayController = {
  qr: async (req: Request, res: Response) => {
    try {
      const actor = (req as any).user || {};
      const scope = requireRetailBranch(retailScopeFromRequest(actor, { companyCode: req.query.companyCode, branchId: req.query.branchId }));
      const canManage = await hasEffectiveRetailCapability(actor, "manager");
      res.json({ success: true, data: await buildRetailPaymentQr(scope.companyCode, scope.branchId, req.params.id, { actorId: String(actor.id || actor.uid || ""), canManage }) });
    }
    catch (error: any) { res.status(error.status || 400).json({ success: false, error: error.message }); }
  },
  webhook: async (req: Request, res: Response) => {
    try {
      if (!(await authenticate(req))) return res.status(401).json({ success: false, message: "Unauthorized" });
      return res.json({ success: true, data: await processRetailSePayTransaction(req.body || {}) });
    }
    catch (error: any) { return res.status(error.status || 500).json({ success: false, message: error.message }); }
  },
};
