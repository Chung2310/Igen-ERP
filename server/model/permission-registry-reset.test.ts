import { describe, expect, it, vi } from "vitest";
import { PERMISSION_REGISTRY_RESET_VERSION, resetPermissionsForRegistryVersion } from "./permission-registry-reset";

describe("permission registry clean-break reset", () => {
  it("clears role and non-superadmin user permissions exactly once", async () => {
    const markers = { insertOne: vi.fn().mockResolvedValue({}), deleteOne: vi.fn() };
    const roles = { updateMany: vi.fn().mockResolvedValue({ modifiedCount: 3 }) };
    const users = { updateMany: vi.fn().mockResolvedValue({ modifiedCount: 8 }) };

    const result = await resetPermissionsForRegistryVersion({ markers, roles, users });

    expect(roles.updateMany).toHaveBeenCalledWith({}, { $set: { permissions: [] } });
    expect(users.updateMany).toHaveBeenCalledWith({ role: { $ne: "superadmin" } }, { $set: { permissions: [] } });
    expect(markers.insertOne).toHaveBeenCalledWith(expect.objectContaining({ _id: PERMISSION_REGISTRY_RESET_VERSION }));
    expect(result).toEqual({ applied: true, rolesReset: 3, usersReset: 8 });
  });

  it("does nothing after the version marker exists", async () => {
    const duplicate = Object.assign(new Error("duplicate"), { code: 11000 });
    const markers = { insertOne: vi.fn().mockRejectedValue(duplicate), deleteOne: vi.fn() };
    const roles = { updateMany: vi.fn() };
    const users = { updateMany: vi.fn() };

    await expect(resetPermissionsForRegistryVersion({ markers, roles, users })).resolves.toEqual({ applied: false, rolesReset: 0, usersReset: 0 });
    expect(roles.updateMany).not.toHaveBeenCalled();
    expect(users.updateMany).not.toHaveBeenCalled();
  });
});
