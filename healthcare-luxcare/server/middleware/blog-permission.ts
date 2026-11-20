import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./auth";

/**
 * Kiểm tra xem người dùng có Role đặc biệt hoặc Quyền được phép đăng bài/tin nhắn blog hay không.
 * Các tài khoản admin khác hoặc nhân viên thông thường chỉ có quyền xem (Read-only).
 */
export function canUserPostBlog(user?: any): boolean {
  if (!user) return false;

  const role = String(user.role || "").toLowerCase();
  // Role đặc biệt được quyền đăng blog
  if (
    role === "blog_editor" ||
    role === "blog_author" ||
    role === "content_creator" ||
    role === "superadmin"
  ) {
    return true;
  }

  // Cờ quyền cụ thể hoặc quyền trong mảng permissions
  if (user.canPostBlog === true) {
    return true;
  }

  const permissions: string[] = Array.isArray(user.permissions) ? user.permissions : [];
  if (
    permissions.includes("blog:post") ||
    permissions.includes("blog:publish") ||
    permissions.includes("blog:manage") ||
    permissions.includes("*")
  ) {
    return true;
  }

  return false;
}

export function requireBlogPoster(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      status: "error",
      message: "Vui lòng đăng nhập để thực hiện thao tác này",
    });
  }

  if (!canUserPostBlog(req.user)) {
    return res.status(403).json({
      status: "error",
      message:
        "Bạn không có quyền gửi tin nhắn trong Kênh Blog chung. Chỉ tài khoản Ban biên tập/Tác giả đặc biệt mới có quyền này.",
      code: "FORBIDDEN_BLOG_POSTER_ONLY",
    });
  }

  next();
}

export function canManageBlogPost(user: { role?: string; id?: string; _id?: unknown; uid?: string }, authorId: unknown) {
  return ["superadmin", "blog_editor"].includes(user?.role || "") ||
    (canUserPostBlog(user) && String(user?.id || user?._id || user?.uid || "") === String(authorId));
}
