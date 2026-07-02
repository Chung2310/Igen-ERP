import { Request, Response } from "express";
import { opusclipService } from "../service/opusclip.service";
import { OpusClipProjectModel } from "../model/opusclip-project.model";
import { emitToUser } from "../socket";
import { walletService, API_COSTS } from "../service/wallet.service";

/**
 * Tính phí OpusClip theo phút video gốc: tối thiểu 1 phút, làm tròn lên.
 */
function calcOpusclipCost(durationSec: number): { minutes: number; cost: number } {
  const minutes = Math.max(1, Math.ceil(durationSec / 60));
  return { minutes, cost: minutes * API_COSTS.OPUSCLIP_PER_MINUTE };
}

/**
 * Trích xuất thời lượng video gốc (giây) từ payload/detail OpusClip trả về.
 * Thử lần lượt các field khả dĩ; fallback: endTime lớn nhất trong danh sách clips.
 */
function extractSourceDurationSec(detail: any, mappedClips: any[]): number | null {
  const candidatesMs = [
    detail?.videoDurationMs,
    detail?.durationMs,
    detail?.sourceDurationMs,
    detail?.videoMeta?.durationMs,
  ];
  for (const ms of candidatesMs) {
    const num = Number(ms);
    if (num > 0) return num / 1000;
  }

  const candidatesSec = [
    detail?.videoDuration,
    detail?.duration,
    detail?.sourceDuration,
    detail?.videoMeta?.duration,
  ];
  for (const sec of candidatesSec) {
    const num = Number(sec);
    if (num > 0) return num;
  }

  // Fallback: mốc thời gian kết thúc xa nhất của các clip trên video gốc
  const maxEnd = (mappedClips || []).reduce((max, c) => Math.max(max, c.endTime || 0), 0);
  return maxEnd > 0 ? maxEnd : null;
}

/**
 * Quyết toán phí khi dự án hoàn thành: chỉ áp dụng cho dự án đang tạm giữ ("estimated").
 * Trừ thêm nếu phí thực > phí tạm giữ, hoàn lại phần thừa nếu ngược lại.
 * Không ném lỗi ra ngoài — quyết toán thất bại không được chặn việc hoàn thành dự án.
 */
async function settleProjectBilling(project: any, detail: any, mappedClips: any[]): Promise<void> {
  if (project.billingStatus !== "estimated") return;

  try {
    const actualSec = extractSourceDurationSec(detail, mappedClips);
    if (!actualSec) {
      console.warn(`[OpusClipBilling] Không xác định được thời lượng thực của ${project.projectId}. Giữ nguyên mức phí tạm giữ ${project.chargedCredits} Credit.`);
      project.billingStatus = "settled";
      return;
    }

    const { minutes, cost: actualCost } = calcOpusclipCost(actualSec);
    const diff = actualCost - (project.chargedCredits || 0);
    const userId = project.userId.toString();

    if (diff > 0) {
      try {
        await walletService.deductBalance(userId, diff, `Quyết toán bổ sung OpusClip Long-to-Short (${minutes} phút, dự án ${project.projectId})`);
      } catch (deductErr: any) {
        // Ví không đủ để trừ thêm: log lại, vẫn cho dự án hoàn thành
        console.error(`[OpusClipBilling] Không trừ được ${diff} Credit bổ sung cho ${project.projectId}:`, deductErr.message);
      }
    } else if (diff < 0) {
      await walletService.refundBalance(userId, -diff, `Hoàn phần tạm giữ thừa OpusClip Long-to-Short (thực tế ${minutes} phút, dự án ${project.projectId})`);
    }

    project.sourceDurationSec = Math.round(actualSec);
    project.chargedCredits = actualCost;
    project.billingStatus = "settled";
    console.log(`[OpusClipBilling] Quyết toán ${project.projectId}: ${minutes} phút = ${actualCost} Credit (chênh lệch ${diff}).`);
  } catch (err: any) {
    console.error(`[OpusClipBilling] Lỗi quyết toán ${project.projectId}:`, err.message);
  }
}

/**
 * Hoàn credits khi dự án thất bại. Idempotent — không hoàn trùng.
 */
async function refundProjectOnFailure(project: any): Promise<number> {
  if (project.billingStatus === "refunded" || !(project.chargedCredits > 0)) {
    return 0;
  }
  try {
    await walletService.refundBalance(
      project.userId.toString(),
      project.chargedCredits,
      `OpusClip Long-to-Short xử lý thất bại (dự án ${project.projectId})`
    );
    project.billingStatus = "refunded";
    return project.chargedCredits;
  } catch (err: any) {
    console.error(`[OpusClipBilling] Lỗi hoàn tiền cho ${project.projectId}:`, err.message);
    return 0;
  }
}

