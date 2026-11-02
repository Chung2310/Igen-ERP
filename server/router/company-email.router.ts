import { Router } from "express";
import Joi from "joi";
import { requireAuth, requirePermission } from "../middleware/auth";
import { CompanyModel } from "../model/company.model";
import { CelebrationDeliveryModel } from "../model/celebration-delivery.model";
import { companyEmailService } from "../service/company-email.service";
import { renderCelebrationTemplate } from "../service/company-celebration";
import { sourceUploadFinalizer } from "../service/source-upload-finalizer.service";

export const companyEmailRouter = Router();
companyEmailRouter.use(requireAuth as any);
const companyCode = (req: any) => String(req.user?.companyCode || "").toUpperCase();
const smtpSchema = Joi.object({ host: Joi.string().trim().required(), port: Joi.number().integer().min(1).max(65535).required(), secure: Joi.boolean().required(), user: Joi.string().trim().required(), password: Joi.string().allow("").optional(), fromEmail: Joi.string().email().required(), fromName: Joi.string().trim().required() });
export const normalizeSmtpPayload = (body: any) => {
  let payload = body;
  while (payload?.data && typeof payload.data === "object" && !Array.isArray(payload.data) && !payload.host) payload = payload.data;
  const { host, port, secure, user, password, fromEmail, fromName } = payload || {};
  return { host, port, secure, user, password, fromEmail, fromName };
};
const celebrationSchema = Joi.object({ birthdayEnabled: Joi.boolean().required(), holidayEnabled: Joi.boolean().required(), sendTime: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/).required(), birthdayTemplate: Joi.object({ subject: Joi.string().max(300).required(), html: Joi.string().max(50000).required() }).required(), holidayTemplate: Joi.object({ subject: Joi.string().max(300).required(), html: Joi.string().max(50000).required() }).required(), holidayOverrides: Joi.array().items(Joi.object({ date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(), enabled: Joi.boolean().required(), subject: Joi.string().max(300).allow("").optional(), html: Joi.string().max(50000).allow("").optional() })).default([]), uploadTokens: Joi.array().items(Joi.string().trim()).default([]) });
export const celebrationAssistantPatchSchema = Joi.object({
  birthdayEnabled: Joi.boolean(),
  holidayEnabled: Joi.boolean(),
  sendTime: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/),
  birthdaySubject: Joi.string().max(300).allow(""),
  birthdayHtml: Joi.string().max(4000).allow(""),
  holidaySubject: Joi.string().max(300).allow(""),
  holidayHtml: Joi.string().max(4000).allow(""),
}).min(1).unknown(false);
const celebrationAssistantPatchFields: Record<string, { path: string; label: string }> = {
  birthdayEnabled: { path: "celebrationConfig.birthdayEnabled", label: "Email sinh nh\u1EADt" },
  holidayEnabled: { path: "celebrationConfig.holidayEnabled", label: "Email ng\u00E0y l\u1EC5" },
  sendTime: { path: "celebrationConfig.sendTime", label: "Gi\u1EDD g\u1EEDi" },
  birthdaySubject: { path: "celebrationConfig.birthdayTemplate.subject", label: "Ti\u00EAu \u0111\u1EC1 email sinh nh\u1EADt" },
  birthdayHtml: { path: "celebrationConfig.birthdayTemplate.html", label: "N\u1ED9i dung email sinh nh\u1EADt" },
  holidaySubject: { path: "celebrationConfig.holidayTemplate.subject", label: "Ti\u00EAu \u0111\u1EC1 email ng\u00E0y l\u1EC5" },
  holidayHtml: { path: "celebrationConfig.holidayTemplate.html", label: "N\u1ED9i dung email ng\u00E0y l\u1EC5" },
};

export async function updateCelebrationAssistantSettings(company: string, patch: Record<string, unknown>) {
  const set: Record<string, unknown> = {};
  const updatedFields: string[] = [];
  for (const [key, value] of Object.entries(patch)) {
    const field = celebrationAssistantPatchFields[key];
    if (!field) continue;
    set[field.path] = value;
    updatedFields.push(field.label);
  }
  if (updatedFields.length === 0) throw new Error("N\u00EAu \u00EDt nh\u1EA5t m\u1ED9t tr\u01B0\u1EDDng c\u00E0i \u0111\u1EB7t c\u1EA7n c\u1EADp nh\u1EADt.");
  const result = await CompanyModel.updateOne({ code: company }, { $set: set }, { runValidators: true });
  if (result.matchedCount === 0) throw new Error("Kh\u00F4ng t\u00ECm th\u1EA5y c\u00F4ng ty \u0111\u1EC3 c\u1EADp nh\u1EADt c\u00E0i \u0111\u1EB7t email.");
  return { updatedFields };
}

