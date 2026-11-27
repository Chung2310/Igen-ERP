import type {AssistantField} from '../../src/shared/assistant-workflow';
import type {MeaningUnit,SemanticRequest,SemanticSource} from './semantic-request';
import {assistantModuleContext,isModuleContextClause,hasExplicitModuleContextMarker} from './module-context';
import {MODULE_KEYS,MODULE_LABELS} from '../../src/config/modules';
import {publicAssistantResultFields,publicAssistantResultTarget} from './result-field-policy';
import {validateListAnalysis,analysisPredicates,type ListAnalysis} from './list-analysis';
import {inputProof} from './semantic-request';
import {validateField} from './policy';
import {filterDate,filterLeaves,filterPredicateKey,hasExactFilterConjunction} from './filter-expression';
import {normalizeAssistantFieldValue,assistantInputAddress} from './input-contract';
import {canonicalAnalysisTarget,normalizeAnalysisPlan} from './analysis-normalization';

export const semanticRoles=['action_binding','input_literal','input_assignment','execution_context','module_context','snapshot_context','temporal_input','enum_input','input_fragment','row_measure','row_dimension','group_category','public_output','read_predicate','builtin_condition','ordering'] as const;
export interface SemanticResolution {
  unitId:string;actionId:string;role:typeof semanticRoles[number];target:string;
  predicates:Array<{field:string;operator:'eq'|'ne'|'gt'|'gte'|'lt'|'lte';value:string|number|boolean}>;
}
export interface CompiledRole {actionId:string;role:SemanticResolution['role'];target:string;targets?:string[];value?:unknown;analysis?:string;values?:string}
/** An independently reviewed qualifier can describe a computed measure,
 * instead of imposing a row predicate. Literal thresholds remain predicates. */
export function computedMeasureModifier(request:SemanticRequest,bindings:Map<string,string[]>,source:SemanticSource,plan:ListAnalysis|undefined,unit:MeaningUnit,target:string){
 const key=target.replace(/^analysis\.aggregate\./,''),definition=source.operation.analysis?.fields[key];
 if(!(source.operation.method==='GET'||source.operation.readOnly)||!target.startsWith('analysis.aggregate.')||!definition?.computedMeaning||definition.type!=='number'
  ||unit.kind!=='condition'||unit.operator!=='eq'||typeof unit.value!=='string'||unit.dimension==='numeric'||unit.dimension==='temporal'
  ||!(plan?.aggregates||(plan?.aggregate?[plan.aggregate]:[])).some(a=>a.field===key))return false;
 const bound=(id:string)=>(bindings.get(id)||[]).map(t=>t.replace(`query:${source.operation.id}:`,''));
 return request.units.some(u=>u.kind==='output'&&u.quote.includes(unit.quote)&&bound(u.id).some(t=>t===target||t===`result.${key}`))
   &&request.units.some(u=>u.kind==='aggregate'&&u.value===null&&bound(u.id).includes(target));
}
/** The reviewer decides whether a clause is an assignment. The server still
 * checks the actual declared leaf, concrete value, clearability and type. */
export function inputAssignmentValue(unit:MeaningUnit,source:SemanticSource,target:string,requestText=unit.quote){
 if(!target.startsWith('values.')||!['eq','clear','none'].includes(unit.operator)||['goal','framing','reason','ordering','aggregate','group'].includes(unit.kind))return;
 const input=inputProof(source,target.slice(7));if(!input||input.field.key==='analysis'||['json','array','object'].includes(input.field.type))return;
 const {field,value}=input;
 if(unit.operator==='clear'&&!source.operation.clearableFields?.includes(field.key))return;
 if(value===undefined||value===null||value===''){
  return unit.value===null&&(field.required||field.systemRequired||field.reference)?{input,value}:undefined;
 }
 try{validateField(field,value);}catch{return;}
 const supplied=normalizeAssistantFieldValue(field,unit.value);
 const equal=typeof supplied==='string'&&typeof value==='string'?supplied.normalize('NFC').trim()===value.normalize('NFC').trim():supplied===value;
 const enumValue=(typeof unit.value==='string'||typeof unit.value==='boolean'&&typeof value!=='boolean')&&field.options?.includes(String(value))
   ||typeof unit.value==='string'&&field.type==='boolean';
 const quoted=typeof value==='string'&&(unit.value===null||field.type==='text'&&!field.options&&unit.quote.normalize('NFC').includes(value.normalize('NFC')))
   &&requestText.normalize('NFC').includes(value.normalize('NFC'));
 if(!equal&&!enumValue&&!quoted)return;
 return {input,value};
}
export function isCompiledInputAssignment(request:SemanticRequest,unit:MeaningUnit,source:SemanticSource,target:string){
 const proof=request.compiledRoles?.[unit.id],assignment=proof?.role==='input_literal'?literalAssignment(request,unit,source,target,proof.value):inputAssignmentValue(unit,source,target,request.text);
 return Boolean(assignment&&assignment.input.value===assignment.value&&['input_assignment','input_literal'].includes(proof?.role||'')&&proof!.actionId===source.operation.id&&proof!.values===JSON.stringify(source.values)
   &&proof!.targets?.includes(target)&&proof!.value===assignment.value);
}
function literalAssignment(request:SemanticRequest,unit:MeaningUnit,source:SemanticSource,target:string,value:unknown){
 if(unit.supersededBy||!['input','reference','entity','condition','scope'].includes(unit.kind)||!['none','eq'].includes(unit.operator)||typeof value!=='string'||!value.trim()||value.length>4000||!request.text.includes(value)||!target.startsWith('values.'))return;
 const input=inputProof(source,target.slice(7));
 if(!input||!['text','reference','email','phone'].includes(input.field.type)||input.field.options||/password|secret|token|credential|version|revision/i.test(input.field.key))return;
 try{validateField(input.field,value);}catch{return;}
 return {input,value};
}
export function semanticBindingTargets(source:SemanticSource,existing:string[]=[]){
 const targets=new Set(['','action','context.module','context.scope','context.output_format',...publicAssistantResultFields(source.operation).map(field=>'result.'+field)]);
 for(const [root,children]of Object.entries(source.operation.resultChildFields||{}))if(Array.isArray(children))for(const child of children)if(publicAssistantResultTarget(source.operation,root+'.'+child))targets.add('result.'+root+'.'+child);
 const visit=(value:unknown,path:string,depth=0)=>{
  const input=inputProof(source,path);if(input)targets.add('values.'+input.field.key);
  if(depth>8||!value||typeof value!=='object')return;
  for(const [key,child] of Object.entries(value))visit(child,path+'.'+key,depth+1);
 };
 for(const field of source.workflow.fields){targets.add('values.'+field.key);let value=source.values[field.key];if(field.type==='json'&&typeof value==='string')try{value=JSON.parse(value);}catch{}visit(value,field.key);}
 for(const raw of existing){const target=raw.replace(`query:${source.operation.id}:`,'');if(target.startsWith('values.')&&inputProof(source,target.slice(7)))targets.add(target);}
 for(const field of Object.keys(source.operation.analysis?.fields||{}))for(const operation of ['filters','sort','extreme','groupBy','aggregate','select'])targets.add(`analysis.${operation}.${field}`);
  if(source.operation.analysis){targets.add('analysis.aggregate.count');targets.add('analysis.limit');}
 return [...targets];
}
export function isSnapshotContext(unit:MeaningUnit,source:SemanticSource){
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date());
 const unresolvedLiteral=typeof unit.value==='string'&&unit.value.normalize('NFC').trim().toLocaleLowerCase('vi')===unit.quote.normalize('NFC').trim().toLocaleLowerCase('vi')&&unit.value.trim().length>0;
 // The independent reviewer still supplies snapshot_context. A current-time
 // marker can be expanded by NLU ("hiện" -> "hiện tại") without becoming a
 // new date constraint. Past periods and explicit dates cannot use this path.
 const current=(value:unknown)=>typeof value==='string'&&/^(?:hiện(?: tại)?|bây giờ|lúc này|thời điểm hiện tại|now|currently)$/iu.test(value.normalize('NFC').trim());
 const expandedCurrent=current(unit.quote)&&current(unit.value);
 return (source.operation.method==='GET'||source.operation.readOnly)&&unit.kind==='time'&&unit.operator==='eq'&&(unit.value===today||unresolvedLiteral||expandedCurrent)&&!/\p{N}/u.test(unit.quote);
}
export function isUnboundedTimeContext(unit:MeaningUnit,source:SemanticSource){
 if(!source.operation.unboundedTimeRead||!(source.operation.method==='GET'||source.operation.readOnly)||unit.kind!=='time'||unit.operator!=='range'||unit.value!==null)return false;
 if(source.workflow.fields.some(field=>['date','datetime'].includes(field.type)&&source.values[field.key]!==undefined&&source.values[field.key]!==''))return false;
 try{return !source.operation.analysis||!analysisPredicates(validateListAnalysis(source.values.analysis,source.operation.analysis)).some(p=>source.operation.analysis!.fields[p.field]?.format==='date');}catch{return false;}
}
/** A breakdown may name every enum category as separate condition units. It
 * is equivalent to GROUP BY only when no requested category is lost/added. */
