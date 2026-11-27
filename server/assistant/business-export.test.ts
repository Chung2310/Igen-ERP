import { beforeEach, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
const state = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("./models", () => ({ AssistantDocumentModel: { create: state.create } }));
vi.mock("./workflows", () => ({ actorScope: () => ({ userId: "actor", companyCode: "TEST" }) }));
import { exportBusinessList, isBusinessExcelRequest, saveBusinessWorkbook } from "./business-export";
import { operationById } from "./catalog";
import { formatAssistantResultTable } from "../../src/shared/assistant-result-table";
import {readCohortDigest} from './read-cohort';
import {selectAnalysisCohortRows,type AnalysisContract} from './list-analysis';
const req = { user: { id: "actor", companyCode: "TEST", branchId: "branch" } } as any;
const input = { conversationId: "chat", requestId: "request", requestText: "Xuất danh sách học viên ra Excel" };
beforeEach(() => state.create.mockReset());

it('exports the same ranked aggregate pipeline and rejects an unproven previous cohort before creating a file',async()=>{
 const contract:AnalysisContract={fields:{name:{label:'Tên',type:'text'},amount:{label:'Giá trị',type:'number'}}};
 const op={...operationById('inventory.balance.list')!,analysis:contract};
 const rows=[{name:'QA A',amount:4},{name:'QA A',amount:5},{name:'QA B',amount:7}],dispatch=vi.fn(async()=>({data:rows,analysisComplete:true}));
 const plan={groupBy:'name',aggregate:{operation:'sum',field:'amount'},having:{field:'sum_amount',operator:'gte',value:8},sort:{field:'sum_amount',direction:'desc'},limit:1};
 const reply=await exportBusinessList(req,op,{analysis:JSON.stringify(plan)},dispatch,input);
 expect(reply.status).toBe('completed');const saved=state.create.mock.calls[0][0],workbook=XLSX.read(saved.files[0].bytes,{type:'buffer'});
 expect(JSON.stringify(XLSX.utils.sheet_to_json(workbook.Sheets['Danh sách']))).toContain('QA A');expect(JSON.stringify(XLSX.utils.sheet_to_json(workbook.Sheets['Danh sách']))).not.toContain('QA B');
 state.create.mockClear();
 await expect(exportBusinessList(req,op,{analysis:JSON.stringify({within:plan})},dispatch,input)).rejects.toThrow('đã thay đổi');expect(state.create).not.toHaveBeenCalled();
 const digest=readCohortDigest(selectAnalysisCohortRows(contract,rows,plan,true));
 expect((await exportBusinessList(req,op,{analysis:JSON.stringify({within:plan,select:['name']})},dispatch,{...input,readCohortDigest:digest})).status).toBe('completed');
 expect(JSON.stringify(state.create.mock.calls[0][0].content)).not.toContain(digest);
});

it("recognizes export intent but excludes import and explicit negation", () => {
  expect(isBusinessExcelRequest(input.requestText)).toBe(true);
  expect(isBusinessExcelRequest("Tạo học viên từ Excel")).toBe(false);
  expect(isBusinessExcelRequest("Tải lên tệp Excel lượt khám")).toBe(false);
  expect(isBusinessExcelRequest("Đừng xuất Excel")).toBe(false);
});

it("writes an owner-scoped downloadable workbook with literal phone and formula-like cells", async () => {
  const reply = await saveBusinessWorkbook(req, { ...input, title: "Học viên", scopeNote: "Trang 1", tables: [formatAssistantResultTable("Danh sách", [{ "Tên": "=1+1", "Điện thoại": "0901234567" }])] });
  const saved = state.create.mock.calls[0][0];
  expect(saved).toMatchObject({ userId: "actor", companyCode: "TEST", branchId: "branch", conversationId: "chat" });
  const workbook = XLSX.read(saved.files[0].bytes, { type: "buffer" });
  const cells = Object.values(workbook.Sheets["Danh sách"]) as any[];
  expect(cells).toEqual(expect.arrayContaining([expect.objectContaining({ v: "0901234567", t: "s" }), expect.objectContaining({ v: "=1+1", t: "s" })]));
  expect(cells.some(cell => cell.f)).toBe(false);
  expect(reply.files?.[0].id).toBe(saved.files[0].id);
  expect(reply.files?.[0]).not.toHaveProperty("bytes");
});

it("exports approved student fields and preserves query filters through dispatch", async () => {
  const dispatch = vi.fn().mockResolvedValue({ students: [{ _id: "internal-id", fullName: "Nguyễn An", phone: "0901234567", password: "secret-value" }], total: 1 });
  const reply = await exportBusinessList(req, operationById("student.list")!, { search: "Nguyễn" }, dispatch, input);
  expect(reply.status).toBe("completed");
  expect(reply.files).toHaveLength(1);
  expect(dispatch.mock.calls[0][0]).toMatchObject({ search: "Nguyễn" });
  const saved = JSON.stringify(state.create.mock.calls[0][0].content);
  expect(saved).toContain("Nguyễn An");
  expect(saved).not.toContain("internal-id");
  expect(saved).not.toContain("secret-value");
});

it("does not dispatch mutations for an export", async () => {
  const dispatch = vi.fn();
  await expect(exportBusinessList(req, operationById("student.create")!, {}, dispatch, input)).rejects.toThrow("thao tác đọc");
  expect(dispatch).not.toHaveBeenCalled();
});

it("refuses to claim a full export when the API omits its total", async () => {
  const dispatch = vi.fn().mockResolvedValue({ students: [{ fullName: "An", phone: "0901234567" }] });
  await expect(exportBusinessList(req, operationById("student.list")!, {}, dispatch, { ...input, requestText: "Xuất toàn bộ học viên ra Excel" })).rejects.toThrow("chưa xác nhận đã đọc đủ");
  expect(state.create).not.toHaveBeenCalled();
});

it("reports empty data without creating an empty download", async () => {
  const reply = await exportBusinessList(req, operationById("student.list")!, {}, vi.fn().mockResolvedValue({ students: [], total: 0 }), input);
  expect(reply.reply).toContain("Không có dữ liệu");
  expect(state.create).not.toHaveBeenCalled();
});

it("fetches every page with the original filter and rejects repeated pages", async () => {
  const operation = operationById("student.list")!;
  const pageKey = operation.fields.find(field => field.source === "query" && (field.apiKey || field.key) === "page")!.key;
  const dispatch = vi.fn().mockResolvedValueOnce({ students: [{ fullName: "An", phone: "0901234567" }], total: 2 })
    .mockResolvedValueOnce({ students: [{ fullName: "Bình", phone: "0901234568" }], total: 2 });
  const reply = await exportBusinessList(req, operation, { search: "test" }, dispatch, { ...input, requestText: "Xuất tất cả học viên ra Excel" });
  expect(reply.files).toHaveLength(1);
  expect(dispatch.mock.calls.map(call => call[0][pageKey])).toEqual([1, 2]);
  expect(dispatch.mock.calls.every(call => call[0].search === "test")).toBe(true);
  state.create.mockClear();
  const repeated = vi.fn().mockResolvedValue({ students: [{ fullName: "An", phone: "0901234567" }], total: 2 });
  await expect(exportBusinessList(req, operation, {}, repeated, { ...input, requestText: "Xuất tất cả học viên ra Excel" })).rejects.toThrow("trang trùng");
  expect(state.create).not.toHaveBeenCalled();
});