companyEmailRouter.use("/smtp", requirePermission("settings:manage") as any);
companyEmailRouter.get("/smtp", async (req: any, res) => res.json({ data: await companyEmailService.getSmtp(companyCode(req)) }));
companyEmailRouter.put("/smtp", async (req: any, res) => { const { error, value } = smtpSchema.validate(normalizeSmtpPayload(req.body)); if (error) return res.status(400).json({ message: error.message }); try { return res.json({ data: await companyEmailService.saveSmtp(companyCode(req), value) }); } catch (e: any) { return res.status(400).json({ message: e.message }); } });
companyEmailRouter.post("/smtp/verify", async (req: any, res) => { try { return res.json(await companyEmailService.verify(companyCode(req))); } catch (e: any) { return res.status(400).json({ message: e.message }); } });
companyEmailRouter.post("/smtp/test", async (req: any, res) => { try { return res.json(await companyEmailService.send(companyCode(req), { to: req.user.email, subject: "Kiểm tra SMTP công ty", html: "<p>Kết nối SMTP hoạt động.</p>" })); } catch (e: any) { return res.status(400).json({ message: e.message }); } });

companyEmailRouter.use("/celebration", requirePermission("settings:manage") as any);
companyEmailRouter.get("/celebration", async (req: any, res) => { const company: any = await CompanyModel.findOne({ code: companyCode(req) }).select("celebrationConfig").lean(); return res.json({ data: company?.celebrationConfig }); });
companyEmailRouter.put("/celebration", async (req: any, res) => { const { error, value } = celebrationSchema.validate(req.body); if (error) return res.status(400).json({ message: error.message }); try { const { uploadTokens, ...config } = value; renderCelebrationTemplate(config.birthdayTemplate.subject + config.birthdayTemplate.html + config.holidayTemplate.subject + config.holidayTemplate.html, { employeeName: "A", companyName: "C", holidayName: "H" }); await CompanyModel.updateOne({ code: companyCode(req) }, { $set: { celebrationConfig: config } }); await sourceUploadFinalizer.finalize({ companyCode: companyCode(req), branchId: req.user.branchId, actorId: req.user.id, actorName: req.user.email }, { entityType: "company", entityId: companyCode(req), entityLabel: req.user.companyName || companyCode(req), sourceRecordId: "celebration-config", uploads: uploadTokens.map((uploadToken: string, index: number) => ({ uploadToken, sourceField: `images.${index}` })) }); return res.json({ data: config }); } catch (e: any) { return res.status(400).json({ message: e.message }); } });
companyEmailRouter.patch("/celebration", async (req: any, res) => {
  const { error, value } = celebrationAssistantPatchSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });
  try {
    const variables = { employeeName: "A", companyName: "C", holidayName: "H" };
    for (const key of ["birthdaySubject", "birthdayHtml", "holidaySubject", "holidayHtml"]) {
      if (typeof value[key] === "string") renderCelebrationTemplate(value[key], variables);
    }
    return res.json({ data: await updateCelebrationAssistantSettings(companyCode(req), value) });
  } catch (e: any) { return res.status(400).json({ message: e.message }); }
});
companyEmailRouter.post("/celebration/preview", async (req: any, res) => { try { return res.json({ data: { subject: renderCelebrationTemplate(req.body.subject || "", { employeeName: req.user.displayName || "Nhân viên", companyName: req.user.companyName || "Công ty", holidayName: req.body.holidayName || "Ngày lễ" }), html: renderCelebrationTemplate(req.body.html || "", { employeeName: req.user.displayName || "Nhân viên", companyName: req.user.companyName || "Công ty", holidayName: req.body.holidayName || "Ngày lễ" }) } }); } catch (e: any) { return res.status(400).json({ message: e.message }); } });
companyEmailRouter.get("/celebration/history", async (req: any, res) => res.json({ data: await CelebrationDeliveryModel.find({ companyCode: companyCode(req) }).sort({ createdAt: -1 }).limit(200).lean() }));
