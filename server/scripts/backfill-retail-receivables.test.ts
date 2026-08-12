import assert from "node:assert/strict";
import test from "node:test";
import { parseBackfillOptions } from "./backfill-retail-receivables";
test("backfill CLI accepts documented separated scope arguments", () => { assert.deepEqual(parseBackfillOptions(["--dry-run", "--company", "TEST", "--branch", "B1"]), { apply: false, companyCode: "TEST", branchId: "B1" }); assert.deepEqual(parseBackfillOptions(["--apply", "--company=TEST", "--branch=B1"]), { apply: true, companyCode: "TEST", branchId: "B1" }); });
