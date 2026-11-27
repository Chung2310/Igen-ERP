import { createHash } from 'node:crypto';
import type { AssistantOperation } from './catalog';
import type { AnalysisContract } from './list-analysis';
import { privateAssistantResultField } from './result-field-policy';
import { AssistantReadDataError } from './policy';
import {isAssistantTemporalField} from '../../src/shared/assistant-date';
import {localizedAssistantFieldLabel,localizedAssistantEnumLabel} from './result-format';

export {AssistantReadDataError} from './policy';

/** No column names/types are invented from the user's sentence. Unknown scalar
 * types are checked against actual API values before comparisons/calculations. */
export function publicReadAnalysis(operation: AssistantOperation, relatedOperations: readonly AssistantOperation[] = []): AnalysisContract | undefined {
  if (operation.analysis || operation.unavailableReason || !(operation.method === 'GET' || operation.readOnly)
    || operation.adapter==='quotation'&&!operation.id.endsWith('.list')
    || operation.resultFields.every(k=>['filename','fileName','status','error','createdAt'].includes(k))) return;
  const fields: AnalysisContract['fields'] = {};
  const rowsField=operation.resultRowsField&&operation.resultFields.includes(operation.resultRowsField)&&Array.isArray(operation.resultChildFields?.[operation.resultRowsField])?operation.resultRowsField
    :operation.resultFields.length===1&&Array.isArray(operation.resultChildFields?.[operation.resultFields[0]]) ? operation.resultFields[0] : undefined;
  const identity=operation.path.match(/\/:([^/]+)$/)?.[1];
  if(!rowsField&&identity&&operation.fields.some(f=>f.source==='path'&&(f.apiKey||f.key)===identity&&Boolean(f.reference)))return;
  const paged=operation.fields.some(f=>f.source==='query'&&['page','pageNumber'].includes(f.apiKey||f.key));
  if(!paged&&operation.fields.some(f=>f.source==='query'&&(f.required||f.systemRequired)&&['q','search','keyword'].includes(f.apiKey||f.key)))return;
  const columns=rowsField?operation.resultChildFields![rowsField] as string[]:operation.resultFields;
  for (const key of columns) {
    if (privateAssistantResultField(key) || operation.resultChildFields?.[key]) continue;
    const basePath=operation.path.replace(/\/:\w+$/,'');
    const own=operation.fields.find(f=>f.key===key || f.apiKey===key);
    const rowField=relatedOperations.filter(op=>op.method!=='GET'&&!op.readOnly&&op.path.replace(/\/:\w+$/,'')===basePath).flatMap(op=>op.fields).find(f=>(f.apiKey||f.key)===key&&f.type!=='reference'&&f.source!=='query'&&f.source!=='path');
    // A query-only option such as status=all is not a possible row state.
    const input=own?.source==='query'?rowField||own:own||rowField;
    if (input?.type==='json' || input?.type==='reference') continue;
    const label=input?.label?.trim();
    fields[key]={label:localizedAssistantFieldLabel(key,!label||label==='Thông tin'?key:label,operation.id),type:input?.type==='number'?'number':input?.type==='boolean'?'boolean':input?.options?.length||input&&['phone','email','date','datetime'].includes(input.type)?'text':'scalar',contains:input?.type!=='number'&&input?.type!=='boolean',...(input?.options?.length?{values:Object.fromEntries(input.options.map(v=>[v,localizedAssistantEnumLabel(key,v)]))}:{}),...(key==='bankAccountNo'?{format:'bank-account' as const}:isAssistantTemporalField(input || {key})?{format:'date' as const}:{})};
  }
  // resourceDriveService.list returns DriveFile: size is decimal text in bytes,
  // modifiedTime is a timestamp. Normalize only this reviewed output contract.
  if(operation.method==='GET'&&operation.path==='/resources/drive/files'){
    if(fields.size)fields.size={...fields.size,label:'Dung lượng (byte)',type:'number',contains:false,outputCoercion:'unsigned-integer-string'};
    if(fields.modifiedTime)fields.modifiedTime={...fields.modifiedTime,type:'text',format:'date',contains:false};
  }
  // Course.fee is stored and served as Vietnamese formatted monetary text.
  // This is a source contract, never a heuristic applied to arbitrary fields.
  if(operation.method==='GET'&&operation.path==='/courses'&&fields.fee)
    fields.fee={...fields.fee,type:'number',contains:false,outputCoercion:'vietnamese-money'};
  if(operation.id==='student.learning-roadmap.progression.list'){
    for(const key of ['eligible','overrideEligible'])if(fields[key])fields[key]={...fields[key],type:'boolean',contains:false};
    for(const key of ['attendanceRate','assignmentRate','miniTestRate','examRate'])if(fields[key])fields[key]={...fields[key],type:'number',contains:false};
  }
  if (!Object.keys(fields).length) return;
  if(operation.method==='GET'&&operation.path==='/auth/users/count'&&fields.count){
    fields.count={label:'Số nhân sự',type:'number',measureOperation:'count'};
    return {publicRead:true,singleton:true,fields,displayFields:['count']};
  }
  const rowDimensions=['code','name','fullName','displayName','employeeName','workerName','studentName','orderCode','title'].filter(key=>Boolean(fields[key])).slice(0,2);
  return {publicRead:true,...(rowsField?{publicRowsField:rowsField}:{}),...(operation.resultRowsTotalField?{publicRowsTotalField:operation.resultRowsTotalField}:{}),...(operation.resultRowsComplete?{publicRowsComplete:true as const}:{}),...(rowDimensions.length?{rowDimensions}:{}),fields,displayFields:Object.keys(fields)};
}
/** Reviewed whole-collection APIs. Keep method/path and response shape explicit;
 * do not infer completeness from an array or from the operation's display name.
 * Evidence: auth.controller.getUsers/auth.service.getUsers; workerController.list/
 * WorkerService.list; hr-department.router GET / (unbounded scoped find). */
