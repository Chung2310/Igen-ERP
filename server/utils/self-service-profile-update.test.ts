import assert from "node:assert/strict";
import test from "node:test";
import { pickSelfServiceProfileUpdate } from "./self-service-profile-update";

test("retains integrations accepted by the self-service profile schema", () => {
  const zaloIntegration = { isConnected: true, oaId: "oa-1" };
  const aiAutoReplyConfig = { enabled: true, autoClassify: true };

  assert.deepEqual(
    pickSelfServiceProfileUpdate({ zaloIntegration, aiAutoReplyConfig }),
    { zaloIntegration, aiAutoReplyConfig },
  );
});

test("discards privilege-sensitive and unknown fields", () => {
  assert.deepEqual(
    pickSelfServiceProfileUpdate({
      displayName: "Safe Name",
      role: "superadmin",
      companyCode: "OTHER",
      level: 1,
      parentId: "admin-1",
      unknownField: "ignored",
    }),
    { displayName: "Safe Name" },
  );
});
