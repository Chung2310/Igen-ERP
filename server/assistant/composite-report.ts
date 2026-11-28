import { formatAssistantResultTable } from "../../src/shared/assistant-result-table";
import { formatAssistantTemporalValue,isAssistantTemporalField } from "../../src/shared/assistant-date";
import { AssistantError } from "./policy";
import {privateAssistantResultField} from "./result-field-policy";
import {localizedAssistantFieldLabel,localizedAssistantEnumLabel} from "./result-format";

export interface CompositeReportSource {
  title: string;
  purpose: string;
  rows: Array<Record<string, unknown>>;
}

function displayValue(value: unknown, column: string): string {
  if (typeof value === "number" && Number.isFinite(value)) return value.toLocaleString("vi-VN");
  if (typeof value === "boolean") return value ? "Có" : "Không";
  if (typeof value !== "string") return value == null ? "Chưa có dữ liệu" : JSON.stringify(value);
  if (isAssistantTemporalField({key:column})||/(?:ngày|thời gian|giờ|hạn|date|time|created at|updated at)/iu.test(column)) {
    return formatAssistantTemporalValue(value) || value;
  }
  return localizedAssistantEnumLabel(column,value).replace(/[\r\n\u2028\u2029]+/g, "; ");
}

/** Business values have already been computed and scoped by dispatch. Do not
 * send them through another model to invent a replacement table. The shared
 * optional prose rewriter can still improve the introduction later. */
export async function synthesizeCompositeAssistantReport(_question: string, sources: CompositeReportSource[]) {
  if (!sources.length || sources.length > 8 || JSON.stringify(sources).length > 90_000) throw new AssistantError("Dữ liệu tổng hợp vượt phạm vi của một lượt. Bạn thu hẹp phần cần xem nhé.",413);
  const records:Array<Record<string,string>>=[],notes:string[]=[];
  const quota=Math.floor(400/sources.length);
  const cells=(row:Record<string,unknown>,prefix='',depth=0):Array<[string,unknown]>=>Object.entries(row).flatMap(([key,value])=>{
    if(privateAssistantResultField(key))return [];
    const field=prefix?prefix+' / '+key:key;
    if(value&&typeof value==='object'&&!Array.isArray(value)&&!(value instanceof Date))return depth<4?cells(value as Record<string,unknown>,field,depth+1):[];
    if(Array.isArray(value))return value.flatMap((item,index)=>item&&typeof item==='object'?cells(item as Record<string,unknown>,field+' / '+(index+1),depth+1):[[field+' / '+(index+1),item] as [string,unknown]]);
    return [[field,value] as [string,unknown]];
  });
  for(const source of sources){
    const section=source.purpose||source.title;
    if(!source.rows.length){records.push({'Phần báo cáo':section,'Bản ghi':'—','Chỉ tiêu':'Dữ liệu trả về','Giá trị':'Chưa có dòng kết quả từ nguồn này'});continue;}
    const values=source.rows.flatMap((row,index)=>cells(row).map(([field,value])=>({
      'Phần báo cáo':section,'Bản ghi':String(index+1),
      'Chỉ tiêu':/[\p{L}]/u.test(field)&&(/[\sÀ-ỹĐđ]/u.test(field))?field:localizedAssistantFieldLabel(field,field),
      'Giá trị':displayValue(value,field),
    })));
    if(!values.length)throw new AssistantError('Nguồn báo cáo có bản ghi nhưng chưa trả đủ cột công khai cần xem. Mình chưa kết luận kết quả.',502);
    records.push(...values.slice(0,quota));
    if(values.length>quota)notes.push(`${section}: đang hiển thị ${quota}/${values.length} ô thông tin đã đọc. Bạn có thể yêu cầu xem tiếp phần này.`);
  }
  return formatAssistantResultTable('Mình tổng hợp các phần bạn cần xem bên dưới.',records,notes);
}
