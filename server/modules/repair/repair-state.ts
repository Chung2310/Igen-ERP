export type RepairStatus = "received" | "diagnosing" | "quoted" | "approved" | "repairing" | "waiting_parts" | "waiting_supplier" | "done" | "delivered" | "cancelled" | "returned";

const allowed: Record<RepairStatus, RepairStatus[]> = {
  received: ["diagnosing", "returned", "cancelled"], diagnosing: ["quoted", "repairing", "returned", "cancelled"], quoted: ["approved", "cancelled"], approved: ["repairing", "cancelled"], repairing: ["waiting_parts", "waiting_supplier", "done", "returned"], waiting_parts: ["repairing", "cancelled"], waiting_supplier: ["repairing", "returned"], done: ["delivered", "repairing"], delivered: [], cancelled: [], returned: [],
};

export function assertRepairTransition(from: RepairStatus, to: RepairStatus) {
  if (!allowed[from]?.includes(to)) throw new Error(`Invalid repair transition: ${from} -> ${to}`);
}

export function pausesSla(status: RepairStatus) { return status === "waiting_parts" || status === "waiting_supplier"; }
