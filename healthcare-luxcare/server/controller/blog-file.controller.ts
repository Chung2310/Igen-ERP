import type { AuthenticatedRequest } from "../middleware/auth";
import { Request, Response } from "express";
import { openBlogFile, uploadBlogFile } from "../service/blog-file.service";
export async function upload(req: Request & { user?: any }, res: Response) {
  try { return res.status(201).json({ data: await uploadBlogFile(req.user, req.body) }); }
  catch (error: any) { return res.status(error.status || 500).json({ message: error.message }); }
}
async function sendFile(req: AuthenticatedRequest, res: Response, preview: boolean) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
  try {
    const { file, bytes } = await openBlogFile(req.params.id, preview, req.user?.id);
    const mime = /^(image\/(png|jpeg|gif|webp)|video\/(mp4|webm)|application\/pdf)$/.test(file.mimeType) ? file.mimeType : "application/octet-stream";
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", (preview ? "inline" : "attachment") + "; filename*=UTF-8''" + encodeURIComponent(file.name));
    return res.send(bytes);
  } catch (error: any) { return res.status(error.status || 500).json({ message: error.message }); }
}
export const preview = (req: Request, res: Response) => sendFile(req, res, true);
export const download = (req: Request, res: Response) => sendFile(req, res, false);
