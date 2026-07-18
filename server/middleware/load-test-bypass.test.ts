import assert from "node:assert/strict";
import test from "node:test";

import { isStagingLoadTestBypass } from "./load-test-bypass.js";

const secret = "0123456789abcdef0123456789abcdef";

test("allows only an exact staging secret outside production", () => {
  assert.equal(isStagingLoadTestBypass({
    nodeEnv: "staging",
    hostname: "staging-erp.igentechsolutions.com",
    configuredSecret: secret,
    providedSecret: secret,
  }), true);
});

test("fails closed for production, wrong host, weak config, or wrong secret", () => {
  const base = {
    nodeEnv: "staging",
    hostname: "staging-erp.igentechsolutions.com",
    configuredSecret: secret,
    providedSecret: secret,
  };
  assert.equal(isStagingLoadTestBypass({ ...base, nodeEnv: "production" }), false);
  assert.equal(isStagingLoadTestBypass({ ...base, hostname: "erp.igentechsolutions.com" }), false);
  assert.equal(isStagingLoadTestBypass({ ...base, configuredSecret: "short" }), false);
  assert.equal(isStagingLoadTestBypass({ ...base, providedSecret: `${secret}x` }), false);
  assert.equal(isStagingLoadTestBypass({ ...base, providedSecret: undefined }), false);
});
