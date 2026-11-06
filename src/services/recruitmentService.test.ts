import { beforeEach, describe, expect, it, vi } from "vitest";
import { recruitmentApi } from "./recruitmentService";

vi.mock("./authService", () => ({ getAccessToken: () => "test-token" }));

describe("recruitmentApi dashboard reads", () => {
  const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => ({ ok: true, json: async () => ({ data: [] }) }));

  beforeEach(() => {
    fetchMock.mockClear();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("sends the selected branch for jobs, applicants, and pipeline", async () => {
    await recruitmentApi.listJobs(undefined, "branch-1");
    await recruitmentApi.listApplicants(undefined, "branch-1");
    await recruitmentApi.getPipeline("branch-1");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const [, init] of fetchMock.mock.calls) {
      expect(init.headers).toMatchObject({ Authorization: "Bearer test-token", "x-branch-id": "branch-1" });
    }
  });
});
