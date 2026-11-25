import {expect,it} from 'vitest';
import {ASSISTANT_OPERATIONS,defaultWorkflow,operationById} from './catalog';
import {validateRequestCoverage} from './request-coverage';
import {legalQuestionValues} from './legal-reference';
import {isModuleContextClause,mentionsCompatibleModule} from './module-context';
it.each([
  ['inventory','Kho','product.list','xem danh sách sản phẩm'],
  ['retail','Bán lẻ','retail.shift.current','xem ca POS hiện tại'],
  ['retail','POS','retail.shift.current','xem ca POS hiện tại'],
  ['repair','Sửa chữa','repair.list','xem danh sách phiếu sửa chữa'],
  ['repair','Bảo hành','repair.list','xem danh sách phiếu sửa chữa'],
  ['healthcare','Y tế','healthcare.patient.list','xem danh sách bệnh nhân'],
])('accepts a framed short public area name, without erasing conditions: %s %s',(module,label,id,task)=>{
  expect(isModuleContextClause(`Trong ${label}`,module)).toBe(true);
  const op=operationById(id)!;
  const text=`Trong ${label}, ${task}`;
  const coverage=[{evidence:text,requirement:'Tra cứu',mappedTo:['context.module','action']}];
  expect(validateRequestCoverage(text,coverage,defaultWorkflow(op),op,{})).toEqual({ok:true});
  const conditional=text+' chưa thanh toán';
  expect(validateRequestCoverage(conditional,[{...coverage[0],evidence:conditional}],defaultWorkflow(op),op,{})).toMatchObject({ok:false});
});
it('does not accept a short area name as a prefix of another word or a pure clause naming another area',()=>{
  expect(mentionsCompatibleModule('Trong khóa học','inventory')).toBe(false);
  expect(isModuleContextClause('Trong Kho tri thức','inventory')).toBe(false);
  expect(isModuleContextClause('Trong Kho văn bản','inventory')).toBe(false);
  const op=operationById('product.list')!;
  const text='Trong Kho tri thức, xem danh sách tài liệu';
  expect(validateRequestCoverage(text,[{evidence:text,requirement:'Tra cứu',mappedTo:['context.module','action']}],defaultWorkflow(op),op,{})).toMatchObject({ok:false});
});
it.each([
  ['repair.list','Xem danh sách phiếu sửa chữa'],
  ['finance.treasury.accounts.list','Xem các quỹ tiền mặt và tài khoản ngân hàng'],
])('does not turn a Vietnamese business noun into a filter: %s',(id,text)=>{
  const op=operationById(id)!;
  const check=(evidence:string)=>validateRequestCoverage(evidence,[{evidence,requirement:'Tra cứu',mappedTo:['action']}],defaultWorkflow(op),op,{});
  expect(check(text)).toEqual({ok:true});
  expect(check(text+' chưa thanh toán')).toMatchObject({ok:false});
  expect(check(text+' quý 4')).toMatchObject({ok:false});
});
it('routes repository administration and scoped mutations through ERP, while preserving legal knowledge questions',()=>{
  expect(legalQuestionValues('Trong Tra cứu pháp lý, xem tình trạng kho văn bản')).toBeNull();
  expect(legalQuestionValues('Trong Văn bản pháp luật, đồng bộ kho văn bản')).toBeNull();
  expect(legalQuestionValues('Theo luật lao động, nghỉ phép năm bao nhiêu ngày?')).toHaveProperty('query');
});
it('does not claim that the legacy partner module has executable capabilities',()=>{
  expect(ASSISTANT_OPERATIONS.filter(op=>op.module==='partner'&&!op.unavailableReason)).toHaveLength(0);
});