export const COMPLETE_PUBLIC_READ_ARRAYS:Readonly<Record<string,readonly string[]>>={
  '/auth/users':['data'],
  '/worker-management/workers':['workers','data.workers'],
  '/hr/departments':['data'],
  '/timekeeping/records':['data'],
  // listInterviews uses one scoped, unbounded find; no skip/limit is applied.
  '/recruitment/interviews':['data'],
  '/learning-roadmaps/batches/:batchId/progression':['data'],
  // ReceivableQueryService.byCustomer groups the entire authorized match;
  // the repository has no skip/limit and the controller returns data:[...].
  '/finance/receivables/by-customer':['data'],
  '/inventory/warehouses/balances':['data'],
  '/payments/balances':['data'],
  // WorkerReport rejects its 100-project / 50,000-log limits instead of
  // truncating, then builds every matching row for the requested scope.
  '/worker-management/reports/assistant':['data'],
};
// RetailReportService loads every matched order (no skip/limit); its metrics
// builder returns every grouped product and non-zero payment method. Only
// these explicitly selected row sections inherit that completeness proof.
const COMPLETE_PUBLIC_READ_SECTIONS:Readonly<Record<string,readonly string[]>>={
  '/retail/reports/summary':['paymentMix','products'],
};
function at(response:any,path:string){return path.split('.').reduce((v,k)=>v?.[k],response);}
function completeGroups(operation:AssistantOperation,rows:Record<string,unknown>[]){
  const domain=operation.analysis?.completeGroups;if(!domain)return rows;
  const fields=operation.analysis!.fields,seen=new Set<string>();
  if(!domain.values.length||new Set(domain.values).size!==domain.values.length||domain.values.some(v=>!Object.hasOwn(fields[domain.dimension]?.values||{},v))
    ||!domain.zeroMeasures.length||domain.zeroMeasures.some(key=>fields[key]?.type!=='number'))throw new AssistantReadDataError('Hợp đồng nhóm tổng hợp chưa hợp lệ.');
  for(const row of rows){const key=row[domain.dimension];
    if(typeof key!=='string'||!domain.values.includes(key)||seen.has(key)||domain.zeroMeasures.some(field=>typeof row[field]!=='number'||!Number.isFinite(row[field])))throw new AssistantReadDataError('Nguồn nhóm tổng hợp trả thiếu hoặc trùng dữ liệu.');
    seen.add(key);
  }
  return [...rows,...domain.values.filter(value=>!seen.has(value)).map(value=>({[domain.dimension]:value,...Object.fromEntries(domain.zeroMeasures.map(field=>[field,0]))}))];
}
function outputValue(definition:AnalysisContract['fields'][string],value:unknown):unknown {
  if(value==null||!definition.outputCoercion)return value;
  if(definition.outputCoercion==='vietnamese-money'){
    if(typeof value==='number'&&Number.isSafeInteger(value)&&value>=0)return value;
    if(typeof value!=='string'||! /^(?:0|[1-9]\d*|[1-9]\d{0,2}(?:\.\d{3})+)$/.test(value.trim()))throw new AssistantReadDataError('Nguồn trả số tiền chưa đúng định dạng tiền Việt Nam.');
    const amount=Number(value.trim().replace(/\./g,''));
    if(!Number.isSafeInteger(amount)||amount<0)throw new AssistantReadDataError('Số tiền vượt phạm vi có thể đối chiếu chính xác.');
    return amount;
  }
  if(definition.outputCoercion==='unsigned-integer-string'){
    if(typeof value==='string'&&!/^\d+$/.test(value))throw new AssistantReadDataError('Nguồn trả dung lượng chưa đúng định dạng số byte.');
    const result=typeof value==='string'?Number(value):value;
    if(typeof result!=='number'||!Number.isSafeInteger(result)||result<0)throw new AssistantReadDataError('Số byte vượt phạm vi có thể đối chiếu chính xác.');
    return result;
  }
  return value;
}
export function publicReadRows(operation:AssistantOperation,response:any):unknown[]|undefined {
  const field=operation.analysis?.publicRowsField;
  if(!field)return;
  const containers=[response,response?.data,response?.data?.data];
  const declared=[...new Set(containers.filter(c=>c&&typeof c==='object'&&!Array.isArray(c)&&Object.hasOwn(c,field)&&Array.isArray(c[field])).map(c=>c[field] as unknown[]))];
  if(declared.length>1)throw new AssistantReadDataError('Nguồn trả nhiều danh sách khác nhau cho cùng trường dữ liệu. Mình chưa chọn thay bạn.');
  return declared[0] || containers.find(Array.isArray);
}
function collection(response: any, declaredPagination: boolean, operation:AssistantOperation): {rows:Record<string,unknown>[];total?:number;page?:number} | undefined {
  const containers=[response,response?.data,response?.data?.data].filter(v=>v&&typeof v==='object');
  let rows: unknown=publicReadRows(operation,response);
  for (const container of operation.analysis?.publicRowsField?[]:containers) {
    if (Array.isArray(container)) { rows=container;break; }
    for (const key of ['items','records','results','rows','events','products','courses','contracts','batches','enrollments','payments','notifications','resources','warehouses','balances','accounts','vouchers','partners','students','users','workers']) if (Array.isArray(container[key])) {rows=container[key];break;}
    if (rows) break;
  }
  if (!Array.isArray(rows) || rows.some(r=>!r||typeof r!=='object'||Array.isArray(r))) return;
  const metadata=containers.flatMap(c=>[c,c.pagination,c.meta,c.meta?.pagination]).filter(c=>c&&typeof c==='object'&&!Array.isArray(c));
  const totalField=operation.analysis?.publicRowsTotalField;
  const totals=metadata.map(c=>totalField?c[totalField]:c.totalCount ?? c.totalItems ?? (declaredPagination || c.page!==undefined || c.currentPage!==undefined || containers.some(p=>p.pagination===c||p.meta?.pagination===c) ? c.total : undefined)).filter(v=>v!==undefined);
  if (totals.some(v=>!Number.isSafeInteger(v)||v<0) || new Set(totals).size>1) throw new AssistantReadDataError('Tổng số dòng của nguồn dữ liệu chưa nhất quán. Mình chưa kết luận kết quả lọc.');
  const pages=operation.analysis?.publicRowsComplete?[1]:metadata.map(c=>c.page ?? c.currentPage).filter(v=>v!==undefined);
  if (pages.some(v=>!Number.isSafeInteger(v)||v<1)||new Set(pages).size>1) throw new AssistantReadDataError('Thông tin trang dữ liệu chưa nhất quán.');
  return {rows,total:totals[0],page:pages[0]};
}
/** Only explicit totals prove completeness. A short page, missing total or a
 * bare array is never interpreted as the complete company/branch dataset. */
