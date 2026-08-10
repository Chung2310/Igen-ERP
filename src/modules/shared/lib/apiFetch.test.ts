import { describe, expect, it } from "vitest";
import { workerApiFetch } from "../../worker-management/api/client";
import { apiFetch } from "./apiFetch";

describe("shared apiFetch", () => {
  it("keeps workerApiFetch as the shared apiFetch compatibility export", () => {
    expect(workerApiFetch).toBe(apiFetch);
  });
});
