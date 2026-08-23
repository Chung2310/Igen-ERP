import { ISmsSettings } from "../interfaces/sms-settings.interface";
import { SmsSettings } from "../models/sms-settings.model";

export interface SmsSettingsPayload {
  provider?: "twilio" | "stringee" | "tingting";
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioFromNumber?: string;
  twilioMessagingServiceSid?: string;
  twilioStatusCallbackUrl?: string;
  stringeeApiUrl?: string;
  stringeeApiKey?: string;
  stringeeSecretKey?: string;
  stringeeBrandname?: string;
  stringeeSender?: string;
  stringeeStatusCallbackUrl?: string;
  tingtingApiKey?: string;
  tingtingSender?: string;
}

export class SmsSettingsService {
  static async getByOwnerId(ownerId: string): Promise<ISmsSettings | null> {
    return await SmsSettings.findOne({ ownerId });
  }

  static async upsertByOwnerId(ownerId: string, data: SmsSettingsPayload): Promise<ISmsSettings> {
    return await SmsSettings.findOneAndUpdate(
      { ownerId },
      {
        $set: {
          ownerId,
          provider: data.provider || "tingting",
          twilioAccountSid: data.twilioAccountSid || "",
          twilioAuthToken: data.twilioAuthToken || "",
          twilioFromNumber: data.twilioFromNumber || "",
          twilioMessagingServiceSid: data.twilioMessagingServiceSid || "",
          twilioStatusCallbackUrl: data.twilioStatusCallbackUrl || "",
          stringeeApiUrl: data.stringeeApiUrl || "",
          stringeeApiKey: data.stringeeApiKey || "",
          stringeeSecretKey: data.stringeeSecretKey || "",
          stringeeBrandname: data.stringeeBrandname || "",
          stringeeSender: data.stringeeSender || "",
          stringeeStatusCallbackUrl: data.stringeeStatusCallbackUrl || "",
          tingtingApiKey: data.tingtingApiKey || "",
          tingtingSender: data.tingtingSender || "",
        },
      },
      { returnDocument: 'after', upsert: true }
    );
  }
}
