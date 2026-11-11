import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
const nodeTests = readdirSync("server/modules/quotation").filter(file => file.endsWith(".node-test.ts")).map(file => `server/modules/quotation/${file}`);
for (const args of [
  ["--import", "tsx", "--test", "--test-concurrency=4", ...nodeTests],
  ["node_modules/vitest/vitest.mjs", "run", "server/modules/quotation", "src/modules/quotation", "server/config/resource-source-registry.test.ts", "server/config/business-permission-catalog.test.ts", "--exclude", "tmp/**", "--maxWorkers=2", "--testTimeout=30000", "--hookTimeout=120000"],
]) {
  const result = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}
