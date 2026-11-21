import { ERP_LLM_MODEL } from "../../../shared/llm-model";
import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { openrouterChat } from "../../service/openrouter.service";
import { ASSISTANT_OPERATIONS, defaultWorkflow, type AssistantOperation } from "../catalog";
import { interpretRequest } from "../interpreter";

type CrudAction = "view" | "create" | "update" | "delete";

const readVerbs = /^(?:xem tr\u01b0\u1edbc|tra c\u1ee9u|t\u00ecm ki\u1ebfm|t\u00ecm|xem|danh s\u00e1ch|li\u1ec7t k\u00ea|t\u1ed5ng h\u1ee3p|b\u00e1o c\u00e1o|th\u1ed1ng k\u00ea)\b/i;
const createVerbs = /^(?:t\u1ea1o(?: m\u1edbi)?|th\u00eam|l\u1eadp|ghi nh\u1eadn|\u0111\u0103ng k\u00fd|nh\u1eadp)\b/i;
const updateVerbs = /^(?:c\u1eadp nh\u1eadt|s\u1eeda|ch\u1ec9nh s\u1eeda|\u0111\u1ed5i|b\u1ed5 sung|\u0111\u1ed5i t\u00ean)\b/i;
const deleteVerbs = /^(?:x\u00f3a(?: b\u1ecf)?|h\u1ee7y|hu\u1ef7|g\u1ee1)\b/i;
const titlePrefixes = [readVerbs, createVerbs, updateVerbs, /^(?:thay đổi)\b/i, deleteVerbs, /^(?:gửi|chuyển)\b/i];
const equivalentActionIds = (operation: Pick<AssistantOperation, "id" | "path">) => operation.path === "/customers/search"
  ? [operation.id, "customer.list"]
  : [operation.id];

function actionFor(operation: AssistantOperation): CrudAction | null {
  const title = operation.title.trim();
  const idTail = operation.id.split(".").at(-1) || "";
  if (/(?:^|[.-])leave$/i.test(operation.id) || (/\/leave(?:\/|$)/i.test(operation.path) && operation.method !== "GET")) return null;
  if (/(?:^|[.-])(?:export|pdf|download)$/i.test(operation.id) || /\/(?:export|pdf|download)(?:\/|$)/i.test(operation.path)) return null;
  if (operation.id === "quotation.template.update" || /^thay đổi trạng thái\b/i.test(title)) return "update";
  if (/(?:^|[.-])(?:reset|archive|send|run|process|recalculate|import|approve|reject|assign|unassign|link|unlink|mark-all-read)$/i.test(operation.id)
    || /^(?:đặt lại|gửi|chuyển|phê duyệt|duyệt|tính lại|nhập dữ liệu|liên kết|gỡ liên kết)\b/i.test(title)
    || /\/(?:reset|archive|send|run|process|recalculate|import|approve|reject|assign|link)(?:\/|$)/i.test(operation.path)) return null;
  if (operation.method === "GET") return "view";
  if (/^xem trước\b/i.test(title)) return "view";
  if (operation.readOnly && readVerbs.test(title) && !/(?:\.test|\.suggest|\.simulate)$/i.test(operation.id)) return "view";
  if (operation.method === "DELETE" || /(?:^|[.-])(?:delete|remove|bulk-delete)$/.test(operation.id) || deleteVerbs.test(title)) return "delete";
  if (operation.method === "PATCH" || operation.method === "PUT" || /(?:^|[.-])(?:update|edit)$/.test(operation.id) || updateVerbs.test(title)) return "update";
  if (createVerbs.test(title) || /(?:^|[.-])(?:create|add)$/.test(idTail)) return "create";
  return null;
}

function entityFromTitle(title: string, action: CrudAction): string {
  let entity = title.trim();
  for (const prefix of titlePrefixes) entity = entity.replace(prefix, "").trim();
  entity = entity.replace(/^(?:th\u00f4ng tin|h\u1ed3 s\u01a1|danh s\u00e1ch|chi ti\u1ebft)\s+/i, "");
  entity = entity.split(/\s+(?:c\u1ee7a API|sau khi|\u0111\u00e3 ch\u1ecdn)\b/i, 1)[0].trim();
  if (entity) return entity;
  return title || action;
}

