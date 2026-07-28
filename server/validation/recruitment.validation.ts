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
}).unknown(false);
export const applicantBodySchema = Joi.object({
  jobId: id, fullName: Joi.string().trim().required(), email: Joi.string().email().allow(""), phone: Joi.string().allow(""),
  birthDate: Joi.date().iso().allow(null), address: Joi.string().allow(""), experience: Joi.string().allow(""), education: Joi.string().allow(""),
  skills: Joi.array().items(Joi.string().trim()), expectedSalary: Joi.number().min(0).allow(null), availableDate: Joi.date().iso().allow(null),
  source: Joi.string().allow(""), notes: Joi.string().allow(""), recruiterId: Joi.string().allow(null, ""), confirmDuplicate: Joi.boolean(),
}).unknown(false);
export const pipelineBodySchema = Joi.object({ version, stages: Joi.array().min(1).items(Joi.object({
  id: Joi.string().trim(), name: Joi.string().trim().required(), color: Joi.string().trim().required(), position: Joi.number().integer().min(0),
  isActive: Joi.boolean(), terminalOutcome: Joi.string().valid("hired", "rejected", "withdrawn").allow(null),
}).unknown(false)).required() }).unknown(false);
export const interviewBodySchema = Joi.object({
  applicantId: id, jobId: id, scheduledStart: Joi.date().iso().required(), scheduledEnd: Joi.date().iso().required(),
  format: Joi.string().valid("onsite", "online", "phone").required(), location: Joi.string().allow(""), meetingLink: Joi.string().uri().allow(""),
  interviewerIds: Joi.array().items(Joi.string().trim()).default([]), status: Joi.string().valid("scheduled", "completed", "cancelled"),
  result: Joi.string().allow(""), notes: Joi.string().allow(""),
}).unknown(false);
export const versionBodySchema = Joi.object({ version }).unknown(false);
export const statusBodySchema = Joi.object({ version, status: Joi.string().valid("draft", "open", "paused", "closed").required() }).unknown(false);
export const transitionBodySchema = Joi.object({ version, stageId: id, note: Joi.string().allow("").default("") }).unknown(false);
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
