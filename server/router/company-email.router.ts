import { Router } from "express";
import Joi from "joi";
import { requireAuth, requirePermission } from "../middleware/auth";
import { CompanyModel } from "../model/company.model";
import { CelebrationDeliveryModel } from "../model/celebration-delivery.model";
import { companyEmailService } from "../service/company-email.service";
import { renderCelebrationTemplate } from "../service/company-celebration";

export const companyEmailRouter = Router();
companyEmailRouter.use(requireAuth as any);
const companyCode = (req: any) => String(req.user?.companyCode || "").toUpperCase();
const adminOnly = (req: any, res: any, next: any) => req.user?.role === "admin" ? next() : res.status(403).json({ message: "Chỉ admin được cấu hình SMTP công ty." });
const smtpSchema = Joi.object({ host: Joi.string().trim().required(), port: Joi.number().integer().min(1).max(65535).required(), secure: Joi.boolean().required(), user: Joi.string().trim().required(), password: Joi.string().allow("").optional(), fromEmail: Joi.string().email().required(), fromName: Joi.string().trim().required() });
const celebrationSchema = Joi.object({ birthdayEnabled: Joi.boolean().required(), holidayEnabled: Joi.boolean().required(), sendTime: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/).required(), birthdayTemplate: Joi.object({ subject: Joi.string().max(300).required(), html: Joi.string().max(50000).required() }).required(), holidayTemplate: Joi.object({ subject: Joi.string().max(300).required(), html: Joi.string().max(50000).required() }).required(), holidayOverrides: Joi.array().items(Joi.object({ date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(), enabled: Joi.boolean().required(), subject: Joi.string().max(300).allow("").optional(), html: Joi.string().max(50000).allow("").optional() })).default([]) });

companyEmailRouter.get("/smtp", adminOnly, async (req: any, res) => res.json({ data: await companyEmailService.getSmtp(companyCode(req)) }));
companyEmailRouter.put("/smtp", adminOnly, async (req: any, res) => { const { error, value } = smtpSchema.validate(req.body); if (error) return res.status(400).json({ message: error.message }); try { return res.json({ data: await companyEmailService.saveSmtp(companyCode(req), value) }); } catch (e: any) { return res.status(400).json({ message: e.message }); } });
companyEmailRouter.post("/smtp/verify", adminOnly, async (req: any, res) => { try { return res.json(await companyEmailService.verify(companyCode(req))); } catch (e: any) { return res.status(400).json({ message: e.message }); } });
companyEmailRouter.post("/smtp/test", adminOnly, async (req: any, res) => { try { return res.json(await companyEmailService.send(companyCode(req), { to: req.user.email, subject: "Kiểm tra SMTP công ty", html: "<p>Kết nối SMTP hoạt động.</p>" })); } catch (e: any) { return res.status(400).json({ message: e.message }); } });

companyEmailRouter.use("/celebration", requirePermission("company-email:manage") as any);
companyEmailRouter.get("/celebration", async (req: any, res) => { const company: any = await CompanyModel.findOne({ code: companyCode(req) }).select("celebrationConfig").lean(); return res.json({ data: company?.celebrationConfig }); });
companyEmailRouter.put("/celebration", async (req: any, res) => { const { error, value } = celebrationSchema.validate(req.body); if (error) return res.status(400).json({ message: error.message }); try { renderCelebrationTemplate(value.birthdayTemplate.subject + value.birthdayTemplate.html + value.holidayTemplate.subject + value.holidayTemplate.html, { employeeName: "A", companyName: "C", holidayName: "H" }); await CompanyModel.updateOne({ code: companyCode(req) }, { $set: { celebrationConfig: value } }); return res.json({ data: value }); } catch (e: any) { return res.status(400).json({ message: e.message }); } });
companyEmailRouter.post("/celebration/preview", async (req: any, res) => { try { return res.json({ data: { subject: renderCelebrationTemplate(req.body.subject || "", { employeeName: req.user.displayName || "Nhân viên", companyName: req.user.companyName || "Công ty", holidayName: req.body.holidayName || "Ngày lễ" }), html: renderCelebrationTemplate(req.body.html || "", { employeeName: req.user.displayName || "Nhân viên", companyName: req.user.companyName || "Công ty", holidayName: req.body.holidayName || "Ngày lễ" }) } }); } catch (e: any) { return res.status(400).json({ message: e.message }); } });
companyEmailRouter.get("/celebration/history", async (req: any, res) => res.json({ data: await CelebrationDeliveryModel.find({ companyCode: companyCode(req) }).sort({ createdAt: -1 }).limit(200).lean() }));
