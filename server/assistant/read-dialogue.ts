import type {SemanticRequest,SemanticSource} from './semantic-request';
import {analysisPredicates,validateListAnalysis,type ListAnalysis} from './list-analysis';
import {filterPredicateKey,type FilterExpression} from './filter-expression';
import {AssistantError} from './policy';
import {filterDate} from './filter-expression';
import {UnresolvedAssistantClarification} from './dialogue-clarification';

/** Private query state, not result data or authority. Scope/version are checked
 * by service.ts before passing it to interpretation. Never accepted from HTTP. */
export interface AssistantReadContext {scope:string;actionId:string;version:number;text:string;values:Record<string,unknown>;cohortDigest?:string}
export function readContextQuestion(request:SemanticRequest){
 const metric=request.units.find(u=>u.kind==='ordering'&&u.dimension==='none'&&['min','max'].includes(u.operator)&&u.value===null);
 if(metric)return `Bạn muốn đánh giá “${metric.quote}” theo tiêu chí nào?`;
 const threshold=request.units.find(u=>u.kind==='condition'&&u.operator==='other'&&u.value===null);
 if(threshold)return `Bạn muốn xác định “${threshold.quote}” theo tiêu chí hoặc ngưỡng nào?`;
 return undefined;
}
const planOf=(value:unknown)=>typeof value==='string'?JSON.parse(value):value;
const tree=(plan:any):FilterExpression|undefined=>plan?.where&&plan?.filters?.length?{all:[plan.where,...plan.filters]}:plan?.where|| (plan?.filters?.length?{all:plan.filters}:undefined);
const signature=(node:FilterExpression):string=>'all'in node?'all('+node.all.map(signature).sort().join(',')+')':'any'in node?'any('+node.any.map(signature).sort().join(',')+')':'not'in node?'not('+signature(node.not)+')':filterPredicateKey(node);
export const isReadCohort=(plan:ListAnalysis)=>Boolean(plan.within||plan.limit||plan.extreme||plan.having);
/** Only private, scope/version-checked session state may authorize a cohort.
 * Re-read it through the same authorized API; never replay cached result rows. */
export function validInheritedReadCohort(request:Pick<SemanticRequest,'readContinuation'>,source:SemanticSource,plan:ListAnalysis):boolean{
 if(!plan.within)return true;
 const context=request.readContinuation,contract=source.operation.analysis;
 if(!context||!contract||source.operation.method!=='GET'||context.actionId!==source.operation.id||context.version!==source.workflow.version||!context.cohortDigest||!/^[a-f0-9]{64}$/.test(context.cohortDigest))return false;
 try{
  const previous=validateListAnalysis(context.values.analysis,contract);
  if(!isReadCohort(previous)||JSON.stringify(plan.within)!==JSON.stringify(previous))return false;
  return source.workflow.fields.filter(field=>field.key!=='analysis'&&field.source!=='body'&&!['page','limit','pageSize'].includes(field.apiKey||field.key)).every(field=>JSON.stringify(source.values[field.key]??field.defaultValue)===JSON.stringify(context.values[field.key]??field.defaultValue));
 }catch{return false;}
}
export function inheritedReadTree(request:SemanticRequest,source:SemanticSource){
 const context=request.readContinuation;
 if(!context||context.actionId!==source.operation.id||context.version!==source.workflow.version||source.operation.method!=='GET'||!source.operation.analysis)return;
 try{const previous=validateListAnalysis(context.values.analysis,source.operation.analysis);return isReadCohort(previous)?undefined:structuredClone(tree(previous));}catch{return;}
}
/** An inherited query is an AND constraint. It cannot be moved below OR/NOT. */
export function hasInheritedReadTree(actual:FilterExpression|undefined,prior:FilterExpression):boolean{
 return Boolean(actual&&(signature(actual)===signature(prior)||'all'in actual&&actual.all.some(child=>hasInheritedReadTree(child,prior))));
}
export const sameReadTree=(a:FilterExpression,b:FilterExpression)=>signature(a)===signature(b);
export function inheritReadConstraints(request:SemanticRequest,sources:SemanticSource[],bindings?:Map<string,string[]>){
 const context=request.readContinuation;if(!context)return;
 for(const source of sources){
  if(source.operation.id!==context.actionId||source.workflow.version!==context.version||source.operation.method!=='GET')continue;
  let cohort:ListAnalysis|undefined;
  if(source.operation.analysis&&context.values.analysis!==undefined){
    let previous;try{previous=validateListAnalysis(context.values.analysis,source.operation.analysis);}catch{throw new AssistantError('Điều kiện lọc trước đó không còn khớp nguồn dữ liệu hiện tại. Bạn chọn lại phạm vi cần xem nhé.',409);}
    if(isReadCohort(previous))cohort=previous;
  }
  // Native date/search/reference inputs keep the previous scope. New explicit
  // values must still be bound and validated as usual, never copied from rows.
  const changed=new Set(request.units.flatMap(unit=>{
    if(!['condition','scope','reference','input','time'].includes(unit.kind)||!['eq','ne','not_exists','clear'].includes(unit.operator))return [];
    const targets=(bindings?.get(unit.id)||[]).map(t=>t.replace(`query:${source.operation.id}:`,''));
    return Object.entries(source.operation.analysis?.referenceInputs||{}).filter(([rowField])=>targets.includes(`analysis.filters.${rowField}`)).map(([,input])=>input);
  }));
  for(const field of source.workflow.fields)if(field.key!=='analysis'&&field.source!=='body'&&!changed.has(field.key)&&context.values[field.key]!==undefined&&source.values[field.key]===undefined)source.values[field.key]=structuredClone(context.values[field.key]);
  if(!source.operation.analysis)continue;
  if(cohort){
   const plan=planOf(source.values.analysis)||{};
   // A changed API scope cannot safely reconstruct the earlier top/group.
   const candidate={...plan,within:cohort};
   if(!validInheritedReadCohort(request,source,candidate))throw new UnresolvedAssistantClarification(request.text,'Bạn muốn lọc tiếp trong nhóm vừa xem hay tìm lại trên phạm vi mới?');
   source.values.analysis=validateListAnalysis(candidate,source.operation.analysis);continue;
  }
  const prior=inheritedReadTree(request,source);if(!prior)continue;
  const plan=planOf(source.values.analysis)||{},current=tree(plan);
  if(hasInheritedReadTree(current,prior))continue;
  source.values.analysis={...plan,filters:undefined,where:current?{all:[prior,current]}:prior};
 }
}

