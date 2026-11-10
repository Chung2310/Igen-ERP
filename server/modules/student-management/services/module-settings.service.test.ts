import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findOne: vi.fn() }));

vi.mock("../models/module-settings.model", () => ({ ModuleSettings: { findOne: mocks.findOne } }));

import { ModuleSettingsService } from "./module-settings.service";

describe("ModuleSettingsService.get", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns the persisted entity preset for the requested tenant", async () => {
    const lean = vi.fn().mockResolvedValue({ entityPreset: "worker" });
    const select = vi.fn().mockReturnValue({ lean });
    mocks.findOne.mockReturnValue({ select });

    await expect(new ModuleSettingsService().get("company-a")).resolves.toEqual({ tenantId: "company-a", entityPreset: "worker" });
    expect(mocks.findOne).toHaveBeenCalledWith({ tenantId: "company-a" });
    expect(select).toHaveBeenCalledWith("entityPreset");
  });

  it("uses the student preset when the tenant has no saved setting", async () => {
    const lean = vi.fn().mockResolvedValue(null);
    mocks.findOne.mockReturnValue({ select: vi.fn().mockReturnValue({ lean }) });

    await expect(new ModuleSettingsService().get("company-a")).resolves.toEqual({ tenantId: "company-a", entityPreset: "student" });
  });
});
