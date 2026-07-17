import { randomUUID } from "node:crypto";
import { AuditEventModel, type AuditEventInsert } from "../model/audit-event.model";
import { getDeploymentEnv } from "../config/env";

export const auditService = {
  async record(event: Partial<AuditEventInsert> & Pick<AuditEventInsert, "actionType" | "actorSuperAdminId" | "result">, options?: any) {
    return AuditEventModel.create({
      eventId: randomUUID(), correlationId: event.correlationId || randomUUID(),
      riskClass: event.riskClass || "sensitive", environment: event.environment || getDeploymentEnv(),
      occurredAt: event.occurredAt || new Date(), ...event,
    } as AuditEventInsert, options);
  },
};
