export { parseAssistantResultTable, type AssistantResultTable, type AssistantResultTableRow } from "../../shared/assistant-result-table";

export interface AssistantSuccessCard {
  title: string;
  fields: { label: string; value: string }[];
  notes: string[];
}

/** Keep successful write results readable without changing the saved message. */
export function parseAssistantSuccessCard(content: string): AssistantSuccessCard | null {
  const [firstLine, ...remaining] = content.split(/\r?\n/);
  const match = firstLine?.trim().match(/^Xong rồi bạn nhé, mình đã (.+?)\.?$/i);
  if (!match) return null;

  const fields: AssistantSuccessCard["fields"] = [];
  const notes: string[] = [];
  for (const line of remaining) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const field = trimmed.match(/^([^:]{1,80}):\s*(.+)$/);
    if (field) fields.push({ label: field[1].trim(), value: field[2].trim() });
    else notes.push(trimmed);
  }
  if (!fields.length) return null;
  const action = match[1].trim();
  return { title: action.charAt(0).toLocaleUpperCase("vi") + action.slice(1), fields, notes };
}
