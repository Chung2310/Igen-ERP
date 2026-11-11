import { parseAssistantResultTable, parseAssistantSuccessCard } from "./assistant-message-format";
import { cn } from "../../modules/student-management/lib/utils";

function formattedText(content: string) {
  return content.split(/(\*\*.*?\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={index}>{part.slice(2, -2)}</strong>
      : part,
  );
}

function MessageParagraph({ content }: { content: string }) {
  return <p className="whitespace-pre-wrap break-words text-pretty" style={{ overflowWrap: "anywhere" }}>{formattedText(content)}</p>;
}

export function AssistantMessageContent({ content, visibleCharacters }: { content: string; visibleCharacters?: number }) {
  const visibleContent = visibleCharacters === undefined ? content : Array.from(content).slice(0, visibleCharacters).join("");
  const resultTable = parseAssistantResultTable(content);
  if (!resultTable) {
    const successCard = parseAssistantSuccessCard(visibleContent);
    if (!successCard) return <MessageParagraph content={visibleContent} />;
    return (
      <section className="min-w-0 overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
        <div className="border-b border-outline-variant bg-surface-container-low px-4 py-3">
          <p className="text-xs font-medium text-primary">Đã hoàn tất</p>
          <h3 className="mt-1 text-balance text-sm font-semibold text-on-surface">{successCard.title}</h3>
        </div>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 p-4 sm:grid-cols-2">
          {successCard.fields.map((field, index) => <div key={`${field.label}-${index}`} className="min-w-0">
            <dt className="text-xs text-on-surface-variant">{field.label}</dt>
            <dd className="mt-1 break-words text-sm text-on-surface tabular-nums" style={{ overflowWrap: "anywhere" }}>{formattedText(field.value)}</dd>
          </div>)}
        </dl>
        {successCard.notes.length > 0 && <div className="space-y-2 border-t border-outline-variant px-4 py-3 text-sm text-on-surface-variant">
          {successCard.notes.map((note, index) => <MessageParagraph key={index} content={note} />)}
        </div>}
      </section>
    );
  }

  const totalParts = resultTable.before.length + resultTable.rows.length + resultTable.after.length;
  const visibleParts = visibleCharacters === undefined
    ? totalParts
    : Math.min(totalParts, Math.floor(visibleCharacters / Array.from(content).length * totalParts));
  if (visibleCharacters !== undefined && visibleParts === 0) {
    return <MessageParagraph content={Array.from(resultTable.before.join("\n")).slice(0, visibleCharacters).join("")} />;
  }
  const visibleBefore = resultTable.before.slice(0, visibleParts);
  const visibleRows = resultTable.rows.slice(0, Math.max(0, visibleParts - resultTable.before.length));
  const visibleAfter = resultTable.after.slice(0, Math.max(0, visibleParts - resultTable.before.length - resultTable.rows.length));

  return (
    <div className="min-w-0 space-y-3">
      {visibleBefore.map((line, index) => <MessageParagraph key={`before-${index}`} content={line} />)}
      {visibleRows.length > 0 && <div
        role="region"
        aria-label="Bảng kết quả. Có thể cuộn ngang để xem đủ các cột."
        tabIndex={0}
        className="max-w-full overflow-x-auto rounded-xl border border-outline-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <table
          aria-label="Kết quả"
          className={cn("w-full border-collapse text-left text-sm tabular-nums", resultTable.headers.length <= 3 ? "table-fixed" : "min-w-max")}
        >
          <caption className="sr-only">Kết quả</caption>
          <thead className="bg-surface-container-low text-on-surface">
            <tr>
              <th scope="col" className="w-12 border-b border-outline-variant px-2 py-2.5 font-semibold">STT</th>
              {resultTable.headers.map(header => <th key={header} scope="col" className="border-b border-outline-variant px-2 py-2.5 font-semibold sm:px-3">{header}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {visibleRows.map(row => (
              <tr key={row.number}>
                <td className="w-12 px-2 py-2.5 align-top tabular-nums text-on-surface/70">{row.number}</td>
                {resultTable.headers.map(header => <td key={header} className="max-w-prose whitespace-normal break-words px-2 py-2.5 align-top sm:px-3">{row.values[header] || "—"}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>}
      {visibleAfter.map((line, index) => <MessageParagraph key={`after-${index}`} content={line} />)}
    </div>
  );
}
