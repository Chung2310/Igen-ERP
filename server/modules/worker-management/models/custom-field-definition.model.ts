import { Schema, model } from "mongoose";
import {
  DYNAMIC_FIELD_TYPES,
  IFieldDefinition,
  MODULE_KEYS,
} from "../interfaces/custom-field.interface";

export const customFieldDefinitionSchema = new Schema<IFieldDefinition>(
  {
    tenantId: { type: String, required: true, trim: true },
    moduleKey: { type: String, required: true, enum: MODULE_KEYS },
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    type: { type: String, required: true, enum: DYNAMIC_FIELD_TYPES },
    placeholder: { type: String, trim: true },
    defaultValue: { type: Schema.Types.Mixed },
    options: [
      {
        label: { type: String, required: true },
        value: { type: String, required: true },
      },
    ],
    validation: { type: Schema.Types.Mixed },
    isVisible: { type: Boolean, required: true, default: true },
    isRequired: { type: Boolean, required: true, default: false },
    isArchived: { type: Boolean, required: true, default: false },
    order: { type: Number, required: true, default: 0 },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true },
  },
  { timestamps: true },
);

customFieldDefinitionSchema.index(
  { tenantId: 1, moduleKey: 1, key: 1 },
  { unique: true },
);
customFieldDefinitionSchema.index({
  tenantId: 1,
  moduleKey: 1,
  isArchived: 1,
  order: 1,
});

export const CustomFieldDefinition = model<IFieldDefinition>(
  "WorkerCustomFieldDefinition",
  customFieldDefinitionSchema,
  "customfielddefinitions",
);
