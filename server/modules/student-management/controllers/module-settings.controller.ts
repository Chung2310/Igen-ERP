import type { NextFunction, Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { ModuleSettingsService } from "../services/module-settings.service";
import { resolveCustomFieldTenant } from "../utils/custom-field.util";
import { emitToCompany } from "../../../socket";

export class ModuleSettingsController {
  static service = new ModuleSettingsService();

  static async get(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tenantId = await resolveCustomFieldTenant(req.user!, req.query?.tenantId);
      const data = await ModuleSettingsController.service.get(tenantId);
      res.json({ success: true, data });
    } catch (error) {
      const status = typeof (error as { status?: unknown })?.status === "number" ? (error as { status: number }).status : undefined;
      if (status) res.status(status).json({ success: false, error: (error as Error).message });
      else next(error);
    }
  }

  static async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tenantId = await resolveCustomFieldTenant(req.user!, req.query?.tenantId);
      const data = await ModuleSettingsController.service.update(
        { tenantId, actorId: req.user!.uid },
        req.body.entityPreset,
      );
      emitToCompany(tenantId, "entity_preset_changed", { entityPreset: data.entityPreset });
      res.json({ success: true, data });
    } catch (error) {
      const status = typeof (error as { status?: unknown })?.status === "number" ? (error as { status: number }).status : undefined;
      if (status) res.status(status).json({ success: false, error: (error as Error).message });
      else next(error);
    }
  }
}
