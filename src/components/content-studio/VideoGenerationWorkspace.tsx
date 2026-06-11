import { useState } from 'react';
import { Clapperboard, Sparkles, Wand2 } from 'lucide-react';
import { HeyGenWorkspace } from './HeyGenWorkspace';
import { SimpleVideoWorkspace } from './SimpleVideoWorkspace';

interface VideoGenerationWorkspaceProps {
  initialPrompt?: string;
  cardId?: string;
  onMediaSaved?: (cardId: string, mediaUrl: string, type: 'image' | 'video') => void;
}

type VideoToolTab = 'veo' | 'heygen' | 'edit-video';

const VIDEO_TOOL_TABS: Array<{
  id: VideoToolTab;
  label: string;
  icon: typeof Sparkles;
}> = [
  { id: 'veo', label: 'Veo', icon: Sparkles },
  { id: 'heygen', label: 'HeyGen', icon: Clapperboard },
  { id: 'edit-video', label: 'Edit Video', icon: Wand2 },
];

export function VideoGenerationWorkspace({
  initialPrompt,
  cardId,
  onMediaSaved,
}: VideoGenerationWorkspaceProps) {
  const [activeVideoTab, setActiveVideoTab] = useState<VideoToolTab>('veo');

  return (
    <div className="flex flex-col gap-4">
      <div className="mx-auto flex w-full max-w-[1500px] items-center justify-start px-2">
        <div className="inline-flex w-fit items-center gap-1 rounded-2xl border border-slate-200 bg-white/90 p-1 shadow-sm">
          {VIDEO_TOOL_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveVideoTab(id)}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                activeVideoTab === id
                  ? 'bg-slate-950 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {activeVideoTab === 'veo' && (
        <SimpleVideoWorkspace
          initialPrompt={initialPrompt}
          cardId={cardId}
          onMediaSaved={onMediaSaved}
        />
      )}

      {activeVideoTab === 'heygen' && <HeyGenWorkspace initialPrompt={initialPrompt} />}

      {activeVideoTab === 'edit-video' && (
        <VideoToolPlaceholder
          title="Edit Video Workspace"
          description="Tab nay da san sang cho cac tinh nang cat ghep, them subtitle, thay nen hoac hau ky video."
          badge="Ready for integration"
        />
      )}
    </div>
  );
}

function VideoToolPlaceholder({
  title,
  description,
  badge,
}: {
  title: string;
  description: string;
  badge: string;
}) {
  return (
    <div className="mx-auto w-full max-w-[1500px] px-2">
      <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f5fafc_100%)] p-8 shadow-sm">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-700">Video Studio</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-900">{title}</h3>
          </div>
          <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-semibold text-cyan-700">
            {badge}
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-semibold text-slate-900">Trang thai</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
          </div>
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5">
            <p className="text-sm font-semibold text-slate-900">Goi y use case</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Tach cong cu chuyen biet khoi luong Veo hien tai de giao dien ro rang hon cho nguoi van hanh.
            </p>
          </div>
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5">
            <p className="text-sm font-semibold text-slate-900">San sang mo rong</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Khi can, minh co the noi tiep API va khu preview rieng cho tung tab ma khong phai sua lai cau truc tong.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
