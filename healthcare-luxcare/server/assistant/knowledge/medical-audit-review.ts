// Reviews apply only to the same extracted content and the same audit finding.
export function retainMedicalAuditReviews(previous: any, contentHash: string, flags: any[], status: string) {
  const sameContent = previous.contentHash === contentHash;
  const auditFlags = flags.map((flag) => {
    const old = sameContent && previous.auditFlags?.find((item: any) =>
      ["id", "type", "severity", "snippet", "message", "suggestedCorrection"].every((key) => item[key] === flag[key]));
    return old?.reviewStatus === "confirmed"
      ? { ...flag, reviewStatus: old.reviewStatus, reviewedBy: old.reviewedBy, reviewedAt: old.reviewedAt, reviewNote: old.reviewNote }
      : flag;
  });
  return {
    auditFlags,
    auditStatus: auditFlags.length > 0 && auditFlags.every((flag) => flag.reviewStatus === "confirmed") ? "verified" : status,
  };
}