export async function collectPublicReadData(
  operation: AssistantOperation, values: Record<string,any>, dispatch:(values:Record<string,any>)=>Promise<any>,
  project:(response:any,values:Record<string,any>)=>Record<string,unknown>[],
  options:{allowPartialRows?:boolean}={},
) {
  const pageField=operation.fields.find(f=>f.source==='query'&&['page','pageNumber'].includes(f.apiKey||f.key));
  const sizeField=operation.fields.find(f=>f.source==='query'&&['limit','pageSize','perPage'].includes(f.apiKey||f.key));
  const all:Record<string,unknown>[]=[],seen=new Map<string,number>();
  let total: number | undefined;
  const start=pageField&&Number.isSafeInteger(values[pageField.key])&&values[pageField.key]>1?values[pageField.key]:1;
  const partial=()=>({data:all,analysisComplete:false as const});
  for (let page=start;page<start+20;page++) {
    const input={...values,...(pageField?{[pageField.key]:page}:{}),...(pageField&&sizeField?{[sizeField.key]:values[sizeField.key] ?? Math.min(500,sizeField.max||500)}:{})};
    const response=await dispatch(input);
    if(operation.analysis?.singleton){
      const rows=project(response,input);
      const containers=[response,response?.data,response?.data?.data].filter(r=>r&&typeof r==='object'&&!Array.isArray(r));
      const invalidNumber=rows.length!==1||Object.entries(operation.analysis.fields).some(([key,field])=>{
        if(field.type!=='number')return false;
        const value=rows[0][key];
        return typeof value!=='number'||!Number.isFinite(value)
          ||field.measureOperation==='count'&&(!Number.isSafeInteger(value)||value<0)
          ||!containers.some(r=>Object.hasOwn(r,key)&&r[key]===value);
      });
      if(invalidNumber)throw new AssistantReadDataError('Nguồn báo cáo chưa trả đủ số liệu tổng hợp. Mình chưa kết luận kết quả.');
      return {data:rows,analysisComplete:true};
    }
    let source=collection(response,Boolean(pageField),operation);
    if(operation.analysis?.publicRowsComplete&&(!source||source.total===undefined||source.total!==source.rows.length))throw new AssistantReadDataError('Phần báo cáo chưa trả đủ các dòng theo tổng đã xác nhận.');
    // Schedule class expansion is capped at 400 days. Its bounded daily/monthly
    // response is complete; an unbounded or wider request is not.
    const calendarBoundary=(key:string)=>operation.fields.find(f=>f.source==='query'&&(f.apiKey||f.key)===key);
    const from=values[calendarBoundary('from')?.key||''],to=values[calendarBoundary('to')?.key||''];
    const boundedSchedule=operation.path==='/schedule'&&typeof from==='string'&&typeof to==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(from)&&/^\d{4}-\d{2}-\d{2}$/.test(to)
      &&Date.parse(to)>=Date.parse(from)&&Date.parse(to)-Date.parse(from)<400*86400000;
    const section=operation.analysis?.publicRowsField;
    const sectionRows=section&&COMPLETE_PUBLIC_READ_SECTIONS[operation.path]?.includes(section)
      ?[response,response?.data,response?.data?.data].map(value=>value?.[section]).find(Array.isArray):undefined;
    const reviewed=operation.method==='GET'?(sectionRows|| (boundedSchedule?response.events:COMPLETE_PUBLIC_READ_ARRAYS[operation.path]?.map(path=>at(response,path)).find(Array.isArray))):undefined;
    if(reviewed){
      if(!source || source.rows!==reviewed)throw new AssistantReadDataError('Dạng dữ liệu trả về đã thay đổi so với hợp đồng đọc đầy đủ.');
      const explicitTotal=response.total ?? response.data?.total ?? source.total;
      if(explicitTotal!==undefined&&explicitTotal!==reviewed.length)throw new AssistantReadDataError('Danh sách có dấu hiệu bị phân trang ngoài hợp đồng đọc đầy đủ.');
      source={...source,total:reviewed.length,page:1};
    }
    if (!source || source.page!==undefined&&source.page!==page || source.total!==undefined&&source.total>10000 && !options.allowPartialRows || total!==undefined&&source.total!==total) throw new AssistantReadDataError('Nguồn này chưa trả đủ thông tin để lọc hoặc tính trên toàn bộ danh sách. Mình chưa kết luận là không có dữ liệu phù hợp.');
    if(source.total===undefined&&!options.allowPartialRows)throw new AssistantReadDataError('Nguồn chưa xác nhận đã đọc đủ danh sách để tính kết quả.');
    total=source.total;
    const rows=project(response,input);
    if (rows.length!==source.rows.length) throw new AssistantReadDataError('Cấp độ dòng của nguồn dữ liệu chưa khớp với danh sách cần lọc. Mình chưa tính kết quả.');
    if(source.total!==undefined&&all.length+rows.length>source.total)throw new AssistantReadDataError('Số dòng vượt tổng được nguồn xác nhận. Mình chưa kết luận kết quả.');
    const take=Math.min(rows.length,10000-all.length);
    for (let i=0;i<take;i++) {
      const raw=source.rows[i],id=raw._id??raw.id;
      const key=id!=null?'id:'+String(id):'row:'+createHash('sha256').update(JSON.stringify(raw)).digest('hex');
      // Different records can share all public values (e.g. an unnamed roster).
      // Without an ID, equal rows on one page are not proof of a repeated page.
      if (seen.has(key)&&(id!=null||seen.get(key)!==page)) throw new AssistantReadDataError('Danh sách có trang trùng hoặc đã thay đổi khi đọc. Mình chưa tính kết quả lọc.');
      seen.set(key,page);
      all.push(Object.fromEntries(Object.keys(operation.analysis!.fields).filter(k=>Object.hasOwn(rows[i],k)).map(k=>[k,outputValue(operation.analysis!.fields[k],rows[i][k])])));
    }
    if(take<rows.length){if(options.allowPartialRows)return partial();throw new AssistantReadDataError('Danh sách vượt giới hạn đọc hiện tại.');}
    if(start>1||source.total===undefined){if(options.allowPartialRows)return partial();break;}
    if (all.length===total) return {data:completeGroups(operation,all),analysisComplete:true};
    if (all.length>total!)throw new AssistantReadDataError('Số dòng vượt tổng được nguồn xác nhận. Mình chưa kết luận kết quả.');
    if (!pageField || !rows.length) break;
  }
  if(options.allowPartialRows)return partial();
  throw new AssistantReadDataError('Chưa lấy đủ dữ liệu trong giới hạn đọc hiện tại. Bạn thu hẹp phạm vi để mình lọc chính xác nhé.');
}
