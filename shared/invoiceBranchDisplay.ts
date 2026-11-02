export function isHeadOfficeName(value: unknown): boolean {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/đ/g, "d");
  return /\btru\s*so\b|\bhead\s*office\b|\bheadquarters\b/.test(normalized);
}
