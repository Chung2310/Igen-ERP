import { Router, type RequestHandler } from "express";
import { requirePermission } from "../../../middleware/auth";
import { route } from "./http";
import { atomic, collection, scope, find, conflict, replace } from "./store";
import { id, input, revisionInput } from "./validation";
export const equipmentExtraRouter = Router();
equipmentExtraRouter.get(
  "/overview/equipment",
  requirePermission("healthcare:read") as RequestHandler,
  route(async (_req, res, db, actor) => {
    const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
    const soon = new Date(Date.now() + 30 * 86400000 + 7 * 3600000).toISOString().slice(0, 10);
    const [stats] = await collection(db, "equipment")
      .aggregate([
        { $match: { ...scope(actor), deletedAt: { $exists: false } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            available: { $sum: { $cond: [{ $eq: ["$status", "available"] }, 1, 0] } },
            inUse: { $sum: { $cond: [{ $eq: ["$status", "in-use"] }, 1, 0] } },
            maintenance: { $sum: { $cond: [{ $eq: ["$status", "maintenance"] }, 1, 0] } },
            overdue: {
              $sum: {
                $cond: [{ $and: [{ $gt: ["$nextInspectionDay", ""] }, { $lt: ["$nextInspectionDay", today] }] }, 1, 0],
              },
            },
            dueSoon: {
              $sum: {
                $cond: [
                  { $and: [{ $gte: ["$nextInspectionDay", today] }, { $lte: ["$nextInspectionDay", soon] }] },
                  1,
                  0,
                ],
              },
            },
          },
        },
        { $project: { _id: 0 } },
      ])
      .toArray();
    res.json(stats || { total: 0, available: 0, inUse: 0, maintenance: 0, overdue: 0, dueSoon: 0 });
  }),
);
equipmentExtraRouter.delete(
  "/equipment/:id",
  requirePermission("healthcare:manage") as RequestHandler,
  route(async (req, res, db, actor) => {
    const equipmentId = input<string>(id, req.params.id),
      revision = input<number>(revisionInput, req.body?.revision);
    await atomic(async (session) => {
      const row = await find(db, "equipment", actor, equipmentId, session);
      if (["in-use", "requested"].includes(row.status)) conflict("Không xóa thiết bị đang mượn hoặc chờ duyệt.");
      // Retain the record for historical requests and inspections.
      await replace(
        db,
        "equipment",
        actor,
        { ...row, status: "retired", deletedAt: new Date().toISOString() } as typeof row,
        revision,
        session,
      );
    });
    res.json({ success: true });
  }),
);
equipmentExtraRouter.delete(
  "/inspections/:id",
  requirePermission("healthcare:manage") as RequestHandler,
  route(async (req, res, db, actor) => {
    const inspectionId = input<string>(id, req.params.id),
      revision = input<number>(revisionInput, req.body?.revision);
    await atomic(async (session) => {
      const row = await find(db, "equipment_inspections", actor, inspectionId, session);
      if (row.revision !== revision) conflict();
      const equipment = await find(db, "equipment", actor, row.equipmentId, session);
      if (["requested", "in-use", "retired"].includes(equipment.status))
        conflict("Không sửa lịch sử của thiết bị đang mượn hoặc ngừng sử dụng.");
      await collection(db, "equipment_inspections").deleteOne(
        { ...scope(actor), _id: inspectionId, revision },
        { session },
      );
      const latest = await collection(db, "equipment_inspections")
        .find({ ...scope(actor), equipmentId: row.equipmentId }, { session })
        .sort({ day: -1, createdAt: -1 })
        .limit(1)
        .next();
      await replace(
        db,
        "equipment",
        actor,
        {
          ...equipment,
          nextInspectionDay: latest?.nextDay || "",
          lastInspectionDay: latest?.day || "",
          lastInspectionResult: latest?.result || "",
          lastInspectionProvider: latest?.provider || "",
          lastInspectionReportUrl: latest?.reportUrl || "",
        },
        equipment.revision,
        session,
      );
    });
    res.json({ success: true });
  }),
);
