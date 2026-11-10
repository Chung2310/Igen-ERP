// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { workflowToText } from "../../shared/assistant-workflow";
const mocks = vi.hoisted(() => ({ workflows: vi.fn(), interpretWorkflow: vi.fn(), saveWorkflow: vi.fn(), resetWorkflow: vi.fn() }));
vi.mock("../../services/assistantService", () => ({ assistantService: mocks }));
import { AssistantWorkflowEditor } from "./AssistantWorkflowEditor";
const workflow = { actionId: "employee.create", title: "Tạo nhân sự", description: "", module: "hr", version: 0, enabled: true, instructions: "", requireConfirmation: false, confirmationLocked: false, fields: [{ key: "displayName", label: "Họ và tên", type: "text" as const, required: true, systemRequired: true }, { key: "monthlySalary", label: "Lương tháng", type: "number" as const, min: 0, defaultValue: 0 }] };
beforeEach(() => { vi.resetAllMocks(); mocks.workflows.mockResolvedValue([structuredClone(workflow)]); });
afterEach(cleanup);
it("seeds readable text and saves only the reviewed interpretation with its source", async () => {
  const text = "Cần họ tên. Nếu thiếu lương, dùng 8000000.";
  const compiled = { ...workflow, fields: workflow.fields.map(f => f.key === "monthlySalary" ? { ...f, defaultValue: 8000000 } : f) };
  mocks.interpretWorkflow.mockResolvedValue(compiled);
  mocks.saveWorkflow.mockImplementation(async (_id, input) => ({ ...compiled, ...input, version: 1 }));
  render(<AssistantWorkflowEditor />);
  const editor = await screen.findByLabelText("Mô tả workflow");
  expect((editor as HTMLTextAreaElement).value).toContain("Nếu thiếu, dùng mặc định 0");
  fireEvent.change(editor, { target: { value: text } });
  expect(screen.queryByText("Lưu workflow")).toBeNull();
  fireEvent.click(screen.getByText("Xem cách trợ lý hiểu"));
  await screen.findByRole("region", { name: "Bản diễn giải workflow" });
  expect(mocks.saveWorkflow).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("Lưu workflow")); await screen.findByText("Đã lưu workflow riêng của bạn.");
  expect(mocks.saveWorkflow.mock.calls[0][1]).toMatchObject({ sourceText: text, version: 0 });
  expect(mocks.saveWorkflow.mock.calls[0][1].fields[1].defaultValue).toBe(8000000);
});
it("invalidates preview when text changes and preserves rejected or conflicting drafts", async () => {
  mocks.interpretWorkflow.mockResolvedValueOnce(workflow).mockRejectedValueOnce(new Error("Chưa hỗ trợ gửi email"));
  render(<AssistantWorkflowEditor />); const editor = await screen.findByLabelText("Mô tả workflow");
  fireEvent.click(screen.getByText("Xem cách trợ lý hiểu")); await screen.findByText("Lưu workflow");
  fireEvent.change(editor, { target: { value: "Tạo nhân sự rồi gửi email" } });
  expect(screen.queryByText("Lưu workflow")).toBeNull();
  fireEvent.click(screen.getByText("Xem cách trợ lý hiểu")); await screen.findByText("Chưa hỗ trợ gửi email");
  expect((editor as HTMLTextAreaElement).value).toBe("Tạo nhân sự rồi gửi email");
  mocks.interpretWorkflow.mockResolvedValue(workflow);
  mocks.saveWorkflow.mockRejectedValue(new Error("Workflow đã được sửa ở nơi khác."));
  fireEvent.click(screen.getByText("Xem cách trợ lý hiểu")); await screen.findByText("Lưu workflow");
  fireEvent.click(screen.getByText("Lưu workflow")); await screen.findByText("Workflow đã được sửa ở nơi khác.");
  expect((editor as HTMLTextAreaElement).value).toBe("Tạo nhân sự rồi gửi email");
  fireEvent.click(screen.getByText("Bỏ thay đổi"));
  await waitFor(() => expect((editor as HTMLTextAreaElement).value).toBe(workflowToText(workflow)));
});

it("filters the expanded catalogue by module and Vietnamese search without losing edited rules", async () => {
  mocks.workflows.mockResolvedValue([workflow, { ...workflow, actionId: "course.create", module: "student", title: "Tạo khóa học", description: "Quản lý học viên" }]);
  render(<AssistantWorkflowEditor />); await screen.findByLabelText("Mô tả workflow");
  fireEvent.change(screen.getByLabelText("Phân hệ"), { target: { value: "student" } });
  expect((screen.getByLabelText("Thao tác") as HTMLSelectElement).value).toBe("course.create");
  fireEvent.change(screen.getByLabelText("Tìm workflow"), { target: { value: "khoa hoc" } });
  expect(screen.getByRole("status").textContent).toContain("1 workflow phù hợp");
  fireEvent.change(screen.getByLabelText("Mô tả workflow"), { target: { value: "Cần tên khóa học" } });
  expect((screen.getByLabelText("Phân hệ") as HTMLSelectElement).disabled).toBe(true);
  expect((screen.getByLabelText("Tìm workflow") as HTMLInputElement).disabled).toBe(true);
});
