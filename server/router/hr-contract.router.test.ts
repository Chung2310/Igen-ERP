import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./hr-contract.router.ts", import.meta.url), "utf8");

describe("HR contract router permissions", () => {
  it("allows hr:read to list contracts and extensions", () => {
    expect(source).toMatch(/hrContractRouter\.get\(\s*"\/",\s*requirePermission\("hr:read"\)/);
    expect(source).toMatch(/hrContractRouter\.get\(\s*"\/extensions\/list",\s*requirePermission\("hr:read"\)/);
  });

  it("requires hr:manage for upload and contract mutations", () => {
    expect(source).toMatch(/hrContractRouter\.post\(\s*"\/upload",\s*requirePermission\("hr:manage"\)/);
    expect(source).toMatch(/hrContractRouter\.post\(\s*"\/",\s*requirePermission\("hr:manage"\)/);
    expect(source).toMatch(/hrContractRouter\.patch\(\s*"\/:id",\s*requirePermission\("hr:manage"\)/);
    expect(source).toMatch(/hrContractRouter\.post\(\s*"\/:id\/extensions",\s*requirePermission\("hr:manage"\)/);
    expect(source).not.toContain('requirePermission("access:manage")');
  });
});
