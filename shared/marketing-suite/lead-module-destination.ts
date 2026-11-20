import type { LeadTargetModule } from "./lead-intake";

export const leadModuleTargets = [
  { value: "students", moduleKey: "student", label: "Đào tạo · Học viên" },
  { value: "healthcare", moduleKey: "healthcare", label: "Y tế · Bệnh nhân" },
  { value: "workers", moduleKey: "worker", label: "Quản lý lao động" },
] as const satisfies ReadonlyArray<{ value: LeadTargetModule; moduleKey: string; label: string }>;

export const leadDestinationPlatforms = ["facebook", "zalo"] as const;
export type LeadDestinationPlatform = typeof leadDestinationPlatforms[number];

export type LeadModuleDestination = {
  targetModule: LeadTargetModule | null;
  availableModules: LeadTargetModule[];
};

export type LeadDestinationChannel = {
  platform: LeadDestinationPlatform;
  accountId: string;
  displayName: string;
  targetModule: LeadTargetModule | null;
};

export type LeadDestinationSettings = Pick<LeadModuleDestination, "availableModules"> & {
  channels: LeadDestinationChannel[];
};
