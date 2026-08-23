import crypto from "node:crypto";
import type { Request, Response } from "express";
import { buildRetailPaymentQr, processRetailSePayTransaction } from "../services/retail-sepay.service";

const safeEqual = (left: string, right: string) => {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

function authenticate(req: Request) {
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
  return Boolean(apiKey && match && safeEqual(match[1], apiKey));
}

export const retailSePayController = {
  qr: async (req: Request, res: Response) => {
    try { res.json({ success: true, data: await buildRetailPaymentQr(String((req as any).user?.companyCode || ""), req.params.id) }); }
    catch (error: any) { res.status(400).json({ success: false, error: error.message }); }
  },
  webhook: async (req: Request, res: Response) => {
    if (!authenticate(req)) return res.status(401).json({ success: false, message: "Unauthorized" });
    try { return res.json({ success: true, data: await processRetailSePayTransaction(req.body || {}) }); }
    catch (error: any) { return res.status(error.status || 500).json({ success: false, message: error.message }); }
  },
};
