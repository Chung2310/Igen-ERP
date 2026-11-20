export type AiSharingScope = "personal" | "company";
export interface AiSharingRecipient { name: string; privacyUrl: string }
export interface AiSharingDisclosure {
  scope: AiSharingScope;
  version: string;
  disclosureKey: string;
  model: string;
  recipients: AiSharingRecipient[];
  dataTypes: string[];
  purpose: string;
  processingSafeguards: string;
  privacyUrl: string;
  accepted: boolean;
  acceptedAt: string | null;
}
export type AiSharingDisclosurePreview = Pick<
  AiSharingDisclosure,
  "model" | "recipients" | "dataTypes" | "purpose" | "processingSafeguards" | "privacyUrl"
> & { fingerprint: string };
