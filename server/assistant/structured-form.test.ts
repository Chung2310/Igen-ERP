import {describe,it,expect} from 'vitest';
import {ASSISTANT_OPERATIONS,defaultWorkflow} from './catalog';
import {structuredInputPrompts,applyStructuredFormValues,structuredPreviewValue} from './structured-form';
import {collectValues} from './policy';
const op=ASSISTANT_OPERATIONS.find(o=>o.path==='/worker-management/partners/policies'&&o.method==='POST')!,workflow=defaultWorkflow(op);
describe('shared nested collection form',()=>{
 it('collects declared leaves and choices, preserves them, and reaches a valid prepared payload',()=>{
  let provided:Record<string,unknown>={name:'Chính sách QA',effectiveFrom:'2026-12-01',settlementCycle:JSON.stringify({type:'calendar_month'}),official:JSON.stringify({enabled:true}),seasonal:JSON.stringify({enabled:false})};
  const first=structuredInputPrompts(workflow,[],[],provided,[],op.inputArrayLengths);
  expect(first.fields.some(f=>f.key==='official.maxMonths')).toBe(true);
  expect(first.fields.some(f=>f.key.startsWith('seasonal.'))).toBe(false);
  provided=applyStructuredFormValues(workflow,provided,{'official.maxMonths':2});
  const second=structuredInputPrompts(workflow,[],[],provided,[],op.inputArrayLengths);
  expect(second.fields.map(f=>f.key)).toContain('official.milestones[2].amount');
  expect(second.choices.find(c=>c.key==='official.milestones[2].eligibilityRule')?.options.map(o=>o.value)).toContain('contract_active');
  provided=applyStructuredFormValues(workflow,provided,{'official.milestones[1].month':1,'official.milestones[1].amount':100000,'official.milestones[1].eligibilityRule':'contract_active','official.milestones[2].month':2,'official.milestones[2].amount':200000,'official.milestones[2].eligibilityRule':'manual_confirmation'});
  const final=structuredInputPrompts(workflow,[],[],provided,[],op.inputArrayLengths);
  expect(final.fields).toEqual([]);expect(final.choices).toEqual([]);
  expect(JSON.parse(String(provided.official))).toEqual({enabled:true,maxMonths:2,milestones:[{month:1,amount:100000,eligibilityRule:'contract_active'},{month:2,amount:200000,eligibilityRule:'manual_confirmation'}]});
  const checked=collectValues(workflow,provided);expect(checked.errors).toEqual([]);expect(checked.missing).toEqual([]);
 });
 it('does not invent values, replace siblings, or accept undeclared/protected paths',()=>{
  const provided={official:JSON.stringify({enabled:true,maxMonths:2,milestones:[{month:1,amount:100000,eligibilityRule:'contract_active'}]})};
  const prompts=structuredInputPrompts(workflow,[],[],provided,[],op.inputArrayLengths);
  expect(prompts.fields.map(f=>f.key)).toContain('official.milestones[2].amount');
  expect(prompts.fields.map(f=>f.key)).not.toContain('official.milestones[1].amount');
  for(const path of ['official.__proto__.x','official.milestones[0].amount','official.unknown','official.milestones[101].amount'])expect(()=>applyStructuredFormValues(workflow,provided,{[path]:1})).toThrow();
 });
 it('formats a structured preview using declared Vietnamese labels instead of JSON',()=>{
  const field=op.fields.find(f=>f.key==='official')!,preview=structuredPreviewValue(field,JSON.stringify({enabled:true,maxMonths:2,milestones:[{month:1,amount:100000,eligibilityRule:'contract_active'}]}),(_key,v)=>v==='contract_active'?'Hợp đồng còn hiệu lực':v);
  expect(preview).toContain('Số tháng tối đa: 2');expect(preview).toContain('Hợp đồng còn hiệu lực');expect(preview).not.toMatch(/[{}]|maxMonths|eligibilityRule/);
 });
});
