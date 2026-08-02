export type WorkerStatus = "active" | "inactive" | "placed";
export type Worker = { _id: string; fullName: string; phone?: string; email?: string; status: WorkerStatus; note?: string; branchId?: string };
export type WorkerInput = Pick<Worker, "fullName" | "phone" | "email" | "status" | "note" | "branchId">;
