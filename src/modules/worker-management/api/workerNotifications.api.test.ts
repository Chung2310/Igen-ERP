import { describe, expect, it, vi } from "vitest";
const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.mock("./client", () => ({ workerApiFetch: fetchMock }));
import { workerNotificationsApi } from "./workerNotifications.api";
describe("workerNotificationsApi", () => { it("uses worker notification namespace", async () => { fetchMock.mockResolvedValue({ data: [] }); await workerNotificationsApi.list(); await workerNotificationsApi.create({ title: "A", content: "B" }); expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["/worker-management/notifications", "/worker-management/notifications"]); }); });
