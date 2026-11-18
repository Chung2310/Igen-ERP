import { formatAssistantResultTable, parseAssistantResultTable } from "../../src/shared/assistant-result-table";

/** Merge already-public results into the one table supported by the shared UI. */
export function combineAssistantPlanResults(replies: string[]): string {
  const rows: Array<Record<string, string>> = [];
  const prose: string[] = [];
  for (const reply of replies) {
    const table = parseAssistantResultTable(reply);
    if (!table) { prose.push(reply); continue; }
    rows.push(...table.rows.map(row => row.values));
    prose.push(...table.after);
  }
  return rows.length ? formatAssistantResultTable("Kết quả các yêu cầu", rows, prose.filter(Boolean)) : prose.join("\n\n");
}
