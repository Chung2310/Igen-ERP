import { Schema, model } from "mongoose";
import { leadDestinationPlatforms, leadModuleTargets } from "../../../../../shared/marketing-suite/lead-module-destination";

const schema = new Schema({
  companyCode: { type: String, required: true },
  platform: { type: String, enum: leadDestinationPlatforms, required: true },
  accountId: { type: String, required: true },
  targetModule: { type: String, enum: leadModuleTargets.map(target => target.value), required: true },
});

schema.index({ companyCode: 1, platform: 1, accountId: 1 }, { unique: true });

export const LeadModuleDestinationModel = model("LeadModuleDestination", schema);
