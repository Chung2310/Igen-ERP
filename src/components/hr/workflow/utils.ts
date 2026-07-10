let counter = 0;

export const createClientId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${(counter++).toString(36)}`;

export const avatarUrl = (name: string, photo?: string) => {
  if (photo && (photo.startsWith("http") || photo.startsWith("/"))) return photo;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "NV")}&background=4f46e5&color=fff`;
};

export const nowISO = () => new Date().toISOString();

export const formatShortDate = (iso?: string) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
};