import { Document } from "mongoose";

export interface ISmsSettings extends Document {
  ownerId: string;
  provider: "twilio" | "stringee" | "tingting";
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
  createdAt?: Date;
  updatedAt?: Date;
}
