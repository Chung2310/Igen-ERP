import Joi from "joi";
import { ENTITY_PRESETS } from "../models/module-settings.model";

export const updateModuleSettingsSchema = Joi.object({
  entityPreset: Joi.string()
    .valid(...ENTITY_PRESETS)
    .required(),
});