/**
 * Map dữ liệu clips từ OpusClip API về schema Database local.
 * Bỏ qua các clip không có videoUrl (schema yêu cầu bắt buộc, và không có URL thì không hiển thị được).
 */
function mapClips(rawClips: any[]): any[] {
  return (rawClips || [])
    .filter((clip: any) => clip && (clip.uriForPreview || clip.uriForExport || clip.videoUrl))
    .map((clip: any, index: number) => ({
      clipId: clip.curationId || clip.id?.split(".")[1] || clip.id || `clip_${index + 1}`,
      videoUrl: clip.uriForPreview || clip.uriForExport || clip.videoUrl,
      title: clip.title || "",
      description: clip.description || "",
      hashtags: Array.isArray(clip.hashtags) ? clip.hashtags.join(" ") : (clip.hashtags || ""),
      viralityScore: clip.score || clip.viralityScore || clip.judgeResult?.curvedScore || 0,
      viralReason: clip.judgeResult?.trendComment || clip.viralReason || "",
      duration: clip.durationMs ? Math.round(clip.durationMs / 1000) : 0,
      startTime: clip.timeRanges?.[0]?.[0] ? Math.round(clip.timeRanges[0][0] / 1000) : 0,
      endTime: clip.timeRanges?.[clip.timeRanges.length - 1]?.[1] ? Math.round(clip.timeRanges[clip.timeRanges.length - 1][1] / 1000) : 0,
    }));
}

