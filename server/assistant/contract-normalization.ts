/** Compare declared schema names, never words from a user's request. Exact
 * keys win and an alias must resolve to one field; ambiguity stays unresolved. */
export function contractSpelling(value:string){
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLocaleLowerCase('vi').replace(/[\s_.\-[\]]+/gu,'').trim();
}
export function declaredContractKey(address:string,fields:ReadonlyArray<{key:string;spellings:readonly string[]}>){
  if(['__proto__','prototype','constructor'].includes(address))return;
  const exact=fields.find(field=>field.key===address);
  if(exact)return exact.key;
  const spelling=contractSpelling(address);
  if(!spelling)return;
  const matches=fields.filter(field=>field.spellings.some(alias=>contractSpelling(alias)===spelling));
  return matches.length===1?matches[0].key:undefined;
}

/** Only representation changes justified by a declared type/domain. Do not
 * infer yes/no, money units, percentages, relative dates or reference IDs. */
export function normalizeContractScalar(value:unknown,type:string,choices?:Readonly<Record<string,string>>,calendar=false):unknown{
  if(typeof value!=='string')return value;
  let text=value.normalize('NFC').trim(),matchedChoice=false;
  if(choices){
    if(Object.hasOwn(choices,text))matchedChoice=true;
    else{
      const folded=contractSpelling(text);
      const options=Object.entries(choices).filter(([key,label])=>contractSpelling(key)===folded||contractSpelling(label)===folded);
      if(options.length===1){text=options[0][0];matchedChoice=true;}
    }
  }
  if(type==='number'&&/^-?(?:0|[1-9]\d*)$/.test(text)){
    const number=Number(text);if(Number.isSafeInteger(number))return number;
  }
  if(type==='boolean'&&/^(?:true|false)$/i.test(text))return text.toLowerCase()==='true';
  if(calendar){
    const match=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
    if(match){
      const iso=`${match[3]}-${match[2]}-${match[1]}`,date=new Date(iso+'T00:00:00Z');
      if(Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===iso)return iso;
    }
  }
  return matchedChoice?text:value;
}
