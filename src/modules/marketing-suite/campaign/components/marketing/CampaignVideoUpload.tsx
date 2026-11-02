import { useState, type ChangeEvent } from "react";
import { uploadEditorMedia, validateEditorMediaMetadata } from "../../../shared/services/videoProjectMediaService";

interface Props {
  cardId: string;
  onMediaSaved: (cardId: string, url: string, type: "video") => void | Promise<void>;
}

export default function CampaignVideoUpload({ cardId, onMediaSaved }: Props) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState("");
  const [error, setError] = useState("");

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || uploading) return;
    setError("");
    setUploading(true);
    setProgress(0);
    try {
      if (validateEditorMediaMetadata(file).mediaType !== "video") {
        throw new Error("Vui lòng chọn file video MP4, MOV hoặc WebM.");
      }
      const media = await uploadEditorMedia(file, setProgress);
      await onMediaSaved(cardId, media.url, "video");
      setVideoUrl(media.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tải và gắn video vào bài đăng.");
    } finally {
      setUploading(false);
    }
  };

  return <section className="mx-auto max-w-3xl space-y-4 p-4">
    <h3 className="text-lg font-semibold text-slate-800">Video của bạn</h3>
    <p className="text-sm text-slate-600">Tải video MP4, MOV hoặc WebM, tối đa 200MB, để gắn vào bài chiến dịch.</p>
    <input type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" disabled={uploading} onChange={(event) => { void upload(event); }} aria-label="Chọn video cho bài chiến dịch" className="block w-full rounded-xl border border-slate-200 p-3 text-sm" />
    {uploading && <p role="status" className="text-sm text-slate-600">Đang tải và lưu video... {progress}%</p>}
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    {videoUrl && <>
      <p role="status" className="text-sm text-emerald-700">Đã gắn video vào bài chiến dịch.</p>
      <video src={videoUrl} controls className="w-full rounded-xl bg-slate-950" />
    </>}
  </section>;
}
