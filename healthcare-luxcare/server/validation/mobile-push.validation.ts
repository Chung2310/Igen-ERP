import Joi from "joi";

const expoToken = Joi.string().pattern(/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/).max(256).required();
const fcmToken = Joi.string().pattern(/^[A-Za-z0-9_:\-]+$/).max(4096).required();

export const registerMobilePushSchema = Joi.object({
  provider: Joi.string().valid("expo", "fcm").default("expo"),
  platform: Joi.when("provider", { is: "fcm", then: Joi.string().valid("android").required(), otherwise: Joi.string().valid("android", "ios").required() }),
  token: Joi.when("provider", { is: "fcm", then: fcmToken, otherwise: expoToken }),
});
export const deleteMobilePushSchema = Joi.object({ token: Joi.alternatives().try(expoToken, fcmToken).required() });