/** A noun inside a grounded condition is not a second predicate. The action
 * fit still verifies the entity/relationship against the source contract. */
export function normalizeOverlappingEntityBindings(request:SemanticRequest,bindings:Map<string,string[]>,sources:SemanticSource[]){
 for(const unit of request.units){
  if(unit.kind!=='entity'||unit.value!==null)continue;
  const targets=bindings.get(unit.id)||[];
  const redundant=targets.filter(t=>/^(?:query:[^:]+:)?analysis\.filters\./.test(t)&&request.units.some(other=>other.kind==='condition'&&other.quote.includes(unit.quote)&&(bindings.get(other.id)||[]).includes(t)));
  if(!redundant.length)continue;
  bindings.set(unit.id,[...new Set([...targets.filter(t=>!redundant.includes(t)),...sources.filter(s=>redundant.some(t=>!t.startsWith('query:')||t.startsWith(`query:${s.operation.id}:`))).map(s=>sources.length===1?'action':`query:${s.operation.id}:action`)])]);
 }
}

/** Multiple identities resolved from the same plural mention form a union.
 * This does not rewrite explicit user AND/OR or unrelated conditions. */
export function contextualReferenceGroups(request:SemanticRequest):string[][]{
 return request.referenceGroups||[];
}

export function normalizeReadReferenceBindings(request:SemanticRequest,bindings:Map<string,string[]>,sources:SemanticSource[]){
 for(const source of sources){
  if(source.operation.method!=='GET'||!source.operation.analysis?.referenceInputs)continue;
  const plan=planOf(source.values.analysis)||{};
  for(const unit of request.units){
   if(!['reference','scope','condition'].includes(unit.kind)||unit.operator!=='eq'||typeof unit.value!=='string')continue;
   const prefix=sources.length>1?`query:${source.operation.id}:`:'';
   const targets=bindings.get(unit.id)||[];
   for(const [rowField,input]of Object.entries(source.operation.analysis.referenceInputs)){
    const field=source.workflow.fields.find(f=>f.key===input&&f.reference);if(!field)continue;
    const filterTarget=`${prefix}analysis.filters.${rowField}`;
    if(!targets.includes(filterTarget))continue;
    if(unit.kind==='condition'&&(!targets.includes(`${prefix}values.${input}`)||source.values[input]!==unit.value))continue;
    const matches=(node:FilterExpression)=>'field'in node&&node.field===rowField&&node.operator==='eq'&&node.value===unit.value;
    const strip=(node:FilterExpression):FilterExpression|undefined=>{
      if(matches(node))return;
      if('all'in node){const kept=node.all.map(strip).filter((v):v is FilterExpression=>Boolean(v));return kept.length?{all:kept}:undefined;}
      // Native reference inputs may only replace conjunctive predicates.
      return node;
    };
    const before=tree(plan);if(!before)continue;
    const after=strip(before);
    if(JSON.stringify(before)===JSON.stringify(after))continue;
    if(source.values[input]!==undefined&&source.values[input]!==unit.value)continue;
    source.values[input]=unit.value;
    delete plan.filters;delete plan.where;if(after)plan.where=after;
    bindings.set(unit.id,[...new Set([...targets.filter(t=>t!==filterTarget),`${prefix}values.${input}`])]);
   }
  }
  source.values.analysis=plan;
 }
}

