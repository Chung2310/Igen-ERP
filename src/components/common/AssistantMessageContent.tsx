import { parseAssistantResultTable } from "./assistant-message-format";

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

export function AssistantMessageContent({ content }: { content: string }) {
  const resultTable = parseAssistantResultTable(content);
  if (!resultTable) return <MessageParagraph content={content} />;

  return (
    <div className="min-w-0 space-y-3">
      {resultTable.before.map((line, index) => <MessageParagraph key={`before-${index}`} content={line} />)}
      <div
        role="region"
        aria-label="Bảng kết quả. Có thể cuộn ngang để xem đủ các cột."
        tabIndex={0}
        className="max-w-full overflow-x-auto rounded-xl border border-outline-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <table
          aria-label="Kết quả tra cứu"
          className={`w-full border-collapse text-left text-sm ${resultTable.headers.length <= 3 ? "table-fixed" : "min-w-max"}`}
        >
          <caption className="sr-only">Kết quả tra cứu</caption>
          <thead className="bg-surface-container-low text-on-surface">
            <tr>
              <th scope="col" className="w-12 border-b border-outline-variant px-2 py-2.5 font-semibold">STT</th>
              {resultTable.headers.map(header => <th key={header} scope="col" className="border-b border-outline-variant px-2 py-2.5 font-semibold sm:px-3">{header}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {resultTable.rows.map(row => (
              <tr key={row.number}>
                <td className="w-12 px-2 py-2.5 align-top tabular-nums text-on-surface/70">{row.number}</td>
                {resultTable.headers.map(header => <td key={header} className="max-w-prose whitespace-normal break-words px-2 py-2.5 align-top sm:px-3">{row.values[header] || "—"}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {resultTable.after.map((line, index) => <MessageParagraph key={`after-${index}`} content={line} />)}
    </div>
  );
}
