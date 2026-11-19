import { describe, expect, it } from "vitest";
import { applyWorkWorkflowMutation } from "./workflow-mutations";

const snapshot = {
  name: "Tuyển dụng nhân sự",
  steps: [
    { id: "step-screen", title: "Sàng lọc CV", subTasks: [{ id: "child-old", title: "Kiểm tra hồ sơ", done: true }] },
    { id: "step-interview", title: "Phỏng vấn", subTasks: [] },
  ],
};

function mutate(action: string, extra: Record<string, unknown> = {}) {
  const body: Record<string, unknown> = {};
  applyWorkWorkflowMutation(body, { workflowAction: action, __assistantExistingRecord: JSON.stringify(snapshot), ...extra });
  return body.steps as any[];
}

describe("assistant work workflow mutations", () => {
  it("adds a step while selecting the existing steps by title for metadata preservation", () => {
    expect(mutate("Thêm bước", { workflowValue: "Hẹn lịch phỏng vấn" })).toEqual([
      { existingTitle: "Sàng lọc CV", title: "Sàng lọc CV" },
      { existingTitle: "Phỏng vấn", title: "Phỏng vấn" },
      { title: "Hẹn lịch phỏng vấn" },
    ]);
  });

  it("removes only the named step", () => {
    expect(mutate("Gỡ bước", { workflowTarget: "Sàng lọc CV" })).toEqual([
      { existingTitle: "Phỏng vấn", title: "Phỏng vấn" },
    ]);
  });

  it("adds a child stage to the selected step and preserves its current children", () => {
    const steps = mutate("Thêm giai đoạn con", { workflowTarget: "Sàng lọc CV", workflowValue: "Scan CV" });
    expect(steps[0].existingTitle).toBe("Sàng lọc CV");
    expect(steps[0].subTasks).toHaveLength(2);
    expect(steps[0].subTasks[0]).toEqual({ id: "child-old", title: "Kiểm tra hồ sơ", done: true });
    expect(steps[0].subTasks[1]).toMatchObject({ title: "Scan CV", assigneeUid: "", assignee: "", done: false });
    expect(steps[0].subTasks[1].id).toBeTruthy();
  });

  it("does not allow removing the last process step", () => {
    const body: Record<string, unknown> = {};
    expect(() => applyWorkWorkflowMutation(body, {
      workflowAction: "Gỡ bước",
      workflowTarget: "Chỉ một bước",
      __assistantExistingRecord: JSON.stringify({ steps: [{ id: "one", title: "Chỉ một bước" }] }),
    })).toThrow("Quy trình cần giữ ít nhất một bước.");
  });
});
