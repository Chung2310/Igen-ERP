import { EntityPreset, ModuleSettings } from "../models/module-settings.model";

export type ModuleSettingsContext = { tenantId: string; actorId: string };
export type ModuleSettingsView = { tenantId: string; entityPreset: EntityPreset };

export class ModuleSettingsService {
  async get(tenantId: string): Promise<ModuleSettingsView> {
    const existing = await ModuleSettings.findOne({ tenantId });
    return { tenantId, entityPreset: existing?.entityPreset ?? "student" };
  }

  async update(context: ModuleSettingsContext, entityPreset: EntityPreset): Promise<ModuleSettingsView> {
    const updated = await ModuleSettings.findOneAndUpdate(
      { tenantId: context.tenantId },
      { $set: { entityPreset, updatedBy: context.actorId } },
      { new: true, upsert: true, runValidators: true },
    );
    return { tenantId: context.tenantId, entityPreset: updated!.entityPreset };
  }
}
