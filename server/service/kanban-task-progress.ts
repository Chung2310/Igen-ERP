export function taskProgress(task: { status?: string; progress?: number }) {
  if (["Done", "done"].includes(task.status || "")) return 100;
  return task.progress ?? (["In Progress", "doing", "Review/Testing"].includes(task.status || "") ? 1 : 0);
}

export function taskActivityUpdate(task: any, input: any, actor: { uid: string; name: string; manager: boolean }, now = new Date().toISOString()) {
  const fail = (code: number, message: string): never => { throw Object.assign(new Error(message), { statusCode: code }); };
  if (task.status === "Archived") fail(400, "Công việc đã lưu trữ.");
  const owner = actor.manager || task.assigneeUid === actor.uid;
  const note = typeof input.note === "string" ? input.note.trim() : "";
  if (note.length > 2000) fail(400, "Ghi chú tối đa 2.000 ký tự.");
  let update: Record<string, any> = {};
  let action = "";
  switch (input.action) {
    case "progress": {
      if (!owner) fail(403, "Chỉ người phụ trách hoặc quản lý được cập nhật tiến độ.");
      if (!Number.isInteger(input.progress) || input.progress < 0 || input.progress > 100 || !note) fail(400, "Tiến độ phải từ 0–100 và có ghi chú báo cáo.");
      const progress = input.progress;
      update = { progress, progressNote: note, status: progress === 100 ? "Done" : progress > 0 ? "In Progress" : "Not Started" };
      if (progress > 0 && !task.actualStartTime) update.actualStartTime = now;
      if (progress > 0 && !task.startTime) update.startTime = now;
      if (progress === 100) {
        update.completedAt = task.status === "Done" ? (task.completedAt || task.endTime || now) : now;
        update.endTime = update.completedAt;
        update.helpRequested = false;
      } else { update.completedAt = ""; update.endTime = ""; }
      action = `Báo cáo tiến độ ${progress}%: ${note}`;
      break;
    }
    case "help":
      if (!owner) fail(403, "Chỉ người phụ trách hoặc quản lý được gửi trợ giúp.");
      if (taskProgress(task) === 100 || task.helpRequested || !note) fail(400, "Cần công việc chưa hoàn thành, chưa gửi trợ giúp và có lý do.");
      update = { helpRequested: true, helpReason: note };
      action = `Gửi trợ giúp: ${note}`;
      break;
    case "join":
      if (!task.helpRequested) fail(400, "Công việc không còn yêu cầu trợ giúp.");
      if (task.assigneeUid === actor.uid || task.helpers?.some((helper: any) => helper.uid === actor.uid)) fail(400, "Bạn đã tham gia công việc này.");
      update = { helpers: [...(task.helpers || []), { uid: actor.uid, name: actor.name }] };
      action = "Tham gia hỗ trợ (giữ nguyên người phụ trách chính)";
      break;
    case "resolve":
      if (!owner) fail(403, "Chỉ người phụ trách hoặc quản lý được đóng trợ giúp.");
      if (!task.helpRequested) fail(400, "Không có yêu cầu trợ giúp đang mở.");
      update = { helpRequested: false };
      action = "Đã giải quyết yêu cầu trợ giúp";
      break;
    default: fail(400, "Thao tác không hợp lệ.");
  }
  return { update, history: { time: now, user: actor.name, action } };
}
