import type { useAiSharing } from "../hooks/useAiSharing";

type Sharing = ReturnType<typeof useAiSharing>;

export function AiSharingNotice({ sharing }: { sharing: Sharing }) {
  return (
    <section aria-label="AI data sharing consent" className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
      <h3 className="font-semibold">Allow AI to process this data? / Cho phép AI xử lý dữ liệu này?</h3>
      {sharing.error && <p role="alert" className="mt-2 text-amber-800">{sharing.error}</p>}
      {!sharing.disclosure ? (
        <button type="button" disabled={sharing.busy} onClick={sharing.refresh} className="mt-2 underline">
          {sharing.busy ? "Loading… / Đang tải…" : "Reload / Tải lại"}
        </button>
      ) : (
        <>
          <p className="mt-2"><strong>Purpose / Mục đích:</strong> {sharing.disclosure.purpose}</p>
          <p className="mt-2 font-medium">Data sent / Dữ liệu gửi</p>
          <ul className="list-disc space-y-1 pl-5">
            {sharing.disclosure.dataTypes.map((text) => <li key={text}>{text}</li>)}
          </ul>
          <p className="mt-2">
            <strong>AI processing / Xử lý AI:</strong>{" "}
            {sharing.disclosure.recipients.map((item) => (
              <a key={item.name} href={item.privacyUrl} target="_blank" rel="noopener noreferrer" className="underline">
                {item.name}
              </a>
            ))}
          </p>
          <a href={sharing.disclosure.privacyUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block underline">
            Privacy Policy / Chính sách bảo mật
          </a>
          {sharing.accepted ? (
            <div className="mt-2 flex items-center gap-3">
              <span>Consent active / Đã đồng ý</span>
              <button type="button" disabled={sharing.busy} onClick={() => void sharing.revoke()} className="underline">
                Revoke / Thu hồi
              </button>
            </div>
          ) : sharing.declined ? (
            <div className="mt-2 flex items-center gap-3">
              <span>AI is off / AI đang tắt</span>
              <button type="button" onClick={sharing.reconsider} className="underline">
                Review / Xem lại
              </button>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={sharing.busy} onClick={() => void sharing.accept()} className="rounded-lg bg-emerald-700 px-3 py-2 text-white disabled:opacity-50">
                Allow AI / Cho phép AI
              </button>
              <button type="button" disabled={sharing.busy} onClick={sharing.decline} className="rounded-lg border px-3 py-2">
                Decline / Từ chối
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
