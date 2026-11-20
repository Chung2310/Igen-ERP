import { serializeBlogAttachments } from "./blog-file.service";
import { Types, type ClientSession } from "mongoose";
import { BlogPostModel } from "../model/blog-post.model";
import { BlogReportModel } from "../model/blog-report.model";
import { UserBlockModel } from "../model/user-block.model";
import { logger } from "../config/logger";
import type { BlogReportReason, BlogReportStatus } from "../../shared/blog-moderation";
export interface BlogActor {
  id: string;
  role: string;
  companyCode?: string;
}
function fail(message: string, status = 400): never {
  throw Object.assign(new Error(message), { status });
}
export function assertBlogModerator(actor: BlogActor) {
  if (actor.role !== "superadmin") fail("Chỉ quản trị nền tảng được duyệt báo cáo Blog.", 403);
}
async function findPost(id: string) {
  if (!Types.ObjectId.isValid(id)) fail("Không tìm thấy bài viết.", 404);
  const post = await BlogPostModel.findOne({ _id: id, isDeleted: false }).lean();
  if (!post) fail("Không tìm thấy bài viết.", 404);
  return post;
}
export async function reportBlogPost(
  actor: BlogActor,
  id: string,
  input: { reason: BlogReportReason; details?: string },
) {
  const post = await findPost(id);
  if (String(post.authorId) === actor.id) fail("Bạn không thể báo cáo bài viết của mình.");
  const record = {
    postId: post._id,
    authorId: post.authorId,
    reporterId: actor.id,
    companyCode: post.companyCode,
    authorName: post.authorName.slice(0, 300),
    title: (post.title || "").slice(0, 300),
    snippet: post.content.slice(0, 500),
    reason: input.reason,
    details: input.details || "",
    status: "pending",
    notes: "",
    postRemoved: false,
  };
  // One report per reader/post. Retries cannot overwrite a moderator's decision.
  try {
    const report = await BlogReportModel.findOneAndUpdate(
      { postId: post._id, reporterId: actor.id },
      { $setOnInsert: record },
      { upsert: true, new: true },
    );
    return { id: String(report._id), status: report.status };
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    const existing = await BlogReportModel.findOne({ postId: post._id, reporterId: actor.id }).lean();
    if (!existing) throw error;
    return { id: String(existing._id), status: existing.status };
  }
}
export async function blockBlogAuthor(actor: BlogActor, id: string) {
  const post = await findPost(id);
  if (String(post.authorId) === actor.id) fail("Bạn không thể chặn chính mình.");
  await UserBlockModel.updateOne(
    { userId: actor.id, blockedUserId: post.authorId },
    {
      $setOnInsert: {
        userId: actor.id,
        blockedUserId: post.authorId,
        companyCode: actor.companyCode || "SYSTEM",
        reason: "blog",
        createdAt: new Date(),
      },
    },
    { upsert: true },
  );
  return { authorId: String(post.authorId) };
}
export async function listBlogBlocks(actor: BlogActor) {
  const blocks = await UserBlockModel.find({ userId: actor.id }).sort({ createdAt: -1 }).lean();
  const authors = await BlogPostModel.find({ authorId: { $in: blocks.map((block) => block.blockedUserId) } })
    .select("authorId authorName")
    .sort({ createdAt: -1 })
    .lean();
  return blocks.map((block) => ({
    authorId: String(block.blockedUserId),
    authorName:
      authors.find((post) => String(post.authorId) === String(block.blockedUserId))?.authorName || "Người dùng đã chặn",
    createdAt: block.createdAt,
  }));
}
export async function unblockBlogAuthor(actor: BlogActor, authorId: string) {
  if (!Types.ObjectId.isValid(authorId)) fail("Người dùng không hợp lệ.");
  await UserBlockModel.deleteOne({ userId: actor.id, blockedUserId: authorId });
  return { authorId };
}
export async function listBlogReports(actor: BlogActor, status: BlogReportStatus = "pending", page = 1) {
  assertBlogModerator(actor);
  const limit = 25;
  const [reports, total] = await Promise.all([
    BlogReportModel.find({ status })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    BlogReportModel.countDocuments({ status }),
  ]);
  const posts = reports.length
    ? await BlogPostModel.find({ _id: { $in: reports.map((report) => report.postId) }, isDeleted: false }).lean()
    : [];
  return {
    items: reports.map((report) => ({
      ...report,
      id: String(report._id),
      post: (() => {
        const post = posts.find((post) => String(post._id) === String(report.postId));
        return post ? { content: post.content, attachments: serializeBlogAttachments(post) } : undefined;
      })(),
    })),
    total,
    page,
    limit,
  };
}
export async function moderateBlogReport(
  actor: BlogActor,
  id: string,
  input: { status: BlogReportStatus; notes?: string; removePost?: boolean },
) {
  assertBlogModerator(actor);
  if (!Types.ObjectId.isValid(id)) fail("Không tìm thấy báo cáo.", 404);
  if (input.removePost && input.status !== "resolved") fail("Chỉ gỡ bài khi xác nhận đã xử lý báo cáo.");
  const report = await BlogReportModel.findById(id);
  if (!report) fail("Không tìm thấy báo cáo.", 404);
  // Hide first; a failed write must never claim content was removed. Retrying is safe.
  if (input.removePost) {
    const post = await BlogPostModel.findByIdAndUpdate(report.postId, { $set: { isDeleted: true, isPinned: false } });
    if (!post) fail("Không tìm thấy bài viết cần gỡ.", 404);
    report.postRemoved = true;
  }
  report.status = input.status;
  report.notes = input.notes || "";
  report.moderatedBy = new Types.ObjectId(actor.id);
  report.moderatedAt = new Date();
  await report.save();
  if (input.removePost) {
    try {
      const { broadcastEvent } = await import("../socket");
      broadcastEvent("blog_post_deleted", { postId: String(report.postId) });
    } catch (error) {
      logger.warn("[BlogModeration] Emit removal failed", error);
    }
  }
  return { id: String(report._id), status: report.status, postRemoved: report.postRemoved };
}

export async function prepareBlogModeration() {
  await BlogReportModel.createCollection();
  await BlogReportModel.createIndexes();
}
export async function cleanupBlogSafety(userId: string, session?: ClientSession) {
  await BlogReportModel.deleteMany({ $or: [{ reporterId: userId }, { authorId: userId }] }, { session });
  await BlogReportModel.updateMany({ moderatedBy: userId }, { $unset: { moderatedBy: 1 } }, { session });
  await UserBlockModel.deleteMany({ $or: [{ userId }, { blockedUserId: userId }] }, { session });
}
