import { toFriendlyTokens as toFriendlyTemplateTokens, toRawTokens as toRawTemplateTokens } from "../../../components/template-editor/templateTokenCodec";
import { MARKETING_VARIABLE_REGISTRY } from "./marketingVariableRegistry";

const MARKETING_VARIABLES = Object.values(MARKETING_VARIABLE_REGISTRY);

export function toFriendlyTokens(raw: string) {
  return toFriendlyTemplateTokens(raw, MARKETING_VARIABLES);
}

export function toRawTokens(friendly: string) {
  return toRawTemplateTokens(friendly, MARKETING_VARIABLES);
}
