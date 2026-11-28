// Run offline: node --import tsx server/assistant/scripts/audit-read-filter-coverage.mjs
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {ASSISTANT_OPERATIONS} from '../catalog.ts';
import {COMPLETE_PUBLIC_READ_ARRAYS} from '../public-read-query.ts';
const reads=ASSISTANT_OPERATIONS.filter(o=>!o.unavailableReason&&(o.method==='GET'||o.readOnly));
const nativeReason=o=>{
 const last=o.path.match(/\/:([^/]+)$/)?.[1];
 if(last&&o.fields.some(f=>f.source==='path'&&(f.apiKey||f.key)===last&&f.reference))return 'single-record-reference';
 if(o.resultFields.some(f=>['filename','fileName'].includes(f))&&o.resultFields.every(f=>['filename','fileName','status','error','createdAt'].includes(f)))return 'file-or-job';
 if(o.fields.some(f=>f.source==='query'&&(f.required||f.systemRequired)&&['q','search','keyword'].includes(f.apiKey||f.key)))return 'mandatory-keyword-lookup';
 if(Object.keys(o.resultChildFields||{}).length>1)return 'multiple-nested-datasets';
 if(o.adapter==='quotation')return 'dedicated-document-contract';
 return 'dedicated-output-contract';
};
const actions=reads.map(o=>({actionId:o.id,module:o.module,title:o.title,...(!o.analysis?{nativeReason:nativeReason(o)}:{}),
  mode:o.analysis?.publicRead?'shared-public-read':o.analysis?'dedicated-shared-analysis':'dedicated-native-read',
  fields:Object.keys(o.analysis?.fields||{}),
  nativeInputs:o.fields.filter(f=>f.source==='query').map(f=>({key:f.key,apiKey:f.apiKey||f.key})),
  completeness:o.analysis?.publicRead
    ? COMPLETE_PUBLIC_READ_ARRAYS[o.path]?'reviewed-whole-array':o.fields.some(f=>f.source==='query'&&['page','pageNumber'].includes(f.apiKey||f.key))?'verify-pages-and-total-at-runtime':'requires-response-completeness-contract'
    :o.analysis?'existing-reviewed-analysis-contract':'dedicated-output-not-converted',
  ...(o.analysis?.publicRowsField?{approvedRowsField:o.analysis.publicRowsField}:{}),
}));
const modules=[...new Set(reads.map(o=>o.module))].sort().map(module=>({module,reads:actions.filter(o=>o.module===module).length,shared:actions.filter(o=>o.module===module&&o.mode!=='dedicated-native-read').length,native:actions.filter(o=>o.module===module&&o.mode==='dedicated-native-read').length}));
const report={schemaVersion:1,kind:'STATIC_CONTRACT_AUDIT_NOT_END_TO_END_BUSINESS_COVERAGE',sourceHash:createHash('sha256').update(JSON.stringify(ASSISTANT_OPERATIONS)).digest('hex'),totals:{reads:reads.length,shared:actions.filter(o=>o.mode!=='dedicated-native-read').length,generic:actions.filter(o=>o.mode==='shared-public-read').length,dedicatedAnalysis:actions.filter(o=>o.mode==='dedicated-shared-analysis').length,native:actions.filter(o=>o.mode==='dedicated-native-read').length},modules,actions};
// Resolve from the repository root, never from an arbitrary caller directory.
const target=fileURLToPath(new URL('../../../docs/bao-phu-bo-loc-tro-ly-erp.json',import.meta.url));
fs.mkdirSync(fileURLToPath(new URL('../../../docs/',import.meta.url)),{recursive:true});
fs.writeFileSync(target,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({totals:report.totals,modules,output:target},null,2));
