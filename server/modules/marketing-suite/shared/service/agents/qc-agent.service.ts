import { IMarketingCampaignSlot } from "../../../campaign/interface/marketing-campaign-slot.interface.ts";
import { IMarketingCampaign } from "../../../campaign/interface/marketing-campaign.interface.ts";
import { MarketingContentModel } from "../../../campaign/model/marketing-content.model.ts";
import { openrouterChat } from "../openrouter.service.ts";
import { loadAgentSkill, resolveFacebookCredentials } from "../../../campaign/service/agents/campaign-utils";
import { assertCampaignMediaReady } from "../../../campaign/service/agents/campaign-media-readiness";
import { tiktokService } from "../tiktok.service.ts";

export class QcAgentService {
  public static async verify(
    slot: IMarketingCampaignSlot,
    campaign: IMarketingCampaign
  ): Promise<{ passed: boolean; score: number; reasons: string[] }> {
    const content = await MarketingContentModel.findOne({
      _id: slot.marketingContentId,
      companyCode: slot.companyCode,
    });
    if (!content) {
      return { passed: false, score: 0, reasons: ["Không tìm thấy nội dung bài đăng để kiểm duyệt."] };
    }

    const reasons: string[] = [];

    // 1. Technical Checks
    if (!content.bodyText || !content.bodyText.trim()) {
      reasons.push("Nội dung bài viết trống.");
    }

    try {
      await assertCampaignMediaReady({ campaign, slot, content });
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === "AI_SUBSCRIPTION_LIMIT") throw err;
      reasons.push(
        err instanceof Error
          ? err.message
          : "Media chiến dịch chưa sẵn sàng."
      );
    }

    // 2. Integration / Credential Verification
    try {
      if (slot.platform === "TikTok") {
        await tiktokService.getCreatorInfoForIntegration({
          integrationId: slot.integrationId ? String(slot.integrationId) : undefined,
          companyCode: slot.companyCode,
          userId: campaign.createdBy,
        });
      } else {
        await resolveFacebookCredentials({
          companyCode: slot.companyCode,
          createdBy: campaign.createdBy,
          integrationId: slot.integrationId,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      reasons.push(`Lỗi kết nối kênh đăng bài: ${msg}`);
    }

    if (reasons.length > 0) {
      return { passed: false, score: 0, reasons };
    }

    // 3. Editorial Checks via AI (QC Agent Sweep)
    const qcSkill = loadAgentSkill("qc");
    const tiktokSkill = slot.platform === "TikTok"
      ? loadAgentSkill("tiktok-content-publishing")
      : "";

    const systemInstruction = `
${qcSkill}
${tiktokSkill}

You are the Quality Control (QC) Agent. Your task is to perform an editing sweep of the Vietnamese marketing copy.
Scan the draft for:
1. Placeholders (e.g. [Tên], [Số điện thoại], [Link], [Sản phẩm], etc. that have not been filled).
2. Clichés and jargon (avoid words like "seamless", "cutting-edge", "innovative" without evidence).
3. Passive voice, confusing sentences, or formatting issues.
4. Exclamation points (minimize them).
5. For TikTok, reject a caption over 2,200 characters or any scene-direction text in bodyText.

Score the post content on a scale of 1 to 10 based on the Copy Editing Checklist.
If the score is 7 or above AND there are no placeholders or critical errors, mark "passed" as true.
Otherwise, set "passed" as false and list specific rejection reasons in Vietnamese.

JSON Output Schema:
{
  "score": 8,
  "passed": true,
  "rejectionReasons": []
}
`;

    const rulesSection = campaign.rules
      ? `\n\nQUY TẮC CHIẾN DỊCH BẮT BUỘC (Hãy kiểm tra nghiêm ngặt, nếu vi phạm, đặt passed thành false và nêu rõ lý do):\n` +
      (campaign.rules.requiredCta ? `- Kêu gọi hành động (CTA) bắt buộc: ${campaign.rules.requiredCta}\n` : "") +
      (campaign.rules.requiredHashtags?.length ? `- Hashtags bắt buộc (bài viết phải chứa các hashtag này): ${campaign.rules.requiredHashtags.join(", ")}\n` : "") +
      (campaign.rules.forbiddenTerms?.length ? `- Các từ ngữ cấm sử dụng (không được xuất hiện trong bài viết): ${campaign.rules.forbiddenTerms.join(", ")}\n` : "")
      : "";

    const userPrompt = `
Tiêu đề: ${content.title}
Nội dung bài đăng:
"""
${content.bodyText}
"""${rulesSection}
`;

    const responseSchema = {
      type: "object",
      properties: {
        score: { type: "number" },
        passed: { type: "boolean" },
        rejectionReasons: { type: "array", items: { type: "string" } },
      },
      required: ["score", "passed", "rejectionReasons"],
    };

    const model = process.env.OPENROUTER_TEXT_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash";

    console.log(`[QcAgent] Auditing content for slot ${slot._id}...`);
    try {
      const result = await openrouterChat({
        model,
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        jsonMode: true,
        responseSchema,
      });

      const audit = JSON.parse(result.text);

      if (!audit.passed || audit.score < 7 || (audit.rejectionReasons && audit.rejectionReasons.length > 0)) {
        return {
          passed: false,
          score: audit.score,
          reasons: audit.rejectionReasons || ["Nội dung không đạt điểm chất lượng tối thiểu (7/10)."],
        };
      }

      return { passed: true, score: audit.score, reasons: [] };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if ((err as { code?: string })?.code === "AI_SUBSCRIPTION_LIMIT") throw err;
      console.warn(`[QcAgent] Editorial sweep failed: ${msg}. Defaulting to basic structural pass.`);
      // Fallback: If AI fails but structural check passed
      return { passed: false, score: 0, reasons: ["Không thể hoàn tất kiểm duyệt nội dung. Vui lòng thử lại."] };
    }
  }
}