export function readLifecycleQuestion(request:SemanticRequest,bindings:Map<string,string[]>,sources:SemanticSource[]){
 for(const source of sources){
  const contract=source.operation.analysis;if(source.operation.method!=='GET'||!contract?.lifecycleFields)continue;
  let predicates;try{predicates=analysisPredicates(validateListAnalysis(source.values.analysis,contract));}catch{continue;}
  for(const [field,lifecycle]of Object.entries(contract.lifecycleFields)){
   const excluded=predicates.filter(p=>p.field===field&&p.operator==='ne'&&lifecycle.terminal.includes(String(p.value)));
   if(!excluded.length||!lifecycle.terminal.some(value=>!excluded.some(p=>p.value===value)))continue;
   const abstract=request.units.some(u=>u.kind==='condition'&&typeof u.value==='string'&&!Object.entries(contract.fields[field]?.values||{}).some(([key,label])=>u.value===key||u.value===label)
    &&(bindings.get(u.id)||[]).some(t=>t.replace(`query:${source.operation.id}:`,'')===`analysis.filters.${field}`));
   if(abstract)return 'Bạn muốn xem các hồ sơ còn đang xử lý, hay cả những hồ sơ đã hủy hoặc đã đóng nhưng chưa hoàn tất?';
  }
 }
}

/** Optional native day bounds are a coarse envelope around an exact datetime
 * row predicate. They never replace the predicate or invent a time of day. */
export function readCalendarEnvelope(request:SemanticRequest,source:SemanticSource,bindings:Map<string,string[]>){
 const result=new Map<string,string>();if(source.operation.method!=='GET'||!source.operation.analysis)return result;
 let predicates;try{predicates=analysisPredicates(validateListAnalysis(source.values.analysis,source.operation.analysis));}catch{return result;}
 const isoDay=(value:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
 for(const unit of request.units){
  if(unit.kind!=='time'||unit.operator!=='range'||!unit.value||typeof unit.value!=='object'||!unit.value.from.includes('T')||!unit.value.to.includes('T')||!Number.isFinite(Date.parse(unit.value.from))||!Number.isFinite(Date.parse(unit.value.to)))continue;
  const range=unit.value;
  const grounded=predicates.some(p=>source.operation.analysis!.fields[p.field]?.format==='date'&&p.operator==='between'&&Array.isArray(p.value)&&p.value[0]===range.from&&p.value[1]===range.to
   &&(bindings.get(unit.id)||[]).some(t=>t.replace(`query:${source.operation.id}:`,'')===`analysis.filters.${p.field}`));
  if(!grounded)continue;
  for(const field of source.workflow.fields){
   if(field.source!=='query'||field.type!=='date')continue;
   const key=field.apiKey||field.key;
   if(key==='from'||key==='to')result.set(field.key,isoDay(key==='from'?range.from:range.to));
  }
 }
 return result;
}
export function readCalendarQuestion(request:SemanticRequest,bindings:Map<string,string[]>,sources:SemanticSource[]){
 for(const unit of request.units){
  if(unit.kind!=='time'||typeof unit.value!=='string'||Number.isFinite(Date.parse(unit.value))||filterDate(unit.value)!==undefined||/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(unit.value))continue;
  if(sources.some(source=>(bindings.get(unit.id)||[]).some(raw=>{
   const target=raw.replace(`query:${source.operation.id}:`,'');
   if(target.startsWith('analysis.filters.'))return source.operation.analysis?.fields[target.slice('analysis.filters.'.length)]?.format==='date';
   const field=source.workflow.fields.find(f=>target==='values.'+f.key);return field&&['date','datetime'].includes(field.type);
  })))return `Bạn muốn xem “${unit.quote}” trong khoảng thời gian nào?`;
 }
}
export function readPlanningValues(request:SemanticRequest,source:SemanticSource){
 return request.readContinuation?.actionId===source.operation.id?Object.fromEntries(Object.entries(source.values).map(([key,value])=>[key,source.workflow.fields.some(f=>f.key===key&&f.reference)&&typeof value==='string'&&/^[a-f0-9]{24}$/i.test(value)?'[Tham chiếu đã chọn ở lượt trước]':value])):source.values;
}
