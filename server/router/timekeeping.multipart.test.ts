import { describe, expect, it } from "vitest";
import { timekeepingRouter } from "./timekeeping.router";

describe("timekeeping multipart routes", () => {
  it.each(["/check-in", "/check-out"])("wires upload and face gate for %s", (path) => {
    const layer: any = (timekeepingRouter as any).stack.find((item: any) => item.route?.path === path);
    expect(layer).toBeDefined();
    const names = layer.route.stack.map((item: any) => item.handle.name);
    expect(names).toContain("multerMiddleware");
    expect(names).toContain("attendanceFaceGate");
  });
});