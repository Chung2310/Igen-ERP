import { describe, expect, it, vi } from "vitest";
import * as crudRouterModule from "./crud.router";

const policy = (crudRouterModule as any).CRUD_MODEL_PERMISSION_POLICY;
const supportedModels = (crudRouterModule as any).SUPPORTED_CRUD_MODELS;

describe("generic CRUD permission policy", () => {
  it("defines an explicit read and manage policy for every supported model", () => {
    expect(Array.isArray(supportedModels)).toBe(true);
    expect(policy).toBeDefined();

    for (const modelName of supportedModels) {
      expect(policy[modelName], `missing policy for ${modelName}`).toEqual(
        expect.objectContaining({ read: expect.anything(), manage: expect.anything() }),
      );
    }
  });

  it("assigns HR permissions to training and workflow mutations", () => {
    for (const modelName of ["training-courses", "training-enrollments", "workflows"]) {
      expect(policy[modelName]).toMatchObject({ read: "hr:read", manage: "hr:manage" });
    }
  });

  it("assigns timekeeping management to leave templates and retains leave self-service", () => {
    expect(policy["hr-leave-templates"]).toMatchObject({ manage: "timekeeping:manage" });
    expect(policy["hr-leave-applications"]).toMatchObject({ read: "self-service", manage: "self-service" });
  });

  it("fails closed for a model without a read policy", async () => {
    const guard = (crudRouterModule as any).crudReadPermissionGuard;
    const next = vi.fn();
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await guard({ params: { modelName: "unsupported-model" } }, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
