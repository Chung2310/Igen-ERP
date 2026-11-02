import { lazy, Suspense, useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { CampaignMediaLaunch } from "./campaignMedia";
import CampaignVideoUpload from "./CampaignVideoUpload";

const ImageWorkspace = lazy(() => import("../../../shared/components/content-studio/ImageGenerationWorkspace").then((module) => ({ default: module.ImageGenerationWorkspace })));
const VoiceWorkspace = lazy(() => import("../../../shared/components/content-studio/VoiceGenerationWorkspace").then((module) => ({ default: module.VoiceGenerationWorkspace })));
const BulkWorkspace = lazy(() => import("../../../shared/components/content-studio/BulkCreateWorkspace").then((module) => ({ default: module.BulkCreateWorkspace })));

interface Props {
  launch: CampaignMediaLaunch;
  onClose: () => void;
  onMediaSaved: (cardId: string, url: string, type: "image" | "video" | "audio") => void | Promise<void>;
}

export default function CampaignMediaDialog({ launch, onClose, onMediaSaved }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  const common = { cardId: launch.cardId, autoTrigger: launch.autoTrigger, onMediaSaved };
  return <dialog ref={dialogRef} onCancel={onClose} aria-label="Tạo media cho chiến dịch" className="m-auto h-[92vh] w-[96vw] max-w-[1500px] rounded-2xl border-0 bg-white p-0 shadow-2xl backdrop:bg-slate-950/60">
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
        <h2 className="font-semibold text-slate-800">Tạo media cho chiến dịch</h2>
        <button type="button" onClick={onClose} aria-label="Đóng tạo media" className="rounded-lg p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <Suspense fallback={<p className="p-6 text-center text-slate-500">Đang tải công cụ tạo media...</p>}>
          {launch.kind === "image" && <ImageWorkspace {...common} initialPrompt={launch.prompt} initialImage={launch.image} />}
          {launch.kind === "video" && <CampaignVideoUpload cardId={launch.cardId!} onMediaSaved={onMediaSaved} />}
          {launch.kind === "voice" && <VoiceWorkspace {...common} initialText={launch.prompt} initialTitle={launch.title} initialDescription={launch.description} />}
          {launch.kind === "bulk" && <BulkWorkspace initialCampaignId={launch.campaignId} onClose={onClose} />}
        </Suspense>
      </div>
    </div>
  </dialog>;
}