export function isCompiledGroupCategory(request:SemanticRequest,bindings:Map<string,string[]>,source:SemanticSource,plan:ListAnalysis,unit:MeaningUnit,target:string){
 const field=plan.groupBy,values=field?source.operation.analysis?.fields[field]?.values:undefined;
 if(!field||!values||target!==`analysis.groupBy.${field}`||!(source.operation.method==='GET'||source.operation.readOnly)||plan.filters?.some(f=>f.field===field))return false;
 const digest=JSON.stringify(source.values.analysis);
 const category=(candidate:MeaningUnit)=>{
  const proof=request.compiledRoles?.[candidate.id];
  const categories=Array.isArray(proof?.value)?proof.value:[proof?.value];
  return (candidate.kind==='condition'&&candidate.operator==='eq'&&categories.length===1||candidate.kind==='group'&&candidate.operator==='none'&&candidate.value!==null)&&proof?.role==='group_category'&&proof.actionId===source.operation.id&&proof.target===target&&proof.analysis===digest&&categories.length>0&&categories.every(v=>typeof v==='string'&&Object.hasOwn(values,v))
    &&(bindings.get(candidate.id)||[]).some(t=>t===target||t===`query:${source.operation.id}:${target}`)?categories as string[]:undefined;
 };
 if(!category(unit))return false;
 const covered=new Set(request.units.flatMap(candidate=>category(candidate)||[]));
 return Object.keys(values).length>1&&Object.keys(values).every(key=>covered.has(key));
}
export function isCompiledRowRole(unit:MeaningUnit,proof:CompiledRole|undefined,source:SemanticSource,plan:ListAnalysis|undefined,target:string){
  const dimension=target.startsWith('result.')&&source.operation.analysis?.rowDimensions?.includes(target.slice(7));
  if((source.operation.method==='GET'||source.operation.readOnly)&&unit.kind==='group'&&unit.value===null&&dimension&&!plan?.aggregate&&!plan?.aggregates&&!plan?.groupBy)return true;
  if(!proof||proof.actionId!==source.operation.id||proof.target!==target||proof.analysis!==JSON.stringify(source.values.analysis)
    ||!(source.operation.method==='GET'||source.operation.readOnly))return false;
  const field=target.slice('result.'.length),contract=source.operation.analysis;
  if(proof.role==='row_dimension')return unit.kind==='group'&&Boolean(contract?.rowDimensions?.includes(field))&&!plan?.aggregate&&!plan?.aggregates&&!plan?.groupBy;
  return proof.role==='row_measure'&&unit.kind==='aggregate'&&contract?.fields[field]?.type==='number'&&contract.fields[field].measureOperation===unit.operator
    &&Boolean(plan?.extreme?.field===field||plan?.sort?.field===field||proof.value==='singleton-precomputed-measure'&&contract.singleton&&!plan?.aggregate&&!plan?.aggregates&&plan?.select?.includes(field)||proof.value==='displayed-precomputed-measure'&&!plan?.aggregate&&!plan?.aggregates&&plan?.select?.includes(field)&&contract.rowDimensions?.some(d=>plan.select!.includes(d)));
}
function isDisplayedMeasure(request:SemanticRequest,bindings:Map<string,string[]>,source:SemanticSource,plan:ListAnalysis|undefined,unit:MeaningUnit,field:string){
  if(plan?.aggregate||plan?.aggregates||plan?.groupBy||!plan?.select?.includes(field))return false;
  const bound=(id:string,key:string)=>(bindings.get(id)||[]).some(t=>['result.'+key,'analysis.select.'+key].includes(t.replace(`query:${source.operation.id}:`,'')));
  return request.units.some(u=>u.kind==='output'&&u.quote===unit.quote&&bound(u.id,field))
    &&source.operation.analysis?.rowDimensions?.some(d=>plan.select!.includes(d)&&request.units.some(u=>u.kind==='output'&&bound(u.id,d)));
}
export const semanticResolutionSchema={type:'array',maxItems:40,items:{type:'object',additionalProperties:false,required:['unitId','actionId','role','target','predicates'],properties:{unitId:{type:'string'},actionId:{type:'string'},role:{enum:semanticRoles},target:{type:'string'},predicates:{type:'array',maxItems:8,items:{type:'object',additionalProperties:false,required:['field','operator','value'],properties:{field:{type:'string'},operator:{enum:['eq','ne','gt','gte','lt','lte']},value:{anyOf:[{type:'string'},{type:'number'},{type:'boolean'}]}}}}}}};

