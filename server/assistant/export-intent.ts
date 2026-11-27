const normalize=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLowerCase();
export function isBusinessExcelRequest(text:string){
 const value=normalize(text);
 return /\b(?:excel|xlsx)\b/.test(value)&&/\b(?:xuat|export|tai(?!\s+len\b)|download)\b/.test(value)&&!/\b(?:khong|dung|chua can)\s+(?:xuat|export|tai)\b/.test(value);
}
/** A format-only output is fulfilled by the server workbook, never a business
 * API column. Quotes containing names/filters/other outputs cannot use this. */
export function isWorkbookFormatQuote(text:string){
 const words=normalize(text).match(/[a-z0-9]+/g)||[];
 return words.some(w=>w==='excel'||w==='xlsx')&&words.every(w=>['file','tep','dinh','dang','bang','tinh','excel','xlsx'].includes(w));
}
/** Presentation-only excerpts; any business noun, field or condition keeps
 * its normal output binding instead of being consumed as a table shape. */
export function isCollectionShapeQuote(text:string){
 return /^(?:danh sach(?: day du| toan bo)?|bang(?: du lieu| ket qua)?|ket qua)$/u.test(normalize(text).replace(/\s+/gu,' ').trim());
}
