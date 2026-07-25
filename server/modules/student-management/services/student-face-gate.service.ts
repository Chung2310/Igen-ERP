import type { PrivateImageAsset } from "../../../service/cloudinary.service";
import type { FaceReasonCode } from "../../../service/insightface.service";

interface GateInput {
  insightFaceUserId: string;
  image: Buffer;
  mimeType: string;
}

interface GateDependencies {
  cloudinary: { uploadPrivateImage(buffer: Buffer, folder: string): Promise<PrivateImageAsset> };
  insightFace: { verifyEmployee(userId: string, image: Buffer, mimeType: string): Promise<any> };
}

export async function verifyStudentAttendanceFace(input: GateInput, deps: GateDependencies) {
  const evidence = await deps.cloudinary.uploadPrivateImage(input.image, "student-attendance/evidence");
  const verification = await deps.insightFace.verifyEmployee(input.insightFaceUserId, input.image, input.mimeType);
  const accepted = verification.registered === true && verification.live === true &&
    verification.faceVerified === true && verification.reasonCode === "verified";
  return {
    accepted,
    reasonCode: verification.reasonCode as FaceReasonCode,
    evidence,
    evidenceDeleteAfter: accepted ? undefined : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    verification,
  };
}
