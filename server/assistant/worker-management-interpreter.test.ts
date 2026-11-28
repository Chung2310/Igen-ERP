import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ASSISTANT_OPERATIONS, defaultWorkflow } from "./catalog";
import { interpretRequest } from "./interpreter";

const provider = vi.hoisted(() => vi.fn());
vi.mock("../service/openrouter.service", () => ({ openrouterChat: provider }));

const workflows = ASSISTANT_OPERATIONS.filter(operation => operation.module === "worker").map(defaultWorkflow);

beforeEach(() => provider.mockReset().mockResolvedValue({ text: JSON.stringify({ actionId: null, values: {} }) }));
afterEach(() => provider.mockReset());

it.each([
  ["Danh sách người lao động", "worker.list"],
  ["Tạo hồ sơ người lao động mới", "worker.create"],
  ["Bổ sung thông tin cho lao động Lê Minh", "worker.update"],
  ["Xóa hồ sơ lao động Lê Minh", "worker.delete"],
  ["Tạo hợp đồng lao động cho Lê Minh", "worker.labor.contract.create"],
  ["Cập nhật hợp đồng lao động của Lê Minh", "worker.labor.contract.update"],
  ["Xóa hợp đồng lao động của Lê Minh", "worker.labor.contract.delete"],
  ["Gia hạn hợp đồng lao động của Lê Minh", "worker.labor.contract.renew"],
  ["Xem thông tin hợp đồng lao động của Lê Minh", "worker.labor.contract.detail"],
  ["Danh sách trường thông tin của hồ sơ lao động", "worker.standard-fields.list"],
  ["Sửa trường thông tin của hồ sơ lao động", "worker.standard-fields.update"],
])("routes an everyday labor request to the expected tab operation: %s", async (text, actionId) => {
  const result = await interpretRequest(text, workflows, null, []);

  expect(result.actionId).toBe(actionId);
});

it("routes a 30-day foreign work-permit expiry request with its supported filter", async () => {
  const result = await interpretRequest("Lao động nước ngoài nào có giấy phép sắp hết hạn trong 30 ngày?", workflows, null, []);

  expect(result.actionId).toBe("worker.list");
  expect(result.values.query_permitExpiryWithinDays).toBe(30);
  expect(provider).not.toHaveBeenCalled();
});
