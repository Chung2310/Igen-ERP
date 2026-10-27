import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

const output = path.resolve("tmp/local-qa");
const nodeOnly = process.argv.includes("--node-only");
await mkdir(output, { recursive: true });
const groups: Record<string, string[]> = { vitest: [], node: [], unrecognized: [] };
for (const root of ["src", "server", "tools"]) {
  for (const entry of await readdir(root, { recursive: true })) {
    if (!/\.test\.tsx?$/.test(entry) || /(?:node_modules|\.worktrees)/.test(entry)) continue;
    const file = path.join(root, entry);
    const contents = await readFile(file, "utf8");
    groups[contents.includes('from "vitest"') || contents.includes("from 'vitest'") ? "vitest" : contents.includes("node:test") ? "node" : "unrecognized"].push(file);
  }
}
await writeFile(path.join(output, "test-inventory.json"), JSON.stringify(groups, null, 2));
console.log(JSON.stringify({ vitestFiles: groups.vitest.length, nodeFiles: groups.node.length, unrecognized: groups.unrecognized }));
const env = { ...process.env, NODE_ENV: "test", DEPLOYMENT_ENV: "staging", DOTENV_CONFIG_PATH: path.join(output, "nonexistent.env"),
  MONGODB_URI: "mongodb://127.0.0.1:27119/igen_qa_regression", MONGODB_USER: "", MONGODB_PASSWORD: "",
  JWT_ACCESS_SECRET: randomBytes(48).toString("hex"), JWT_REFRESH_SECRET: randomBytes(48).toString("hex"),
  SUPERADMIN_ENCRYPTION_KEY: randomBytes(32).toString("hex"), SEED_MOCK_USERS: "false" };
const results: Record<string, number | null> = {};
for (const group of ["vitest", "node"] as const) {
  if (nodeOnly && group === "vitest") continue;
  if (!groups[group].length) continue;
  const args = group === "vitest"
    ? ["node_modules/vitest/vitest.mjs", "run", ...groups[group], "--pool=threads", "--maxWorkers=2", "--reporter=json", `--outputFile=${path.join(output, "vitest-report.json")}`]
    : ["--import", "tsx", "--test", "--test-force-exit", "--test-concurrency=2", "--test-timeout=120000", ...groups[group]];
  const log: string[] = [];
  results[group] = await new Promise<number | null>((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: process.cwd(), env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.on("data", (chunk) => { log.push(chunk.toString()); if (group === "node") process.stdout.write(chunk); });
    child.stderr.on("data", (chunk) => { log.push(chunk.toString()); process.stderr.write(chunk); });
    child.on("error", reject); child.on("exit", resolve);
  });
  await writeFile(path.join(output, `${group}-regression.log`), log.join(""));
  console.log(`${group}: exit ${results[group]}`);
}
await writeFile(path.join(output, "regression-result.json"), JSON.stringify({ at: new Date().toISOString(), files: Object.fromEntries(Object.entries(groups).map(([key, files]) => [key, files.length])), exitCodes: results }, null, 2));
process.exitCode = Object.values(results).some((code) => code !== 0) || groups.unrecognized.length ? 1 : 0;