function variantsFor(action: CrudAction, entity: string, operation: AssistantOperation): string[] {
  const idParts = operation.id.toLowerCase().split(/[.-]/);
  const previewView = action === "view" && /^xem trước\b/i.test(operation.title.trim());
  const personalLeaveBalance = operation.id === "leave.balance.me";
  const detailedView = action === "view" && (idParts.includes("detail") || /\/audit(?:\/|$)/i.test(operation.path) || /^(?:xem\s+)?(?:thông tin\s+)?chi tiết\b|^xem\s+hồ sơ\b|^(?:xem|tra cứu)\s+(?:thông tin|hồ sơ)\b/i.test(operation.title.trim()));
  const summaryView = action === "view" && !detailedView && (idParts.some(part => ["summary", "report", "aging"].includes(part)) || /^(?:tổng hợp|báo cáo|thống kê)\b/i.test(operation.title.trim()));
  const searchView = action === "view" && !detailedView && !summaryView && (/\/search(?:\/|$)/i.test(operation.path) || idParts.includes("search") || /^tìm(?: kiếm)?\b/i.test(operation.title.trim()));
  const previewVariants = operation.id === "student.bulk.delete.preview"
    ? ["Xem trước ảnh hưởng khi xóa học viên", "Nếu xóa học viên thì sẽ ảnh hưởng thế nào", "Kiểm tra trước khi xóa nhiều học viên", "Cho tôi xem danh sách học viên bị ảnh hưởng"]
    : operation.id === "api.post.94df372cee3d43f4"
      ? [operation.title.trim(), "Cho tôi xem trước các đơn hàng lấy từ Google Drive", "Kiểm tra các đơn hàng sẽ nhập từ Google Drive", "Xem thử dữ liệu đơn hàng từ Google Drive"]
      : operation.id === "api.post.0b24bc4450142162"
        ? [operation.title.trim(), "Cho tôi xem trước các đơn hàng sẽ nhập vào chiến dịch", "Kiểm tra dữ liệu đơn hàng trước khi nhập", "Xem thử danh sách đơn hàng cần nhập"]
        : operation.id === "api.post.f74c1ae26e5c4c3d"
          ? [operation.title.trim(), "Cho tôi xem các ảnh sẽ tạo cho đơn hàng chiến dịch", "Xem thử ảnh tạo cho đơn hàng", "Kiểm tra ảnh dự kiến trước khi tạo"]
          : operation.id === "api.post.d88657dd722cb73f"
            ? [operation.title.trim(), "Cho tôi xem nội dung AI đề xuất cho bảng chiến dịch", "Xem thử nội dung AI trước khi đưa vào bảng", "Kiểm tra nội dung AI sắp được thêm vào chiến dịch"]
            : operation.id === "api.post.ef223f5f2995bc38"
              ? [operation.title.trim(), "Cho tôi xem trước dữ liệu Google Sheets sẽ tạo", "Xem thử danh sách sẽ tạo từ Google Sheets", "Kiểm tra nội dung bảng tính trước khi tạo"]
              : operation.id === "api.post.8ee0e1e6992ff475"
                ? [operation.title.trim(), "Cho tôi xem các ảnh sẽ tạo từ bảng tính", "Xem thử ảnh được tạo từ workbook", "Kiểm tra ảnh dự kiến trước khi tạo"]
                : operation.id === "company-email.celebration.preview"
                  ? [operation.title.trim(), "Cho tôi xem thử email chúc mừng", "Xem nội dung email trước khi gửi", "Kiểm tra mẫu email chúc mừng"]
                  : [operation.title.trim(), `Xem thử ${entity}`, `Cho tôi xem trước ${entity}`, `Kiểm tra ${entity} trước khi thực hiện`];
  const explicitUpdateVariants = operation.id === "quotation.template.update"
    ? ["Chuyển loại mẫu tài liệu Báo giá", "Đổi loại mẫu tài liệu Báo giá", "Sửa loại của mẫu tài liệu Báo giá", "Chỉnh sửa danh mục mẫu tài liệu Báo giá"]
    : operation.id === "marketing.campaign.lifecycle"
      ? ["Thay đổi trạng thái chiến dịch marketing", "Đổi trạng thái chiến dịch marketing", "Cập nhật trạng thái chiến dịch marketing", "Chuyển chiến dịch marketing sang trạng thái khác"]
      : null;
  const base = personalLeaveBalance
    ? ["Tra cứu số dư phép năm của tôi", "Tôi còn bao nhiêu ngày phép năm", "Cho tôi biết còn bao nhiêu ngày phép năm", "Kiểm tra số phép năm còn lại của tôi"]
    : previewView
      ? previewVariants
      : explicitUpdateVariants
        ? explicitUpdateVariants
      : detailedView
    ? [`Xem chi tiết ${entity}`, `Thông tin chi tiết ${entity}`, `Xem thông tin ${entity}`, `Cho tôi xem chi tiết ${entity}`]
    : summaryView
      ? [`Tổng hợp số liệu ${entity}`, `Báo cáo ${entity}`, `Thống kê ${entity}`, `Cho tôi xem báo cáo ${entity}`]
      : searchView
        ? operation.path === "/customers/search"
          ? [`Tìm ${entity} theo tên, mã hoặc số điện thoại`, `Tra cứu ${entity} theo từ khóa`, `Tìm ${entity} cụ thể`, `Lọc ${entity} theo tên hoặc số điện thoại`]
          : [`Tìm kiếm ${entity}`, `Tìm ${entity}`, `Lọc ${entity}`, `Tra cứu ${entity} theo từ khóa`]
      : action === "view"
      ? [`Danh sách ${entity}`, `Liệt kê ${entity}`, `Xem danh sách ${entity}`, `Cho tôi xem danh sách ${entity}`]
      : action === "create"
        ? [`Tạo ${entity}`, `Thêm ${entity}`, `Tôi muốn tạo ${entity}`, `Cho tôi thêm ${entity}`]
        : action === "update"
          ? [`Cập nhật ${entity}`, `Sửa ${entity}`, `Chỉnh sửa ${entity}`, `Thay đổi thông tin ${entity}`]
          : [`Xóa ${entity}`, `Xóa giúp tôi ${entity}`, `Xóa bỏ ${entity}`, `Vui lòng xóa ${entity}`];
  const removeAccents = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, char => char === "đ" ? "d" : "D");
  return [...new Set([...base, ...base.map(removeAccents)])];
}

