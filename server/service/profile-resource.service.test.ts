import { describe, expect, it, vi } from "vitest";
import { createProfileResourceService } from "./profile-resource.service";

describe("ProfileResourceService", () => {
  it("finalizes an avatar only after the user profile has been persisted", async () => {
    const finalize = vi.fn(async () => []);
    const service = createProfileResourceService({ finalize });

    await service.finalizeAvatar(
      { companyCode: "ACME", branchId: "branch-1", actorId: "user-1" },
      { _id: "user-1", displayName: "Nguyen A" },
      "avatar-token",
    );

    expect(finalize).toHaveBeenCalledWith(
      expect.objectContaining({ companyCode: "ACME", actorId: "user-1" }),
      {
        entityType: "user",
        entityId: "user-1",
        entityLabel: "Nguyen A",
        sourceRecordId: "user-1",
        uploads: [{ uploadToken: "avatar-token", sourceField: "photoURL" }],
      },
    );
  });
});
