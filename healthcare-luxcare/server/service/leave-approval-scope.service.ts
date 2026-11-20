export interface LeaveScope {
  companyCode: string;
  branchId?: string;
}

export interface LeaveActor extends LeaveScope {
  id: string;
  role: string;
}

interface ScopedUser {
  _id: unknown;
  companyCode: string;
  branchId?: string;
  role?: string;
  isDeleted?: boolean;
  parentId?: unknown;
}

interface LeaveApprovalScopeDependencies {
  listUsers(scope: LeaveScope): Promise<ScopedUser[]>;
}

const idOf = (value: unknown) => String(value || "");
const isAdmin = (role: string) => role === "admin" || role === "superadmin";
function isAncestor(users: Map<string, ScopedUser>, actorId: string, employeeId: string): boolean {
  const visited = new Set<string>([employeeId]);
  let parentId = idOf(users.get(employeeId)?.parentId);
  let actorFound = false;
  while (parentId) {
    if (visited.has(parentId)) return false;
    visited.add(parentId);
    if (parentId === actorId) actorFound = true;
    parentId = idOf(users.get(parentId)?.parentId);
  }
  return actorFound;
}

export function createLeaveApprovalScopeService(deps: LeaveApprovalScopeDependencies) {
  async function scopedUsers(actor: LeaveActor) {
    const users = await deps.listUsers({ companyCode: actor.companyCode, branchId: actor.branchId });
    return new Map(users.map((user) => [idOf(user._id), user]));
  }

  return {
    async canDecide(actor: LeaveActor, employeeId: string): Promise<boolean> {
      if (!employeeId || employeeId === actor.id) return false;
      const users = await scopedUsers(actor);
      const employee = users.get(employeeId);
      if (!employee || employee.isDeleted) return false;
      if (isAdmin(actor.role)) return true;

      return isAncestor(users, actor.id, employeeId);
    },

    async visibleEmployeeIds(actor: LeaveActor): Promise<string[]> {
      const users = await scopedUsers(actor);
      if (isAdmin(actor.role)) return [...users.keys()];
      return [...users.keys()].filter((id) => id === actor.id || isAncestor(users, actor.id, id));
    },
  };
}