const operations = ASSISTANT_OPERATIONS.flatMap(operation => {
  const action = actionFor(operation);
  if (!action) return [];
  const entity = entityFromTitle(operation.title, action);
  return [{
    id: operation.id,
    module: operation.module,
    tab: operation.link,
    action,
    method: operation.method,
    path: operation.path,
    title: operation.title,
    entity,
    variants: variantsFor(action, entity, operation),
  }];
});

const groupKey = (module: string, tab: string) => `${module}\t${tab}`;
const groups = new Map<string, typeof operations>();
for (const operation of operations) {
  const key = groupKey(operation.module, operation.tab);
  groups.set(key, [...(groups.get(key) || []), operation]);
}
const distinctPhraseCaseCount = [...groups.values()].reduce((count, rows) => {
  return count + new Set(rows.flatMap(operation => operation.variants)).size;
}, 0);
const summary = [...groups.entries()].map(([key, rows]) => {
  const [module, tab] = key.split("\t");
  return {
    module,
    tab,
    allOperationCount: ASSISTANT_OPERATIONS.filter(operation => operation.module === module && operation.link === tab).length,
    functions: rows.length,
    phrases: rows.reduce((sum, row) => sum + row.variants.length, 0),
    byAction: Object.fromEntries((['view', 'create', 'update', 'delete'] as CrudAction[]).map(action => [action, rows.filter(row => row.action === action).length])),
  };
}).sort((left, right) => left.module.localeCompare(right.module) || left.tab.localeCompare(right.tab));

const report = {
  generatedAt: new Date().toISOString(),
  operationCount: ASSISTANT_OPERATIONS.length,
  crudFunctionCount: operations.length,
  phraseCount: operations.reduce((sum, operation) => sum + operation.variants.length, 0),
  unclassified: ASSISTANT_OPERATIONS.filter(operation => !actionFor(operation)).map(({ id, module, link, method, path, title }) => ({ id, module, tab: link, method, path, title })),
  summary,
  operations,
  evaluations: [] as Array<Record<string, unknown>>,
  interpreterMatrix: [] as Array<Record<string, unknown>>,
  interpreterSamples: [] as Array<Record<string, unknown>>,
  interpreterEvaluations: [] as Array<Record<string, unknown>>,
};

