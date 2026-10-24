import { getAccessToken } from "./authService";

export async function downloadCampaignMedia(url: string, filename: string): Promise<void> {
  const query = new URLSearchParams({ url, filename });
  const response = await fetch(`/api/v1/marketing-media/download?${query}`, {
    headers: { Authorization: `Bearer ${getAccessToken()}` },
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.message || result.error || "Không thể tải media.");
  }
  const blobUrl = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
}
