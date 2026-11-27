import { randomUUID } from "node:crypto";
import type { AuthenticatedRequest } from "../middleware/auth";
import type { AssistantReply, AssistantValue } from "../../src/shared/assistant-workflow";
import { parseAssistantResultTable } from "../../src/shared/assistant-result-table";
import type { AssistantOperation } from "./catalog";
import { AssistantDocumentModel } from "./models";
import { actorScope } from "./workflows";
import { AssistantError } from "./policy";
import { renderDocumentWorkbook } from "./document-workbook";
import { documentFileName, documentMimeTypes } from "./document-export";
import { formatFriendlyAssistantResult as friendlyResult } from "./result-format";
import { projectRecords } from "./executor";
import { formatQuotationResult } from "./quotation-result";
export {isBusinessExcelRequest} from './export-intent';
import {collectPublicReadData} from './public-read-query';
import {collectAnalysisPages,analyzeList} from './list-analysis';
import {formatAssistantResultTable} from '../../src/shared/assistant-result-table';

const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase();

export async function saveBusinessWorkbook(req: AuthenticatedRequest, input: {
  conversationId: string; requestId: string; title: string; tables: string[]; scopeNote: string;
}): Promise<AssistantReply> {
  const tables = input.tables.map(parseAssistantResultTable).filter((table): table is NonNullable<typeof table> => Boolean(table));
  const columns = [...new Set(tables.flatMap(table => table.headers))];
  const rows = tables.flatMap(table => table.rows.map(row => columns.map(column => row.values[column] ?? "")));
  if (!columns.length || !rows.length) return { status: "completed", reply: "Không có dữ liệu phù hợp để xuất Excel. Bạn kiểm tra lại bộ lọc nhé." };
  if (columns.length > 40 || rows.length > 1000) throw new AssistantError("Danh sách vượt giới hạn 1.000 dòng hoặc 40 cột. Bạn thu hẹp bộ lọc rồi xuất lại nhé.", 422);
  const content = { title: input.title.slice(0, 200), sections: [{ heading: "Phạm vi dữ liệu", text: input.scopeNote }],
    sheets: [{ name: "Danh sách", columns, rows }] };
  // Strings stay strings in XLSX, including phone numbers and formula-like user data.
  const bytes = renderDocumentWorkbook(content);
  if (bytes.length > 8 * 1024 * 1024) throw new AssistantError("File xuất vượt giới hạn 8 MB. Bạn thu hẹp bộ lọc nhé.", 422);
  const documentId = randomUUID();
  const file = { id: randomUUID(), fileName: documentFileName(content.title, 1, "xlsx"), format: "xlsx" as const,
    mimeType: documentMimeTypes.xlsx, size: bytes.length, bytes };
  await AssistantDocumentModel.create({ ...actorScope(req), branchId: req.user?.branchId || "", conversationId: input.conversationId,
    requestId: input.requestId, documentId, version: 1, title: content.title, content, files: [file] });
  return { status: "completed", reply: `Đã xuất ${rows.length} dòng ra Excel. ${input.scopeNote}\n\nBạn tải file bên dưới nhé.`,
    files: [{ id: file.id, fileName: file.fileName, format: file.format, mimeType: file.mimeType, size: file.size,
      documentId, conversationId: input.conversationId, version: 1 }] };
}

function pagination(result: any) {
  const candidates = [result?.analysisPage,result?.pagination, result?.meta, result?.data?.pagination, result?.data?.meta, result?.data, result];
  const found = candidates.find(value => value && Number.isSafeInteger(value.total) && value.total >= 0);
  return found ? { total: found.total as number } : null;
}

