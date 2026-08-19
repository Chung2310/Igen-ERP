import { MARKETING_VARIABLE_REGISTRY } from "./marketingVariableRegistry";

const rawTokenPattern = /{{\s*([a-zA-Z]+)\s*}}/g;

export function toFriendlyTokens(raw: string) {
  return String(raw).replace(rawTokenPattern, (match, key: string) => {
    const label = MARKETING_VARIABLE_REGISTRY[key]?.label;
    return label ? `[${label}]` : match;
  });
}

export function toRawTokens(friendly: string) {
  let next = String(friendly);
  for (const [key, value] of Object.entries(MARKETING_VARIABLE_REGISTRY)) {
    next = next.replaceAll(`[${value.label}]`, `{{${key}}}`);
  }
  return next;
}
