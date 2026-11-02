import { IMarketingCampaignSlot } from "../../../campaign/interface/marketing-campaign-slot.interface.ts";
import { IMarketingCampaign } from "../../../campaign/interface/marketing-campaign.interface.ts";
import { MarketingContentModel } from "../../../campaign/model/marketing-content.model.ts";
import { MarketingCampaignModel } from "../../../campaign/model/marketing-campaign.model.ts";
import { geminiService } from "../gemini.service.ts";
import { API_COSTS, walletService } from "../wallet.service.ts";
import { applyCampaignVideoCaption } from "../../../campaign/service/agents/campaign-caption.service.ts";

export class MediaCreatorAgentService {
  public static async createMedia(
    slot: IMarketingCampaignSlot,
    campaign: IMarketingCampaign
  ): Promise<string> {
    if (slot.mediaType === "text") {
      console.log(`[MediaCreatorAgent] Slot ${slot._id} is text-only. Skipping media generation.`);
      return "";
    }

    const content = await MarketingContentModel.findOne({
      _id: slot.marketingContentId,
      companyCode: slot.companyCode,
    });
    if (!content) {
      throw new Error("Thiếu nội dung bài đăng để chuẩn bị media.");
    }

    if ((slot.mediaType === "video" || slot.mediaType === "human-video") ? Boolean(content.videoUrl && /^https:\/\//i.test(content.videoUrl)) : Boolean(content.imageUrl)) {
      if (
        content.videoUrl &&
        (slot.mediaType === "video" ||
          slot.mediaType === "human-video")
      ) {
        return applyCampaignVideoCaption({
          campaign,
          slot,
          content,
          videoUrl: content.videoUrl,
        });
      }
      return content.imageUrl || "";
    }

    const isBudget = campaign.qualityMode === "budget";

    if (slot.mediaType === "video" || slot.mediaType === "human-video") {
      throw new Error("Video chiến dịch phải do khách hàng tải lên. Vui lòng bổ sung video.");
    }

    if (slot.mediaType === "image") {
      if (!content.mediaPrompt) throw new Error("Thiếu Visual Prompt để tạo ảnh.");
      const imageCost = isBudget ? API_COSTS.CAMPAIGN_IMAGE_BUDGET : API_COSTS.CAMPAIGN_IMAGE_PREMIUM;

      try {
        // Check balance first
        await walletService.checkBalance(campaign.createdBy, imageCost);

        console.log(`[MediaCreatorAgent] Generating image for slot ${slot._id} (Prompt: "${content.mediaPrompt}")...`);
        const image = await geminiService.generateImage(content.mediaPrompt, {
          aspectRatio: "1:1",
          resolution: "1K",
        });

        if (!/^https:\/\//i.test(image.url)) {
          throw new Error("AI không trả về URL ảnh HTTPS hợp lệ.");
        }

        // Deduct balance
        const billing = await walletService.deductBalance(
          campaign.createdBy,
          imageCost,
          "Tạo ảnh cho chiến dịch tự động (MediaCreatorAgent)",
          `${campaign._id}:${slot._id}:media:image`
        );
        if (billing?.charged) {
          await MarketingCampaignModel.updateOne(
            { _id: campaign._id, companyCode: campaign.companyCode },
            { $inc: { "statistics.actualCost": imageCost } }
          );
        }

        content.imageUrl = image.url;
        await content.save();

        console.log(`[MediaCreatorAgent] Generated image successfully: ${image.url}`);
        return image.url;
      } catch (err: unknown) {
        if ((err as { code?: string })?.code === "AI_SUBSCRIPTION_LIMIT") throw err;
        const errorMsg = err instanceof Error ? err.message : String(err);
        if (campaign.rules?.allowTextOnlyFallback && slot.platform === "Facebook") {
          console.warn(`[MediaCreatorAgent] Image generation failed. Attempting fallback to text-only...`, err);
          slot.mediaType = "text";
          await slot.save();
          content.mediaType = undefined;
          await content.save();
          return "";
        }
        throw new Error(`Tạo ảnh thất bại và không cho phép bài viết chỉ có chữ làm dự phòng. Lỗi chi tiết: ${errorMsg}`);
      }
    }

    throw new Error(`Media type không hỗ trợ: ${slot.mediaType}`);
  }
}
