import type { PrivateImageAsset } from "./cloudinary.service";
import type { FaceReasonCode } from "./insightface.service";

interface GateInput { uid: string; image: Buffer; mimeType: string }
interface GateDependencies {
  cloudinary: { uploadPrivateImage(buffer: Buffer, folder: string): Promise<PrivateImageAsset> };
  insightFace: { verifyEmployee(uid: string, image: Buffer, mimeType: string): Promise<any> };
}

export async function verifyAttendanceFace(input: GateInput, deps: GateDependencies) {
  const evidence = await deps.cloudinary.uploadPrivateImage(input.image, "attendance/evidence");
  const verification = await deps.insightFace.verifyEmployee(input.uid, input.image, input.mimeType);
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