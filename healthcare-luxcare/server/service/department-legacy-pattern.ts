export function legacyDepartmentPattern(names: string[]) {
  return names.map((name) => `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`).join("|");
}
