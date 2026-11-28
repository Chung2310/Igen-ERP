import { AssistantError } from './policy';

export type FilterScalar = string | number | boolean;
export interface ReadPredicate {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'startsWith' | 'endsWith' | 'in' | 'nin' | 'between' | 'is_empty' | 'not_empty';
  value?: FilterScalar | FilterScalar[];
}
export type FilterExpression = ReadPredicate | { all: FilterExpression[] } | { any: FilterExpression[] } | { not: FilterExpression };
/** An abstract condition may lower to an entire AND subtree, never to leaves
 * scattered across OR/NOT or an incomplete subset of another condition. */
export function hasExactFilterConjunction(tree:FilterExpression,predicates:ReadPredicate[]):boolean {
  const expected=predicates.map(filterPredicateKey).sort();
  if(!expected.length||new Set(expected).size!==expected.length)return false;
  const conjunction=(node:FilterExpression):ReadPredicate[]|undefined=>{
    if('field' in node)return [node];
    if(!('all' in node))return;
    const rows=node.all.map(conjunction);return rows.every(Boolean)?rows.flatMap(r=>r!):undefined;
  };
  const rows=conjunction(tree)?.map(filterPredicateKey).sort();
  if(rows&&JSON.stringify(rows)===JSON.stringify(expected))return true;
  if('field' in tree)return false;
  return ('all' in tree?tree.all:'any' in tree?tree.any:[tree.not]).some(child=>hasExactFilterConjunction(child,predicates));
}
export interface FilterField { type: 'number' | 'text' | 'boolean' | 'scalar'; format?: string; contains?: boolean; values?: Record<string,string> }
const plain = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const fail = (): never => { throw new AssistantError('Điều kiện lọc chưa khớp với dữ liệu được phép xem. Mình chưa thực hiện tra cứu.'); };
const scalar = (v: unknown): v is FilterScalar => typeof v === 'string' && v.length <= 4000 || typeof v === 'number' && Number.isFinite(v) || typeof v === 'boolean';
export const normalizeSearchText = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLocaleLowerCase('vi').replace(/\s+/gu,' ').trim();
/** Canonicalize only an unambiguous declared label, retaining the predicate tree. */
export function canonicalFilterEnums(raw:unknown,fields:Record<string,FilterField>,evaluatedAt?:string):unknown {
  if(!plain(raw))return raw;
  if(Object.keys(raw).length===1){
    for(const key of ['all','any'] as const)if(Array.isArray(raw[key]))return {[key]:raw[key].map((child:unknown)=>canonicalFilterEnums(child,fields,evaluatedAt))};
    if(Object.hasOwn(raw,'not'))return {not:canonicalFilterEnums(raw.not,fields,evaluatedAt)};
  }
  if(Object.hasOwn(raw,'value')&&fields[raw.field]?.format==='date'&&evaluatedAt&&filterDate(evaluatedAt)!==undefined){
    const calendar=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(evaluatedAt));
    const date=(value:unknown)=>value==='now'?evaluatedAt:value==='today'?calendar:value;
    return {...raw,value:Array.isArray(raw.value)?raw.value.map(date):date(raw.value)};
  }
  const choices=fields[raw.field]?.values;
  if(!choices||!['eq','ne','in','nin'].includes(raw.operator))return raw;
  const canonical=(value:unknown)=>{
    if(typeof value!=='string'||Object.hasOwn(choices,value))return value;
    const matches=Object.entries(choices).filter(([,label])=>normalizeSearchText(label)===normalizeSearchText(value));
    return matches.length===1?matches[0][0]:value;
  };
  return {...raw,value:Array.isArray(raw.value)?raw.value.map(canonical):canonical(raw.value)};
}
export function filterDate(value: unknown): number | undefined {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) return;
  if(value.length>10&&(Number(value.slice(11,13))>23||Number(value.slice(14,16))>59||Number(value.slice(17,19))>59))return;
  const day = value.slice(0,10), time = Date.parse(value);
  if (!Number.isFinite(time) || new Date(`${day}T00:00:00Z`).toISOString().slice(0,10) !== day) return;
  return time;
}
function dateOrder(actual:unknown,bound:unknown):number {
  if(filterDate(actual)===undefined||filterDate(bound)===undefined)throw new AssistantError('Có ngày không hợp lệ trong điều kiện hoặc dữ liệu cần lọc.');
  if((bound as string).length===10){
    const day=(actual as string).length===10?actual as string:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(actual as string));
    return day.localeCompare(bound as string);
  }
  if((actual as string).length===10)throw new AssistantError('Dữ liệu chỉ có ngày, chưa đủ giờ để so sánh theo thời điểm chính xác.');
  return filterDate(actual)!-filterDate(bound)!;
}
export function validateFilterExpression(raw: unknown, fields: Record<string, FilterField>): FilterExpression {
  let nodes = 0;
  const visit = (node: unknown, depth: number): FilterExpression => {
    if (++nodes > 80 || depth > 6 || !plain(node)) return fail();
    for (const logical of ['all','any','not'] as const) if (Object.hasOwn(node,logical)) {
      if (Object.keys(node).length !== 1) return fail();
      if (logical === 'not') return {not:visit(node.not,depth+1)};
      if (!Array.isArray(node[logical]) || !node[logical].length || node[logical].length > 40) return fail();
      return {[logical]:node[logical].map((v: unknown) => visit(v,depth+1))} as FilterExpression;
    }
    if (Object.keys(node).some(k=>!['field','operator','value'].includes(k)) || typeof node.field !== 'string' || !Object.hasOwn(fields,node.field)) return fail();
    const definition = fields[node.field], op = node.operator;
    if (!['eq','ne','gt','gte','lt','lte','contains','startsWith','endsWith','in','nin','between','is_empty','not_empty'].includes(op)) return fail();
    if (op === 'is_empty' || op === 'not_empty') {
      if (Object.hasOwn(node,'value')) return fail();
      return {field:node.field,operator:op};
    }
    const values = ['in','nin','between'].includes(op) ? node.value : [node.value];
    if (!Array.isArray(values) || !values.length || values.length > 40 || op === 'between' && values.length !== 2 || !values.every(scalar)) return fail();
    if (values.some(v => definition.type === 'number' ? typeof v !== 'number' : definition.type === 'boolean' ? typeof v !== 'boolean' : definition.type === 'text' ? typeof v !== 'string' : false)) return fail();
    if(definition.format==='date' && values.some(v=>filterDate(v)===undefined))return fail();
    if (definition.values && values.some(v=>!Object.hasOwn(definition.values!,String(v)))) return fail();
    if (['contains','startsWith','endsWith'].includes(op) && (!definition.contains || typeof node.value !== 'string' || !node.value.trim() || !['text','scalar'].includes(definition.type))) return fail();
    if (['gt','gte','lt','lte','between'].includes(op)) {
      if (!['number','scalar'].includes(definition.type) && definition.format !== 'date') return fail();
      if (values.some(v=>definition.format === 'date' ? filterDate(v) === undefined : typeof v !== 'number')) return fail();
      if (op === 'between' && (definition.format === 'date' ? filterDate(values[0])! > filterDate(values[1])! : Number(values[0]) > Number(values[1]))) return fail();
    }
    return {field:node.field,operator:op,value:node.value};
  };
  return visit(raw,0);
}
export function filterLeaves(node: FilterExpression): ReadPredicate[] {
  if ('all' in node) return node.all.flatMap(filterLeaves);
  if ('any' in node) return node.any.flatMap(filterLeaves);
  if ('not' in node) return filterLeaves(node.not);
  return [node];
}
export const filterPredicateKey=(p:ReadPredicate)=>JSON.stringify([p.field,p.operator,p.value]);
/** Unknown/missing cells never satisfy a negation of an ordinary comparison. */
export function matchesFilter(row: Record<string, unknown>, node: FilterExpression, fields: Record<string,FilterField>): boolean | undefined {
  if ('not' in node) { const v=matchesFilter(row,node.not,fields); return v === undefined ? undefined : !v; }
  if ('all' in node || 'any' in node) {
    const all='all' in node, values=(all?node.all:node.any).map(n=>matchesFilter(row,n,fields));
    return all ? values.includes(false)?false:values.includes(undefined)?undefined:true : values.includes(true)?true:values.includes(undefined)?undefined:false;
  }
  const raw=row[node.field], empty=raw == null || typeof raw === 'string' && !raw.trim();
  if (node.operator==='is_empty') return empty;
  if (node.operator==='not_empty') return !empty;
  if (raw == null) return;
  const d=fields[node.field];
  if (!scalar(raw)) throw new AssistantError('Trường cần lọc không phải dữ liệu đơn. Mình chưa thể kết luận kết quả.');
  if(['eq','ne','in','nin'].includes(node.operator)&&d.format!=='date'){
    const values=Array.isArray(node.value)?node.value:[node.value];
    if(values.some(v=>typeof v!==typeof raw))throw new AssistantError('Kiểu dữ liệu trả về chưa khớp với điều kiện lọc. Mình chưa kết luận kết quả.');
  }
  const eq=(a: unknown,b: unknown)=>d.format==='date'?dateOrder(a,b)===0:typeof a==='string'&&typeof b==='string' ? normalizeSearchText(a)===normalizeSearchText(b) : a===b;
  if (node.operator==='eq'||node.operator==='ne') return node.operator==='eq'?eq(raw,node.value):!eq(raw,node.value);
  if (node.operator==='in'||node.operator==='nin') { const found=(node.value as FilterScalar[]).some(v=>eq(raw,v)); return node.operator==='in'?found:!found; }
  if (['contains','startsWith','endsWith'].includes(node.operator)) {
    if (typeof raw!=='string') throw new AssistantError('Trường cần tìm không chứa văn bản. Mình chưa thể lọc theo nội dung.');
    const a=normalizeSearchText(raw),b=normalizeSearchText(String(node.value));
    return node.operator==='contains'?a.includes(b):node.operator==='startsWith'?a.startsWith(b):a.endsWith(b);
  }
  if(d.format==='date'){
    if(node.operator==='between')return dateOrder(raw,(node.value as FilterScalar[])[0])>=0&&dateOrder(raw,(node.value as FilterScalar[])[1])<=0;
    const order=dateOrder(raw,node.value);
    return node.operator==='gt'?order>0:node.operator==='gte'?order>=0:node.operator==='lt'?order<0:order<=0;
  }
  const a=d.format==='date'?filterDate(raw):typeof raw==='number'?raw:undefined;
  if (a===undefined) throw new AssistantError('Có giá trị không đúng kiểu số hoặc ngày trong dữ liệu cần lọc. Mình chưa kết luận kết quả.');
  const value=(v: unknown)=>d.format==='date'?filterDate(v)!:Number(v);
  if (node.operator==='between') return a>=value((node.value as FilterScalar[])[0])&&a<=value((node.value as FilterScalar[])[1]);
  const b=value(node.value);
  return node.operator==='gt'?a>b:node.operator==='gte'?a>=b:node.operator==='lt'?a<b:a<=b;
}
export const FILTER_EXPRESSION_SCHEMA = {
  anyOf:[{$ref:'#/$defs/readPredicate'}, ...['all','any'].map(key=>({type:'object',additionalProperties:false,required:[key],properties:{[key]:{type:'array',minItems:1,maxItems:40,items:{$ref:'#/$defs/filterExpression'}}}})), {type:'object',additionalProperties:false,required:['not'],properties:{not:{$ref:'#/$defs/filterExpression'}}}],
};
