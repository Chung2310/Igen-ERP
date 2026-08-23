import { EntityPreset, ModuleSettings } from "../models/module-settings.model";
import mongoose from "mongoose";

export type ModuleSettingsContext = { tenantId: string; actorId: string };
export type ModuleSettingsView = { tenantId: string; entityPreset: EntityPreset };

export class ModuleSettingsService {
  async get(tenantId: string): Promise<ModuleSettingsView> {
    const existing = await ModuleSettings.findOne({ tenantId });
    
    const company = await mongoose.connection.db.collection("companies").findOne({ code: tenantId.toUpperCase() });
    const businessType = company?.businessType || "education";
    
    let entityPreset = existing?.entityPreset;
    if (businessType === "education" && entityPreset !== "student") {
      entityPreset = "student";
    } else if (businessType === "labor" && entityPreset !== "worker") {
      entityPreset = "worker";
    } else if (!entityPreset) {
      entityPreset = "student";
    }
    
    return { tenantId, entityPreset: entityPreset as EntityPreset };
  }

  async update(context: ModuleSettingsContext, entityPreset: EntityPreset): Promise<ModuleSettingsView> {
    const updated = await ModuleSettings.findOneAndUpdate(
      { tenantId: context.tenantId },
      { $set: { entityPreset, updatedBy: context.actorId } },
      { returnDocument: 'after', upsert: true, runValidators: true },
    );
    return { tenantId: context.tenantId, entityPreset: updated!.entityPreset };
  }
}
