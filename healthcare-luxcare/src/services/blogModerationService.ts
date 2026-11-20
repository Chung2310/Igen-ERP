import { browserTransport, type ServiceTransport } from "./serviceTransport";
import { parseApiErrorResponse } from "./apiClientError";
import type {
  BlogBlockedAuthor,
  BlogReportPage,
  BlogReportReason,
  BlogReportStatus,
} from "../../shared/blog-moderation";
export function createBlogModerationService(transport: ServiceTransport, getDeviceId?: () => string) {
  async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
    const headers = new Headers({ "Content-Type": "application/json" });
    if (path.startsWith("/moderation/") && getDeviceId) headers.set("x-device-id", getDeviceId());
    const token = transport.getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const response = await transport.fetch("/api/v1/blogs" + path, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) throw await parseApiErrorResponse(response);
    const envelope = await response.json();
    return envelope.data ?? envelope;
  }
  return {
    report: (postId: string, reason: BlogReportReason, details: string) =>
      request<{ id: string; status: BlogReportStatus }>(`/${encodeURIComponent(postId)}/reports`, "POST", {
        reason,
        details,
      }),
    blockAuthor: (postId: string) =>
      request<{ authorId: string }>(`/${encodeURIComponent(postId)}/block-author`, "POST", {}),
    blocks: () => request<BlogBlockedAuthor[]>("/blocks"),
    unblock: (authorId: string) => request<{ authorId: string }>(`/blocks/${encodeURIComponent(authorId)}`, "DELETE"),
    reports: (status: BlogReportStatus, page = 1) =>
      request<BlogReportPage>(`/moderation/reports?status=${status}&page=${page}`),
    moderate: (id: string, status: BlogReportStatus, notes: string, removePost = false) =>
      request<{ id: string; status: BlogReportStatus; postRemoved: boolean }>(
        `/moderation/reports/${encodeURIComponent(id)}`,
        "PATCH",
        { status, notes, removePost },
      ),
  };
}
export const blogModerationService = createBlogModerationService(browserTransport);
