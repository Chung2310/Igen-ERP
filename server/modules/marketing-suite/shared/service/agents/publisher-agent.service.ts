import { IMarketingCampaignSlot } from "../../../campaign/interface/marketing-campaign-slot.interface.ts";
import { IMarketingCampaign } from "../../../campaign/interface/marketing-campaign.interface.ts";
import { MarketingContentModel } from "../../../campaign/model/marketing-content.model.ts";
import { facebookPostService } from "../facebook-post.service.ts";
import { tiktokService } from "../tiktok.service.ts";
import { resolveFacebookCredentials } from "../../../campaign/service/agents/campaign-utils";
import { marketingCampaignService } from "../../../campaign/service/marketing-campaign.service.ts";
import { recordFacebookPublication } from "../../../campaign/service/facebook-publication.service";
import { assertCampaignMediaReady } from "../../../campaign/service/agents/campaign-media-readiness";

export class PublisherAgentService {
  public static async publish(
    slot: IMarketingCampaignSlot,
    campaign: IMarketingCampaign
  ): Promise<{ status: "published" | "publishing" | "failed"; postId?: string; postUrl?: string }> {
    const content = await MarketingContentModel.findOne({
      _id: slot.marketingContentId,
      companyCode: slot.companyCode,
    });
    if (!content) {
      throw new Error("Không tìm thấy nội dung bài đăng để thực hiện đăng tải.");
    }

    // 1. Idempotency Check
    if (slot.status === "published" || content.status === "published") {
      if (!(slot.publishedPostId || (slot.platform === "TikTok" ? content.tiktokPostId : content.facebookPostId))) {
        throw new Error("Bài được đánh dấu đã đăng nhưng chưa có mã bài đăng xác nhận từ nền tảng. Cần kiểm tra lại trước khi tiếp tục.");
      }
      console.log(`[PublisherAgent] Slot ${slot._id} or content has already been published. Skipping.`);
      return {
        status: "published",
        postId: slot.publishedPostId || content.facebookPostId || content.tiktokPostId,
        postUrl: slot.publishedUrl || content.postUrl || content.tiktokShareUrl,
      };
    }
    if (slot.platform === "TikTok" && content.status === "processing" && content.tiktokPublishId) {
      console.log(`[PublisherAgent] TikTok slot ${slot._id} already has publish_id ${content.tiktokPublishId}. Awaiting provider completion.`);
      return { status: "publishing" };
    }
    if (slot.platform === "Facebook" && content.status === "processing" && slot.status === "publishing") {
      return { status: "publishing" };
    }

    // 2. Late Publish Check
    const lateDeadline = new Date(slot.scheduledAt.getTime() + campaign.latePublishWindowMinutes * 60000);
    if (new Date() > lateDeadline) {
      throw new Error("Đã quá cửa sổ cho phép đăng muộn của chiến dịch.");
    }

    // 3. Final media/caption invariant before every platform publish.
    await assertCampaignMediaReady({ campaign, slot, content });

    // 4. Platform specific publishing
    if (slot.platform === "TikTok") {
      console.log(`[PublisherAgent] Publishing slot ${slot._id} to TikTok...`);
      slot.publishRequestedAt = new Date();
      await slot.save();

      const postOptions = slot.tiktokPublishOptions;
      if (!postOptions?.consentAccepted || !postOptions.privacyLevel || !postOptions.videoDurationSeconds) {
        throw new Error("Cần mở màn hình đăng TikTok để chọn quyền riêng tư, xác nhận điều khoản và kiểm tra thời lượng video trước khi đăng.");
      }

      const result = await tiktokService.publishVideo(
        String(content._id),
        postOptions.caption,
        content.videoUrl || "",
        postOptions.privacyLevel,
        undefined,
        undefined,
        undefined,
        slot.integrationId ? String(slot.integrationId) : undefined,
        slot.companyCode,
        postOptions
      );

      if (result.status === "success" && result.data?.success) {
        const postId = String(result.data.postId || "").trim();
        const postUrl = String(result.data.shareUrl || "").trim();

        content.status = "published";
        content.publishedAt = new Date();
        content.tiktokPostId = postId;
        content.tiktokShareUrl = postUrl;
        await content.save();

        slot.status = "published";
        slot.publishedPostId = postId;
        slot.publishedUrl = postUrl;
        await slot.save();

        await marketingCampaignService.syncCampaignStatusAndStats(campaign._id);
        console.log(`[PublisherAgent] Published slot ${slot._id} successfully to TikTok. Post ID: ${postId}`);
        return { status: "published", postId, postUrl };
      }

      content.status = "processing";
      if (result.data?.publishId) {
        content.tiktokPublishId = result.data.publishId;
      }
      await content.save();

      console.log(`[PublisherAgent] TikTok publish requested for slot ${slot._id}, awaiting processing/webhook...`);
      return { status: "publishing" };
    } else {
      // Default to Facebook
      const credentials = await resolveFacebookCredentials({
        companyCode: slot.companyCode,
        createdBy: campaign.createdBy,
        integrationId: slot.integrationId,
      });

      if (
        credentials.isMock
        && credentials.pageId.startsWith("mock_local_")
        && process.env.NODE_ENV !== "production"
      ) {
        const postId = `mock-local-${slot._id}-${Date.now()}`;
        const postUrl = `http://localhost:3000/mock-facebook/${postId}`;
        content.status = "published";
        content.publishedAt = new Date();
        content.facebookPostId = postId;
        content.postUrl = postUrl;
        await content.save();

        slot.status = "published";
        slot.publishedPostId = postId;
        slot.publishedUrl = postUrl;
        await slot.save();

        await marketingCampaignService.syncCampaignStatusAndStats(campaign._id);
        console.log(`[PublisherAgent] Local mock published slot ${slot._id}.`);
        return { status: "published", postId, postUrl };
      }

      console.log(`[PublisherAgent] Publishing slot ${slot._id} to Facebook page ${credentials.pageId}...`);

      // Detect retry: slot already had a publish attempt before
      const isRetry = !!slot.publishRequestedAt;

      // Record publish requested timestamp
      slot.publishRequestedAt = new Date();
      await slot.save();

      // Graph API execution
      await MarketingContentModel.updateOne(
        { _id: content._id, companyCode: slot.companyCode, status: "failed" },
        { $set: { status: "processing" }, $unset: { publishError: 1 } }
      );
      let result: Awaited<ReturnType<typeof facebookPostService.publishToPage>>;
      try {
        result = await facebookPostService.publishToPage(
          content.bodyText,
          content.imageUrl || "",
          content.videoUrl || "",
          credentials.pageId,
          credentials.accessToken,
          String(content._id),
          "immediate",
          undefined,
          content.title,
          undefined,
          slot.publishIdempotencyKey,
          isRetry, // bypass n8n lock on retry
          content.mediaUrls
        );
      } catch (error) {
        const current = await recordFacebookPublication(String(content._id), {
          status: "failed",
          error: error instanceof Error ? error.message : "Không thể gửi yêu cầu đăng Facebook qua n8n.",
        }, slot.companyCode);
        if (current?.status === "published") {
          await marketingCampaignService.syncCampaignStatusAndStats(campaign._id);
          return { status: "published", postId: current.facebookPostId, postUrl: current.postUrl };
        }
        // A transport failure can be ambiguous. Stop for explicit retry with the
        // same idempotency key instead of leaving a false pending callback.
        throw error;
      }

      const data = result.data?.data ?? result.data ?? {};
      const postId = String(data.id || data.post_id || "").trim();
      const postUrl = String(data.postUrl || data.permalink_url || "").trim();
      const providerStatus = String(data.status || "").toLowerCase();
      const current = await recordFacebookPublication(String(content._id), {
        status: ["failed", "error"].includes(providerStatus) ? "failed"
          : postId && !["processing", "pending", "queued", "publishing"].includes(providerStatus) ? "published" : "processing",
        postId: postId || undefined, postUrl: postUrl || undefined, error: data.error || data.message,
      }, slot.companyCode);
      if (!current) throw new Error("Không tìm thấy nội dung bài đăng để cập nhật kết quả Facebook.");
      if (current.status === "published") {
        await marketingCampaignService.syncCampaignStatusAndStats(campaign._id);
        return { status: "published", postId: current.facebookPostId, postUrl: current.postUrl };
      }
      if (current.status === "failed") throw new Error(current.publishError || "Đăng Facebook thất bại.");
      return { status: "publishing" };
    }
  }
}
