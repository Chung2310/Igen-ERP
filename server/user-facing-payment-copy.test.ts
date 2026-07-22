import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const userFacingFiles = [
  "src/pages/WalletTab.tsx",
  "src/pages/Header.tsx",
  "src/pages/Sidebar.tsx",
  "src/seo/seo-config.ts",
];

test("user-facing payment copy does not expose the PayOS provider name", () => {
  for (const file of userFacingFiles) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /["'`][^"'`\r\n]*payos[^"'`\r\n]*["'`]/i, file);
  }

  const walletController = readFileSync("server/controller/wallet.controller.ts", "utf8");
  assert.doesNotMatch(walletController, /message\s*:\s*["'`]Lỗi kết nối[^"'`]*payos/i);
});
