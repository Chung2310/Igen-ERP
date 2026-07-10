import { Schema, model } from "mongoose";
import { ISmsSettings } from "../interfaces/sms-settings.interface";

const smsSettingsSchema = new Schema<ISmsSettings>(
  {
    ownerId: { type: String, required: true, unique: true, index: true },
    provider: { type: String, required: true, default: "tingting", enum: ["twilio", "stringee", "tingting"] },
    twilioAccountSid: { type: String, default: "", trim: true },
    twilioAuthToken: { type: String, default: "", trim: true },
    twilioFromNumber: { type: String, default: "", trim: true },
    twilioMessagingServiceSid: { type: String, default: "", trim: true },
    twilioStatusCallbackUrl: { type: String, default: "", trim: true },
    stringeeApiUrl: { type: String, default: "", trim: true },
    stringeeApiKey: { type: String, default: "", trim: true },
    stringeeSecretKey: { type: String, default: "", trim: true },
    stringeeBrandname: { type: String, default: "", trim: true },
    stringeeSender: { type: String, default: "", trim: true },
    stringeeStatusCallbackUrl: { type: String, default: "", trim: true },
    tingtingApiKey: { type: String, default: "", trim: true },
    tingtingSender: { type: String, default: "", trim: true },
  },
  {
    timestamps: true,
  }
);

export const SmsSettings = model<ISmsSettings>("SmsSettings", smsSettingsSchema);
