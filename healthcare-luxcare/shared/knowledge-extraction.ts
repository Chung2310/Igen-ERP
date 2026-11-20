export const KNOWLEDGE_EXTRACTION_VERSION = 2;

export interface KnowledgeExtractionQuality {
  version: number;
  status: "complete" | "partial";
  warnings: string[];
  pages?: number;
  ocrPages?: number[];
  sheets?: number;
}

export interface KnowledgeSheetCell {
  value: string | number | boolean | null;
  text: string;
  type: string;
  formula?: string;
}
export interface KnowledgeSheet {
  name: string;
  rows: Array<{ number: number; cells: KnowledgeSheetCell[] }>;
  mergedRanges: string[];
}
export interface KnowledgeWorkbook {
  sheets: KnowledgeSheet[];
}
