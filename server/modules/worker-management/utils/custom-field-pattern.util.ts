export const MAX_CUSTOM_FIELD_PATTERN_LENGTH = 500;
export const MAX_CUSTOM_FIELD_PATTERN_INPUT_LENGTH = 4_096;

type GroupState = { hasAlternation: boolean; hasQuantifier: boolean };

/**
 * Conservative linear scan for constructs that can make a user-defined regular
 * expression unsafe for synchronous server-side evaluation.
 */
export function isSafeCustomFieldPattern(pattern: string): boolean {
  if (!pattern || pattern.length > MAX_CUSTOM_FIELD_PATTERN_LENGTH)
    return false;

  const groups: GroupState[] = [
    { hasAlternation: false, hasQuantifier: false },
  ];
  let escaped = false;
  let inCharacterClass = false;
  let lastClosedGroup: GroupState | undefined;
  let quantifierCount = 0;

  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (escaped) {
      if (!inCharacterClass && (/[1-9]/.test(character) || character === "k"))
        return false;
      escaped = false;
      lastClosedGroup = undefined;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (character === "[" && !inCharacterClass) {
      inCharacterClass = true;
      lastClosedGroup = undefined;
      continue;
    }
    if (character === "]" && inCharacterClass) {
      inCharacterClass = false;
      continue;
    }
    if (inCharacterClass) continue;

    if (character === "(") {
      if (pattern[index + 1] === "?") {
        if (pattern[index + 2] !== ":") return false;
        index += 2;
      }
      groups.push({ hasAlternation: false, hasQuantifier: false });
      lastClosedGroup = undefined;
      continue;
    }
    if (character === ")") {
      if (groups.length === 1) return false;
      const closedGroup = groups.pop()!;
      const parentGroup = groups[groups.length - 1];
      parentGroup.hasAlternation ||= closedGroup.hasAlternation;
      parentGroup.hasQuantifier ||= closedGroup.hasQuantifier;
      lastClosedGroup = closedGroup;
      continue;
    }
    if (character === "|") {
      groups[groups.length - 1].hasAlternation = true;
      lastClosedGroup = undefined;
      continue;
    }

    const isSimpleQuantifier =
      character === "*" || character === "+" || character === "?";
    const isRangeQuantifier =
      character === "{" && /^\{\d+(?:,\d*)?\}/.test(pattern.slice(index));
    if (isSimpleQuantifier || isRangeQuantifier) {
      quantifierCount += 1;
      if (quantifierCount > 1) return false;
      if (lastClosedGroup?.hasQuantifier || lastClosedGroup?.hasAlternation)
        return false;
      groups[groups.length - 1].hasQuantifier = true;
      if (isRangeQuantifier) index += pattern.slice(index).indexOf("}");
      lastClosedGroup = undefined;
      continue;
    }
    lastClosedGroup = undefined;
  }

  return !escaped && !inCharacterClass && groups.length === 1;
}
