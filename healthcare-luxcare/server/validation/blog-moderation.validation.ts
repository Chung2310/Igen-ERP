import Joi from "joi";
import { BLOG_REPORT_REASONS, BLOG_REPORT_STATUSES } from "../../shared/blog-moderation";
export const blogReportBody = Joi.object({
  reason: Joi.string()
    .valid(...Object.keys(BLOG_REPORT_REASONS))
    .required(),
  details: Joi.string().trim().max(2000).allow("").default(""),
}).unknown(false).required();
export const blogModerationBody = Joi.object({
  status: Joi.string()
    .valid(...BLOG_REPORT_STATUSES)
    .required(),
  notes: Joi.string().trim().max(2000).allow("").default(""),
  removePost: Joi.boolean()
    .strict()
    .default(false)
    .when("status", { not: "resolved", then: Joi.valid(false) }),
}).unknown(false).required();
export const blogModerationId = Joi.string().hex().length(24).required();