/** Metadata describes a business area, never the authenticated company/branch. */
export function isBusinessModuleUnit(unit:MeaningUnit,module:string,text?:string){
  if(!['scope','entity'].includes(unit.kind)||!['none','eq'].includes(unit.operator))return false;
  const context=assistantModuleContext(module);
  const matches=(text:string)=>isModuleContextClause(text,module)||MODULE_KEYS.some(key=>context.relatedLabels.includes(MODULE_LABELS[key])&&isModuleContextClause(text,key));
  const bareQuote=unit.quote.replace(/^(?:các|những)\s+/iu,'').normalize('NFC').trim().toLocaleLowerCase('vi');
  const canonicalEntity=unit.kind==='entity'&&unit.value===null&&[context.label,...context.relatedLabels]
    .some(label=>label.replace(/^Quản l[ýí]\s+/iu,'').normalize('NFC').trim().toLocaleLowerCase('vi')===bareQuote);
  if(text){
    const before=text.slice(0,text.indexOf(unit.quote)).trimEnd();
    const prefix=before.split(/\s+/).slice(-2).join(' ');
    const framed=hasExplicitModuleContextMarker(unit.quote)||hasExplicitModuleContextMarker(prefix)&&matches(prefix+' '+unit.quote)||text.trimStart().startsWith(unit.quote+':');
    const bare=canonicalEntity;
    if(!framed&&!bare)return false;
  }
  const quote=unit.quote.replace(/^(?:các|những)\s+/iu,'');
  return (matches(quote)||canonicalEntity)&&(unit.value===null||typeof unit.value==='string'&&matches('trong '+unit.value));
}

/** Explicit domain clauses constrain ownership; bare entity nouns do not.
 * Parent/child ownership comes from module metadata, never grants permission. */
export function declaredDomainModules(request:SemanticRequest,explicitOnly=false){
  return [...new Set(request.units.flatMap(unit=>{
    if(explicitOnly){
      const before=request.text.slice(0,request.text.indexOf(unit.quote)).trimEnd().split(/\s+/).slice(-3).join(' ');
      const framedPrefix=/(?:phân\s+hệ|module|mục|quản\s+l[ýí])\s*$/iu.test(before)||hasExplicitModuleContextMarker(before.split(/\s+/).at(-1)||'');
      if(!hasExplicitModuleContextMarker(unit.quote)&&!framedPrefix
        &&!/^quản\s+l[ýí]\s/iu.test(unit.quote)&&!request.text.trimStart().startsWith(unit.quote+':'))return [];
    }
    return MODULE_KEYS.filter(module=>isBusinessModuleUnit(unit,module,request.text));
  }))];
}

export function temporalInputBoundary(field:AssistantField|undefined){
  if(!field||!['date','datetime'].includes(field.type))return undefined;
  const key=(field.apiKey||field.key).replace(/^(?:body|query)_/,'').replace(/([a-z])([A-Z])/g,'$1 $2').toLowerCase().split(/[_.\s-]+/);
  if(key.some(k=>['from','start','begin'].includes(k)))return 'gte';
  if(key.some(k=>['to','end','until'].includes(k)))return 'lte';
}
export const semanticInputApiKey=(field:AssistantField)=>field.apiKey||field.key.replace(/^(?:body|query|path)_/,'');
export function quotedNumericSibling(unit:MeaningUnit,source:SemanticSource,primary:string,target:string){
 const first=inputProof(source,primary.replace(/^values\./,'')),extra=inputProof(source,target.replace(/^values\./,''));
 if(!first||!extra||first.field.reference||extra.field.reference||first.field.type!=='number'||extra.field.type!=='number'||first.value!==unit.value||typeof extra.value!=='number'||!Number.isFinite(extra.value))return;
 const parent=first.field.key.split('.').slice(0,-1).join('.');
 if(!/\.\d+$/.test(parent)||extra.field.key===first.field.key||extra.field.key.split('.').slice(0,-1).join('.')!==parent)return;
 if(!unit.quote.match(/\d+(?:[.,]\d+)*/g)?.some(n=>Number(n)===extra.value))return;
 return extra;
}

/** Runtime defaults belong to the server, not to model-supplied facts. Keep
 * a value explicitly bound to a user unit even when it equals today's date. */
export function omitInferredRuntimeDefaults(sources:SemanticSource[],bindings:Map<string,string[]>){
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date());
  for(const source of sources)for(const field of source.workflow.fields){
    if(field.reference||!(field.defaultValue!==undefined&&source.values[field.key]===field.defaultValue
      ||source.operation.currentDateDefaults?.includes(field.key)&&field.type==='date'&&source.values[field.key]===today))continue;
    const bound=[...bindings.values()].flat().some(t=>{
      const target=t.replace(`query:${source.operation.id}:`,'');
      return target===`values.${field.key}`||target===`values.${semanticInputApiKey(field)}`;
    });
    if(!bound)delete source.values[field.key];
  }
}

