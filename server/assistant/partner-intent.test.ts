import { afterEach, expect, it, vi } from "vitest";
import { ASSISTANT_OPERATIONS, defaultWorkflow } from "./catalog";
import { interpretRequest } from "./interpreter";

const provider = vi.hoisted(() => vi.fn());
vi.mock("../service/openrouter.service", () => ({ openrouterChat: provider }));
afterEach(() => provider.mockReset());

it.each([
  "Bạn muốn tạo đối tác lao động, đối tác giới thiệu học viên hay đối tác bán lẻ?",
  "Có đối tác lao động, đối tác giới thiệu học viên, đối tác bán lẻ. Bạn muốn chọn phân hệ nào?",
])("continues the create request when the user selects labor partners from a module prompt: %s", async prompt => {
  const workflows = ASSISTANT_OPERATIONS.map(defaultWorkflow);
  const workerPartnerCreate = ASSISTANT_OPERATIONS.find(operation =>
    operation.method === "POST" && operation.path === "/worker-management/partners");
  expect(workerPartnerCreate).toBeDefined();
  provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: null, values: {}, intentType: "ambiguous" }) });

  const result = await interpretRequest("đối tác lao động", workflows, null, [
    { role: "user", content: "tạo đối tác mới" },
    { role: "assistant", content: prompt },
  ]);

  expect(result).toMatchObject({ actionId: workerPartnerCreate!.id, intentType: "workflow", values: {} });
  expect(provider).toHaveBeenCalledTimes(1);
});
