import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { recruitmentRouter } from "./recruitment.router";

describe("recruitment router", () => {
  it("is mounted under the recruitment API path", () => {
    const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    expect(source).toContain('apiRouter.use("/recruitment", recruitmentRouter)');
  });

  it("applies auth, HR module, and one recruitment permission before routes", () => {
    const names = (recruitmentRouter as any).stack.slice(0, 3).map((layer: any) => layer.handle.name);
    expect(names[0]).toBe("requireAuth");
    expect(names[1]).toBe("moduleAccessGuard");
    expect(names[2]).toBe("permissionGuard");
    expect((recruitmentRouter as any).stack.some((layer: any) => layer.route?.path === "/applicants/:applicantId/attachments")).toBe(true);
  });
});
