import { EMAIL_ADDRESS_OPTIONS } from "../../shared/email-policy";
import type { NextFunction, Request, Response } from "express";
import Joi from "joi";

const id = Joi.string().trim().required();
const version = Joi.number().integer().min(0).required();
export const jobBodySchema = Joi.object({
  code: Joi.string().trim(), title: Joi.string().trim().allow(""), department: Joi.string().trim().allow(""),
  headcount: Joi.number().integer().min(1), description: Joi.string().allow(""), requirements: Joi.string().allow(""),
  benefits: Joi.string().allow(""), salaryMin: Joi.number().min(0).allow(null), salaryMax: Joi.number().min(0).allow(null),
  showSalary: Joi.boolean(), employmentType: Joi.string().trim(), workplaceType: Joi.string().valid("onsite", "hybrid", "remote"),
  location: Joi.string().trim().allow(""), applicationDeadline: Joi.date().iso().allow(null), status: Joi.string().valid("draft", "open", "paused", "closed"),
  jdFileUrl: Joi.string().uri().allow(""), jdFilePublicId: Joi.string().allow(""),
}).unknown(false);
export const applicantBodySchema = Joi.object({
  jobId: id, fullName: Joi.string().trim().required(), email: Joi.string().trim().email(EMAIL_ADDRESS_OPTIONS).allow(""), phone: Joi.string().allow(""),
  birthDate: Joi.date().iso().allow(null), address: Joi.string().allow(""), experience: Joi.string().allow(""), education: Joi.string().allow(""),
  skills: Joi.array().items(Joi.string().trim()), expectedSalary: Joi.number().min(0).allow(null), availableDate: Joi.date().iso().allow(null),
  source: Joi.string().allow(""), notes: Joi.string().allow(""), recruiterId: Joi.string().allow(null, ""), confirmDuplicate: Joi.boolean(),
  cvUrl: Joi.string().uri().allow(""), cvPublicId: Joi.string().allow(""),
}).unknown(false);
export const interviewBodySchema = Joi.object({
  applicantId: id, jobId: id, scheduledStart: Joi.date().iso().required(), scheduledEnd: Joi.date().iso().required(),
  format: Joi.string().valid("onsite", "online", "phone").required(), location: Joi.string().allow(""), meetingLink: Joi.string().uri().allow(""),
  interviewerIds: Joi.array().items(Joi.string().trim()).default([]), status: Joi.string().valid("scheduled", "completed", "cancelled"),
  result: Joi.string().allow(""), notes: Joi.string().allow(""),
}).unknown(false);
export const versionBodySchema = Joi.object({ version }).unknown(false);
export const statusBodySchema = Joi.object({ version, status: Joi.string().valid("draft", "open", "paused", "closed").required() }).unknown(false);
export const transitionBodySchema = Joi.object({ version, stageId: id, note: Joi.string().allow("").default("") }).unknown(false);
const historyDate = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/);
export const applicantHistoryQuerySchema = Joi.object({ from: historyDate, to: historyDate }).unknown(false).custom((value, helpers) => {
  const isCalendarDate = (day: string) => {
    const parsed = new Date(`${day}T00:00:00.000Z`);
    return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === day;
  };
  if ([value.from, value.to].some((day: string | undefined) => day !== undefined && !isCalendarDate(day))) return helpers.error("any.invalid");
  if (value.from && value.to && value.from > value.to) return helpers.error("any.invalid");
  return value;
});
const optionalFields = (schema: Joi.ObjectSchema) => schema.fork(
  Object.keys(schema.describe().keys || {}),
  (field) => field.optional(),
);
export const jobUpdateBodySchema = optionalFields(jobBodySchema).append({ version });
export const applicantUpdateBodySchema = optionalFields(applicantBodySchema).append({ version });
export const interviewUpdateBodySchema = optionalFields(interviewBodySchema).append({ version });

export function validateBody(schema: Joi.ObjectSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.validate(req.body, { abortEarly: false, stripUnknown: false });
    if (result.error) return res.status(400).json({ status: "error", message: result.error.message });
    req.body = result.value;
    return next();
  };
}

export function validateQuery(schema: Joi.ObjectSchema) {
  return function validateQueryMiddleware(req: Request, res: Response, next: NextFunction) {
    const result = schema.validate(req.query, { abortEarly: false, stripUnknown: false });
    if (result.error) return res.status(400).json({ status: "error", message: result.error.message });
    return next();
  };
}
