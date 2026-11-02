import { Router } from "express";
import { activityMonitorService } from "../super-admin/activity-monitor.service";

// Mounted after all real-Super-Admin, privileged-session and permission guards.
export function createActivityMonitorRouter(service = activityMonitorService) {
  const router = Router();
  for (const [path, handler] of [
    ["/activity/events", (query: Record<string, unknown>) => service.list(query)],
    ["/activity/accounts", (query: Record<string, unknown>) => service.accounts(query)],
  ] as const) {
    router.get(path, async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      try { return res.json(await handler(req.query)); }
      catch (error) { return res.status(400).json({ message: error instanceof Error ? error.message : "Không thể tải hoạt động." }); }
    });
  }
  return router;
}
