import { Schema, model } from "mongoose";

export const ENTITY_PRESETS = [
  "student",
  "candidate",
  "customer",
  "worker",
] as const;
export type EntityPreset = (typeof ENTITY_PRESETS)[number];

export interface IModuleSettings {
  tenantId: string;
  entityPreset: EntityPreset;
  updatedBy: string;
}

export const moduleSettingsSchema = new Schema<IModuleSettings>(
  {
    tenantId: { type: String, required: true, trim: true, unique: true },
    entityPreset: {
      type: String,
      required: true,
      enum: ENTITY_PRESETS,
      default: "student",
    },
    updatedBy: { type: String, required: true },
  },
  { timestamps: true },
);

export const ModuleSettings = model<IModuleSettings>(
  "WorkerModuleSettings",
  moduleSettingsSchema,
  "studentmodulesettings",
);
