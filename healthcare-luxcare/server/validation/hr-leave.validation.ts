import Joi from "joi";
import { LEAVE_REQUEST_KINDS } from "../interface/hr-leave.interface";

const attachment = Joi.object({
  url: Joi.string().uri().required(),
  uploadToken: Joi.string().trim().required(),
  name: Joi.string().trim().required(),
  mimeType: Joi.string().trim().allow("").optional(),
  size: Joi.number().integer().min(0).optional(),
});

const objectId = Joi.string().hex().length(24).required();

export const uploadLeaveFileSchema = {
  body: Joi.object({
    file: Joi.string().required(),
    fileName: Joi.string().trim().max(300).required(),
    mimeType: Joi.string().trim().max(200).allow("").optional(),
    size: Joi.number().integer().min(0).max(20 * 1024 * 1024).required(),
  }),
};

export const createLeaveTemplateSchema = {
  body: Joi.object({
    name: Joi.string().trim().min(1).max(200).required(),
    requestKind: Joi.string().valid(...LEAVE_REQUEST_KINDS).required(),
    fileUrl: Joi.string().uri().required(),
    fileName: Joi.string().trim().max(300).required(),
    uploadToken: Joi.string().trim().required(),
  }),
};

export const leaveIdSchema = { params: Joi.object({ id: objectId }) };

export const createLeaveApplicationSchema = {
  body: Joi.object({
    templateId: Joi.string().trim().optional(),
    type: Joi.string().trim().required(),
    requestKind: Joi.string().valid(...LEAVE_REQUEST_KINDS).required(),
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().min(Joi.ref("startDate")).required(),
    reason: Joi.string().trim().min(1).required(),
    attachments: Joi.array().items(attachment).max(10).default([]),
    employeeId: Joi.forbidden(),
    employeeName: Joi.forbidden(),
    companyCode: Joi.forbidden(),
    branchId: Joi.forbidden(),
    status: Joi.forbidden(),
    approvedBy: Joi.forbidden(),
    approvedAt: Joi.forbidden(),
  }),
};

export const decideLeaveApplicationSchema = {
  params: Joi.object({ id: objectId }),
  body: Joi.alternatives().try(
    Joi.object({
      decision: Joi.string().valid("approved").required(),
      approvalType: Joi.string().valid("justified", "unjustified").required(),
      note: Joi.string().trim().allow("").optional(),
    }),
    Joi.object({
      decision: Joi.string().valid("rejected").required(),
      rejectReason: Joi.string().trim().min(1).required(),
      note: Joi.string().trim().allow("").optional(),
    }),
  ),
};
