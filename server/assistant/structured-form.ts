import type {AssistantDataShape,AssistantField,AssistantInputField,AssistantReferenceSelection,AssistantValue,AssistantWorkflow} from '../../src/shared/assistant-workflow';
import {AssistantError} from './policy';
import {formatAssistantTemporalValue} from '../../src/shared/assistant-date';

const protectedKey=(key:string)=>/^(?:__proto__|constructor|prototype)$|password|credential|secret|token/i.test(key);
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const blank=(v:unknown)=>v===undefined||v===null||v==='';
function parsed(v:unknown){if(typeof v==='string')try{return JSON.parse(v);}catch{return undefined;}return v;}
const condition=(rule:AssistantDataShape,parent:unknown)=>{
 const c=rule.requiredWhen;if(!c||!record(parent))return false;
 return c.present?!blank(parent[c.field]):(Array.isArray(c.equals)?c.equals:[c.equals]).some(v=>v!==undefined&&v===parent[c.field]);
};

/** Render declared missing leaves through the existing scalar/choice controls.
 * Array indices are one-based, matching the reference-selection contract. */
export function structuredInputPrompts(workflow:AssistantWorkflow,missing:string[],errors:string[],provided:Record<string,unknown>,choiceKeys:string[],lengths:Record<string,string>={},optionLabel:(path:string,value:string)=>string=(_p,v)=>v){
 const fields:AssistantInputField[]=[],choices:AssistantReferenceSelection[]=[];
 const roots=Object.fromEntries(workflow.fields.map(f=>[f.key,parsed(provided[f.key])]));
 const at=(path:string)=>path.split('.').reduce<unknown>((v,k)=>record(v)?v[k]:undefined,roots);
 const visit=(root:AssistantField,shape:AssistantDataShape,value:unknown,key:string,label:string,parent:unknown,forced=false,depth=0)=>{
  if(depth>8||fields.length+choices.length>=50||protectedKey(key)||shape.reference||choiceKeys.includes(key))return;
  const required=forced||!!shape.required||condition(shape,parent);
  const error=errors.filter(e=>e.startsWith(label+':')).join('\n');
  const requested=missing.some(m=>m===label||m.startsWith(label+' · '))||!!error;
  if(shape.type==='object'){
   if(blank(value)&&!required&&!requested)return;
   for(const [child,rule]of Object.entries(shape.keys||{}))visit(root,rule,record(value)?value[child]:undefined,key+'.'+child,label+' · '+(rule.label||child),value,false,depth+1);
   return;
  }
  if(shape.type==='array'){
   if(blank(value)&&!required&&!requested)return;
   const rows=Array.isArray(value)?value:[],linked=lengths[key]?at(lengths[key]):undefined;
   const declared=typeof linked==='number'&&Number.isInteger(linked)&&linked>=0&&linked<=100?linked:shape.minItems||0;
   const count=Math.min(100,Math.max(rows.length,declared,required&&requested?1:0));
   if(shape.items)for(let i=0;i<count;i++)visit(root,shape.items,rows[i],`${key}[${i+1}]`,`${label} · Mục ${i+1}`,rows,true,depth+1);
   return;
  }
  if(!error&&!requested&&!(required&&blank(value)))return;
  if(shape.options?.length){
   choices.push({key,label,required,multiple:false,options:shape.options.map(v=>({value:String(v),label:typeof v==='boolean'?(v?'Có':'Không'):optionLabel(key,String(v))}))});return;
  }
  const type=shape.type==='string'?'text':shape.type;
  if(!['text','number','boolean','date','datetime','email','phone'].includes(type))return;
  fields.push({key,label,type:type as AssistantInputField['type'],required,...(!blank(value)&&['string','number','boolean'].includes(typeof value)?{value:value as AssistantValue}:{}),...(error?{error}:{}),...(shape.min!==undefined?{min:shape.min}:{}),...(shape.max!==undefined?{max:shape.max}:{}),...(shape.integer?{integer:true}:{}),...(shape.pattern?{pattern:shape.pattern}:{})});
 };
 for(const field of workflow.fields)if(field.type==='json'&&field.structure)visit(field,field.structure,roots[field.key],field.key,field.label,roots,!!field.required||!!field.systemRequired);
 return {fields,choices};
}

