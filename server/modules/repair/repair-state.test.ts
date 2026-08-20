import { expect, test } from "vitest";
import { assertRepairTransition, pausesSla } from "./repair-state";

test("repair accepts supplier waiting state and resumes repair", () => {
  expect(() => assertRepairTransition("repairing", "waiting_supplier")).not.toThrow();
  expect(() => assertRepairTransition("waiting_supplier", "repairing")).not.toThrow();
  expect(pausesSla("waiting_supplier")).toBe(true);
});

test("repair rejects delivering an unfinished ticket", () => {
  expect(() => assertRepairTransition("repairing", "delivered")).toThrow(/Invalid repair transition/);
});
