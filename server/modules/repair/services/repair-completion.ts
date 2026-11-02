/** Historical delivered tickets may lack completedAt. Resolve at read time only. */
export function repairCompletionFilter(from: Date, to: Date) {
  return {
    status: { $in: ["done" as const, "delivered" as const] },
    $or: [
      { completedAt: { $gte: from, $lte: to } },
      { status: "delivered" as const, completedAt: null, deliveredAt: { $gte: from, $lte: to } },
    ],
  };
}
