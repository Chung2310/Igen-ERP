import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(); const cache=new Map();
function read(file){
 if(cache.has(file))return cache.get(file);
 const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
 const imports=new Map(),vars=new Map(),functions=new Map();let defaultName;
 function visit(n){
  if(ts.isImportDeclaration(n)&&n.importClause&&ts.isStringLiteral(n.moduleSpecifier)&&n.moduleSpecifier.text.startsWith('.')){
   const stem=path.resolve(path.dirname(file),n.moduleSpecifier.text);const target=[stem+'.ts',stem+'/index.ts'].find(fs.existsSync);
   if(target){if(n.importClause.name)imports.set(n.importClause.name.text,{file:target,name:'default'}); const bindings=n.importClause.namedBindings;if(bindings&&ts.isNamedImports(bindings))for(const e of bindings.elements)imports.set(e.name.text,{file:target,name:e.propertyName?.text||e.name.text});}
  }
  if(ts.isFunctionDeclaration(n)&&n.name)functions.set(n.name.text,n);
  if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&n.initializer)vars.set(n.name.text,n.initializer);
  if(ts.isExportAssignment(n)&&ts.isIdentifier(n.expression))defaultName=n.expression.text;
  ts.forEachChild(n,visit);
 }
 visit(source);const data={source,imports,vars,functions,defaultName};cache.set(file,data);return data;
}
const unwrap=n=>{while(n&&(ts.isAsExpression(n)||ts.isParenthesizedExpression(n)||ts.isNonNullExpression(n)))n=n.expression;return n;};
function resolve(n,file,depth=0){n=unwrap(n);if(!n||depth>12)return undefined;if(ts.isStringLiteral(n))return n.text;if(ts.isNumericLiteral(n))return Number(n.text);if(n.kind===ts.SyntaxKind.TrueKeyword)return true;if(n.kind===ts.SyntaxKind.FalseKeyword)return false;
 if(ts.isArrayLiteralExpression(n)){const arr=[];for(const e of n.elements){const v=resolve(ts.isSpreadElement(e)?e.expression:e,file,depth+1);if(v===undefined)return undefined;arr.push(...(ts.isSpreadElement(e)?v:[v]));}return arr;}
 if(ts.isElementAccessExpression(n)){const target=resolve(n.expression,file,depth+1);const key=resolve(n.argumentExpression,file,depth+1);return target?.[key];}
 if(ts.isIdentifier(n)){const d=read(file);if(d.vars.has(n.text))return resolve(d.vars.get(n.text),file,depth+1);const i=d.imports.get(n.text);if(i){const target=read(i.file);return resolve(target.vars.get(i.name),i.file,depth+1);}}
 if(ts.isObjectLiteralExpression(n)){const obj={};for(const e of n.properties)if(ts.isPropertyAssignment(e)){const key=e.name.getText().replace(/["']/g,'');obj[key]=resolve(e.initializer,file,depth+1);}return obj;}
 if(ts.isPropertyAccessExpression(n))return resolve(n.expression,file,depth+1)?.[n.name.text];
}
function permissions(n,file,depth=0){n=unwrap(n);if(!n||depth>10)return [];const d=read(file);
 if(ts.isSpreadElement(n))return permissions(n.expression,file,depth+1);
 if(ts.isArrayLiteralExpression(n))return n.elements.flatMap(item=>permissions(item,file,depth+1));
 if(ts.isIdentifier(n)){if(d.vars.has(n.text))return permissions(d.vars.get(n.text),file,depth+1);if(d.functions.has(n.text)){const out=[];const scan=x=>{if(ts.isCallExpression(x)&&/require(?:Any)?Permission$/.test(x.expression.getText()))out.push(...permissions(x,file,depth+1));else if(ts.isCallExpression(x)&&ts.isIdentifier(x.expression)){out.push(...permissions(x.expression,file,depth+1));}else ts.forEachChild(x,scan);};ts.forEachChild(d.functions.get(n.text),scan);return [...new Map(out.map(group=>[JSON.stringify(group),group])).values()];}return [];}
 if(ts.isCallExpression(n)&&/require(?:Any)?Permission$/.test(n.expression.getText())){const value=resolve(n.arguments[0],file);return value===undefined?[]:[Array.isArray(value)?value:[value]];}
 if(ts.isCallExpression(n)){if(['areaRead','areaManage'].includes(n.expression.getText())){const imported=d.imports.get('STUDENT_AREA_PERMISSIONS');const value=imported?resolve(read(imported.file).vars.get(imported.name),imported.file):undefined;const area=resolve(n.arguments[0],file);const access=n.expression.getText()==='areaManage'?'manage':'read';return value?.[area]?.[access]?[value[area][access]]:[];}if(ts.isIdentifier(n.expression))return permissions(n.expression,file,depth+1);}
 if(ts.isArrowFunction(n)||ts.isFunctionExpression(n)){const out=[];const scan=x=>{if(ts.isCallExpression(x)&&/require(?:Any)?Permission$/.test(x.expression.getText()))out.push(...permissions(x,file,depth+1));else ts.forEachChild(x,scan);};scan(n.body);return out;}
 return [];
}
function schema(n,file,depth=0){
 n=unwrap(n);if(!n||depth>20)return null;
 const d=read(file);
 if(ts.isIdentifier(n)){
  if(d.vars.has(n.text))return schema(d.vars.get(n.text),file,depth+1);
  const i=d.imports.get(n.text);if(i)return schema(read(i.file).vars.get(i.name),i.file,depth+1);
  return null;
 }
 if(ts.isObjectLiteralExpression(n)){
  const keys={};for(const p of n.properties){if(ts.isSpreadAssignment(p)){const extra=schema(p.expression,file,depth+1);if(!extra?.keys)return null;Object.assign(keys,extra.keys);continue;}if(!ts.isPropertyAssignment(p))return null;const v=schema(p.initializer,file,depth+1);if(!v)return null;keys[p.name.getText().replace(/["']/g,'')]=v;}return {type:'object',keys};
 }
 if(!ts.isCallExpression(n)||!ts.isPropertyAccessExpression(n.expression))return null;
 const method=n.expression.name.text;
 if(n.expression.expression.getText()==='Joi'){
  if(method==='object')return n.arguments[0]?schema(n.arguments[0],file,depth+1):{type:'object',keys:{},open:true};
  if(['string','number','boolean','date','array','any','alternatives'].includes(method))return {type:method};
  return null;
 }
 let base=schema(n.expression.expression,file,depth+1);if(!base)return null;
 if(method==='try'&&base.type==='alternatives'){base=n.arguments.map(a=>schema(a,file,depth+1)).find(x=>x&&x.type!=='any');if(!base)return null;}
 if(['keys','append','concat'].includes(method)){const extra=schema(n.arguments[0],file,depth+1);if(!extra?.keys)return null;base={...base,keys:{...base.keys,...extra.keys}};}
 if(method==='fork'){const keys=resolve(n.arguments[0],file);const rule=n.arguments[1]?.getText()||'';if(!Array.isArray(keys)||!/\.optional\(\)|\.required\(\)/.test(rule))return null;for(const key of keys)if(base.keys?.[key])base.keys[key].required=rule.includes('.required(');}

 if(method==='required')base.required=true;
 if(method==='optional')base.required=false;
 if(method==='valid'){const values=n.arguments.map(v=>resolve(v,file));if(values.every(v=>v!==undefined))base.options=values;else return null;}
 if(method==='default'){const v=resolve(n.arguments[0],file);if(v!==undefined)base.defaultValue=base.type==='number'?Number(v):v;}
 if(['min','max'].includes(method)&&base.type==='number'){const v=resolve(n.arguments[0],file);if(v!==undefined)base[method]=Number(v);}
 if(method==='items'){if(n.arguments.length!==1)return null;base.items=schema(n.arguments[0],file,depth+1);if(!base.items)return null;}
 if(method==='unknown')base.open=true;
 // Conditional/custom validation cannot be safely inferred from syntax alone.
 if(['when','conditional','custom','alter','tailor','pattern'].includes(method)&&base.type==='object')return null;
 return base;
}
function definition(n,file,depth=0){
 n=unwrap(n);if(!n||depth>12)return null;const d=read(file);
 if(ts.isIdentifier(n)){if(d.vars.has(n.text))return definition(d.vars.get(n.text),file,depth+1);if(d.functions.has(n.text))return {node:d.functions.get(n.text),file};const i=d.imports.get(n.text);if(i){const target=read(i.file);return definition(target.vars.get(i.name)||target.functions.get(i.name),i.file,depth+1);}return null;}
 if(ts.isPropertyAccessExpression(n)){const parent=definition(n.expression,file,depth+1);if(parent&&ts.isObjectLiteralExpression(parent.node)){const child=parent.node.properties.find(p=>p.name?.getText()===n.name.text);return child?definition(ts.isPropertyAssignment(child)?child.initializer:child,parent.file,depth+1):null;}return null;}
 if(ts.isArrowFunction(n)||ts.isFunctionExpression(n)||ts.isMethodDeclaration(n)||ts.isFunctionDeclaration(n)||ts.isObjectLiteralExpression(n))return {node:n,file};
 return null;
}
function noBodyHandler(args,file){
 const found=definition(args.at(-1),file);if(!found||!found.node.body)return false;
 const request=found.node.parameters[0]?.name;if(!request||!ts.isIdentifier(request))return false;
 let unsafe=false;function scan(n){
  if(ts.isPropertyAccessExpression(n)&&['body','file','files','query'].includes(n.name.text))unsafe=true;
  if(ts.isElementAccessExpression(n))unsafe=true;
  if(ts.isBindingElement(n)&&['body','file','files','query'].includes(n.name.getText()))unsafe=true;
  if(ts.isCallExpression(n)&&n.arguments.some(a=>unwrap(a)?.getText()===request.text))unsafe=true;
  ts.forEachChild(n,scan);
 }scan(found.node.body);return !unsafe;
}
function contracts(args,file){
 const result={};
 function visit(n){n=unwrap(n);if(!n)return;
  if(ts.isCallExpression(n)){
   const fn=n.expression.getText();
   if(fn==='validateRequest'){
    const v=schema(n.arguments[0],file);if(v?.type==='object')for(const [k,x]of Object.entries(v.keys))result[k]=x;
   } else if(['validate','validateBody'].includes(fn)){
    const target=resolve(n.arguments[1],file)||'body';const v=schema(n.arguments[0],file);if(v)result[target]=v;
   }
  }
  ts.forEachChild(n,visit);
 }
 args.forEach(visit);if(!result.body&&noBodyHandler(args,file))result.emptyBodyVerified=true;return result;
}
function staticRouteValues(node,file,site,depth=0){
 node=unwrap(node);if(!node||depth>16)return [];
 if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))return [node.text];
 if(ts.isTemplateExpression(node)){
  let values=[node.head.text];
  for(const span of node.templateSpans){const parts=staticRouteValues(span.expression,file,site,depth+1);if(!parts.length)return [];values=values.flatMap(value=>parts.map(part=>value+part+span.literal.text));}
  return [...new Set(values)];
 }
 if(ts.isBinaryExpression(node)&&node.operatorToken.kind===ts.SyntaxKind.PlusToken){const left=staticRouteValues(node.left,file,site,depth+1),right=staticRouteValues(node.right,file,site,depth+1);return [...new Set(left.flatMap(a=>right.map(b=>a+b)))];}
 if(!ts.isIdentifier(node))return [];
 const identifier=node.text;let parent=site;
 while(parent){
  if(ts.isForOfStatement(parent)&&ts.isVariableDeclarationList(parent.initializer)){
   const loopExpression=unwrap(parent.expression);
   for(const declaration of parent.initializer.declarations){
    if(ts.isIdentifier(declaration.name)&&declaration.name.text===identifier&&ts.isArrayLiteralExpression(loopExpression))return loopExpression.elements.flatMap(item=>staticRouteValues(item,file,site,depth+1));
    if(ts.isArrayBindingPattern(declaration.name)&&ts.isArrayLiteralExpression(loopExpression)){
     const index=declaration.name.elements.findIndex(item=>ts.isBindingElement(item)&&ts.isIdentifier(item.name)&&item.name.text===identifier);
     if(index>=0)return loopExpression.elements.flatMap(tuple=>{tuple=unwrap(tuple);return ts.isArrayLiteralExpression(tuple)&&tuple.elements[index]?staticRouteValues(tuple.elements[index],file,site,depth+1):[];});
    }
   }
  }
  if(ts.isFunctionDeclaration(parent)||ts.isFunctionExpression(parent)||ts.isArrowFunction(parent)){
   const index=parent.parameters.findIndex(parameter=>ts.isIdentifier(parameter.name)&&parameter.name.text===identifier);
   if(index>=0){
    let callableName=parent.name&&ts.isIdentifier(parent.name)?parent.name.text:'';
    if(!callableName){let owner=parent.parent;while(owner&&!ts.isVariableDeclaration(owner))owner=owner.parent;if(owner&&ts.isIdentifier(owner.name))callableName=owner.name.text;}
    if(callableName){const d=read(file),values=[];function findCalls(current){if(ts.isCallExpression(current)&&ts.isIdentifier(current.expression)&&current.expression.text===callableName&&current.arguments[index])values.push(...staticRouteValues(current.arguments[index],file,current,depth+1));ts.forEachChild(current,findCalls);}findCalls(d.source);if(values.length)return [...new Set(values)];}
   }
  }
  parent=parent.parent;
 }
 const d=read(file);if(d.vars.has(identifier))return staticRouteValues(d.vars.get(identifier),file,site,depth+1);
 return [];
}
const endpoints=[],unresolved=[];
function walk(file,exportName,prefix='',inherited=[],chain=[]){
 const d=read(file),name=exportName==='default'?d.defaultName:exportName;if(!name)return;
 const key=file+':'+name+':'+prefix;if(chain.includes(key))return;
 const globals=[];
 const calls=[];function visit(n){if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&n.expression.expression.getText()===name)calls.push(n);ts.forEachChild(n,visit);}visit(d.source);
 for(const n of calls){const method=n.expression.name.text;let args=[...n.arguments];let local='';if(args[0]&&ts.isStringLiteral(args[0]))local=args.shift().text;
  const full=('/'+[prefix,local].filter(Boolean).join('/')).replace(/\/+/g,'/').replace(/\/$/,'')||'/';
  const guards=args.flatMap(a=>permissions(a,file));
  if(method==='use'){
   let mounted=false;
   for(const a of args){const v=unwrap(a);if(ts.isIdentifier(v)&&d.imports.has(v.text)){const target=d.imports.get(v.text);if(/(?:router|routes)(?:\.ts|\/)/.test(target.file.replaceAll('\\','/'))){walk(target.file,target.name,full,[...inherited,...globals,...guards],[...chain,key]);mounted=true;}}}
   if(!local&&!mounted)globals.push(...guards);
  } else if(['get','post','patch','put','delete'].includes(method)&&local!==undefined){
   const routeValues=ts.isStringLiteral(n.arguments[0])?[n.arguments[0].text]:staticRouteValues(n.arguments[0],file,n);
   if(!routeValues.length){unresolved.push({file:path.relative(root,file),line:d.source.getLineAndCharacterOfPosition(n.pos).line+1,expression:n.getText().slice(0,160)});continue;}
   const endpointArgs=[...n.arguments.slice(1)],endpointGuards=endpointArgs.flatMap(a=>permissions(a,file));
   for(const route of routeValues){const endpointPath=('/'+[prefix,route].filter(Boolean).join('/')).replace(/\/+/g,'/').replace(/\/$/,'')||'/';endpoints.push({method:method.toUpperCase(),path:endpointPath,permissions:[...inherited,...globals,...endpointGuards],file:path.relative(root,file).replaceAll('\\','/'),line:d.source.getLineAndCharacterOfPosition(n.getStart()).line+1,contracts:contracts(endpointArgs,file),handlers:endpointArgs.map(a=>a.getText()).join(', ')});}
  }
 }
}
walk(path.resolve('server/router/index.ts'),'apiRouter');
for(const e of endpoints){
 const file=e.file.replaceAll('\\','/');
 if(file==='server/router/super-admin-user-access.router.ts')e.contracts.assistantUnsupported='API quản trị xuyên doanh nghiệp yêu cầu phiên Super Admin đặc quyền, công ty đích và kiểm tra bảo mật riêng; trợ lý nghiệp vụ của tài khoản doanh nghiệp không được gọi.';
 if(file==='server/modules/repair/repair-refund.router.ts'&&e.method==='POST'){
  if(e.path.endsWith('/reconcile')||e.path.endsWith('/revoke'))e.contracts.assistantUnsupported='Đối soát hoặc thu hồi hoàn tiền làm thay đổi chứng từ và sổ tài chính; cần workflow tài chính có kiểm soát trạng thái và chống ghi trùng riêng.';
 }
 if(file==='server/modules/marketing-suite/shared/data.router.ts'){
  if(e.method==='GET'&&e.path==='/social-integrations')e.contracts.assistantUnsupported='Danh sách tích hợp trả hồ sơ rộng; chỉ có thao tác tra cứu tài khoản đã duyệt với trường đầu ra giới hạn.';
  if(e.method==='GET'&&e.path.endsWith('/accounts/:id'))e.contracts.assistantUnsupported='API chi tiết tài khoản trả thêm metadata nội bộ; trợ lý chỉ dùng danh sách tài khoản đã duyệt với trường đầu ra giới hạn.';
  if((e.method==='POST'&&e.path==='/marketing-contents')||(e.method==='PATCH'&&e.path==='/marketing-contents/:id')||(e.method==='DELETE'&&e.path==='/marketing-contents/:id'))e.contracts.assistantUnsupported='API ghi nội dung marketing nhận payload tổng quát và có thể đổi lịch đăng hoặc liên kết chiến dịch; dùng các route bản nháp trợ lý có giới hạn theo trường và trạng thái.';
  if(['POST','PATCH','DELETE'].includes(e.method)&&e.path.startsWith('/social-integrations'))e.contracts.assistantUnsupported='API ghi tích hợp có thể thay đổi thông tin xác thực và kết nối mạng xã hội; cần luồng quản lý bí mật, xác minh tài khoản và quyền riêng.';
  if(e.method==='DELETE'&&e.path==='/omni-inbox/leads/:id')e.contracts.assistantUnsupported='API xóa khách tiềm năng là xóa cứng; chưa có khôi phục hoặc kiểm tra liên kết nên trợ lý chưa được phép gọi.';
 }
}
const financeFile=path.resolve('server/modules/finance/validations/management.validation.ts');
const finance=schema(read(financeFile).vars.get('managementSchemas'),financeFile)?.keys;
if(finance){const mapped={'POST /finance/management/payables':'payable','POST /finance/management/vouchers':'voucher','POST /finance/management/followups':'followup','POST /finance/management/tax':'tax','PUT /finance/management/settings':'settings','POST /finance/management/vouchers/:id/reversal':'reversal'};for(const e of endpoints){const kind=mapped[e.method+' '+e.path];if(kind)e.contracts.body=finance[kind];if(e.path==='/finance/management/report')e.contracts.query=finance.range;}}
const seen=new Map();for(const e of endpoints){const key=e.method+' '+e.path;const existing=seen.get(key);if(existing){existing.ambiguous=true;existing.alsoMountedAt=[...(existing.alsoMountedAt||[]),e.file+':'+e.line];}else seen.set(key,e);}const unique=[...seen.values()];
const output={generatedFrom:'server/router/index.ts',endpoints:unique,unresolved};
fs.writeFileSync('server/assistant/api-inventory.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({endpoints:unique.length,withPermissions:unique.filter(e=>e.permissions.length).length,unresolved:unresolved.length,files:cache.size}));
