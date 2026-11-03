/** Restrict the employee data exposed to users whose only roster permission is attendance. */
export function toAttendanceRosterProfile(user: any) {
  const profile = typeof user?.toObject === "function" ? user.toObject() : user;
  const uid = String(profile?._id || profile?.uid || "");

  return {
    _id: uid,
    uid,
    displayName: profile?.displayName || "",
    email: profile?.email || "",
    photoURL: profile?.photoURL || "",
    role: profile?.role || "user",
    branchId: profile?.branchId ? String(profile.branchId) : undefined,
  };
}
