import { LeadIntakeProfileModel } from "../model/lead-intake-profile.model";

export async function readLeadIntakeProfiles(
  companyCode: string,
  platform: "facebook" | "zalo" | "tiktok",
  accountId: string,
) {
  const profiles = await LeadIntakeProfileModel.find({
    companyCode,
    status: "active",
    $or: [{ platform, accountId }, { platform: { $exists: false } }],
  }).sort({ version: -1 }).lean();
  return {
    account: profiles.find(profile => profile.platform === platform && profile.accountId === accountId),
    company: profiles.find(profile => !profile.platform),
  };
}
