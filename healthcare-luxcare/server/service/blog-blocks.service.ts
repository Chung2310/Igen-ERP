import { Types } from "mongoose";
import { UserBlockModel } from "../model/user-block.model";
export async function blogVisibilityFilter(userId?: string) {
  if (!userId || !Types.ObjectId.isValid(userId)) return {};
  const blocks = await UserBlockModel.find({ userId }).select("blockedUserId").lean();
  return blocks.length ? { authorId: { $nin: blocks.map((block) => block.blockedUserId) } } : {};
}
export async function assertBlogAuthorVisible(userId: string, authorId: unknown) {
  if (!userId || !Types.ObjectId.isValid(userId)) return;
  if (await UserBlockModel.exists({ userId, blockedUserId: authorId }))
    throw Object.assign(new Error("Không tìm thấy bài viết"), { status: 404 });
}