export const semanticCompilationGuidance=`resolutions là bước BIÊN DỊCH vai trò ý nghĩa, không phải đổi yêu cầu để khớp công cụ. text/quote là căn cứ, kind/concept do NLU suy luận có thể lệch. Đối chiếu cả ý gốc, binding, values và hợp đồng đầy đủ của nguồn đã chọn. Chỉ trả resolution khi chắc chắn tương đương; không bỏ yêu cầu người dùng.
- action_binding: sửa cách ghi địa chỉ hành động của goal/entity thành target=action thuộc đúng actionId đã chọn. Không đổi loại hồ sơ hay mục tiêu.
- builtin_condition: với lệnh ghi chỉ được duyệt điều kiện nằm trong builtinConditions do server khai báo và thực sự cưỡng chế; không dùng cho điều kiện bổ sung hoặc ghi tùy ý. Với nguồn đọc, điều kiện trừu tượng đã được nguồn đọc chuyên biệt thực hiện sẵn theo hợp đồng của nó. Chỉ dùng cho condition không có ngưỡng số/ngày hoặc tên hồ sơ cụ thể cần lọc; target=action. Không dùng để bỏ bộ lọc bổ sung mà API chưa áp dụng. Server vẫn giữ mọi unit và kiểm tra input/phạm vi. predicates=[].
- ordering: NLU có thể gán asc/desc cho một ý cực trị hoặc ngược lại. Chỉ duyệt target analysis.extreme.<field> hoặc analysis.sort.<field> nếu phép xếp hạng thực sự đúng quote gốc, giữ đồng hạng và giới hạn người dùng nêu. Không duyệt max thay cho yêu cầu xem toàn bộ danh sách giảm dần. predicates=[].
- input_literal: khi NLU cắt mất hoặc tách sai một phần tên/mã/email/điện thoại, target=values.<trường scalar>, predicates=[{field:<key>,operator:"eq",value:<chuỗi đầy đủ nguyên văn trong câu gốc>}]. Server kiểm tra chuỗi thực sự có trong câu, đúng kiểu và trường khai báo. Không suy ra số, ngày, ID, thông tin xác thực hoặc giá trị ngoài lời người dùng. Đối chiếu lại toàn bộ tên/mã dù value do NLU đã có.
- execution_context: cụm mô tả phạm vi đọc hiện tại do executionContext/API đã áp dụng. Áp dụng scope/condition không có tên tổ chức/người cụ thể, value=null hoặc true; target=context.scope. Khi nguồn khai báo unboundedTimeRead=true, time/range/value=null có thể biểu diễn toàn bộ lịch sử không đặt kỳ; không chọn cách này nếu đã có ngày cụ thể hoặc filter ngày. Không bỏ quan hệ nghiệp vụ hay bộ lọc bản ghi thật, không dùng cho ghi.
- input_assignment: dùng chung mọi phân hệ/thao tác cho thông tin người dùng muốn điền, gán hoặc sửa, dù NLU gọi nó là condition/entity/scope/output. target=values.<trường hoặc lá cấu trúc đã khai báo>. Chỉ duyệt khi nguyên văn và ngữ cảnh thực sự là phép gán, không phải điều kiện phải kiểm tra trước thao tác; không chuyển nếu/chỉ khi/thỏa điều kiện thành giá trị cần ghi. Giữ dữ kiện cụ thể, tên tham chiếu, số, ngày, phủ định. Enum/bật tắt dùng mã hợp đồng đúng nghĩa. Không tạo giá trị còn thiếu, không tự chọn hồ sơ. Trường bắt buộc/liên kết chưa biết để server đưa form. Không duyệt toàn bộ object thay các lá đã cung cấp. Áp dụng cả đầu vào truy vấn; so sánh/giới hạn vẫn phải được thể hiện bằng bộ lọc thật, không đổi gt/lt thành eq.
- module_context: nhắc phân hệ/nhóm chức năng, khác công ty/chi nhánh/dự án cụ thể cần lọc. Không biến một tên tổ chức thành phân hệ chỉ vì trùng chữ. Dùng metadata moduleContext gồm alias và quan hệ phân hệ, target=context.module.
- snapshot_context: NLU có thể gán ngày hôm nay cho một cụm chỉ hiện trạng của nguồn đọc. Chỉ duyệt nếu ý nguyên gốc là xem trạng thái hiện tại, không phải lọc ngày xảy ra sự kiện/ngày tạo/ngày chi trả. target=context.scope. Không bỏ yêu cầu thời gian thật; không áp dụng cho ghi, kỳ, so sánh hoặc ngày cụ thể người dùng đã nêu.
- temporal_input: ngày gán vào input date/datetime, khác điều kiện so sánh ngày của bản ghi. Gán mốc bắt đầu/kết thúc dùng đúng ngày đã nêu và field có temporalBoundary; không đổi gt thành gte hay bỏ điều kiện so sánh chưa được công cụ hỗ trợ. target=values.<key>.
- row_measure: chỉ tiêu đã tính sẵn cho mỗi dòng theo measureOperation, khi người dùng xếp hạng hoặc chọn cột của từng hồ sơ. Nếu NLU tách aggregate trùng nguyên quote với output của cùng cột, và có output định danh dòng theo rowDimensions, có thể duyệt hiển thị chỉ tiêu đó; không biến yêu cầu tính tổng/trung bình toàn bộ thành các dòng riêng. Trường hợp này dùng row_measure, không dùng row_dimension. Dùng đúng field có measureOperation và phép xếp hạng trên field đó; không đếm số dòng thay cho chỉ tiêu hoặc bỏ yêu cầu tổng toàn bộ. target=result.<field>.
- row_dimension: nguồn đã có một dòng cho mỗi đối tượng theo rowDimensions; không nhóm lại chỉ vì NLU tách một group mô tả đối tượng. Không bỏ yêu cầu tổng hợp thật. target=result.<field>.
- group_category: khi người dùng muốn đối chiếu số lượng theo các nhóm enum, NLU có thể tách từng tên nhóm thành condition eq hoặc một/nhiều group có value chứa tên nhóm. Nếu kế hoạch GROUP BY thực sự giữ đúng các nhóm đó, duyệt MỖI unit tên nhóm bằng target=analysis.groupBy.<field>, predicates=[{field,operator:"eq",value:<mã enum tương ứng>}]. Một group có thể mô tả nhiều nhóm bằng nhiều predicates; condition riêng chỉ được ánh xạ một nhóm. Server chỉ chấp nhận khi các unit bao phủ toàn bộ enum, không có filter cùng trường và không mất điều kiện; không dùng role này để bỏ bộ lọc một trạng thái riêng hay đổi phủ định.
- enum_input: gán lựa chọn enum hoặc bật/tắt được mô tả trong hợp đồng khi tạo/sửa; gồm điều kiện áp dụng của hồ sơ, không phải điều kiện lọc đối tượng cần sửa. Chỉ duyệt nếu mọi binding của unit đều là lựa chọn cùng nghĩa, không reference. Không được đổi phủ định hay suy ra giá trị chưa nêu. target là một binding values.<field> hiện có; giữ các binding còn lại của unit (ví dụ cùng điều kiện cho nhiều mốc). Với thao tác đọc, entity/condition/output có value=null, hoặc condition eq mô tả trạng thái bằng chữ, có thể chọn enum gốc đã khai báo để thể hiện đúng loại dữ liệu người dùng nêu; target=values.<field> có trong kế hoạch. Giữ đầu ra của output; không dùng tên phân hệ làm trạng thái hay bỏ một điều kiện khác. Giá trị phải thuộc options; không reference, không trường tự do.
- input_fragment: unit đầu vào gộp nhiều dữ kiện số trong cùng phần tử danh sách. Giữ binding chính khớp value, chỉ duyệt thêm một trường số cùng phần tử, được nói rõ trong quote và có trong schema. target=values.<đường dẫn lá bổ sung>; không suy ra số, không áp dụng reference hay trường ngoài phần tử đó.
- public_output: nếu NLU tách condition eq dạng chữ từ một phần quote của output chỉ tiêu tính toán, có thể duyệt nó như thuộc tính của chỉ tiêu bằng target=analysis.aggregate.<field>, nhưng chỉ khi computedMeaning của field thật sự đã biểu diễn đầy đủ ý đó, có output chồng quote và aggregate riêng cùng field. Không dùng cách này để bỏ điều kiện lọc một tập người/hàng, ngưỡng số, thời gian hoặc phủ định. Ngoài ra, condition eq dạng chữ có thể là tên một nhóm chỉ tiêu đã tính sẵn khi chính cột công khai có precomputedMeasures.category tương ứng; chỉ duyệt đúng nhóm được hỏi, không dùng cho lọc hồ sơ. Với đầu ra thông thường, chuẩn hóa binding từ vỏ HTTP hoặc tên cột model tự đặt sang cột công khai. target=result.<field> cho cột nguồn, hoặc analysis.aggregate.<field|count> cho đầu ra số do phép tổng hợp đã khai báo tạo ra. Không lấy số lượng thay cho danh tính/ngày/nội dung cần xem. Không trả items/summary hoặc ID nội bộ thay cho cột.
- read_predicate: biên dịch điều kiện trừu tượng vào filters số/enum được khai báo, giữ phủ định và mọi ngưỡng literal. Dùng quote thay nhãn concept suy diễn khi chúng mâu thuẫn. Không nhầm chưa thiết lập với chưa đạt chỉ tiêu. target để trống; predicates là đầy đủ hội AND cần cho unit, gồm boolean khi field khai báo boolean. Với where, chứng minh từng lá hiện có, không đổi cây OR/NOT. Dù binding đã đúng cột, nếu value của NLU còn là nhãn trừu tượng mà kế hoạch đã chuyển thành số/enum/boolean, vẫn trả read_predicate để server xác nhận phép chuyển nghĩa. Các role ngoài read_predicate/group_category/input_literal dùng predicates=[]. Nếu binding trỏ khóa chưa có trong bindingTargets nhưng có đích tương đương đúng hợp đồng, trả resolution để sửa, không chỉ duyệt action rồi giữ nguyên binding lỗi. Không thêm phép tính hoặc giá trị không được yêu cầu. Không tự cấp quyền, tự chọn reference hay xác nhận ghi.`;

