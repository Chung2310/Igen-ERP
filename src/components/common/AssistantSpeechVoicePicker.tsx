import { Check, ChevronDown } from "lucide-react";
import { useRef } from "react";
import {
  assistantSpeechVoiceProfiles,
  getAssistantSpeechVoiceProfile,
  type AssistantSpeechVoice,
} from "../../shared/assistant-speech-voices";

function VietnamFlag() {
  return <img src="/flag-vietnam.svg" alt="" aria-hidden="true" className="size-4 shrink-0 rounded-full border border-outline-variant object-cover" />;
}

function VoicePortrait({ voice, size = "large" }: { voice: AssistantSpeechVoice; size?: "large" | "small" }) {
  const profile = getAssistantSpeechVoiceProfile(voice);
  const column = profile.portraitIndex % 7;
  const row = Math.floor(profile.portraitIndex / 7);
  const backgroundPosition = `${Math.round(column * 100 / 6)}% ${row * 50}%`;

  return <span
    aria-hidden="true"
    className={`block shrink-0 rounded-full border border-outline-variant bg-surface-container-low bg-cover ${size === "large" ? "size-14" : "size-10"}`}
    style={{
      backgroundImage: "url('/ai-studio-vietnamese-voices.png')",
      backgroundSize: "700% 300%",
      backgroundPosition,
    }}
  />;
}

export default function AssistantSpeechVoicePicker({
  value,
  onChange,
  label = "Giọng đọc tiếng Việt",
  describedBy,
}: {
  value: AssistantSpeechVoice;
  onChange: (voice: AssistantSpeechVoice) => void;
  label?: string;
  describedBy?: string;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const selected = getAssistantSpeechVoiceProfile(value);

  return <fieldset aria-describedby={describedBy} className="min-w-0 space-y-2">
    <legend className="text-sm font-medium text-on-surface">{label}</legend>
    <details
      ref={detailsRef}
      className="group relative"
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !detailsRef.current?.open) return;
        detailsRef.current.open = false;
        summaryRef.current?.focus();
      }}
    >
      <summary
        ref={summaryRef}
        aria-label={`Chọn giọng đọc. Đang chọn ${selected.name}, giọng ${selected.gender.toLowerCase()}, quốc tịch Việt Nam.`}
        className="flex min-h-16 cursor-pointer list-none items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-3 text-left hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden"
      >
        <VoicePortrait voice={selected.id} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-on-surface">{selected.name}</span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-on-surface-variant">
            <span className="rounded-full bg-surface-container-low px-2 py-0.5">{selected.gender}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-low px-2 py-0.5"><VietnamFlag />Việt Nam</span>
          </span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-on-surface-variant group-open:rotate-180" aria-hidden="true" />
      </summary>
      <ul className="absolute left-0 right-0 top-full z-20 mt-2 max-h-72 space-y-1 overflow-y-auto rounded-xl border border-outline-variant bg-surface-container-lowest p-2 shadow-lg">
        {assistantSpeechVoiceProfiles.map((profile) => (
          <li key={profile.id}>
            <button
              type="button"
              aria-pressed={value === profile.id}
              onClick={() => {
                onChange(profile.id);
                if (detailsRef.current) detailsRef.current.open = false;
                summaryRef.current?.focus();
              }}
              className="flex min-h-14 w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary"
            >
              <VoicePortrait voice={profile.id} size="small" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-on-surface">{profile.name}</span>
                <span className="inline-flex items-center gap-1 text-xs text-on-surface-variant">{profile.gender} · <VietnamFlag />Việt Nam</span>
              </span>
              {value === profile.id && <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />}
            </button>
          </li>
        ))}
      </ul>
    </details>
  </fieldset>;
}