/** Intake remains server-owned: only declared scalar leaves can be assigned.
 * The caller also checks the pending form ID and its exact field allow-list. */
export function applyStructuredFormValues(workflow:AssistantWorkflow,provided:Record<string,unknown>,values:Record<string,AssistantValue>){
 const result={...provided};
 for(const [key,value]of Object.entries(values)){
  if(protectedKey(key))throw new AssistantError('Trường nhập không được phép.');
  const root=workflow.fields.find(f=>f.key===key)||workflow.fields.filter(f=>key.startsWith(f.key+'.')||key.startsWith(f.key+'[')).sort((a,b)=>b.key.length-a.key.length)[0];
  if(!root)throw new AssistantError('Trường nhập không còn thuộc biểu mẫu.');
  if(root.key===key){result[key]=value;continue;}
  const suffix=key.slice(root.key.length),parts=[...suffix.matchAll(/\.([^.[\]]+)|\[(\d+)\]/g)];
  if(!root.structure||parts.map(m=>m[0]).join('')!==suffix)throw new AssistantError('Đường dẫn trường nhập không hợp lệ.');
  let shape=root.structure;
  for(const part of parts){const next=part[2]?(shape.type==='array'&&Number(part[2])>=1&&Number(part[2])<=100?shape.items:undefined):shape.type==='object'?shape.keys?.[part[1]]:undefined;if(!next||protectedKey(part[1]||''))throw new AssistantError('Trường nhập chưa được khai báo.');shape=next;}
  if(!['string','number','boolean','date','datetime','email','phone'].includes(shape.type)||shape.reference)throw new AssistantError('Trường nhập không phải dữ liệu đơn.');
  let data=parsed(result[root.key]);data=record(data)||Array.isArray(data)?structuredClone(data):root.structure.type==='array'?[]:{};
  let node:any=data;
  parts.forEach((part,index)=>{const address=part[2]?Number(part[2])-1:part[1];if(index===parts.length-1)node[address]=value;else{if(!node[address]||typeof node[address]!=='object')node[address]=parts[index+1][2]?[]:{};node=node[address];}});
  result[root.key]=JSON.stringify(data);
 }
 return result;
}

export function structuredPreviewValue(field:AssistantField,value:AssistantValue,optionLabel:(path:string,value:string)=>string){
 if(!field.structure)return value;
 const root=parsed(value);if(!root||typeof root!=='object')return value;
 const lines:string[]=[];
 const visit=(shape:AssistantDataShape,v:unknown,key:string,label:string,depth=0)=>{
  if(depth>8||lines.length>=50||protectedKey(key)||blank(v))return;
  if(shape.type==='object'&&record(v)){for(const [k,s]of Object.entries(shape.keys||{}))visit(s,v[k],key+'.'+k,[label,s.label||k].filter(Boolean).join(' · '),depth+1);return;}
  if(shape.type==='array'&&Array.isArray(v)){if(shape.items)v.forEach((r,i)=>visit(shape.items!,r,`${key}[${i+1}]`,`${label} · Mục ${i+1}`,depth+1));return;}
  if(typeof v==='object')return;
  const visible=typeof v==='boolean'?(v?'Có':'Không'):shape.options?.includes(v as any)?optionLabel(key,String(v)):shape.type==='date'||shape.type==='datetime'?formatAssistantTemporalValue(String(v))||String(v):String(v);
  lines.push(`${label}: ${visible}`);
 };
 visit(field.structure,root,field.key,'');return lines.length?lines.join('\n'):'Chưa có nội dung';
}
