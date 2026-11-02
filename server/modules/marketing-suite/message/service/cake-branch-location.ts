import { normalizeCakeText } from "./chat-ordering/flows/bakery-default/cake-price-catalog";

export type CakeBranchLocation = { code?: unknown; name?: unknown; address?: unknown };

const BRANCH_LOCATION_STOP_WORDS = new Set([
  "tại", "tiem", "banh", "cua", "hang", "chi", "nhanh", "so", "phuong", "xa", "quan", "huyen",
  "thanh", "pho", "tinh", "duong", "tp", "viet", "nam",
]);

function locationTokens(value: unknown): Set<string> {
  return new Set(normalizeCakeText(String(value || "")).split(/\s+/)
    .filter(token => token.length > 1 && !BRANCH_LOCATION_STOP_WORDS.has(token)));
}

/** Returns a branch only when the supplied location identifies exactly one active branch. */
export function matchCakeBranchLocation<T extends CakeBranchLocation>(branches: T[], rawLocation: string): T | undefined {
  const location = normalizeCakeText(rawLocation);
  if (!location) return undefined;
  const exactMatches = branches.filter(branch => [branch.code, branch.name, branch.address]
    .map(value => normalizeCakeText(String(value || "").trim())).filter(value => value.length >= 4)
    .some(value => location.includes(value) || value.includes(location)));
  const locationTokenSet = locationTokens(rawLocation);
  const matching = exactMatches.length ? exactMatches : branches.filter(branch => {
    const branchTokenSet = locationTokens(`${branch.name || ""} ${branch.address || ""}`);
    return [...locationTokenSet].filter(token => branchTokenSet.has(token)).length >= 3;
  });
  return matching.length === 1 ? matching[0] : undefined;
}
