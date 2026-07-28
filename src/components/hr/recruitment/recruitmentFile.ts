export const RECRUITMENT_FILE_ACCEPT = ".pdf,.doc,.docx";
export const RECRUITMENT_FILE_MAX_SIZE = 10 * 1024 * 1024;

const allowedExtensions = new Set(["pdf", "doc", "docx"]);
const allowedMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export function validateRecruitmentFile(file: File): string {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  if (
    !allowedExtensions.has(extension) ||
    (file.type && !allowedMimeTypes.has(file.type))
  ) {
    return "Chỉ chấp nhận tệp PDF, DOC hoặc DOCX.";
  }
  if (file.size > RECRUITMENT_FILE_MAX_SIZE)
    return "Tệp không được vượt quá 10 MB.";
  return "";
}
