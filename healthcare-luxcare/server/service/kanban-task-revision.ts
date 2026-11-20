/** Optional precondition keeps legacy clients compatible while protecting native edits. */
export function assertTaskRevision(expected: unknown, actual: number = 0) {
  if (expected === undefined) return;
  if (typeof expected !== "number" || !Number.isInteger(expected) || expected < 0) {
    throw Object.assign(new Error("Phiên bản công việc không hợp lệ."), { statusCode: 400 });
  }
  if (expected !== actual)
    throw Object.assign(new Error("Công việc đã được thay đổi. Vui lòng tải lại trước khi lưu."), { statusCode: 409 });
}
