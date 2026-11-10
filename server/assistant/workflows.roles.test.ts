import { expect, it, vi } from "vitest";

vi.mock("../middleware/auth", () => ({ getEffectivePermissions: vi.fn(async () => new Set(["*"])) }));
vi.mock("../middleware/require-module", () => ({
  getModuleStateForCompany: vi.fn(async () => ({ modules: {}, exists: true, businessType: "general" })),
  resolveModuleAccess: vi.fn(() => true),
}));
vi.mock("./models", () => ({ AssistantWorkflowModel: {}, ensureAssistantIndexes: vi.fn() }));

import { allowedOperations } from "./workflows";
import { getEffectivePermissions } from "../middleware/auth";
import { resolveModuleAccess } from "../middleware/require-module";

const reqForRole = (role: string) => ({ user: { id: "actor", role, companyCode: "TEST" } }) as any;

it("shows admin-only unassigned-student operations only to company admins", async () => {
  const adminOperations = await allowedOperations(reqForRole("admin"));
  const managerOperations = await allowedOperations(reqForRole("manager"));
  const branchOwnerOperations = await allowedOperations(reqForRole("branch_owner"));

  expect(adminOperations.some(operation => operation.id === "student.unassigned.list")).toBe(true);
  expect(adminOperations.some(operation => operation.path === "/students/:id/assign-branch")).toBe(true);
  expect(managerOperations.some(operation => operation.id === "student.unassigned.list")).toBe(false);
  expect(managerOperations.some(operation => operation.path === "/students/:id/assign-branch")).toBe(false);
  expect(branchOwnerOperations.some(operation => operation.id === "student.unassigned.list")).toBe(false);
});

it("offers work-process creation and hides recruitment pipeline editing from the assistant", async () => {
  const operations = await allowedOperations(reqForRole("admin"));

  expect(operations.some(operation => operation.id === "hr.workflow.create")).toBe(true);
  expect(operations.some(operation => operation.id === "recruitment.pipeline.update")).toBe(false);
  expect(operations.some(operation => operation.id === "recruitment.pipeline.get")).toBe(true);
});

it("limits healthcare workflows to their feature permissions and enabled module", async () => {
  vi.mocked(getEffectivePermissions).mockResolvedValueOnce(new Set(["healthcare:read"]));
  const reader = (await allowedOperations(reqForRole("member"))).filter(op => op.module === "healthcare");
  expect(reader.map(op => op.id)).toEqual(expect.arrayContaining(["healthcare.patient.list", "healthcare.patient.detail", "healthcare.overview"]));
  expect(reader.some(op => !op.readOnly || op.id === "healthcare.visit.list")).toBe(false);

  vi.mocked(getEffectivePermissions).mockResolvedValueOnce(new Set(["healthcare:read", "healthcare-care:read", "healthcare-care:manage"]));
  const carer = (await allowedOperations(reqForRole("member"))).filter(op => op.module === "healthcare");
  expect(carer.map(op => op.id)).toEqual(expect.arrayContaining(["healthcare.care.create", "healthcare.care.update", "healthcare.staff.list"]));
  expect(carer.some(op => op.id === "healthcare.patient.create" || op.id === "healthcare.import.commit")).toBe(false);

  vi.mocked(resolveModuleAccess).mockImplementationOnce(() => false);
  vi.mocked(resolveModuleAccess).mockImplementation(() => false);
  expect((await allowedOperations(reqForRole("admin"))).some(op => op.module === "healthcare")).toBe(false);
  vi.mocked(resolveModuleAccess).mockImplementation(() => true);
});
