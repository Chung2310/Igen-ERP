import { beforeEach, describe, expect, it, vi } from "vitest";

const updateMany = vi.hoisted(() => vi.fn());

vi.mock("../models/marketing-delivery.model", () => ({
  MarketingDeliveryModel: { updateMany },
}));

const { MARKETING_STALE_DELIVERY_ERROR, MARKETING_STALE_DELIVERY_MS, recoverStaleMarketingDeliveries } =
  await import("./marketing-delivery.service");

describe("recoverStaleMarketingDeliveries", () => {
  beforeEach(() => updateMany.mockReset().mockResolvedValue({ modifiedCount: 2 }));

  it("marks only old sending rows as uncertain failures without resending", async () => {
    const now = new Date("2026-11-20T12:00:00.000Z");

    await expect(recoverStaleMarketingDeliveries(now)).resolves.toBe(2);

    expect(updateMany).toHaveBeenCalledWith(
      { status: "sending", updatedAt: { $lte: new Date(now.getTime() - MARKETING_STALE_DELIVERY_MS) } },
      { $set: { status: "failed", error: MARKETING_STALE_DELIVERY_ERROR } },
    );
  });
});
