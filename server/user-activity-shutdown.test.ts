import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("server flushes queued user activity during graceful shutdown", () => {
  const middleware = fs.readFileSync("server/middleware/user-activity.ts", "utf8");
  const server = fs.readFileSync("server.ts", "utf8");

  assert.match(middleware, /export\s+function\s+flushUserActivityQueue\s*\(/);
  assert.match(server, /process\.once\("SIGTERM"/);
  assert.match(server, /process\.once\("SIGINT"/);
  assert.match(server, /await\s+flushUserActivityQueue\(\)/);
});
