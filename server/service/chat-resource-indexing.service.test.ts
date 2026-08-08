import { describe, expect, it, vi } from "vitest";
import { createChatResourceIndexingService } from "./chat-resource-indexing.service";

describe("ChatResourceIndexingService", () => {
  it("finalizes message attachments with room membership inherited as the source audience", async () => {
    const finalize = vi.fn(async () => []);
    const service = createChatResourceIndexingService({ finalize });

    await service.finalizeMessage({ companyCode: "ACME", actorId: "sender-1" }, {
      _id: "message-1",
      attachments: [{ uploadToken: "token-1" }],
    }, {
      _id: "room-1",
      name: "Finance Team",
      members: [{ userId: "sender-1" }, { userId: { _id: "user-2" } }],
    });

    expect(finalize).toHaveBeenCalledWith(
      expect.objectContaining({ companyCode: "ACME", actorId: "sender-1" }),
      expect.objectContaining({
        entityType: "chat-room",
        entityId: "room-1",
        entityLabel: "Finance Team",
        sourceRecordId: "message-1",
        sourceAudienceIds: ["sender-1", "user-2"],
        uploads: [{ uploadToken: "token-1", sourceField: "attachments.0" }],
      }),
    );
  });
});
