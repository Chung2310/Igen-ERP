import { useState } from "react";
import { AudioLines, FileAudio, FileText, History, Mic, Monitor, Upload } from "lucide-react";
import { cn } from "../../modules/student-management/lib/utils";
import "./AssistantMeetingNotes.css";

type MeetingMode = "record" | "upload";
type AudioSource = "microphone" | "browser";

const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

type MeetingIconName = "record" | "browser" | "upload" | "microphone" | "audioFile" | "document";

function MeetingIcon({ name, className }: { name: MeetingIconName; className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" focusable="false">
    {name === "record" && <><path d="M3 10v4m3-7v10m3-6v2m3-9v16m3-12v8m3-11v14m3-9v4" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /></>}
    {name === "browser" && <><rect x="2.5" y="3.5" width="19" height="16" rx="2.5" /><path d="M2.5 8h19M6 5.8h.01M9 5.8h.01m.5 6.7v3m3-5v7m3-4.5v2" /></>}
    {name === "upload" && <><path d="M5 3.5h9l5 5V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.5Z" /><path d="M14 3.5V9h5m-7 8v-6m-2.5 2.5L12 11l2.5 2.5" /></>}
    {name === "microphone" && <><rect x="9" y="2.5" width="6" height="12" rx="3" /><path d="M6 11.5a6 6 0 0 0 12 0M12 17.5v3m-3 0h6" /></>}
    {name === "audioFile" && <><path d="M5 3.5h9l5 5V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.5Z" /><path d="M14 3.5V9h5m-11 6v2m2-3v4m2-5v6m2-4v2m2-3v4" /></>}
    {name === "document" && <><path d="M5 3.5h9l5 5V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.5Z" /><path d="M14 3.5V9h5M8 12h8m-8 3h8m-8 3h5" /></>}
  </svg>;
}

export function AssistantMeetingNotes({ standalone = true }: { standalone?: boolean }) {
  const [mode, setMode] = useState<MeetingMode>("record");
  const [source, setSource] = useState<AudioSource>("microphone");
  const [showHistory, setShowHistory] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [notice, setNotice] = useState("");

  const changeMode = (nextMode: MeetingMode) => {
    setMode(nextMode);
    setShowHistory(false);
    setNotice("");
  };

  return <section aria-label="Ghi chép cuộc họp" className="min-h-0 flex-1 overflow-y-auto bg-surface-container-lowest px-4 py-5 text-on-surface sm:px-8 sm:py-7 lg:px-12">
    <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col">
      <div className={cn("flex flex-wrap items-start gap-4", standalone ? "justify-center" : "justify-between")}>
        {!standalone && <div className="hidden sm:block" aria-hidden="true" />}
        <div role="group" aria-label="Cách tạo ghi chép" className={cn("mx-auto flex w-full max-w-md rounded-xl bg-surface-container-low p-1", !standalone && "order-2 sm:order-1 sm:w-96")}>
          <button type="button" aria-pressed={!showHistory && mode === "record"} onClick={() => changeMode("record")} className={cn("assistant-meeting-tab min-h-9 flex-1 rounded-lg px-3 text-sm font-medium", !showHistory && mode === "record" ? "text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface", focusClass)}>Ghi âm</button>
          <button type="button" aria-pressed={!showHistory && mode === "upload"} onClick={() => changeMode("upload")} className={cn("assistant-meeting-tab min-h-9 flex-1 rounded-lg px-3 text-sm font-medium", !showHistory && mode === "upload" ? "text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface", focusClass)}>Tải tài liệu</button>
        </div>
        {!standalone && <button type="button" aria-pressed={showHistory} onClick={() => { setShowHistory(value => !value); setNotice(""); }} className={cn("order-1 ml-auto inline-flex min-h-9 items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm font-medium text-on-surface hover:bg-surface-container-low sm:order-2", focusClass)}><History className="size-4" aria-hidden="true" />Lịch sử</button>}
      </div>

      {showHistory ? <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-xl bg-surface-container-low text-primary"><History className="size-6" aria-hidden="true" /></div>
        <h2 className="mt-5 text-balance text-2xl font-semibold">Lịch sử ghi chép</h2>
        <p className="mt-2 max-w-md text-pretty text-sm leading-6 text-on-surface-variant">Các bản ghi và biên bản cuộc họp sẽ xuất hiện tại đây khi dịch vụ được kết nối.</p>
        <button type="button" onClick={() => setShowHistory(false)} className={cn("mt-6 min-h-10 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary/90", focusClass)}>Tạo ghi chép mới</button>
      </div> : <div className="flex flex-1 flex-col items-center justify-center py-12 sm:py-16">
        <div className="w-full text-center">
          <h2 className="text-balance text-2xl font-semibold sm:text-3xl">Ghi chép cuộc họp</h2>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-sm leading-6 text-on-surface-variant sm:text-base">Ghi chép, tóm tắt và tạo biên bản họp thông minh cho mọi cuộc họp của bạn</p>
          <p className="text-pretty text-sm text-on-surface-variant">Thời lượng tối đa 3 tiếng</p>
        </div>

        {mode === "record" ? <>
          <div role="group" aria-label="Nguồn âm thanh" className="mt-10 grid w-full gap-4 sm:mt-14 sm:grid-cols-2 sm:gap-6">
            <button type="button" aria-label="Ghi âm trực tiếp" aria-pressed={source === "microphone"} onClick={() => { setSource("microphone"); setNotice(""); }} className={cn("flex min-h-36 flex-col items-start rounded-xl border bg-surface-container-lowest p-5 text-left hover:bg-surface-container-low", standalone && "assistant-meeting-source", source === "microphone" ? standalone ? "shadow-sm" : "border-primary shadow-sm" : "border-outline-variant", focusClass)}>
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">{standalone ? <MeetingIcon name="record" className="size-5" /> : <AudioLines className="size-5" aria-hidden="true" />}</span>
              <span className="assistant-meeting-source-title mt-3 text-sm font-semibold">Ghi âm trực tiếp</span>
              <span className="mt-2 text-pretty text-sm leading-5 text-on-surface-variant">Ghi lại âm thanh từ micro của bạn ngay lập tức</span>
            </button>
            <button type="button" aria-label="Ghi âm tab trình duyệt" aria-pressed={source === "browser"} onClick={() => { setSource("browser"); setNotice(""); }} className={cn("flex min-h-36 flex-col items-start rounded-xl border bg-surface-container-lowest p-5 text-left hover:bg-surface-container-low", standalone && "assistant-meeting-source", source === "browser" ? standalone ? "shadow-sm" : "border-primary shadow-sm" : "border-outline-variant", focusClass)}>
              <span className="flex size-10 items-center justify-center rounded-lg bg-surface-container-low text-on-surface">{standalone ? <MeetingIcon name="browser" className="size-5" /> : <Monitor className="size-5" aria-hidden="true" />}</span>
              <span className="assistant-meeting-source-title mt-3 text-sm font-semibold">Ghi âm tab trình duyệt</span>
              <span className="mt-2 text-pretty text-sm leading-5 text-on-surface-variant">Ghi lại âm thanh từ một tab trình duyệt khác</span>
            </button>
          </div>
          <button type="button" onClick={() => setNotice("Giao diện đã sẵn sàng. Chức năng ghi âm sẽ hoạt động khi dịch vụ được kết nối.")} className={cn("mt-10 inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-on-primary hover:bg-primary/90 sm:mt-12", focusClass)}>{standalone ? <MeetingIcon name="microphone" className="size-4" /> : <Mic className="size-4" aria-hidden="true" />}Bắt đầu ghi âm</button>
        </> : <div className="mt-10 flex w-full max-w-xl flex-col items-center rounded-xl border border-outline-variant bg-surface-container-lowest p-6 text-center sm:mt-14 sm:p-8">
          <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">{standalone ? <MeetingIcon name="upload" className="size-6" /> : <Upload className="size-6" aria-hidden="true" />}</span>
          <h3 className="mt-4 text-balance text-base font-semibold">Tải tài liệu cuộc họp</h3>
          <p className="mt-2 text-pretty text-sm leading-6 text-on-surface-variant">Chọn tệp âm thanh hoặc tài liệu để chuẩn bị tạo ghi chép.</p>
          <label htmlFor="assistant-meeting-file" className="mt-5 block w-full text-left text-sm font-medium">Tệp cuộc họp</label>
          <input id="assistant-meeting-file" type="file" accept="audio/*,.pdf,.doc,.docx,.txt" onChange={event => { setFile(event.currentTarget.files?.[0] ?? null); setNotice(""); }} className="mt-2 block w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-surface-container-low file:px-3 file:py-2 file:text-on-surface focus:border-primary focus:outline-none" />
          {file && <p className="mt-3 flex items-center gap-2 self-start text-pretty text-sm text-on-surface-variant">{standalone ? <MeetingIcon name={file.type.startsWith("audio/") ? "audioFile" : "document"} className="size-4 shrink-0" /> : file.type.startsWith("audio/") ? <FileAudio className="size-4 shrink-0" aria-hidden="true" /> : <FileText className="size-4 shrink-0" aria-hidden="true" />}<span className="break-all">{file.name}</span></p>}
          <button type="button" disabled={!file} onClick={() => setNotice("Tệp đã được chọn trên giao diện. Chức năng tạo ghi chép sẽ hoạt động khi dịch vụ được kết nối.")} className={cn("mt-6 min-h-10 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-on-primary hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40", focusClass)}>Tạo ghi chép</button>
        </div>}
        {notice && <p role="status" className="mt-5 max-w-xl rounded-lg border border-outline-variant bg-surface-container-low p-3 text-center text-pretty text-sm text-on-surface">{notice}</p>}
        <p className="mt-auto pt-10 text-center text-xs text-on-surface-variant">Chưa kết nối dịch vụ ghi chép cuộc họp</p>
      </div>}
    </div>
  </section>;
}