const argumentsList = process.argv.slice(2);
const pause = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));
const outputPath = argumentsList.find(argument => !argument.startsWith("--")) || "server/assistant/intent-audit-report.json";
const resume = argumentsList.includes("--resume");
const evaluate = argumentsList.includes("--evaluate");
const evaluateInterpreter = argumentsList.includes("--evaluate-interpreter");
const sampleInterpreter = argumentsList.includes("--sample-interpreter");
const probeInterpreter = argumentsList.includes("--probe-interpreter");
if (resume) {
  try {
    const existing = JSON.parse(await (await import("node:fs/promises")).readFile(outputPath, "utf8"));
    report.evaluations = Array.isArray(existing.evaluations) ? existing.evaluations : [];
    report.interpreterMatrix = Array.isArray(existing.interpreterMatrix) ? existing.interpreterMatrix : [];
    report.interpreterSamples = Array.isArray(existing.interpreterSamples) ? existing.interpreterSamples : [];
    report.interpreterEvaluations = Array.isArray(existing.interpreterEvaluations) ? existing.interpreterEvaluations : [];
    for (const key of ["evaluationModel", "batchSize", "modelEvaluation", "evaluationErrors"] as const) {
      if (existing[key] !== undefined) (report as Record<string, unknown>)[key] = existing[key];
    }
    if (existing.modelEvaluation && typeof existing.modelEvaluation === "object") {
      (report as any).modelEvaluation = {
        ...existing.modelEvaluation,
        requestedCases: distinctPhraseCaseCount,
        complete: existing.modelEvaluation.evaluatedCases === distinctPhraseCaseCount,
      };
    }
  } catch { /* Start a fresh evaluation if no previous report exists. */ }
}
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ outputPath, operationCount: report.operationCount, crudFunctionCount: report.crudFunctionCount, phraseCount: report.phraseCount, tabGroups: summary.length, unclassified: report.unclassified.length, evaluating: evaluate, resume, savedEvaluationBatches: report.evaluations.length }, null, 2));

if (evaluateInterpreter) {
  const batchSize = Math.max(10, Math.min(100, Number(process.env.INTENT_AUDIT_BATCH_SIZE) || 25));
  const concurrency = Math.max(1, Math.min(16, Number(process.env.INTENT_AUDIT_CONCURRENCY) || 6));
  const allCases = [...groups.entries()].flatMap(([key, rows]) => {
    const casesByPhrase = new Map<string, Set<string>>();
    for (const operation of rows) for (const phrase of sampleInterpreter ? operation.variants.slice(0, 1) : operation.variants) {
      const expectedIds = casesByPhrase.get(phrase) || new Set<string>();
      for (const id of equivalentActionIds(operation)) expectedIds.add(id);
      casesByPhrase.set(phrase, expectedIds);
    }
    const [module, tab] = key.split("\t");
    const workflows = ASSISTANT_OPERATIONS.filter(operation => operation.module === module && operation.link === tab).map(defaultWorkflow);
    return [...casesByPhrase].map(([phrase, expectedIds]) => ({ groupKey: key, module, tab, phrase, expectedIds: [...expectedIds], workflows }));
  });
  const signature = (item: { groupKey: string; phrase: string; expectedIds: string[] }) => `${item.groupKey}\t${item.phrase}\t${JSON.stringify(item.expectedIds)}`;
  const targetMatrix: any[] = sampleInterpreter ? report.interpreterSamples : report.interpreterMatrix;
  const completed = new Set(targetMatrix.filter(entry => entry.passed && !entry.error).map(signature));
  const pending = allCases.filter(testCase => !completed.has(signature(testCase)));
  let done = allCases.length - pending.length;
  const resultBySignature = new Map(targetMatrix.map(entry => [signature(entry), entry]));
  for (let offset = 0; offset < pending.length; offset += batchSize) {
    const batch = pending.slice(offset, offset + batchSize);
    const batchResults: Array<Record<string, unknown>> = [];
    let cursor = 0;
    const worker = async () => {
      while (true) {
        const index = cursor++;
        if (index >= batch.length) return;
        const testCase = batch[index];
        try {
          const result = await interpretRequest(testCase.phrase, testCase.workflows, null, []);
          const values = result.values && typeof result.values === "object" ? result.values as Record<string, unknown> : {};
          batchResults[index] = {
            groupKey: testCase.groupKey, module: testCase.module, tab: testCase.tab, phrase: testCase.phrase,
            expectedIds: testCase.expectedIds, actionId: result.actionId, intentType: result.intentType || null,
            valueKeys: Object.keys(values), passed: testCase.expectedIds.includes(String(result.actionId || "")),
          };
        } catch (error) {
          batchResults[index] = {
            groupKey: testCase.groupKey, module: testCase.module, tab: testCase.tab, phrase: testCase.phrase,
            expectedIds: testCase.expectedIds, actionId: null, passed: false, error: (error as Error).message,
          };
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, batch.length) }, worker));
    for (const result of batchResults) resultBySignature.set(signature(result as any), result);
    if (sampleInterpreter) report.interpreterSamples = [...resultBySignature.values()];
    else report.interpreterMatrix = [...resultBySignature.values()];
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    done += batch.length;
    const failed = batchResults.filter(result => !result.passed).length;
    console.log(`Production interpreter ${done}/${allCases.length}: ${failed} lệch trong lô vừa xong.`);
  }
  const results = sampleInterpreter ? report.interpreterSamples as Array<any> : report.interpreterMatrix as Array<any>;
  const failures = results.filter(entry => !entry.passed);
  console.log(JSON.stringify({ interpreterCases: results.length, passed: results.length - failures.length, mismatches: failures.length, concurrency, sampleInterpreter, reportPath: outputPath }, null, 2));
}

