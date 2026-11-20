import type { AssistantCitation } from "../../services/assistantService";

export function AssistantSources({ citations }: { citations?: AssistantCitation[] }) {
  if (!citations?.length) return null;
  return (
    <div className="mt-3 border-t border-slate-200 pt-2 text-xs text-slate-600" aria-label="Nguồn trả lời">
      <p className="mb-1 font-semibold">Nguồn trả lời</p>
      <ul className="space-y-1">
        {citations.map((citation) => {
          const link =
            citation.documentId && /^[a-f0-9]{24}$/i.test(citation.documentId)
              ? `/kho-tri-thuc?document=${citation.documentId}&chunk=${Number.isInteger(citation.chunkIndex) && citation.chunkIndex! >= 0 ? citation.chunkIndex : 0}&revision=${encodeURIComponent(citation.revision || "legacy")}`
              : undefined;
          return (
            <li key={citation.id}>
              {link ? (
                <a className="text-indigo-700 underline" href={link} target="_blank" rel="noopener noreferrer">
                  {citation.title}
                </a>
              ) : (
                citation.title
              )}
              {citation.scope ? ` · ${citation.scope}` : ""}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
