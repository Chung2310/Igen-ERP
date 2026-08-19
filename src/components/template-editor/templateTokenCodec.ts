import type { TemplateVariableConfig } from "./templateEditorTypes";

const rawTokenPattern = /{{\s*([a-zA-Z]+)\s*}}/g;

export function toFriendlyTokens(raw: string, variables: TemplateVariableConfig[]) {
  const labelsByKey = new Map(variables.map((variable) => [variable.key, variable.label]));
  return String(raw).replace(rawTokenPattern, (match, key: string) => {
    const label = labelsByKey.get(key);
    return label ? `[${label}]` : match;
  });
}

export function toRawTokens(friendly: string, variables: TemplateVariableConfig[]) {
  let next = String(friendly);
  for (const variable of variables) {
    next = next.replaceAll(`[${variable.label}]`, `{{${variable.key}}}`);
  }
  return next;
}

export function fillSampleValues(template: string, variables: TemplateVariableConfig[]) {
  const samplesByKey = new Map(variables.map((variable) => [variable.key, variable.sample]));
  return String(template).replace(rawTokenPattern, (match, key: string) => samplesByKey.get(key) ?? match);
}
