import { cpSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "server", "assets", "fonts");
const target = join(root, "dist-server", "server", "assets", "fonts");

mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });
