import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import * as service from "../service/blog-post.service";

export async function listPosts(req: AuthenticatedRequest, res: Response) {
  try {
    const companyCode = req.user?.companyCode || "SYSTEM";
    const { tag, search, page, limit } = req.query;

    const result = await service.listPosts({
      companyCode,
      tag: tag as string,
      search: search as string,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      currentUserId: req.user?.id || (req.user as any)?._id || (req.user as any)?.uid,
      currentUserRole: req.user?.role,
    });

    return res.status(200).json({ status: "success", data: result });
  } catch (error: any) {
    return res.status(500).json({
      status: "error",
      message: error.message || "Lỗi khi tải danh sách bài viết blog",
    });
  }
}

export async function createPost(req: AuthenticatedRequest, res: Response) {
  try {
    const post = await service.createPost(req.user, req.body);
    return res.status(201).json({
      status: "success",
      message: "Đăng bài viết lên Kênh Blog thành công",
      data: post,
    });
  } catch (error: any) {
    return res.status(400).json({
      status: "error",
      message: error.message || "Lỗi khi đăng bài viết",
    });
  }
}

export async function togglePinPost(req: AuthenticatedRequest, res: Response) {
  try {
    const companyCode = req.user?.companyCode || "SYSTEM";
    const result = await service.togglePinPost(companyCode, req.params.id, req.user);
    return res.status(200).json({ status: "success", data: result });
  } catch (error: any) {
    return res.status(400).json({
      status: "error",
      message: error.message || "Lỗi khi ghim bài viết",
    });
  }
}

export async function toggleLikePost(req: AuthenticatedRequest, res: Response) {
  try {
    const companyCode = req.user?.companyCode || "SYSTEM";
    const userId = req.user?.id || (req.user as any)?._id || (req.user as any)?.uid;
    if (!userId) {
      return res.status(403).json({ status: "error", message: "Yêu cầu đăng nhập" });
    }

    const result = await service.toggleLikePost(companyCode, req.params.id, String(userId));
    return res.status(200).json({ status: "success", data: result });
  } catch (error: any) {
    return res.status(400).json({
      status: "error",
      message: error.message || "Lỗi khi thích bài viết",
    });
  }
}

export async function deletePost(req: AuthenticatedRequest, res: Response) {
  try {
    const companyCode = req.user?.companyCode || "SYSTEM";
    const result = await service.deletePost(companyCode, req.params.id, req.user);
    return res.status(200).json({
      status: "success",
      message: "Đã xóa bài viết khỏi Kênh Blog",
      data: result,
    });
  } catch (error: any) {
    return res.status(400).json({
      status: "error",
      message: error.message || "Lỗi khi xóa bài viết",
    });
  }
}

export async function getChannelInfo(req: AuthenticatedRequest, res: Response) {
  try {
    const companyCode = req.user?.companyCode || "SYSTEM";
    const info = await service.getBlogChannelInfo(companyCode, req.user);
    return res.status(200).json({ status: "success", data: info });
  } catch (error: any) {
    return res.status(500).json({
      status: "error",
      message: error.message || "Lỗi khi lấy thông tin kênh",
    });
  }
}

export async function getPost(req: AuthenticatedRequest, res: Response) {
  try {
    res.setHeader("Cache-Control", "no-store");
    return res.json({ status: "success", data: await service.getPost(req.params.id, req.user) });
  } catch (error: any) { return res.status(error.status || 500).json({ status: "error", message: error.message }); }
}
export async function updateAttachmentVisibility(req: AuthenticatedRequest, res: Response) {
  try {
    const data = await service.updateAttachmentVisibility(req.params.id, req.user, req.body.attachmentsPublic);
    return res.json({ status: "success", data });
  } catch (error: any) { return res.status(error.status || 500).json({ status: "error", message: error.message }); }
}
export async function getAttachmentAccess(req: AuthenticatedRequest, res: Response) {
  try {
    res.setHeader("Cache-Control", "no-store");
    return res.json({ status: "success", data: await service.getAttachmentAccess(req.params.id, req.params.attachmentId, req.user?.id) });
  } catch (error: any) { return res.status(error.status || 500).json({ status: "error", message: error.message }); }
}
