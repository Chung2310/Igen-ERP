import type { ChatImageObservation } from "../../chat-image-context";

export interface ChatOrderScope {
  companyCode: string;
  pageId: string;
  conversationId: string;
  platform?: "facebook" | "zalo" | "tiktok";
}

export interface ChatOrderFlowSession {
  sessionId: string;
  resetDraft: boolean;
  ask?: string;
}

export interface ChatOrderFlowInput extends ChatOrderScope {
  messageId: string;
  messageAt?: Date;
  message: string;
  history?: Array<{ sender: string; text: string }>;
  imageUrls: string[];
  observation?: ChatImageObservation;
  visualMode?: boolean;
  simulationMode?: boolean;
  intakeProfile?: {
    _id: string; version: number; goal: string; completionMessage: string;
    fields: import("../../../../../../../shared/marketing-suite/lead-intake").LeadIntakeField[];
    needGroups?: import("../../../../../../../shared/marketing-suite/lead-intake").LeadNeedGroup[];
  };
  verifiedImageValues?: Record<string, string>;
  // Set by the document reader, never by model-generated intake output.
  subscriberIdentity?: { fieldKey: string; code: string };
  retryIntake?: boolean;
  freshImage?: boolean;
  replyDeadlineAt?: number;
  businessContext?: string;
  customerAddressStyle?: string;
  session?: ChatOrderFlowSession;
}

export interface ChatOrderFlowReply {
  text: string;
  isMock: boolean;
  draftId: string;
  revision: number;
  qrUrl?: string;
  qrImageAltText?: string;
  sampleImageUrl?: string;
  isSummary?: boolean;
  consultationContext?: string;
  leadIntake?: LeadIntakeContext;
  wordingSource?: string;
}

export interface LeadIntakeContext {
  collectionMode?: "document";
  goal: string;
  collected: Record<string, string>;
  receivedContact?: import("../../lead-intake-contact").LeadContactField[];
  missingRequiredFields: LeadIntakeQuestion[];
  missingOptionalFields?: LeadIntakeQuestion[];
  status: "inactive" | "collecting" | "just_completed" | "complete";
}

type LeadIntakeQuestion = { label: string; type: string; question?: string; options?: string[] };

export interface ChatOrderFlowPreview {
  dryRun: true;
  currentState: string;
  proposedDetails: Record<string, unknown>;
  matchedVariants: Array<{ id: string; name: string; size: string; price: number }>;
  requiresConfirmation: true;
  consultationContext?: string;
  wordingSource?: string;
}

export interface ChatOrderFlow {
  key: string;
  isEnabled(pageId: string, platform?: "facebook" | "zalo" | "tiktok", companyCode?: string): Promise<boolean>;
  isActive(pageId: string, conversationId: string): Promise<boolean>;
  prepareSession(scope: ChatOrderScope, messageId: string): Promise<ChatOrderFlowSession>;
  process(input: ChatOrderFlowInput): Promise<ChatOrderFlowReply | undefined>;
  preview?(input: ChatOrderFlowInput): Promise<ChatOrderFlowPreview | undefined>;
  markDelivered(reply: ChatOrderFlowReply): Promise<void>;
  conversationInstructions?: string;
  consultationInstructions?: string;
  preservesReplyFacts?(source: string, candidate: string): boolean;
  splitReply?(text: string): string[];
}
