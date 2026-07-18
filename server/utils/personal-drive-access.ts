interface PersonalDriveAccessInput {
  callerId?: string;
  callerRole?: string;
  callerCompanyCode?: string;
  targetUserId: string;
  targetCompanyCode?: string;
}

export function canAccessPersonalDriveTarget({
  callerId,
  callerRole,
  callerCompanyCode,
  targetUserId,
  targetCompanyCode,
}: PersonalDriveAccessInput): boolean {
  if (callerId && String(callerId) === String(targetUserId)) return true;
  if (callerRole === "superadmin") return true;
  return Boolean(callerCompanyCode && targetCompanyCode && callerCompanyCode === targetCompanyCode);
}
