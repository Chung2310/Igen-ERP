import { existsSync } from "fs";

function isUsableConfiguredBinary(configured: string) {
  const looksLikeCommandName = !configured.includes("/") && !configured.includes("\\");
  return looksLikeCommandName || existsSync(configured);
}

export function resolveMediaBinary(
  binaryName: "ffmpeg" | "ffprobe",
  configuredPath?: string
) {
  const configured = (configuredPath || (binaryName === "ffmpeg" ? process.env.FFMPEG_PATH : process.env.FFPROBE_PATH))?.trim();
  if (configured && isUsableConfiguredBinary(configured)) return configured;

  // Media tools are optional host dependencies, never bundled at startup.
  // Callers already report a clear unavailable error when spawn returns ENOENT.
  return binaryName;
}