/** Only a verdict from the independent action reviewer reaches this function.
 * It can lower roles/bindings; it cannot change input values, tools or scope. */
export function compileSemanticResolutions(request:SemanticRequest,sources:SemanticSource[],bindings:Map<string,string[]>,raw:unknown){
  if(raw===undefined)return;
  if(!Array.isArray(raw)||raw.length>40)throw Error('SEMANTIC_RESOLUTION_INVALID');
  const resolved:NonNullable<SemanticRequest['compiledRoles']>={...request.compiledRoles};
  const changedBindings=new Map(bindings),analyses=new Map<SemanticSource,ListAnalysis>();
  const predicateProofs={...request.readPredicateProofs};
  const outputProofs={...request.readOutputProofs};
  const contextProofs={...request.readContextProofs};
  const seen=new Set<string>();
  const claim=(id:string)=>{if(seen.has(id))throw Error('SEMANTIC_RESOLUTION_INVALID');seen.add(id);};
  // A redundant GROUP BY may itself be invalid before lowering. Remove only
  // the grouping explicitly reviewed as the source's existing row dimension.
  for(const p of raw as SemanticResolution[]){
    const unit=request.units.find(u=>u.id===p?.unitId),source=sources.find(s=>s.operation.id===p?.actionId);
    if(p?.role!=='row_dimension'||unit?.kind!=='group'||!source?.operation.analysis||!p.target.startsWith('result.'))continue;
    const field=p.target.slice(7),contract=source.operation.analysis;
    if(!contract.rowDimensions?.includes(field))continue;
    let candidate=source.values.analysis;
    if(typeof candidate==='string')try{candidate=JSON.parse(candidate);}catch{continue;}
    if(!candidate||typeof candidate!=='object'||Array.isArray(candidate))continue;
    const plan=candidate as ListAnalysis;
    if(plan.aggregate||plan.aggregates||plan.groupBy!==field)continue;
    const next={...plan};delete next.groupBy;analyses.set(source,validateListAnalysis(next,contract));
  }
  for(const proposal of raw){
    let p=proposal as SemanticResolution;
    const unit=request.units.find(u=>u.id===p?.unitId),source=sources.find(s=>s.operation.id===p?.actionId);
    if(!unit||!source||!semanticRoles.includes(p.role)||typeof p.target!=='string'||!Array.isArray(p.predicates)||p.predicates.length>8)throw Error('SEMANTIC_RESOLUTION_INVALID');
    if(!['read_predicate','group_category','input_literal'].includes(p.role)&&p.predicates.length)throw Error('SEMANTIC_RESOLUTION_INVALID');
    const read=source.operation.method==='GET'||source.operation.readOnly;
    const contract=source.operation.analysis;
    if(contract)p={...p,target:canonicalAnalysisTarget(contract,p.target)};
    if(p.target.startsWith('values.')){
      const address=assistantInputAddress(source.workflow,p.target.slice(7));
      if(address)p={...p,target:'values.'+address.canonical};
    }
    if(contract&&p.role==='read_predicate')p={...p,predicates:p.predicates.map(f=>(normalizeAnalysisPlan({where:f},contract,request.evaluatedAt) as {where:SemanticResolution['predicates'][number]}).where)};
    if(p.role==='enum_input'&&read&&p.target.startsWith('values.')&&unit.kind==='condition'){
      const input=inputProof(source,p.target.slice(7)),key=input&&semanticInputApiKey(input.field);
      const bound=key&&(bindings.get(unit.id)||[]).map(t=>t.replace(`query:${source.operation.id}:`,'').replace(/^values\.analysis\./,'analysis.')).includes(`analysis.filters.${key}`);
      if(input&&input.value===undefined&&!input.field.reference&&input.field.options?.length&&bound&&contract?.fields[key!]?.values)p={...p,target:`analysis.filters.${key}`};
    }
    // Some built-in read predicates are implemented by a declared local enum
    // selector. Keep that selector grounded instead of dropping its binding.
    if(p.role==='builtin_condition'&&read&&unit.kind==='condition'&&typeof unit.value==='string'&&unit.dimension!=='temporal'){
      const targets=(bindings.get(unit.id)||[]).map(t=>t.replace(`query:${source.operation.id}:`,''));
      const input=targets.length===1&&targets[0].startsWith('values.')?inputProof(source,targets[0].slice(7)):undefined;
      if(input&&input.field.key===input.root.key&&!input.field.reference&&source.operation.assistantOnlyFields?.includes(input.field.key)&&input.field.options?.includes(String(input.value)))p={...p,role:'enum_input',target:targets[0]};
    }
    if(p.role==='read_predicate'&&read&&unit.kind==='condition'&&unit.operator==='eq'&&p.predicates.length===1){
      const predicate=p.predicates[0],targets=(bindings.get(unit.id)||[]).map(t=>t.replace(`query:${source.operation.id}:`,''));
      const input=targets.length===1&&targets[0].startsWith('values.')?inputProof(source,targets[0].slice(7)):undefined;
      if(input&&input.field.key===input.root.key&&input.field.source==='query'&&(input.field.apiKey||input.field.key)===predicate.field
        &&predicate.operator==='eq'&&input.value===predicate.value&&input.field.options?.includes(String(predicate.value)))p={...p,role:'enum_input',target:targets[0],predicates:[]};
    }
    if(p.role==='enum_input'&&read&&unit.kind==='condition'&&contract&&p.target.startsWith('analysis.filters.')){
      const field=p.target.slice('analysis.filters.'.length),plan=analyses.get(source)||validateListAnalysis(source.values.analysis,contract);
      const predicates=analysisPredicates(plan).filter(f=>f.field===field&&f.operator==='eq'&&typeof f.value==='string'&&Object.hasOwn(contract.fields[field]?.values||{},f.value));
      const bound=(bindings.get(unit.id)||[]).some(t=>t.replace(`query:${source.operation.id}:`,'').replace(/^values\.analysis\./,'analysis.')===p.target);
      if(predicates.length===1&&bound)p={...p,role:'read_predicate',target:'',predicates:predicates as SemanticResolution['predicates']};
    }
    let target=p.target,value:unknown;
    if(p.role==='builtin_condition'){
      if((!read&&!source.operation.builtinConditions?.length)||target!=='action'||unit.kind!=='condition'||typeof unit.value==='number'||unit.dimension==='temporal'&&unit.value!==null)continue;
      contextProofs[unit.id]={actionId:source.operation.id,values:'',kind:'builtin'};
    }else if(p.role==='ordering'){
      const match=/^analysis\.(extreme|sort)\.([^.]+)$/.exec(target);
      const plan=contract?analyses.get(source)||validateListAnalysis(source.values.analysis,contract):undefined;
      if(!read||unit.kind!=='ordering'||!match||!plan||unit.value!==null&&unit.value!==plan.limit)continue;
      const order=match[1]==='extreme'?plan.extreme:plan.sort;
      if(!order||order.field!==match[2]||!(['max','desc'].includes(unit.operator)&&['max','desc'].includes(order.direction)||['min','asc'].includes(unit.operator)&&['min','asc'].includes(order.direction)))continue;
      value=order.direction;
    }else if(p.role==='action_binding'){
      if(target!=='action'||!['goal','entity'].includes(unit.kind))continue;
    }else if(p.role==='execution_context'){
      if(target!=='context.scope')continue;
      if(isUnboundedTimeContext(unit,source))value='unbounded-range';
      else if(!read||!['scope','condition','entity'].includes(unit.kind)||!['none','eq','exists'].includes(unit.operator)||unit.value!==null&&unit.value!==true||unit.kind==='entity'&&(unit.operator!=='none'||unit.value!==null))continue;
    }else if(p.role==='input_literal'){
      const predicate=p.predicates[0],literal=predicate&&p.predicates.length===1&&predicate.operator==='eq'?literalAssignment(request,unit,source,target,predicate.value):undefined;
      if(!literal||![literal.input.field.key,literal.input.field.key.split('.').at(-1)].includes(predicate.field))continue;
      const {root,field}=literal.input;
      let nested:unknown;
      if(field.key!==root.key){
        try{nested=typeof source.values[root.key]==='string'?JSON.parse(String(source.values[root.key])):structuredClone(source.values[root.key]);}catch{continue;}
        const path=field.key.slice(root.key.length+1).split('.');let parent:any=nested;
        for(const part of path.slice(0,-1))parent=parent&&typeof parent==='object'?parent[part]:undefined;
        if(!parent||typeof parent!=='object')continue;
        parent[path.at(-1)!]=literal.value;
      }
      claim(unit.id);
      if(field.key===root.key)source.values[field.key]=literal.value;
      else source.values[root.key]=typeof source.values[root.key]==='string'?JSON.stringify(nested):nested;
      resolved[unit.id]={actionId:source.operation.id,role:p.role,target,targets:[target],value:literal.value,values:JSON.stringify(source.values)};
      changedBindings.set(unit.id,[(sources.length>1?`query:${source.operation.id}:`:'')+target]);continue;
    }else if(p.role==='input_assignment'){
      const originalTargets=(bindings.get(unit.id)||[]).map(t=>t.replace(`query:${source.operation.id}:`,''));
      const targets=unit.kind==='entity'?originalTargets.filter(t=>!['action','actionId',`action:${source.operation.id}`].includes(t)):originalTargets;
      if(!targets.includes(target))continue;
      const assignments=targets.map(t=>inputAssignmentValue(unit,source,t,request.text));
      const first=assignments[0];
      if(!first||assignments.some(a=>!a||a.value!==first.value))continue;
      claim(unit.id);
      resolved[unit.id]={actionId:source.operation.id,role:p.role,target,targets,value:first.value,values:JSON.stringify(source.values)};
      if(targets.length!==originalTargets.length)changedBindings.set(unit.id,targets.map(t=>(sources.length>1?`query:${source.operation.id}:`:'')+t));
      continue;
    }else if(p.role==='input_fragment'){
      if(read||unit.kind!=='input'||unit.operator!=='eq'||typeof unit.value!=='number')continue;
      const primary=(bindings.get(unit.id)||[]).map(t=>t.replace(`query:${source.operation.id}:`,'')).find(t=>quotedNumericSibling(unit,source,t,target));
      if(!primary)continue;
      const extra=quotedNumericSibling(unit,source,primary,target)!;
      claim(unit.id);
      resolved[unit.id]={actionId:source.operation.id,role:p.role,target:`values.${extra.field.key}`,value:extra.value};
      continue;
    }else if(p.role==='enum_input'){
      const targets=(bindings.get(unit.id)||[]).map(t=>t.replace(`query:${source.operation.id}:`,'').replace(/\[(\d+)\]/g,'.$1'));
      const normalized=target.replace(/\[(\d+)\]/g,'.$1');
      const readSelector=read&&['entity','condition','output'].includes(unit.kind)&&['none','eq','ne'].includes(unit.operator)
        &&(unit.value===null||unit.kind==='condition'&&['string','boolean'].includes(typeof unit.value)&&unit.dimension!=='temporal');
      if(readSelector){
        const input=inputProof(source,normalized.replace(/^values\./,''));
        if(!normalized.startsWith('values.')||!input||input.field.reference||input.field.key!==input.root.key||!input.field.options?.includes(String(input.value)))continue;
        claim(unit.id);resolved[unit.id]={actionId:source.operation.id,role:p.role,target:normalized,targets:[normalized],value:input.value};
        changedBindings.set(unit.id,[...(unit.kind==='output'?(bindings.get(unit.id)||[]).filter(t=>t.replace(`query:${source.operation.id}:`,'').startsWith('result.')):[]),(sources.length>1?`query:${source.operation.id}:`:'')+normalized]);continue;
      }
      if(read||!['input','condition'].includes(unit.kind)||unit.operator!=='eq'||!['string','boolean'].includes(typeof unit.value)||!targets.includes(normalized))continue;
      const inputs=targets.map(t=>t.startsWith('values.')?inputProof(source,t.slice(7)):undefined);
      const first=inputs[0];
      if(!first||typeof unit.value==='boolean'&&typeof first.value==='boolean'&&first.value!==unit.value||inputs.some(i=>!i||i.field.reference||!(i.field.options?.includes(String(i.value))||i.field.type==='boolean'&&typeof i.value==='boolean')||i.value!==first.value))continue;
      claim(unit.id);
      resolved[unit.id]={actionId:source.operation.id,role:p.role,target:normalized,targets,value:first.value};
      continue;
    }else if(p.role==='module_context'){
      if(target!=='context.module'||!['scope','entity','condition'].includes(unit.kind)||!isBusinessModuleUnit({...unit,kind:'entity'},source.operation.module))continue;
    }else if(p.role==='snapshot_context'){
      if(target!=='context.scope'||!isSnapshotContext(unit,source))continue;
      value=unit.value;
    }else if(p.role==='temporal_input'){
      const key=target.replace(/^values\./,''),field=source.workflow.fields.find(f=>f.key===key||f.apiKey===key);
      if(unit.kind!=='time'||!field||!['date','datetime'].includes(field.type)||!['eq','gte','lte'].includes(unit.operator)
        ||unit.operator!=='eq'&&temporalInputBoundary(field)!==unit.operator||typeof unit.value!=='string')continue;
      value=source.values[field.key];
      if(value!==unit.value)continue;
      target=`values.${field.key}`;
    }else if(p.role==='public_output'){
      if(read&&contract&&target.startsWith('analysis.aggregate.')){
        const plan=analyses.get(source)||validateListAnalysis(source.values.analysis,contract);
        if(computedMeasureModifier(request,bindings,source,plan,unit,target)){
          claim(unit.id);outputProofs[unit.id]={actionId:source.operation.id,analysis:'',targets:[target]};
          changedBindings.set(unit.id,[(sources.length>1?`query:${source.operation.id}:`:'')+target]);continue;
        }
      }
      const rows=contract?.publicRowsField;
      if(rows&&target.startsWith(`result.${rows}.`)&&Object.hasOwn(contract!.fields,target.slice(rows.length+8)))target='result.'+target.slice(rows.length+8);
      if(read&&unit.kind==='output'&&contract&&target.startsWith('result.')){
        const plan=analyses.get(source)||validateListAnalysis(source.values.analysis,contract),key=target.slice(7);
        if((plan.aggregates||(plan.aggregate?[plan.aggregate]:[])).some(a=>a.field===key))target='analysis.aggregate.'+key;
      }
      if(read&&unit.kind==='output'&&contract&&target.startsWith('analysis.aggregate.')){
        const plan=analyses.get(source)||validateListAnalysis(source.values.analysis,contract),key=target.slice('analysis.aggregate.'.length);
        const aggregates=plan.aggregates||(plan.aggregate?[plan.aggregate]:[]);
        if(!aggregates.some(a=>(a.field||'count')===key))continue;
        claim(unit.id);
        outputProofs[unit.id]={actionId:source.operation.id,analysis:'',targets:[target]};
        changedBindings.set(unit.id,[(sources.length>1?`query:${source.operation.id}:`:'')+target]);continue;
      }
      const field=target.replace(/^result\./,'');
      const category=read&&unit.kind==='condition'&&unit.operator==='eq'&&typeof unit.value==='string'&&Boolean(source.operation.precomputedMeasures?.[field]?.category);
      if((unit.kind!=='output'&&!category)||!target.startsWith('result.')||!publicAssistantResultTarget(source.operation,field)
        ||contract&&!Object.hasOwn(contract.fields,field))continue;
      if(category)value=unit.value;
    }else if(p.role==='row_measure'){
      const field=target.replace(/^result\./,''),definition=contract?.fields[field];
      const plan=contract?analyses.get(source)||validateListAnalysis(source.values.analysis,contract):undefined;
      const displayed=isDisplayedMeasure(request,bindings,source,plan,unit,field);
      const ordered=(plan?.extreme?.field===field||plan?.sort?.field===field)&&request.units.some(u=>u.kind==='ordering'&&(bindings.get(u.id)||[]).some(t=>t.endsWith(`.extreme.${field}`)||t.endsWith(`.sort.${field}`)));
      if(!read||unit.kind!=='aggregate'||definition?.type!=='number'||definition.measureOperation!==unit.operator||!displayed&&!ordered)continue;
      if(displayed)value='displayed-precomputed-measure';
    }else if(p.role==='group_category'){
      const plan=contract?analyses.get(source)||validateListAnalysis(source.values.analysis,contract):undefined;
      const field=target.replace(/^analysis\.groupBy\./,''),predicate=p.predicates[0];
      if(!read||!(unit.kind==='condition'&&unit.operator==='eq'&&p.predicates.length===1||unit.kind==='group'&&unit.operator==='none'&&unit.value!==null)||!contract?.fields[field]?.values||plan?.groupBy!==field||!p.predicates.length
        ||p.predicates.some(predicate=>predicate.field!==field||predicate.operator!=='eq'||typeof predicate.value!=='string'||!Object.hasOwn(contract.fields[field].values!,predicate.value)))continue;
      // A category can also be an explicit OR leaf. Keep that leaf and bind
      // its evidence as a predicate, rather than leaving an unbound filter.
      if(plan.where&&unit.kind==='condition'){
        if(p.predicates.length!==1||filterLeaves(plan.where).filter(f=>filterPredicateKey(f)===filterPredicateKey(p.predicates[0])).length!==1)continue;
        claim(unit.id);
        analyses.set(source,plan);
        changedBindings.set(unit.id,[(sources.length>1?`query:${source.operation.id}:`:'')+`analysis.filters.${field}`]);
        predicateProofs[unit.id]={actionId:source.operation.id,analysis:'',fields:[field],predicates:p.predicates};
        continue;
      }
      value=p.predicates.length===1?predicate.value:p.predicates.map(predicate=>predicate.value);
    }else if(p.role==='row_dimension'){
      const field=target.replace(/^result\./,'');
      if(!read||unit.kind!=='group'||!contract?.rowDimensions?.includes(field))continue;
      const plan=analyses.get(source)||validateListAnalysis(source.values.analysis,contract);
      if(plan.aggregate||plan.aggregates||plan.groupBy&&plan.groupBy!==field)continue;
      const next={...plan};delete next.groupBy;analyses.set(source,next);
    }else{
      if(!read||unit.kind!=='condition'||!contract||!p.predicates.length)continue;
      if(p.predicates.some(f=>!contract.fields[f.field]||contract.fields[f.field].type==='text'&&!contract.fields[f.field].values&&contract.fields[f.field].format!=='date'
        ||!['eq','ne','gt','gte','lt','lte'].includes(f.operator)||!['string','number','boolean'].includes(typeof f.value)
        ||typeof f.value==='boolean'&&(contract.fields[f.field].type!=='boolean'||!['eq','ne'].includes(f.operator))))continue;
      const equivalent=contract.numericPredicateEquivalences?.some(rule=>rule.operator===unit.operator&&rule.value===unit.value
        &&JSON.stringify(rule.predicates.map(filterPredicateKey).sort())===JSON.stringify(p.predicates.map(filterPredicateKey).sort()));
      if(typeof unit.value==='number'&&!p.predicates.some(f=>f.value===unit.value&&f.operator===unit.operator)&&!equivalent)continue;
      if(unit.dimension==='temporal'&&typeof unit.value==='string'&&filterDate(unit.value)!==undefined&&!p.predicates.some(f=>f.value===unit.value&&f.operator===unit.operator))continue;
      if(typeof unit.value==='boolean'&&['eq','ne'].includes(unit.operator)&&p.predicates.some(f=>typeof f.value==='boolean'&&([false,true].some(v=>(unit.operator==='eq'?v===unit.value:v!==unit.value)!==(f.operator==='eq'?v===f.value:v!==f.value)))))continue;
      const plan=analyses.get(source)||validateListAnalysis(source.values.analysis,contract);
      if(plan.where){
        // Review an exact existing AND subtree; retain all surrounding logic.
        if(!hasExactFilterConjunction(plan.where,p.predicates))continue;
        claim(unit.id);
        analyses.set(source,plan);
        changedBindings.set(unit.id,[...new Set(p.predicates.map(f=>f.field))].map(field=>(sources.length>1?`query:${source.operation.id}:`:'')+`analysis.filters.${field}`));
        predicateProofs[unit.id]={actionId:source.operation.id,analysis:'',fields:[...new Set(p.predicates.map(f=>f.field))],predicates:p.predicates};
        continue;
      }
      const exact=p.predicates.every(p=>plan.filters?.filter(f=>filterPredicateKey(f)===filterPredicateKey(p)).length===1);
      if(exact){
        claim(unit.id);
        analyses.set(source,plan);
        changedBindings.set(unit.id,[...new Set(p.predicates.map(f=>f.field))].map(field=>`analysis.filters.${field}`));
        predicateProofs[unit.id]={actionId:source.operation.id,analysis:'',fields:[...new Set(p.predicates.map(f=>f.field))],predicates:p.predicates};
        continue;
      }
      const oldFields=(bindings.get(unit.id)||[]).map(t=>/analysis\.filters\.([^.]+)$/.exec(t)?.[1]).filter(Boolean);
      if([...bindings].some(([other,targets])=>other!==unit.id&&targets.some(t=>oldFields.some(field=>t===`analysis.filters.${field}`||t===`query:${source.operation.id}:analysis.filters.${field}`))))continue;
      const next={...plan,filters:[...(plan.filters||[]).filter(f=>!oldFields.includes(f.field)),...p.predicates]};
      validateListAnalysis(next,contract);claim(unit.id);analyses.set(source,next);
      changedBindings.set(unit.id,[...new Set(p.predicates.map(f=>f.field))].map(f=>`analysis.filters.${f}`));
      predicateProofs[unit.id]={actionId:source.operation.id,analysis:'',fields:[...new Set(p.predicates.map(f=>f.field))],predicates:p.predicates};
      continue;
    }
    const prefix=sources.length>1?`query:${source.operation.id}:`:'';
    claim(unit.id);
    changedBindings.set(unit.id,[prefix+target]);
    resolved[unit.id]={actionId:source.operation.id,role:p.role,target,value};
  }
  for(const [source,analysis] of analyses)source.values.analysis=analysis;
  for(const proof of Object.values(predicateProofs)){
    const source=sources.find(s=>s.operation.id===proof.actionId);if(source)proof.analysis=JSON.stringify(source.values.analysis);
  }
  for(const proof of Object.values(resolved)){
    const source=sources.find(s=>s.operation.id===proof.actionId);if(source){proof.analysis=JSON.stringify(source.values.analysis);proof.values=JSON.stringify(source.values);}
  }
  for(const proof of Object.values(outputProofs)){const source=sources.find(s=>s.operation.id===proof.actionId);if(source)proof.analysis=JSON.stringify(source.values.analysis);}
  for(const proof of Object.values(contextProofs)){const source=sources.find(s=>s.operation.id===proof.actionId);if(source)proof.values=JSON.stringify(source.values);}
  request.compiledRoles=resolved;request.readPredicateProofs=predicateProofs;request.readOutputProofs=outputProofs;request.readContextProofs=contextProofs;
  for(const [key,value] of changedBindings)bindings.set(key,value);
}
