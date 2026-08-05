import Joi from "joi";
export const createWorkerNotificationSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200).required(),
  content: Joi.string().trim().min(1).max(10000).required(),
  recipients: Joi.string().trim().max(100).optional(),
  channels: Joi.array().items(Joi.string().valid("in-app", "email")).min(1).optional(),
}).unknown(false);
