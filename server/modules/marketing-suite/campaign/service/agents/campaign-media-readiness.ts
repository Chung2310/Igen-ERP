import type { IMarketingCampaign } from "../../interface/marketing-campaign.interface";
import type { IMarketingCampaignSlot } from "../../interface/marketing-campaign-slot.interface";
import type { IMarketingContent } from "../../interface/marketing-content.interface";
import { assertCampaignVideoReady } from "./campaign-caption.service";

/** Hard media requirements also apply to manually approved posts. */
export async function assertCampaignMediaReady(input: {
  campaign: IMarketingCampaign;
  slot: IMarketingCampaignSlot;
  content: IMarketingContent;
}) {
  try {
    const { campaign, slot, content } = input;
    if (slot.mediaType === "text" && ["image", "video"].includes(campaign.mediaPolicy) && !campaign.rules?.allowTextOnlyFallback) {
      throw new Error("Chiến dịch yêu cầu đa phương tiện nhưng không cho phép bài viết text-only fallback.");
    }
    if (slot.mediaType === "image") {
      const urls = [...new Set([content.imageUrl, ...(content.mediaUrls || [])].filter((url): url is string => Boolean(url)))];
      if (!urls.length) throw new Error("Hình ảnh bắt buộc chưa sẵn sàng.");
      if (content.videoUrl) throw new Error("Bài đăng ảnh đang có video không khớp loại media của slot.");
      // Bound checks for albums independently of the worker concurrency.
      for (let offset = 0; offset < urls.length; offset += 3) {
        await Promise.all(urls.slice(offset, offset + 3).map(async (url) => {
          if (!/^https:\/\//i.test(url)) throw new Error("Hình ảnh phải có URL HTTPS hợp lệ.");
          const response = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(10_000) });
          if (!response.ok || !String(response.headers.get("content-type") || "").toLowerCase().startsWith("image/")) {
            throw new Error("Hình ảnh không truy cập được hoặc không phải tệp ảnh hợp lệ.");
          }
        }));
      }
    }
    await assertCampaignVideoReady(input);
  } catch (error) {
    throw Object.assign(new Error(error instanceof Error ? error.message : String(error)), {
      code: "CAMPAIGN_MEDIA_NOT_READY", statusCode: 409,
    });
  }
}
