import { VideoCaptionProjectModel } from "../model/video-caption-project.model";
import { VideoCaptionSegmentModel } from "../model/video-caption-segment.model";
import type { IVideoCaptionProject } from "../interface/video-caption.interface";

/** Concurrent writers stage different versions before switching the active pointer. */
export async function allocateCaptionVersion(project: IVideoCaptionProject) {
  const latest = await VideoCaptionSegmentModel.findOne({ companyCode: project.companyCode, projectId: project._id })
    .sort({ version: -1 }).select("version").lean();
  const reserved = await VideoCaptionProjectModel.findOneAndUpdate(
    { _id: project._id, companyCode: project.companyCode },
    [{ $set: { versionSequence: { $add: [{ $max: [
      { $ifNull: ["$versionSequence", 0] }, "$currentVersion", latest?.version || 0,
    ] }, 1] } } }],
    { returnDocument: "after", updatePipeline: true },
  ).select("versionSequence").lean();
  if (!reserved?.versionSequence) throw new Error("Không thể cấp phiên bản caption.");
  return reserved.versionSequence;
}

export async function discardCaptionVersion(project: IVideoCaptionProject, version: number) {
  // A lost commit acknowledgement must never delete the active version.
  const active = await VideoCaptionProjectModel.exists({ _id: project._id, companyCode: project.companyCode, currentVersion: version });
  if (active) return;
  await VideoCaptionSegmentModel.deleteMany({ companyCode: project.companyCode, projectId: project._id, version });
}
