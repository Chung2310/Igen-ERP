import { useState, useEffect } from 'react';
import { ImageIcon, Mic, Video } from 'lucide-react';
import { ImageGenerationWorkspace } from './ImageGenerationWorkspace';
import { SimpleVideoWorkspace } from './SimpleVideoWorkspace';
import { VoiceGenerationWorkspace } from './VoiceGenerationWorkspace';

interface ContentStudioWorkspaceProps {
  initialParams?: {
    tab: 'image' | 'video' | 'voice';
    prompt: string;
    cardId: string;
  } | null;
  onClearParams?: () => void;
  onMediaSaved?: (cardId: string, mediaUrl: string, type: 'image' | 'video') => void;
}

export function ContentStudioWorkspace({ initialParams, onClearParams, onMediaSaved }: ContentStudioWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<'image' | 'video' | 'voice'>(initialParams?.tab || 'image');

  useEffect(() => {
    if (initialParams) {
      setActiveTab(initialParams.tab);
    }
  }, [initialParams]);

  useEffect(() => {
    return () => {
      onClearParams?.();
    };
  }, [onClearParams]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-[linear-gradient(180deg,#fcfdfd_0%,#f4f8fb_100%)]" id="content_studio_workspace_root">
      <div className="shrink-0 border-b border-slate-200/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/75">
        <div className="mx-auto flex w-full max-w-[1500px] items-center justify-center py-1.5 px-4 md:px-6">
          <div className="inline-flex w-fit items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              onClick={() => setActiveTab('image')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                activeTab === 'image' ? 'bg-white text-slate-950 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:bg-white/80'
              }`}
            >
              <ImageIcon className="h-3.5 w-3.5" />
              Tạo hình ảnh
            </button>
            <button
              onClick={() => setActiveTab('video')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                activeTab === 'video' ? 'bg-white text-slate-950 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:bg-white/80'
              }`}
            >
              <Video className="h-3.5 w-3.5" />
              Tạo video
            </button>
            <button
              onClick={() => setActiveTab('voice')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                activeTab === 'voice' ? 'bg-white text-slate-950 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:bg-white/80'
              }`}
            >
              <Mic className="h-3.5 w-3.5" />
              Tạo giọng nói
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 md:px-6 md:py-4" id="content_studio_tab_body">
        {activeTab === 'image' && (
          <ImageGenerationWorkspace
            initialPrompt={initialParams?.prompt}
            cardId={initialParams?.cardId}
            onMediaSaved={onMediaSaved}
          />
        )}
        {activeTab === 'video' && (
          <SimpleVideoWorkspace
            initialPrompt={initialParams?.prompt}
            cardId={initialParams?.cardId}
            onMediaSaved={onMediaSaved}
          />
        )}
        {activeTab === 'voice' && <VoiceGenerationWorkspace />}
      </div>
    </div>
  );
}