if (evaluate) {
  const batchSize = Math.max(10, Math.min(100, Number(process.env.INTENT_AUDIT_BATCH_SIZE) || 60));
  const model = ERP_LLM_MODEL;
  (report as any).evaluationModel = model;
  (report as any).batchSize = batchSize;
  const allBatches = [...groups.entries()].flatMap(([key, rows]) => {
    const allOperations = ASSISTANT_OPERATIONS.filter(operation => groupKey(operation.module, operation.link) === key);
    const casesByPhrase = new Map<string, Set<string>>();
    for (const operation of rows) for (const phrase of operation.variants) {
      const expectedIds = casesByPhrase.get(phrase) || new Set<string>();
      for (const id of equivalentActionIds(operation)) expectedIds.add(id);
      casesByPhrase.set(phrase, expectedIds);
    }
    const cases = [...casesByPhrase.entries()].map(([phrase, expectedIds], index) => ({ caseId: String(index), phrase, expectedIds: [...expectedIds] }));
    return Array.from({ length: Math.ceil(cases.length / batchSize) }, (_unused, index) => ({
      groupKey: key,
      module: rows[0].module,
      tab: rows[0].tab,
      allOperations,
      cases: cases.slice(index * batchSize, (index + 1) * batchSize),
      batchIndex: index,
      batchCount: Math.ceil(cases.length / batchSize),
    }));
  });
  const caseSignature = (cases: Array<{ phrase: string; expectedIds: string[] }>) => JSON.stringify(cases.map(result => `${result.phrase}\t${JSON.stringify(result.expectedIds)}`));
  const batches = allBatches.filter(batch => {
    const previous = report.evaluations.filter(result => result.groupKey === batch.groupKey && result.batchIndex === batch.batchIndex && !result.error).at(-1);
    if (!previous || !Array.isArray(previous.results)) return true;
    return caseSignature(previous.results as Array<{ phrase: string; expectedIds: string[] }>) !== caseSignature(batch.cases);
  });
  let completedBatches = allBatches.length - batches.length;

  const pauseBetweenBatchesMs = Math.max(0, Number(process.env.INTENT_AUDIT_PAUSE_MS) || 5_000);
  for (const [batchIndex, batch] of batches.entries()) {
    if (batchIndex > 0 && pauseBetweenBatchesMs) await pause(pauseBetweenBatchesMs);
    const candidateOperations = batch.allOperations.map(operation => ({
      id: operation.id,
      title: operation.title,
      description: operation.description.slice(0, 100),
    }));
    const prompt = [
      "Đây là bài kiểm tra chọn đúng thao tác cho trợ lý ERP tiếng Việt. Chọn actionId phù hợp nhất với từng câu người dùng trong danh sách workflow. Tên workflow là mô tả nghiệp vụ; câu có thể thiếu dấu tiếng Việt.",
      "Nếu câu nói rõ thao tác và đối tượng thì chọn đúng một workflow. Nếu câu đủ mơ hồ để có nhiều workflow khác nhau thì trả actionId null. Không tự tạo mã. Phân biệt xem/danh sách, tạo/thêm, sửa/cập nhật và xóa.",
      ...(batch.module === "finance" ? ["Trong phân hệ tài chính, câu nói tạo/lập phiếu thu hoặc phiếu chi thông thường dùng finance.voucher.create; chỉ chọn finance.treasury.vouchers.create khi người dùng nhắc rõ quỹ, chuyển quỹ hoặc tài khoản nhận tiền."] : []),
      ...(batch.module === "hr" && batch.tab === "/nhan-su" ? ["Trong lương, nhật ký xử lý của kỳ lương là api.get.ac427b464961eae6; nhật ký thao tác của một lượt lương là api.get.f2ac09bb2c5e311f. Hãy phân biệt kỳ lương và lượt lương."] : []),
      `Phân hệ: ${batch.module}. Tab đang kiểm tra: ${batch.tab}.`,
      `WORKFLOWS=${JSON.stringify(candidateOperations)}`,
      `CASES=${JSON.stringify(batch.cases.map(({ caseId, phrase }) => ({ caseId, phrase })))}`,
      'Trả JSON duy nhất dạng {"results":[{"caseId":"...","actionId":"ID hoặc null"}]}. Mỗi case phải có đúng một kết quả.',
    ].join("\n");
    let rawOutput = "";
    try {
      const response = await openrouterChat({ model, temperature: 0, jsonMode: true, maxRetries: 1, maxTokens: 1_536, messages: [{ role: "user", content: prompt }] });
      rawOutput = response.text;
      const parsed = JSON.parse(response.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
      const predictions = Array.isArray(parsed.results) ? parsed.results : [];
      const predictedById = new Map(predictions.filter((item: any) => item && typeof item.caseId === "string").map((item: any) => [item.caseId, item.actionId ?? null]));
      const results = batch.cases.map(testCase => {
        const prediction = predictedById.get(testCase.caseId) ?? null;
        const matches = testCase.expectedIds.includes(String(prediction || ""));
        return { caseId: testCase.caseId, phrase: testCase.phrase, expectedIds: testCase.expectedIds, predictedActionId: prediction, passed: matches };
      });
      report.evaluations = report.evaluations.filter(result => result.groupKey !== batch.groupKey || result.batchIndex !== batch.batchIndex);
      report.evaluations.push({ groupKey: batch.groupKey, module: batch.module, tab: batch.tab, batchIndex: batch.batchIndex, batchCount: batch.batchCount, tested: results.length, passed: results.filter(result => result.passed).length, failed: results.filter(result => !result.passed).length, results });
      completedBatches++;
      await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
      console.log(`Intent audit ${completedBatches}/${allBatches.length}: ${batch.module} ${batch.tab} — ${results.filter(result => !result.passed).length} chưa khớp.`);
    } catch (error) {
      report.evaluations = report.evaluations.filter(result => result.groupKey !== batch.groupKey || result.batchIndex !== batch.batchIndex);
      report.evaluations.push({ groupKey: batch.groupKey, module: batch.module, tab: batch.tab, batchIndex: batch.batchIndex, batchCount: batch.batchCount, caseSignature: caseSignature(batch.cases), error: (error as Error).message, rawOutput: rawOutput.slice(0, 1000) });
      completedBatches++;
      await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
      console.error(`Intent audit ${completedBatches}/${allBatches.length} lỗi: ${batch.module} ${batch.tab}: ${(error as Error).message}`);
      if (/\b402\b/.test((error as Error).message)) {
        console.warn("Đã dừng ma trận để tránh gửi tiếp các lô khi tài khoản không còn hạn mức.");
        break;
      }
    }
  }
  report.evaluations = allBatches.flatMap(batch => {
    const entries = report.evaluations.filter(result => result.groupKey === batch.groupKey && result.batchIndex === batch.batchIndex);
    const validResults = entries.filter((entry: any) => Array.isArray(entry.results)
      && caseSignature(entry.results) === caseSignature(batch.cases));
    const latest = validResults.at(-1) || entries.filter((entry: any) => entry.error).at(-1);
    return latest ? [latest] : [];
  });
  const allResults = report.evaluations.flatMap((evaluation: any) => Array.isArray(evaluation.results) ? evaluation.results : []);
  const mismatches = allResults.filter((result: any) => !result.passed);
  const requestedCases = allBatches.reduce((count, batch) => count + batch.cases.length, 0);
  const errors = report.evaluations.filter((evaluation: any) => evaluation.error).map((evaluation: any) => ({
    module: evaluation.module,
    tab: evaluation.tab,
    reason: evaluation.error,
  }));
  const complete = allResults.length === requestedCases && errors.length === 0;
  (report as any).modelEvaluation = {
    status: complete ? "complete" : errors.some((error: any) => /\b402\b/.test(error.reason)) ? "incomplete_api_limit" : "incomplete",
    requestedCases,
    evaluatedCases: allResults.length,
    matched: allResults.length - mismatches.length,
    mismatches: mismatches.length,
    complete,
    provider: model,
    notes: complete ? "The full phrase matrix was evaluated." : "Partial results are retained, but must not be treated as a full-matrix accuracy score.",
  };
  (report as any).evaluationErrors = errors;
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ evaluated: allResults.length, matched: allResults.length - mismatches.length, mismatches: mismatches.length, reportPath: outputPath }, null, 2));
}

