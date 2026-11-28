import { afterEach, describe, expect, it, vi } from 'vitest';
const provider=vi.hoisted(()=>vi.fn());
vi.mock('../service/openrouter.service',()=>({openrouterChat:provider}));
import {parseAssistantResultTable} from '../../src/shared/assistant-result-table';
import {synthesizeCompositeAssistantReport} from './composite-report';
afterEach(()=>provider.mockReset());
describe('deterministic composite result presentation',()=>{
 it('retains exact public source values without an additional LLM, arithmetic or replacement table',async()=>{
  const reply=await synthesizeCompositeAssistantReport('Tổng hợp tháng 11',[{title:'Doanh thu',purpose:'Doanh thu và lãi',rows:[{revenue:10000000,netProfit:3000000}]},{title:'Khách nợ',purpose:'Khách còn nợ',rows:[{customerName:'QA An',balance:500000}]}]);
  const table=parseAssistantResultTable(reply)!;
  expect(table.rows).toHaveLength(4);expect(reply).toContain('10.000.000');expect(reply).toContain('3.000.000');expect(reply).toContain('500.000');expect(reply).toContain('QA An');
  expect(reply).not.toContain('13.500.000');expect(provider).not.toHaveBeenCalled();
 });
 it('states an empty returned source separately and never turns it into a global zero',async()=>{
  const reply=await synthesizeCompositeAssistantReport('Tổng hợp',[{title:'Đơn',purpose:'Đơn đã hủy',rows:[]},{title:'Hoa hồng',purpose:'Hoa hồng tháng này',rows:[{commissionExpense:500000}]}]);
  expect(reply).toContain('Chưa có dòng kết quả từ nguồn này');expect(reply).toContain('500.000');expect(provider).not.toHaveBeenCalled();
 });
 it('retains every section when bounded, reports truncation, and excludes nested private identifiers',async()=>{
  const reply=await synthesizeCompositeAssistantReport('Xem',[{title:'A',purpose:'A',rows:Array.from({length:300},(_,i)=>({name:'QA '+i,secret:'PRIVATE'}))},{title:'B',purpose:'B',rows:[{summary:{netProfit:123,token:'PRIVATE'}}]}]);
  expect(reply).toContain('123');expect(reply).toContain('200/300');expect(reply).not.toContain('PRIVATE');
  await expect(synthesizeCompositeAssistantReport('Xem',[{title:'Lớn',purpose:'Lớn',rows:[{name:'x'.repeat(91000)}]}])).rejects.toThrow('vượt phạm vi');
 });
});
