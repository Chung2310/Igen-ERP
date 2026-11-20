import { browserTransport, type ServiceTransport } from "./serviceTransport";
import { parseApiErrorResponse } from "./apiClientError";
export function createKanbanMediaService({ fetch, getAccessToken }: ServiceTransport) {
  return {
    upload: async (input: {
      file: string;
      fileName: string;
      mimeType: string;
      size: number;
    }): Promise<{ url: string; uploadToken: string }> => {
      const headers = new Headers({ "Content-Type": "application/json" });
      const token = getAccessToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      const response = await fetch("/api/v1/media/upload", {
        method: "POST",
        headers,
        body: JSON.stringify({ ...input, sourceType: "hr.kanban" }),
      });
      if (!response.ok) throw await parseApiErrorResponse(response);
      const body = await response.json();
      if (!body.url || !body.uploadToken) throw new Error("Máy chủ chưa trả đủ thông tin tệp tải lên.");
      return { url: body.url, uploadToken: body.uploadToken };
    },
  };
}
export const kanbanMediaService = createKanbanMediaService(browserTransport);