if (probeInterpreter) {
  type InterpreterProbe = { module: string; tab: string; phrase: string; expectedIds: string[]; expectedValues?: Record<string, unknown> };
  const probes = new Map<string, InterpreterProbe>();
  for (const evaluation of report.evaluations as Array<any>) {
    for (const result of evaluation.results || []) {
      if (result.passed) continue;
      const key = `${evaluation.groupKey}\t${result.phrase}`;
      const previous = probes.get(key);
      probes.set(key, {
        module: evaluation.module,
        tab: evaluation.tab,
        phrase: result.phrase,
        expectedIds: [...new Set([...(previous?.expectedIds || []), ...result.expectedIds])],
      });
    }
  }
  probes.set("student\t/quan-ly-hoc-vien\tThông tin học phí của La Văn Sến", {
    module: "student", tab: "/quan-ly-hoc-vien", phrase: "Thông tin học phí của La Văn Sến", expectedIds: ["student.list"], expectedValues: { search: "La Văn Sến" },
  });
  probes.set("student\t/quan-ly-hoc-vien\tKiểm tra chất lượng học viên", {
    module: "student", tab: "/quan-ly-hoc-vien", phrase: "Kiểm tra chất lượng học viên", expectedIds: ["student.quality.list"],
  });
  const regressionProbes: InterpreterProbe[] = [
    { module: "customer", tab: "/quan-ly-khach-hang", phrase: "Danh sách khách hàng", expectedIds: ["customer.list"] },
    { module: "customer", tab: "/quan-ly-khach-hang", phrase: "Tìm khách hàng theo số điện thoại 0900000000", expectedIds: ["customer.list"], expectedValues: { query_q: "0900000000" } },
    { module: "customer", tab: "/quan-ly-khach-hang", phrase: "Bổ sung thông tin cho khách hàng La Văn Sến, địa chỉ 12 Đường Mới", expectedIds: ["customer.update"], expectedValues: { path_id: "La Văn Sến", address: "12 Đường Mới" } },
    { module: "hr", tab: "/nhan-su", phrase: "Xem nhật ký xử lý của kỳ lương", expectedIds: ["api.get.ac427b464961eae6"] },
    { module: "hr", tab: "/nhan-su", phrase: "Xem chi tiết lịch sử thay đổi ngày trong lịch công ty", expectedIds: ["timekeeping.work-calendar.audit"] },
    { module: "hr", tab: "/nhan-su", phrase: "Cập nhật biến dữ liệu đầu vào bảng lương", expectedIds: ["payroll.period.variables.update"] },
    { module: "hr", tab: "/nhan-su", phrase: "Sửa giờ làm nhân viên", expectedIds: ["api.patch.6bc968347283a069"] },
    { module: "hr", tab: "/nhan-su", phrase: "Xóa lịch phỏng vấn", expectedIds: ["recruitment.interview.delete"] },
    { module: "worker", tab: "/quan-ly-lao-dong", phrase: "Cập nhật hợp đồng lao động của Lê Minh", expectedIds: ["worker.labor.contract.update"], expectedValues: { path_id: "Lê Minh" } },
    { module: "healthcare", tab: "/quan-ly-y-te", phrase: "Bổ sung thông tin cho bệnh nhân La Văn Sến", expectedIds: ["healthcare.patient.update"], expectedValues: { path_id: "La Văn Sến" } },
    { module: "healthcare", tab: "/quan-ly-y-te", phrase: "Xem dữ liệu liên quan trước khi xóa bệnh nhân La Văn Sến", expectedIds: ["healthcare.patient.bulk-delete-preview"], expectedValues: { patientIds: JSON.stringify(["La Văn Sến"]) } },
    { module: "student", tab: "/quan-ly-hoc-vien", phrase: "Xem trước ảnh hưởng khi xóa học viên La Văn Sến", expectedIds: ["student.bulk.delete.preview"] },
    { module: "chat", tab: "/tro-chuyen", phrase: "Tạo phòng trò chuyện mới", expectedIds: ["api.post.0ca30bd0f44e4447"] },
    { module: "chat", tab: "/tro-chuyen", phrase: "Cập nhật thông tin phòng trò chuyện", expectedIds: ["api.patch.d4060a45017e2ff2"] },
    { module: "chat", tab: "/tro-chuyen", phrase: "Xóa phòng trò chuyện", expectedIds: ["api.delete.6b7e088799881047"] },
    { module: "chat", tab: "/tro-chuyen", phrase: "Rời phòng trò chuyện", expectedIds: ["api.delete.2cad6a5af287c9ed"] },
    { module: "chat", tab: "/tro-chuyen", phrase: "Xem danh sách tin nhắn trong phòng chat", expectedIds: ["chat.room.messages.list"] },
    { module: "chat", tab: "/tro-chuyen", phrase: "Tìm tin nhắn theo từ khóa trong phòng chat", expectedIds: ["api.get.0a45433dc8df2971"] },
    { module: "chat", tab: "/tro-chuyen", phrase: "Cập nhật vai trò thành viên trong phòng chat", expectedIds: ["chat.room.member.role.update"] },
    { module: "chat", tab: "/tro-chuyen", phrase: "Xóa tin nhắn trong phòng chat", expectedIds: ["api.delete.405c62abccc22d73"] },
    { module: "social-marketing", tab: "/chien-dich-noi-dung", phrase: "Xem thông tin nội dung marketing đã lưu", expectedIds: ["marketing.content.detail"] },
    { module: "finance", tab: "/tai-chinh", phrase: "Xem thông tin tài sản cố định", expectedIds: ["finance.asset.detail"] },
  ];
  for (const probe of regressionProbes) probes.set(`${probe.module}\t${probe.tab}\t${probe.phrase}`, probe);
  const byGroup = new Map<string, InterpreterProbe[]>();
  for (const probe of probes.values()) {
    const key = groupKey(probe.module as AssistantOperation["module"], probe.tab);
    byGroup.set(key, [...(byGroup.get(key) || []), probe]);
  }
  report.interpreterEvaluations = [];
  for (const [key, cases] of byGroup) {
    const [module, tab] = key.split("\t");
    const workflows = ASSISTANT_OPERATIONS.filter(operation => operation.module === module && operation.link === tab).map(defaultWorkflow);
    for (const testCase of cases) {
      try {
        const result = await interpretRequest(testCase.phrase, workflows, null, []);
        const values = result.values && typeof result.values === "object" ? result.values as Record<string, unknown> : {};
        const valuesMatch = Object.entries(testCase.expectedValues || {}).every(([key, value]) => values[key] === value);
        report.interpreterEvaluations.push({
          module: testCase.module, tab: testCase.tab, phrase: testCase.phrase, expectedIds: testCase.expectedIds,
          ...(testCase.expectedValues ? { expectedValueKeys: Object.keys(testCase.expectedValues) } : {}),
          actionId: result.actionId, intentType: result.intentType || null, valueKeys: Object.keys(values),
          valuesMatch, passed: testCase.expectedIds.includes(String(result.actionId || "")) && valuesMatch,
        });
      } catch (error) {
        report.interpreterEvaluations.push({ ...testCase, actionId: null, passed: false, error: (error as Error).message });
      }
      await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
      console.log(`Interpreter probe ${report.interpreterEvaluations.length}/${probes.size}: ${testCase.module} ${testCase.phrase}`);
    }
  }
  const passed = report.interpreterEvaluations.filter((entry: any) => entry.passed).length;
  console.log(JSON.stringify({ interpreterProbed: report.interpreterEvaluations.length, passed, mismatches: report.interpreterEvaluations.length - passed, reportPath: outputPath }, null, 2));
}
