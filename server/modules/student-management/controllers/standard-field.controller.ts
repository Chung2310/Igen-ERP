import type { NextFunction, Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { StandardFieldService } from "../services/standard-field.service";
import { resolveCustomFieldTenant } from "../utils/custom-field.util";
import type { ModuleKey } from "../interfaces/custom-field.interface";

function respondWithStatus(error: unknown, res: Response, next: NextFunction) {
  const status = typeof (error as { status?: unknown })?.status === "number"
    ? (error as { status: number }).status
    : undefined;
  if (status) res.status(status).json({ success: false, error: (error as Error).message });
  else next(error);
}

export class StandardFieldController {
  static service = new StandardFieldService();

  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tenantId = await resolveCustomFieldTenant(req.user!, req.query?.tenantId);
      const data = await StandardFieldController.service.list(tenantId, req.params.moduleKey as ModuleKey);
      res.json({ success: true, data });
    } catch (error) {
      respondWithStatus(error, res, next);
    }
  }

  static async replace(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tenantId = await resolveCustomFieldTenant(req.user!, req.query?.tenantId);
      const data = await StandardFieldController.service.replace(
        { tenantId, actorId: req.user!.uid },
        req.params.moduleKey as ModuleKey,
        req.body.fields,
      );
      res.json({ success: true, data });
    } catch (error) {
      respondWithStatus(error, res, next);
    }
  }
}
