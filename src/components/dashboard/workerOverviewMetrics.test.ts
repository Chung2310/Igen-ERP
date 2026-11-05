import { describe, expect, it } from "vitest";
import { workerDistributions } from "./workerOverviewMetrics";
import type { Worker } from "../../modules/worker-management/types";

const worker = (laborType: Worker["laborType"], partnerName?: string): Worker => ({
  _id: `${laborType}-${partnerName}`, fullName: "Lao động", status: "active", laborType, partnerName,
});

describe("workerDistributions", () => {
  it("thống kê loại lao động và nguồn đối tác, không tạo dữ liệu quốc tịch", () => {
    const result = workerDistributions([worker("official", "A"), worker("seasonal", "A"), worker("foreign", "B"), worker(undefined)]);
    expect(result.types).toEqual({ official: 1, seasonal: 1, foreign: 1, unknown: 1 });
    expect(result.partners).toEqual([{ name: "A", count: 2 }, { name: "B", count: 1 }]);
    expect(result).not.toHaveProperty("nationalities");
  });
});
