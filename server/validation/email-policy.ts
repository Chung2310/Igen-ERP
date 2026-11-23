import Joi from "joi";
import { EMAIL_ADDRESS_OPTIONS } from "../../shared/email-policy";

export const emailAddressSchema = Joi.string().trim().email(EMAIL_ADDRESS_OPTIONS);
export const isValidEmailAddress = (value: string) => !emailAddressSchema.validate(value).error;
