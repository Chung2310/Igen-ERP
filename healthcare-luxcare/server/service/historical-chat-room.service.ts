import { annotateHistoricalRecords } from "./historical-user.service";
export async function historicalRoom(room: any) {
  if (!room) return room;
  const plain = typeof room.toObject === "function" ? room.toObject() : room;
  const references = (plain.members || []).map((member: any) => ({
    ...member,
    userId: String(member.userId?._id || member.userId || ""),
    displayName: member.userId?.isDeleted ? "" : member.userId?.displayName,
  }));
  const members = await annotateHistoricalRecords(
    plain.companyCode,
    references,
    "userId",
    "displayName",
    "userDeleted",
  );
  return {
    ...plain,
    members: members.map((member: any, index: number) => ({
      ...plain.members[index],
      userId: {
        ...(plain.members[index].userId || {}),
        _id: member.userId,
        displayName: member.displayName,
        isDeleted: member.userDeleted,
      },
    })),
  };
}
export const historicalMember = {
  path: "members.userId",
  select: "displayName photoURL email role status",
  transform: (doc: any, id: any) => doc || { _id: id, displayName: "Tài khoản đã xóa", isDeleted: true },
};
