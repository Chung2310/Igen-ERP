export type AssistantDocumentAlignment = "left" | "center" | "right";
export type AssistantDocumentAlignmentValue = AssistantDocumentAlignment | null;

/** A cell alignment overrides the column default; null means no cell-specific override. */
export function assistantDocumentCellAlignment(
  columnAlignments: readonly AssistantDocumentAlignmentValue[] | undefined,
  cellAlignments: readonly (readonly AssistantDocumentAlignmentValue[])[] | undefined,
  row: number,
  column: number,
): AssistantDocumentAlignment | undefined {
  const cellAlignment = cellAlignments?.[row]?.[column];
  if (cellAlignment) return cellAlignment;
  return columnAlignments?.[column] ?? undefined;
}
