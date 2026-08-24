import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("build script copies runtime font assets into dist-server", () => {
  const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.match(packageJson.scripts.build, /tools\/copy-runtime-assets\.mjs/);
});

test("production image includes server font assets needed for invoice PDFs", () => {
  const dockerfile = readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
  assert.match(dockerfile, /COPY --from=builder \/app\/server\/assets\/fonts \.\/server\/assets\/fonts/);
});
