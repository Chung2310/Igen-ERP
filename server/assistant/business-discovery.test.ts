import { afterEach, expect, it, vi } from "vitest";
const provider = vi.hoisted(() => vi.fn());
vi.mock("../service/openrouter.service", () => ({ openrouterChat: provider }));
import { interpretRequest } from "./semantic-interpreter";
import { ASSISTANT_OPERATIONS, defaultWorkflow } from "./catalog";
import { businessDiscoveryReply } from "./business-discovery";
afterEach(() => provider.mockReset());

it.each(["student", "hr", "quotation", "worker", "labor-partner", "retail-partner", "student-partner", "healthcare", "inventory", "repair", "retail", "finance"])("grounds discovery in permitted capabilities: %s", async module => {
  const operations = ASSISTANT_OPERATIONS.filter(op => op.module === module && !op.unavailableReason).slice(0, 3);
  const workflows = operations.map(defaultWorkflow);
  workflows[1].enabled = false;
  provider.mockResolvedValue({ text: JSON.stringify({ intentType: "workflow", actionId: operations[0].id, values: { fullName: "Unrequested record" },
    businessDiscovery: { actionIds: [operations[0].id, operations[1].id, "invented.operation", operations[0].id] }, remainingRequests: ["create another record"] }) });
  const result = await interpretRequest("Tôi chưa biết phần này giúp được việc gì", workflows, null, []);
  expect(result).toMatchObject({ actionId: null, values: {}, intentType: "ambiguous", remainingRequests: [], businessDiscovery: { actionIds: [operations[0].id] } });
  const reply = businessDiscoveryReply(result.businessDiscovery!, workflows);
  expect(reply).toContain(workflows[0].title);
  expect(reply).not.toContain("invented.operation");
  expect(reply).not.toContain("API");
});

it.each([null, "create now", { actionIds: [42] }, { actionIds: Array(6).fill("student.create") }])("malformed discovery cannot execute a proposed write: %j", async businessDiscovery => {
  provider.mockResolvedValue({ text: JSON.stringify({ actionId: "student.create", values: { fullName: "An" }, businessDiscovery }) });
  const workflows = ASSISTANT_OPERATIONS.filter(op => op.id === "student.create").map(defaultWorkflow);
  expect(await interpretRequest("Tôi muốn tìm hiểu", workflows, null, [])).toMatchObject({ actionId: null, values: {}, businessDiscovery: { actionIds: [] } });
});

it("passes ordinary business context to interpretation without inventing a prior period", async () => {
  const history = [{ role: "user", content: "Tôi quản lý trung tâm, đang hay quên ai chưa đóng học phí" }, { role: "assistant", content: "Bạn muốn kiểm tra lớp nào?" }];
  provider.mockResolvedValue({ text: JSON.stringify({ actionId: null, values: {}, intentType: "ambiguous", businessDiscovery: { actionIds: [] }, clarification: "Bạn muốn kiểm tra lớp nào và tháng nào?" }) });
  const result = await interpretRequest("Làm như tháng trước", [], null, history);
  expect(result.actionId).toBeNull();
  const messages = JSON.stringify(provider.mock.calls[0][0].messages);
  expect(messages).toContain(history[0].content);
  expect(messages).toContain("không bịa số hoặc nguyên nhân");
});
