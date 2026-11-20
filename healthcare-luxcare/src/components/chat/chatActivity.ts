export const ROOM_ACTIVITY_PREFIX = "LUXCAREROOMACTIVITY:";

export function isRoomActivityMessage(content?: string): boolean {
  if (!content) return false;
  return content.startsWith(ROOM_ACTIVITY_PREFIX);
}

export function getRoomActivityText(content?: string): string {
  if (!content) return "";
  return content.replace(/^LUXCAREROOMACTIVITY:\s*/, "");
}
