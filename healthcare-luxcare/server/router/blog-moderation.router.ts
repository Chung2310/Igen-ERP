import { blogReportBody, blogModerationBody, blogModerationId as id } from "../validation/blog-moderation.validation";
import { requireRealSuperAdmin, requirePrivilegedSession } from "../middleware/super-admin-auth";
import { Router, type RequestHandler } from "express";
import Joi from "joi";
import { requireAuth, requireRole, type AuthenticatedRequest } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { BLOG_REPORT_STATUSES } from "../../shared/blog-moderation";
import * as moderation from "../service/blog-moderation.service";
const handler =
  (task: (req: AuthenticatedRequest) => Promise<unknown>): RequestHandler =>
  async (req: AuthenticatedRequest, res) => {
    try {
      res.json({ status: "success", data: await task(req) });
    } catch (error) {
      const failure = error as { status?: number; message?: string };
      const status = failure.status || 500;
      res
        .status(status)
        .json({
          status: "error",
          message: status === 500 ? "Không thể hoàn tất thao tác. Vui lòng thử lại." : failure.message,
        });
    }
  };
export const blogModerationRouter = Router();
blogModerationRouter.get(
  "/blocks",
  requireAuth,
  handler((req) => moderation.listBlogBlocks(req.user)),
);
blogModerationRouter.delete(
  "/blocks/:authorId",
  requireAuth,
  validateRequest({ params: Joi.object({ authorId: id }) }),
  handler((req) => moderation.unblockBlogAuthor(req.user, req.params.authorId)),
);
blogModerationRouter.get(
  "/moderation/reports",
  requireAuth,
  requireRole(["superadmin"]),
  requireRealSuperAdmin,
  requirePrivilegedSession,
  validateRequest({
    query: Joi.object({
      status: Joi.string()
        .valid(...BLOG_REPORT_STATUSES)
        .default("pending"),
      page: Joi.number().integer().min(1).max(10000).default(1),
    }),
  }),
  handler((req) => moderation.listBlogReports(req.user, req.query.status as moderationStatus, Number(req.query.page))),
);
type moderationStatus = (typeof BLOG_REPORT_STATUSES)[number];
blogModerationRouter.patch(
  "/moderation/reports/:id",
  requireAuth,
  requireRole(["superadmin"]),
  requireRealSuperAdmin,
  requirePrivilegedSession,
  validateRequest({ params: Joi.object({ id }), body: blogModerationBody }),
  handler((req) => moderation.moderateBlogReport(req.user, req.params.id, req.body)),
);
blogModerationRouter.post(
  "/:id/reports",
  requireAuth,
  validateRequest({ params: Joi.object({ id }), body: blogReportBody }),
  handler((req) => moderation.reportBlogPost(req.user, req.params.id, req.body)),
);
blogModerationRouter.post(
  "/:id/block-author",
  requireAuth,
  validateRequest({ params: Joi.object({ id }), body: Joi.object({}).unknown(false) }),
  handler((req) => moderation.blockBlogAuthor(req.user, req.params.id)),
);
