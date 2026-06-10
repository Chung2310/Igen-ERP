import { useState, useEffect } from 'react';
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

  // Clean up params only when the entire Content Studio Workspace is closed/unmounted
  useEffect(() => {
    return () => {
      onClearParams?.();
    };
  }, [onClearParams]);

  return (
    <div className="flex flex-col w-full h-full min-h-0 bg-white" id="content_studio_workspace_root">
      {/* Tab Navigation header */}
      <div className="border-b border-gray-200 bg-gray-50/50 p-2 text-xs flex justify-between shrink-0" id="content_studio_tab_switch">
        <div className="flex gap-2 mx-auto max-w-3xl w-full justify-center">
          <button
            onClick={() => setActiveTab('image')}
            className={`px-6 py-2.5 rounded-full border text-xs font-bold uppercase transition-all tracking-wider ${
              activeTab === 'image'
                ? "bg-cyan-500 text-white border-cyan-500 shadow-md shadow-cyan-500/20"
                : "bg-white text-gray-500 border-gray-200 hover:bg-gray-100"
            }`}
          >
            Tạo hình ảnh
          </button>
          <button
            onClick={() => setActiveTab('video')}
            className={`px-6 py-2.5 rounded-full border text-xs font-bold uppercase transition-all tracking-wider ${
              activeTab === 'video'
                ? "bg-cyan-500 text-white border-cyan-500 shadow-md shadow-cyan-500/20"
                : "bg-white text-gray-500 border-gray-200 hover:bg-gray-100"
            }`}
          >
            Tạo video
          </button>
          <button
            onClick={() => setActiveTab('voice')}
            className={`px-6 py-2.5 rounded-full border text-xs font-bold uppercase transition-all tracking-wider ${
              activeTab === 'voice'
                ? "bg-cyan-500 text-white border-cyan-500 shadow-md shadow-cyan-500/20"
                : "bg-white text-gray-500 border-gray-200 hover:bg-gray-100"
            }`}
          >
            Tạo giọng nói
          </button>
        </div>
      </div>

      {/* Tab Content Display Area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6" id="content_studio_tab_body">
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