export const opusclipController = {
  /**
   * API: POST /api/v1/opusclip/projects
   * Khởi tạo dự án cắt ghép video dài thành ngắn bằng AI
   */
  async createProject(req: Request, res: Response) {
    try {
      const { videoUrl, name, lengthOption, sourceLang, brandTemplateId } = req.body;
      const userId = (req as any).user?.id || (req as any).user?._id;

      if (!userId) {
        return res.status(401).json({ status: "error", message: "Yêu cầu đăng nhập để sử dụng tính năng." });
      }

      console.log(`[OpusClipController.createProject] User ${userId} requested create project. URL: ${videoUrl}`);

      // 1. Đo thời lượng video gốc để tính phí (1 phút = OPUSCLIP_PER_MINUTE credits)
      const measuredSec = await opusclipService.measureVideoDurationSec(videoUrl);
      let minutes: number;
      let cost: number;
      let billingStatus: "estimated" | "settled";

      if (measuredSec) {
        // Đo được thời lượng chính xác → trừ đúng ngay
        ({ minutes, cost } = calcOpusclipCost(measuredSec));
        billingStatus = "settled";
      } else {
        // Link YouTube/Drive không đo được → tạm giữ mức tối thiểu, quyết toán khi hoàn thành
        minutes = API_COSTS.OPUSCLIP_MIN_HOLD_MINUTES;
        cost = minutes * API_COSTS.OPUSCLIP_PER_MINUTE;
        billingStatus = "estimated";
      }

      // 2. Kiểm tra số dư ví (ném lỗi 402 nếu không đủ)
      await walletService.checkBalance(userId, cost);

      // 3. Gửi yêu cầu khởi tạo dự án lên OpusClip API
      const opusProject = await opusclipService.createProject({
        videoUrl,
        name: name || "Video Long-to-Short",
        lengthOption,
        sourceLang,
        brandTemplateId,
      });

      const projectId = opusProject.id || opusProject.projectId;
      if (!projectId) {
        throw new Error("OpusClip không trả về mã dự án (projectId) hợp lệ.");
      }

      // 4. Lưu thông tin dự án vào Database MongoDB với trạng thái "processing"
      const localProject = await OpusClipProjectModel.create({
        userId,
        projectId,
        videoUrl,
        name: name || `Project ${projectId}`,
        status: "processing",
        lengthOption,
        language: sourceLang || "auto",
        brandTemplateId: brandTemplateId || "",
        clips: [],
        sourceDurationSec: measuredSec ? Math.round(measuredSec) : 0,
        chargedCredits: cost,
        billingStatus,
      });

      // 5. Khấu trừ credits sau khi tạo dự án thành công
      const chargeNote = billingStatus === "settled"
        ? `Chi phí cắt video Long-to-Short OpusClip (${minutes} phút, dự án ${projectId})`
        : `Tạm giữ chi phí cắt video Long-to-Short OpusClip (${minutes} phút, quyết toán khi hoàn thành, dự án ${projectId})`;
      await walletService.deductBalance(userId, cost, chargeNote);

      return res.status(201).json({
        status: "success",
        message: "Tạo dự án OpusClip thành công, đang tiến hành xử lý.",
        data: localProject,
        costApplied: {
          minutes,
          costPerMinute: API_COSTS.OPUSCLIP_PER_MINUTE,
          totalCost: cost,
          isEstimated: billingStatus === "estimated",
        },
      });
    } catch (error: any) {
      console.error("[OpusClipController.createProject] Error:", error.message);
      return res.status(error.statusCode || 500).json({
        status: "error",
        message: error.message || "Đã xảy ra lỗi khi tạo dự án OpusClip.",
      });
    }
  },

  /**
   * API: GET /api/v1/opusclip/projects
   * Lấy danh sách dự án cắt video của người dùng hiện tại (có phân trang & lọc)
   */
  async getProjects(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id || (req as any).user?._id;
      if (!userId) {
        return res.status(401).json({ status: "error", message: "Yêu cầu đăng nhập." });
      }

      // Chấp nhận cả page/limit lẫn pageNum/pageSize để tương thích với frontend
      const page = parseInt((req.query.page || req.query.pageNum) as string, 10) || 1;
      const limit = parseInt((req.query.limit || req.query.pageSize) as string, 10) || 10;
      const status = req.query.status as string;

      const filter: Record<string, any> = { userId };
      if (status) {
        filter.status = status;
      }

      const total = await OpusClipProjectModel.countDocuments(filter);
      const list = await OpusClipProjectModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);

      return res.status(200).json({
        status: "success",
        data: {
          list,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error: any) {
      console.error("[OpusClipController.getProjects] Error:", error.message);
      return res.status(500).json({
        status: "error",
        message: "Không thể lấy danh sách dự án.",
      });
    }
  },

  /**
   * API: GET /api/v1/opusclip/projects/:projectId
   * Lấy chi tiết dự án cắt video
   */
  async getProjectDetail(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const userId = (req as any).user?.id || (req as any).user?._id;

      if (!userId) {
        return res.status(401).json({ status: "error", message: "Yêu cầu đăng nhập." });
      }

      const project = await OpusClipProjectModel.findOne({ projectId, userId });
      if (!project) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy dự án." });
      }

      // Nếu dự án đang ở trạng thái xử lý, tiến hành sync thử trạng thái mới từ API
      if (project.status === "processing") {
        try {
          const detail = await opusclipService.getProjectDetail(projectId);
          const stage = detail.stage || detail.status;

          if (stage === "COMPLETE") {
            const rawClips = await opusclipService.getAllClips(projectId);
            const mappedClips = mapClips(rawClips);
            project.status = "completed";
            project.clips = mappedClips as any;
            // Quyết toán phần phí tạm giữ (nếu có) theo thời lượng thực
            await settleProjectBilling(project, detail, mappedClips);
            await project.save();
          } else if (stage === "FAILED" || stage === "STALLED") {
            project.status = "failed";
            project.error = detail.error || "Dự án bị lỗi trong lúc xử lý.";
            // Hoàn credits đã trừ cho user (idempotent)
            await refundProjectOnFailure(project);
            await project.save();
          }
        } catch (syncErr: any) {
          console.warn(`[OpusClipController] Sync status failed for ${projectId}:`, syncErr.message);
        }
      }

      return res.status(200).json({
        status: "success",
        data: project,
      });
    } catch (error: any) {
      console.error("[OpusClipController.getProjectDetail] Error:", error.message);
      return res.status(500).json({
        status: "error",
        message: "Không thể lấy chi tiết dự án.",
      });
    }
  },

  /**
   * Webhook: POST /api/v1/opusclip/webhook
   * Tiếp nhận callback tự động từ OpusClip khi video xử lý xong hoặc bị lỗi
   */
  async handleWebhook(req: Request, res: Response) {
    try {
      const rawBody = (req as any).rawBody;
      const headers = req.headers as Record<string, string | undefined>;

      console.log("[OpusClipController.handleWebhook] Received webhook. Verification in progress...");

      // 1. Xác thực chữ ký webhook bằng bảo mật HMAC-SHA256
      const isValid = opusclipService.verifyWebhookSignature(rawBody, headers);
      if (!isValid) {
        console.warn("[OpusClipController.handleWebhook] Webhook verification failed. Unauthorized.");
        return res.status(401).json({ status: "error", message: "Xác thực chữ ký thất bại." });
      }

      console.log("[OpusClipController.handleWebhook] Signature verified successfully. Processing payload...");

      // 2. Phân tích nội dung payload nhận được
      const payload = req.body;
      const salt = headers["x-opus-salt"];
      const projectId = payload.projectId || payload.id;
      const stage = payload.stage || payload.status; // COMPLETE, FAILED, processing, v.v.

      if (!projectId) {
        console.warn("[OpusClipController.handleWebhook] Webhook rejected: Missing projectId in payload.");
        return res.status(400).json({ status: "error", message: "Thiếu projectId." });
      }

      // Tìm kiếm dự án tương ứng trong MongoDB
      const project = await OpusClipProjectModel.findOne({ projectId });
      if (!project) {
        console.warn(`[OpusClipController.handleWebhook] Project ${projectId} not found in database.`);
        opusclipService.markSaltProcessed(salt);
        return res.status(200).json({ status: "success", message: "Dự án không tồn tại cục bộ." });
      }

      // 3. Xử lý cập nhật DB tuỳ theo trạng thái
      if (stage === "COMPLETE") {
        // Idempotent: dự án đã hoàn thành trước đó (webhook trùng lặp) thì trả 200 luôn
        if (project.status === "completed") {
          console.log(`[OpusClipController.handleWebhook] Project ${projectId} already completed. Skipping duplicate event.`);
          opusclipService.markSaltProcessed(salt);
          return res.status(200).json({ status: "success", message: "Dự án đã hoàn thành trước đó." });
        }

        console.log(`[OpusClipController.handleWebhook] Project ${projectId} processed successfully. Fetching clips...`);

        // Gọi API lấy đầy đủ danh sách clips (tất cả các trang)
        const rawClips = await opusclipService.getAllClips(projectId);
        const mappedClips = mapClips(rawClips);

        project.status = "completed";
        project.clips = mappedClips as any;

        // Quyết toán phí tạm giữ theo thời lượng thực (thử payload trước, thiếu thì hỏi detail API)
        if (project.billingStatus === "estimated") {
          let detailForBilling: any = payload;
          if (!extractSourceDurationSec(payload, [])) {
            try {
              detailForBilling = await opusclipService.getProjectDetail(projectId);
            } catch (detailErr: any) {
              console.warn(`[OpusClipBilling] Không lấy được detail để quyết toán ${projectId}:`, detailErr.message);
            }
          }
          await settleProjectBilling(project, detailForBilling, mappedClips);
        }

        await project.save();

        console.log(`[OpusClipController.handleWebhook] Local database updated for ${projectId}. Emitting event to owner...`);
        // Bắn sự kiện qua Socket.IO tới đúng user sở hữu dự án (không broadcast toàn server)
        emitToUser(project.userId.toString(), "opusclip:completed", {
          projectId,
          userId: project.userId.toString(),
          status: "completed",
          clips: mappedClips,
        });
      } else if (stage === "FAILED" || stage === "STALLED") {
        const errorMsg = payload.error || "Dự án bị lỗi trong lúc xử lý trên OpusClip.";
        console.log(`[OpusClipController.handleWebhook] Project ${projectId} failed processing. Error: ${errorMsg}`);

        project.status = "failed";
        project.error = errorMsg;
        // Hoàn credits đã trừ cho user (idempotent — không hoàn trùng khi webhook lặp lại)
        const refundedCredits = await refundProjectOnFailure(project);
        await project.save();

        emitToUser(project.userId.toString(), "opusclip:failed", {
          projectId,
          userId: project.userId.toString(),
          status: "failed",
          error: project.error,
          refundedCredits,
        });
      } else {
        console.log(`[OpusClipController.handleWebhook] Project ${projectId} stage update: ${stage}`);
      }

      // Chỉ đánh dấu salt sau khi toàn bộ xử lý thành công.
      // Nếu code phía trên ném lỗi (trả 500), OpusClip retry cùng salt vẫn được chấp nhận.
      opusclipService.markSaltProcessed(salt);

      return res.status(200).json({ status: "success", message: "Webhook processed successfully." });
    } catch (error: any) {
      console.error("[OpusClipController.handleWebhook] Error processing webhook:", error.message);
      return res.status(500).json({ status: "error", message: "Lỗi xử lý webhook." });
    }
  },
};