/** Reads only through the caller's dispatch, preserving permission checks and execution budget. */
export async function exportBusinessList(req: AuthenticatedRequest, operation: AssistantOperation, values: Record<string, AssistantValue>,
  dispatch: (values: Record<string, AssistantValue>) => Promise<any>, input: { conversationId: string; requestId: string; requestText: string }): Promise<AssistantReply> {
  if (operation.method !== "GET") throw new AssistantError("Xuất Excel chỉ dùng thao tác đọc dữ liệu. Chưa thực hiện thay đổi nào.", 400);
  if(operation.analysis){
    const source=operation.analysis.publicRead
      ?await collectPublicReadData(operation,values,dispatch,(response,input)=>projectRecords(operation,response,req,input))
      :await collectAnalysisPages(operation.analysis,values,dispatch);
    const result=analyzeList(operation.analysis,source.data,values.analysis,source.analysisComplete===true);
    if(result.records.length>1000)throw new AssistantError('Danh sách vượt 1.000 dòng. Bạn thu hẹp bộ lọc nhé.',422);
    return saveBusinessWorkbook(req,{...input,title:operation.title,tables:[formatAssistantResultTable(operation.title,result.records)],scopeNote:'File gồm kết quả trong phạm vi và bộ lọc đã chọn.'});
  }
  const pageField = operation.fields.find(field => field.source === "query" && (field.apiKey || field.key) === "page");
  const limitField = operation.fields.find(field => field.source === "query" && (field.apiKey || field.key) === "limit");
  const all = /\b(?:toan bo|tat ca|all)\b/.test(normalize(input.requestText));
  const tables: string[] = [];
  let count = 0;
  let total: number | undefined;
  let page = Number(pageField ? values[pageField.key] || 1 : 1);
  if (all) page = 1;
  const seen = new Set<string>();
  for (let index = 0; index < 20; index++) {
    const query = { ...values, ...(pageField ? { [pageField.key]: page } : {}),
      ...(limitField && all ? { [limitField.key]: Math.min(limitField.max || 100, 100) } : {}) };
    const result = await dispatch(query);
    const records = projectRecords(operation, result, req, query);
    total = pagination(result)?.total ?? total;
    if (all && total !== undefined && total > 1000) throw new AssistantError("Danh sách có hơn 1.000 bản ghi. Bạn thu hẹp bộ lọc trước khi xuất toàn bộ nhé.", 422);
    const signature = JSON.stringify(records);
    if (seen.has(signature) && records.length) throw new AssistantError("API trả lại cùng một trang dữ liệu. Mình chưa xuất file để tránh lặp hoặc thiếu dòng.", 422);
    seen.add(signature);
    // Use the same public-field formatter as chat, one record at a time so display truncation cannot drop list rows.
    const pageTables = records.map(record => operation.module === "quotation"
      ? formatQuotationResult(operation, [record]) : friendlyResult(operation, [record]));
    if (pageTables.some(text => !parseAssistantResultTable(text))) throw new AssistantError("Danh sách này chưa có bảng dữ liệu được phép xuất. Bạn dùng chức năng xuất của phân hệ để giữ đầy đủ thông tin nhé.", 422);
    tables.push(...pageTables);
    count += records.length;
    if (count > 1000) throw new AssistantError("Danh sách vượt 1.000 dòng. Bạn thu hẹp bộ lọc nhé.", 422);
    if (!all || (total !== undefined && count >= total)) break;
    if (!pageField || !limitField || total === undefined || !records.length || index === 19)
      throw new AssistantError("Chưa xác minh được đầy đủ các trang của danh sách này nên mình chưa xuất toàn bộ. Bạn chọn một trang hoặc dùng chức năng xuất của phân hệ nhé.", 422);
    page++;
  }
  const scopeNote = all ? "File gồm toàn bộ bản ghi API trả về theo bộ lọc đã chọn."
    : `File gồm dữ liệu API trả về${pageField ? ` ở trang ${page}` : ""} theo bộ lọc đã chọn.${total !== undefined && total > count ? ` Có ${total} bản ghi tổng cộng, file này chưa bao gồm tất cả.` : " Không tự mở rộng sang các trang khác."}`;
  return saveBusinessWorkbook(req, { ...input, title: operation.title, tables, scopeNote });
}
