import { afterEach, expect, it, vi } from "vitest";
import { ASSISTANT_OPERATIONS, defaultWorkflow } from "./catalog";
import { interpretRequest } from "./interpreter";
import { assistantCourseChoiceGuidance } from "./request-guidance";

const provider = vi.hoisted(() => vi.fn());
vi.mock("../service/openrouter.service", () => ({ openrouterChat: provider }));
const workflows = ASSISTANT_OPERATIONS.filter(op => ["hr", "student"].includes(op.module)).map(defaultWorkflow);
afterEach(() => provider.mockReset());

it.each(["tạo khóa đào tạo", "thêm khóa đào tạo", "tạo khóa đào tạo cho nhân sự"])("routes explicit internal training creation to HR: %s", async text => {
  const result = await interpretRequest(text, workflows, null, []);
  expect(result).toMatchObject({ actionId: "training.create", intentType: "workflow" });
  expect(provider).not.toHaveBeenCalled();
});

it("keeps labeled course details in the pending internal training workflow", async () => {
  const text = "Mình bổ sung Mã khóa học: khoahocabc; Tên khóa học: khóa học abc; Số buổi hoặc thời lượng học: 20.";
  const result = await interpretRequest(text, workflows, { actionId: "training.create", values: {} }, []);
  expect(result).toMatchObject({ actionId: "training.create", intentType: "workflow", newRequest: false });
  expect(result.values).toMatchObject({ title: "khóa học abc", duration: "20 buổi" });
  expect(provider).not.toHaveBeenCalled();
});

it("does not switch pending internal training to student courses for a course-code answer", async () => {
  const result = await interpretRequest("Mã khóa học: khoahocabc", workflows, { actionId: "training.create", values: {} }, []);
  expect(result).toMatchObject({ actionId: "training.create", intentType: "workflow", newRequest: false, values: {} });
  expect(provider).not.toHaveBeenCalled();
});

it.each(["tạo khóa học mới", "thêm khóa học mới"])("asks which course type to create for %s", async text => {
  const result = await interpretRequest(text, workflows, null, []);
  expect(result).toMatchObject({ actionId: null, intentType: "ambiguous", suggestedActionIds: ["training.create", "course.create"] });
  const reply = assistantCourseChoiceGuidance(workflows, result.suggestedActionIds);
  expect(reply).toContain("đào tạo nội bộ");
  expect(reply).toContain("cho học viên");
  expect(provider).not.toHaveBeenCalled();
});

it.each(["training.create", "course.create"])("starts the only available course creation: %s", async actionId => {
  const available = workflows.filter(workflow => workflow.actionId === actionId);
  const result = await interpretRequest("thêm khóa học mới", available, null, []);
  expect(result).toMatchObject({ actionId, intentType: "workflow", values: {} });
  expect(provider).not.toHaveBeenCalled();
});

it.each([["nội bộ", "training.create"], ["nhân sự", "training.create"], ["học viên", "course.create"]])("accepts the course type answer %s", async (text, actionId) => {
  const reply = assistantCourseChoiceGuidance(workflows, ["training.create", "course.create"]);
  const result = await interpretRequest(text, workflows, null, [{ role: "assistant", content: reply }]);
  expect(result).toMatchObject({ actionId, values: {} });
  expect(provider).not.toHaveBeenCalled();
});

it("never offers a disabled or inaccessible course type", () => {
  const available = workflows.filter(workflow => workflow.actionId !== "course.create");
  expect(assistantCourseChoiceGuidance(available, ["training.create", "course.create"])).toBe("");
  expect(assistantCourseChoiceGuidance(workflows.map(workflow => ({ ...workflow, enabled: false })), ["training.create", "course.create"])).toBe("");
});

it.each([
  ["xóa khóa đạo tạo nhân sự hát", "hát"],
  ["xóa khóa đào tạo nhân sự Hát dân ca", "Hát dân ca"],
  ["xoa khoa dao tao nhan su hat", "hat"],
  ["xóa khóa học nội bộ hát", "hát"],
  ['xóa khóa đào tạo "Nhân sự mới"', "Nhân sự mới"],
  ["xóa khóa đào tạo nhân sự", undefined],
])("routes course deletion without targeting an employee: %s", async (text, id) => {
  const result = await interpretRequest(text, workflows, null, []);
  expect(result).toMatchObject({ actionId: "training.delete", values: id ? { id } : {} });
  expect(provider).not.toHaveBeenCalled();
});

it("does not fall back to deleting an employee without course delete permission", async () => {
  await expect(interpretRequest("xóa khóa đạo tạo nhân sự hát", workflows.filter(workflow => workflow.actionId !== "training.delete"), null, []))
    .rejects.toThrow("chưa có quyền");
  expect(provider).not.toHaveBeenCalled();
});
