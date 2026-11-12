import {
  parseActionPreviewProductTable,
  parseAssistantResultTable,
  parseAssistantSuccessCard,
  type AssistantPreviewProductTable,
} from "./assistant-message-format";
import { cn } from "../../modules/student-management/lib/utils";
import { canonicalAssistantLinkUrl, isAssistantImageUrl, safeAssistantHttpUrl } from "./assistant-link-utils";

const inlineLinkClass = "rounded-sm text-primary underline underline-offset-2 hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export function AssistantActionProductTable({
  label,
  table,
}: {
  label: string;
  table: AssistantPreviewProductTable;
}) {
  return (
    <div
      role="region"
      aria-label={`Bảng ${label}. Có thể cuộn ngang để xem đủ các cột.`}
      tabIndex={0}
      className="mt-1.5 max-w-full overflow-x-auto rounded-lg border border-outline-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <table
        aria-label={label}
        className="w-full border-collapse text-left text-xs tabular-nums text-on-surface sm:text-sm"
      >
        <caption className="sr-only">{label}</caption>
        <thead className="bg-surface-container-low text-on-surface">
          <tr>
            <th scope="col" className="w-12 border-b border-outline-variant px-2.5 py-2 text-center font-semibold">
              STT
            </th>
            {table.hasSku && (
              <th scope="col" className="w-48 border-b border-outline-variant px-2.5 py-2 font-semibold sm:px-3">
                Mã sản phẩm
              </th>
            )}
            <th scope="col" className="border-b border-outline-variant px-2.5 py-2 font-semibold sm:px-3">
              Tên sản phẩm
            </th>
            {table.hasQuantity && (
              <th scope="col" className="w-28 border-b border-outline-variant px-2.5 py-2 text-right font-semibold sm:px-3">
                Số lượng
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant bg-surface-container-lowest">
          {table.rows.map(row => (
            <tr key={row.number}>
              <td className="w-12 px-2.5 py-2 text-center align-top tabular-nums text-on-surface/70">
                {row.number}
              </td>
              {table.hasSku && (
                <td className="whitespace-nowrap px-2.5 py-2 align-top font-medium text-on-surface sm:px-3">
                  {row.sku || "—"}
                </td>
              )}
              <td className="whitespace-normal break-words px-2.5 py-2 align-top text-on-surface sm:px-3">
                {row.name}
              </td>
              {table.hasQuantity && (
                <td className="whitespace-nowrap px-2.5 py-2 text-right align-top font-medium tabular-nums text-on-surface sm:px-3">
                  {row.quantity || "—"}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formattedText(content: string, allowedLinkUrls?: readonly string[]) {
  const allowedByCanonical = allowedLinkUrls === undefined
    ? null
    : new Map(
      allowedLinkUrls.flatMap(raw => {
        const safe = safeAssistantHttpUrl(raw);
        const canonical = canonicalAssistantLinkUrl(raw);
        return safe && canonical ? [[canonical, safe] as const] : [];
      }),
    );
  const pattern = /(!?)\[([^\]]+)\]\((https?:\/\/[^\s()]*(?:\([^\s()]*\)[^\s()]*)*)\)|(\*\*.+?\*\*)/g;
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  for (const match of content.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > cursor) parts.push(content.slice(cursor, start));
    if (match[4]) {
      parts.push(<strong key={key++}>{match[4].slice(2, -2)}</strong>);
    } else {
      const safeUrl = safeAssistantHttpUrl(match[3]);
      const canonicalUrl = canonicalAssistantLinkUrl(match[3]);
      const resolvedUrl = allowedByCanonical
        ? (canonicalUrl ? allowedByCanonical.get(canonicalUrl) ?? null : null)
        : safeUrl;
      const label = match[2];
      const isImage = match[1] === "!";
      if (!resolvedUrl || (isImage && !allowedByCanonical)) {
        if (!/^https?:\/\//i.test(label.trim())) parts.push(label);
      } else if (isImage && isAssistantImageUrl(resolvedUrl) && new URL(resolvedUrl).protocol === "https:") {
        parts.push(<a key={key++} href={resolvedUrl} target="_blank" rel="noopener noreferrer" className={inlineLinkClass}>
          <img src={resolvedUrl} alt={label} loading="lazy" referrerPolicy="no-referrer" className="my-2 max-h-56 max-w-full rounded-lg border border-outline-variant object-contain" />
          <span className="sr-only"> (mở ảnh ở tab mới)</span>
        </a>);
      } else if (isImage) {
        parts.push(<a key={key++} href={resolvedUrl} target="_blank" rel="noopener noreferrer" className={inlineLinkClass}>{label}<span className="sr-only"> (mở ảnh ở tab mới)</span></a>);
      } else {
        parts.push(<a key={key++} href={resolvedUrl} target="_blank" rel="noopener noreferrer" className={inlineLinkClass}>{label}<span className="sr-only"> (mở tab mới)</span></a>);
      }
    }
    cursor = start + match[0].length;
  }
  if (cursor < content.length) parts.push(content.slice(cursor));
  return parts;
}

function MessageParagraph({ content, allowedLinkUrls }: { content: string; allowedLinkUrls?: readonly string[] }) {
  return <p className="whitespace-pre-wrap break-words text-pretty" style={{ overflowWrap: "anywhere" }}>{formattedText(content, allowedLinkUrls)}</p>;
}

type AssistantMarkdownBlock =
  | { type: "text"; content: string }
  | { type: "table"; headers: string[]; alignments: Array<"left" | "center" | "right">; rows: string[][] };

function markdownTableCells(line: string) {
  let value = line.trim().replace(/\\\|/g, "\u0000");
  if (value.startsWith("|")) value = value.slice(1);
  if (value.endsWith("|")) value = value.slice(0, -1);
  return value.split("|").map(cell => cell.replace(/\u0000/g, "|").trim());
}

function isMarkdownTableDivider(cells: string[]) {
  return cells.length >= 2 && cells.every(cell => /^:?-{3,}:?$/.test(cell));
}

function parseAssistantMarkdownBlocks(content: string): AssistantMarkdownBlock[] {
  const lines = content.split("\n");
  const blocks: AssistantMarkdownBlock[] = [];
  let textLines: string[] = [];
  const flushText = () => {
    const text = textLines.join("\n").trim();
    if (text) blocks.push({ type: "text", content: text });
    textLines = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].includes("|") && index + 1 < lines.length && lines[index + 1].includes("|")) {
      const headers = markdownTableCells(lines[index]);
      const dividers = markdownTableCells(lines[index + 1]);
      if (headers.length === dividers.length && isMarkdownTableDivider(dividers)) {
        flushText();
        const alignments: Array<"left" | "center" | "right"> = dividers.map(cell => cell.startsWith(":") && cell.endsWith(":") ? "center" : cell.endsWith(":") ? "right" : "left");
        const rows: string[][] = [];
        index += 2;
        while (index < lines.length && lines[index].includes("|")) {
          const row = markdownTableCells(lines[index]);
          if (row.length !== headers.length) break;
          rows.push(row);
          index += 1;
        }
        index -= 1;
        blocks.push({ type: "table", headers, alignments, rows });
        continue;
      }
    }
    textLines.push(lines[index]);
  }
  flushText();
  return blocks;
}

function AssistantMarkdownTable({ headers, alignments, rows, allowedLinkUrls }: Extract<AssistantMarkdownBlock, { type: "table" }> & { allowedLinkUrls?: readonly string[] }) {
  const alignmentClass = { left: "text-left", center: "text-center", right: "text-right" };
  return <div role="region" aria-label="Bảng dữ liệu. Có thể cuộn ngang để xem đủ các cột." tabIndex={0} className="max-w-full overflow-x-auto rounded-xl border border-outline-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
    <table className="w-full min-w-max border-collapse text-sm tabular-nums text-on-surface">
      <caption className="sr-only">Bảng dữ liệu so sánh</caption>
      <thead className="bg-surface-container-low">
        <tr>{headers.map((header, index) => <th key={`${header}-${index}`} scope="col" className={cn("border-b border-outline-variant px-3 py-2.5 font-semibold", alignmentClass[alignments[index]])}>{formattedText(header, allowedLinkUrls)}</th>)}</tr>
      </thead>
      <tbody className="divide-y divide-outline-variant">
        {rows.map((row, rowIndex) => <tr key={rowIndex}>
          {headers.map((_, cellIndex) => <td key={cellIndex} className={cn("max-w-prose whitespace-normal break-words px-3 py-2.5 align-top", alignmentClass[alignments[cellIndex]])}>{formattedText(row[cellIndex] || "", allowedLinkUrls)}</td>)}
        </tr>)}
      </tbody>
    </table>
  </div>;
}

export function AssistantMessageContent({ content, visibleCharacters, allowedLinkUrls }: { content: string; visibleCharacters?: number; allowedLinkUrls?: readonly string[] }) {
  const visibleContent = visibleCharacters === undefined ? content : Array.from(content).slice(0, visibleCharacters).join("");
  const resultTable = parseAssistantResultTable(content);
  if (!resultTable) {
    const successCard = parseAssistantSuccessCard(visibleContent);
    if (!successCard) {
      const blocks = parseAssistantMarkdownBlocks(visibleContent);
      if (!blocks.some(block => block.type === "table")) return <MessageParagraph content={visibleContent} allowedLinkUrls={allowedLinkUrls} />;
      return <div className="min-w-0 space-y-3">
        {blocks.map((block, index) => block.type === "table"
          ? <AssistantMarkdownTable key={`table-${index}`} {...block} allowedLinkUrls={allowedLinkUrls} />
          : <MessageParagraph key={`text-${index}`} content={block.content} allowedLinkUrls={allowedLinkUrls} />)}
      </div>;
    }
    return (
      <section className="min-w-0 overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
        <div className="border-b border-outline-variant bg-surface-container-low px-4 py-3">
          <p className="text-xs font-medium text-primary">Đã hoàn tất</p>
          <h3 className="mt-1 text-balance text-sm font-semibold text-on-surface">{successCard.title}</h3>
        </div>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 p-4 sm:grid-cols-2">
          {successCard.fields.map((field, index) => {
            const productTable = parseActionPreviewProductTable(field.label, field.value);
            return (
              <div key={`${field.label}-${index}`} className={cn("min-w-0", productTable && "sm:col-span-2")}>
                <dt className="text-xs text-on-surface-variant">{field.label}</dt>
                <dd className="mt-1 break-words text-sm text-on-surface tabular-nums" style={{ overflowWrap: "anywhere" }}>
                  {productTable
                    ? <AssistantActionProductTable label={field.label} table={productTable} />
                    : formattedText(field.value, allowedLinkUrls)}
                </dd>
              </div>
            );
          })}
        </dl>
        {successCard.notes.length > 0 && <div className="space-y-2 border-t border-outline-variant px-4 py-3 text-sm text-on-surface-variant">
          {successCard.notes.map((note, index) => <MessageParagraph key={index} content={note} allowedLinkUrls={allowedLinkUrls} />)}
        </div>}
      </section>
    );
  }

  const totalParts = resultTable.before.length + resultTable.rows.length + resultTable.after.length;
  const visibleParts = visibleCharacters === undefined
    ? totalParts
    : Math.min(totalParts, Math.floor(visibleCharacters / Array.from(content).length * totalParts));
  if (visibleCharacters !== undefined && visibleParts === 0) {
    return <MessageParagraph content={Array.from(resultTable.before.join("\n")).slice(0, visibleCharacters).join("")} allowedLinkUrls={allowedLinkUrls} />;
  }
  const visibleBefore = resultTable.before.slice(0, visibleParts);
  const visibleRows = resultTable.rows.slice(0, Math.max(0, visibleParts - resultTable.before.length));
  const visibleAfter = resultTable.after.slice(0, Math.max(0, visibleParts - resultTable.before.length - resultTable.rows.length));

  return (
    <div className="min-w-0 space-y-3">
      {visibleBefore.map((line, index) => <MessageParagraph key={`before-${index}`} content={line} allowedLinkUrls={allowedLinkUrls} />)}
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
      {visibleAfter.map((line, index) => <MessageParagraph key={`after-${index}`} content={line} allowedLinkUrls={allowedLinkUrls} />)}
    </div>
  );
}
