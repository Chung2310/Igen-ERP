import { strict as assert } from "node:assert";
import test from "node:test";
import { getAdminAction } from "./action-registry";

test("user access mutations are registered as audited actions", () => {
  for (const type of ["user.access.lock", "user.access.unlock", "security.2fa.reset", "user.access.role.assign", "security.impersonation.start", "security.impersonation.stop"]) {
    const action = getAdminAction(type);
    assert.equal(action.requiresReason, true);
  }
  assert.equal(getAdminAction("security.2fa.reset").requiresStepUp, true);
});
