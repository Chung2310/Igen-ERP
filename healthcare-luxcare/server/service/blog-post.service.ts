import { blogVisibilityFilter, assertBlogAuthorVisible } from "./blog-blocks.service";
import { assertAllowedContent } from "./content-filter";
import { logger } from "../config/logger";
import { serializeBlogAttachments, validateBlogFiles } from "./blog-file.service";
import { annotateHistoricalRecords } from "./historical-user.service";
import { Types } from "mongoose";
import { BlogPostModel } from "../model/blog-post.model";
import { UserModel } from "../model/user.model";
import { canUserPostBlog, canManageBlogPost } from "../middleware/blog-permission";
import { LegalDocumentModel } from "../model/legal-document.model";
import { canManageLegal } from "../assistant/knowledge/legal-policy";

export interface CreatePostPayload {
  title?: string;
  content?: string;
  tags?: string[];
  isPinned?: boolean;
  attachmentsPublic?: boolean;
  attachments?: {
    url: string;
    name?: string;
    type?: string;
    size?: number;
  }[];
}

export interface ListPostsQuery {
  companyCode: string;
  tag?: string;
  search?: string;
  page?: number;
  limit?: number;
  currentUserId?: string;
  currentUserRole?: string;
}

export async function listPosts(query: ListPostsQuery) {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(50, Math.max(1, query.limit || 20));
  const skip = (page - 1) * limit;

  const filter: any = { isDeleted: false, ...await blogVisibilityFilter(query.currentUserId) };

  // Kênh Blog chung: mở cho mọi tài khoản và mọi doanh nghiệp đều xem được tất cả bài viết
  if ((query as any).strictCompany && query.companyCode && query.companyCode !== "SYSTEM" && query.companyCode !== "ALL") {
    filter.companyCode = { $in: [query.companyCode.toUpperCase().trim(), "SYSTEM"] };
  }

  if (query.tag && query.tag !== "all") {
    filter.tags = query.tag;
  }

  if (query.search && query.search.trim()) {
    const searchRegex = new RegExp(query.search.trim(), "i");
    filter.$or = [{ title: searchRegex }, { content: searchRegex }];
  }

  const [posts, total] = await Promise.all([
    BlogPostModel.find(filter)
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    BlogPostModel.countDocuments(filter),
  ]);

  const currentUserIdStr = query.currentUserId ? String(query.currentUserId) : "";
  const legalDocuments = posts.length ? await LegalDocumentModel.find({ postId: { $in: posts.map(post => post._id) },
    ...(!canManageLegal({ role: query.currentUserRole }) ? { approvedAt: { $exists: true },
      $or: [{ companyCodes: { $size: 0 } }, { companyCodes: query.companyCode }] } : {}),
  }).select("postId number title status").lean() : [];

  const items = posts.map((post: any) => {
    const likesList = Array.isArray(post.likes) ? post.likes : [];
    const isLiked = currentUserIdStr
      ? likesList.some((id: any) => String(id) === currentUserIdStr)
      : false;

    return {
      id: post._id,
      companyCode: post.companyCode,
      authorId: post.authorId,
      authorName: post.authorName,
      authorRole: post.authorRole,
      authorAvatar: post.authorAvatar,
      title: post.title,
      content: post.content,
      tags: post.tags,
      isPinned: post.isPinned,
      attachmentsPublic: post.attachmentsPublic === undefined ? true : post.attachmentsPublic === true,
      attachments: serializeBlogAttachments(post),
      legalDocuments: legalDocuments.filter(document => String(document.postId) === String(post._id))
        .map(document => ({ id: String(document._id), number: document.number, title: document.title, status: document.status })),
      likesCount: likesList.length,
      isLiked,
      viewCount: post.viewCount || 0,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  });

  const decorated = (await Promise.all([...new Set(items.map(item => item.companyCode))].map(company => annotateHistoricalRecords(company, items.filter(item => item.companyCode === company), "authorId", "authorName", "authorDeleted")))).flat();
  const byId = new Map(decorated.map(item => [String(item.id), item]));
  const historicalItems = items.map(item => byId.get(String(item.id))!);
  return {
    posts: historicalItems,
    items: historicalItems,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function createPost(user: any, payload: CreatePostPayload) {
  if (!canUserPostBlog(user)) {
    throw new Error(
      "Bạn không có quyền đăng tin trong Kênh Blog chung. Chỉ tài khoản đặc biệt mới có quyền này.",
    );
  }

  const rawCode = String(user.companyCode || "").toUpperCase().trim();
  const companyCode = rawCode && rawCode !== "SYSTEM" ? rawCode : "SYSTEM";

  const authorUserId = user?.id || user?._id || user?.uid;
  if (!authorUserId) {
    throw new Error("Không xác định được danh tính người đăng bài (thiếu ID tài khoản)");
  }

  let authorName = user.displayName || user.name || user.email || "Tác giả đặc quyền";
  let authorAvatar = user.photoURL || user.avatar || "";

  if (Types.ObjectId.isValid(authorUserId)) {
    try {
      const userDoc = await UserModel.findById(authorUserId).select("displayName photoURL email").lean();
      if (userDoc) {
        if (userDoc.displayName) authorName = userDoc.displayName;
        if (userDoc.photoURL) authorAvatar = userDoc.photoURL;
      }
    } catch {
      // Bỏ qua lỗi truy vấn user nếu có và dùng thông tin fallback
    }
  }

  let authorRole = "Ban Biên Tập";
  if (user.role === "superadmin") authorRole = "Super Admin";
  else if (user.role === "blog_editor") authorRole = "Ban Biên Tập";
  else if (user.role === "blog_author") authorRole = "Tác Giả";

  assertAllowedContent([payload.title, payload.content, ...(payload.tags || [])].filter(Boolean).join("\n"), payload.attachments || []);
  await validateBlogFiles(user, payload.attachments || []);
  const newPost = await BlogPostModel.create({
    companyCode,
    authorId: Types.ObjectId.isValid(authorUserId) ? new Types.ObjectId(authorUserId) : authorUserId,
    authorName,
    authorRole,
    authorAvatar,
    title: payload.title?.trim() || "",
    content: payload.content ? payload.content.trim() : "",
    tags: Array.isArray(payload.tags) && payload.tags.length > 0 ? payload.tags : ["Thông báo"],
    isPinned: Boolean(payload.isPinned),
    attachmentsPublic: payload.attachmentsPublic === true,
    attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
    likes: [],
    viewCount: 1,
    isDeleted: false,
  });

  const formatted = {
    id: newPost._id,
    companyCode: newPost.companyCode,
    authorId: newPost.authorId,
    authorName: newPost.authorName,
    authorRole: newPost.authorRole,
    authorAvatar: newPost.authorAvatar,
    title: newPost.title,
    content: newPost.content,
    tags: newPost.tags,
    isPinned: newPost.isPinned,
    attachmentsPublic: newPost.attachmentsPublic === true,
    attachments: serializeBlogAttachments(newPost),
    likesCount: 0,
    isLiked: false,
    viewCount: newPost.viewCount,
    createdAt: newPost.createdAt,
    updatedAt: newPost.updatedAt,
  };

  // Phát socket realtime tới các thành viên (nếu SYSTEM thì phát toàn hệ thống)
  try {
    const { emitToCompany, broadcastEvent } = await import("../socket");
    if (companyCode === "SYSTEM") {
      broadcastEvent("blog_post_created", formatted);
    } else {
      emitToCompany(companyCode, "blog_post_created", formatted);
    }
  } catch (socketError) {
    logger.warn("[BlogPostService] Emit socket failed:", socketError);
  }

  return formatted;
}

export async function togglePinPost(companyCode: string, postId: string, user: any) {
  if (!canUserPostBlog(user)) {
    throw new Error("Bạn không có quyền ghim bài viết");
  }

  const post = await BlogPostModel.findOne({
    _id: postId,
    isDeleted: false,
  });

  if (!post) {
    throw new Error("Không tìm thấy bài viết");
  }
  if (!canManageBlogPost(user, post.authorId)) throw Object.assign(new Error("Bạn không có quyền sửa hoặc xóa bài viết của tác giả khác."), { status: 403 });

  post.isPinned = !post.isPinned;
  await post.save();

  try {
    const { emitToCompany, broadcastEvent } = await import("../socket");
    const payload = {
      postId: post._id,
      isPinned: post.isPinned,
    };
    if (post.companyCode === "SYSTEM") {
      broadcastEvent("blog_post_pinned", payload);
    } else {
      emitToCompany(post.companyCode, "blog_post_pinned", payload);
    }
  } catch (socketError) {
    logger.warn("[BlogPostService] Emit socket failed:", socketError);
  }

  return { id: post._id, isPinned: post.isPinned };
}

export async function toggleLikePost(companyCode: string, postId: string, userId: string) {
  const post = await BlogPostModel.findOne({
    _id: postId,
    isDeleted: false,
  });

  if (!post) {
    throw new Error("Không tìm thấy bài viết");
  }
  await assertBlogAuthorVisible(userId, post.authorId);

  const userObjId = new Types.ObjectId(userId);
  const existsIndex = post.likes.findIndex((id) => String(id) === String(userId));

  let isLiked = false;
  if (existsIndex >= 0) {
    post.likes.splice(existsIndex, 1);
    isLiked = false;
  } else {
    post.likes.push(userObjId);
    isLiked = true;
  }

  await post.save();

  try {
    const { emitToCompany, broadcastEvent } = await import("../socket");
    const payload = {
      postId: post._id,
      likesCount: post.likes.length,
      userId,
      isLiked,
    };
    if (post.companyCode === "SYSTEM") {
      broadcastEvent("blog_post_liked", payload);
    } else {
      emitToCompany(post.companyCode, "blog_post_liked", payload);
    }
  } catch (socketError) {
    logger.warn("[BlogPostService] Emit socket failed:", socketError);
  }

  return {
    id: post._id,
    likesCount: post.likes.length,
    isLiked,
  };
}

export async function deletePost(companyCode: string, postId: string, user: any) {
  if (!canUserPostBlog(user)) {
    throw new Error("Bạn không có quyền xóa bài viết");
  }

  const post = await BlogPostModel.findOne({
    _id: postId,
    isDeleted: false,
  });

  if (!post) {
    throw new Error("Không tìm thấy bài viết");
  }
  if (!canManageBlogPost(user, post.authorId)) throw Object.assign(new Error("Bạn không có quyền sửa hoặc xóa bài viết của tác giả khác."), { status: 403 });

  post.isDeleted = true;
  await post.save();

  try {
    const { emitToCompany, broadcastEvent } = await import("../socket");
    const payload = { postId: post._id };
    if (post.companyCode === "SYSTEM") {
      broadcastEvent("blog_post_deleted", payload);
    } else {
      emitToCompany(post.companyCode, "blog_post_deleted", payload);
    }
  } catch (socketError) {
    logger.warn("[BlogPostService] Emit socket failed:", socketError);
  }

  return { id: post._id, success: true };
}

export async function getBlogChannelInfo(companyCode: string, user?: any) {
  const code = (companyCode || "SYSTEM").toUpperCase().trim();
  const query: any = { isDeleted: false, ...await blogVisibilityFilter(user?.id || user?._id || user?.uid) };

  const [totalPosts, pinnedPostsCount] = await Promise.all([
    BlogPostModel.countDocuments(query),
    BlogPostModel.countDocuments({ ...query, isPinned: true }),
  ]);

  const canPost = canUserPostBlog(user);

  return {
    channelName: "Kênh Bảng Tin & Blog Doanh Nghiệp",
    companyCode: code,
    totalPosts,
    pinnedPostsCount,
    canPost,
    userRole: user?.role || "user",
  };
}

export async function getPost(postId: string, user: any) {
  if (!Types.ObjectId.isValid(postId)) throw Object.assign(new Error("Không tìm thấy bài viết"), { status: 404 });
  const post = await BlogPostModel.findOne({ _id: postId, isDeleted: false }).lean();
  if (!post) throw Object.assign(new Error("Không tìm thấy bài viết"), { status: 404 });
  const userId = String(user?.id || user?._id || user?.uid || "");
  await assertBlogAuthorVisible(userId, post.authorId);
  const item = { ...post, attachments: serializeBlogAttachments(post), id: post._id, attachmentsPublic: post.attachmentsPublic === undefined ? true : post.attachmentsPublic === true,
    likesCount: post.likes?.length || 0, isLiked: post.likes?.some(id => String(id) === userId) || false };
  const [decorated] = await annotateHistoricalRecords(post.companyCode, [item], "authorId", "authorName", "authorDeleted");
  return decorated;
}

export async function updateAttachmentVisibility(postId: string, user: any, attachmentsPublic: boolean) {
  if (!canUserPostBlog(user)) throw Object.assign(new Error("Bạn không có quyền sửa bài viết"), { status: 403 });
  if (typeof attachmentsPublic !== "boolean") throw Object.assign(new Error("Quyền tệp không hợp lệ"), { status: 400 });
  if (!Types.ObjectId.isValid(postId)) throw Object.assign(new Error("Không tìm thấy bài viết"), { status: 404 });
  const post = await BlogPostModel.findOneAndUpdate({ _id: postId, isDeleted: false, ...(["superadmin", "blog_editor"].includes(user.role) ? {} : { authorId: user.id || user._id || user.uid }) }, { $set: { attachmentsPublic } }, { new: true }).lean();
  if (!post) throw Object.assign(new Error("Không tìm thấy bài viết"), { status: 404 });
  try {
    const { broadcastEvent } = await import("../socket");
    // Blog is readable across companies, so invalidate every reader's snapshot.
    broadcastEvent("blog_post_updated", { postId: String(post._id), attachmentsPublic });
  } catch (error) { logger.warn("[BlogPostService] Emit update failed:", error); }
  return { id: String(post._id), attachmentsPublic };
}

export async function getAttachmentAccess(postId: string, attachmentId: string, userId?: string) {
  if (!Types.ObjectId.isValid(postId) || !Types.ObjectId.isValid(attachmentId))
    throw Object.assign(new Error("Không tìm thấy tệp"), { status: 404 });
  const post = await BlogPostModel.findOne({ _id: postId, isDeleted: false }).lean();
  if (!post) throw Object.assign(new Error("Không tìm thấy bài viết"), { status: 404 });
  if (userId) await assertBlogAuthorVisible(userId, post.authorId);
  if (post.attachmentsPublic !== undefined && post.attachmentsPublic !== true)
    throw Object.assign(new Error("Tệp không công khai. Không cho phép chia sẻ hoặc tải về."), { status: 403 });
  const attachment = post.attachments.find(item => String((item as any)._id) === attachmentId);
  if (!attachment?.url) throw Object.assign(new Error("Không tìm thấy tệp"), { status: 404 });
  return { url: attachment.url };
}
