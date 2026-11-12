import {entities,types} from './core.js?v=1.8.0';

export const parseJson=(value,fallback)=>{try{return JSON.parse(value||'null')??fallback;}catch{return fallback;}};
export const propertyKey=(row,index)=>row.Uniform_id||row.Source_uri||'row:'+index;
export function ensurePropertyIds(data){if(data.rows.some(r=>!r.Source_uri&&!r.Uniform_id)){ensureHeaders(data,['Uniform_id']);data.rows.forEach(r=>{if(!r.Source_uri&&!r.Uniform_id)r.Uniform_id='local:'+crypto.randomUUID();});}}
export function propertyGroups(data){
 const groups=new Map();
 data.rows.forEach((row,index)=>{const key=propertyKey(row,index);if(!groups.has(key))groups.set(key,{key,name:row.Uniform_name||row.Source_name||row.Source_code||row.IFC_parameter,rows:[]});groups.get(key).rows.push({row,index});});
 return [...groups.values()];
}
export function ensureHeaders(data,fields){for(const field of fields)if(!data.headers.includes(field)){data.headers.push(field);data.rows.forEach(r=>r[field]='');}}
const text=(value,label,empty=false)=>{if(typeof value!=='string'||(!empty&&!value.trim())||/[\t\r\n]/.test(value))throw Error('Vul een geldige '+label+' in.');return value.trim();};
function groupRows(data,key){const group=propertyGroups(data).find(g=>g.key===key);if(!group)throw Error('Eigenschap bestaat niet meer.');return group.rows;}
function atomic(data,change){const next=structuredClone(data);const result=change(next);data.headers=next.headers;data.rows=next.rows;return result;}
function duplicates(data){const found=new Set(),repeated=new Set();for(const r of data.rows.filter(r=>r['Y/N']==='x'))for(const e of entities(data).filter(e=>r[e]==='x')){const key=JSON.stringify([e,r.Export_tabblad,r.IFC_parameter]);if(found.has(key))repeated.add(key);found.add(key);}return repeated;}
function noNewDuplicates(before,after){const old=duplicates(before);if([...duplicates(after)].some(k=>!old.has(k)))throw Error('Deze wijziging maakt een dubbele IFC-property binnen dezelfde entiteit en propertyset.');}
export function uniformDefaults(data,key){const rows=groupRows(data,key).map(x=>x.row),first=rows[0];const common=field=>rows.every(r=>r[field]===first[field])?first[field]:'';return {name:first.Uniform_name||first.Source_name||first.Source_code||first.IFC_parameter,revit:first.Uniform_revit||common('Revit_parameter'),property:first.Uniform_property||common('IFC_parameter'),propertySet:first.Uniform_propertyset||common('Export_tabblad'),dataType:first.Uniform_datatype||common('Data_type')};}
export function setUniformDefaults(data,key,values,applyAll=false){
 const v={name:text(values.name,'naam'),revit:text(values.revit,'Revit-parameter',true),property:text(values.property,'IFC-property'),propertySet:text(values.propertySet,'propertyset'),dataType:values.dataType};if(!types.includes(v.dataType))throw Error('Kies een geldig datatype.');
 return atomic(data,next=>{ensureHeaders(next,['Uniform_id','Uniform_name','Uniform_revit','Uniform_property','Uniform_propertyset','Uniform_datatype','Mapping_pending']);for(const {row} of groupRows(next,key)){const old=uniformDefaults(data,key),fields={Revit_parameter:['revit','Uniform_revit'],IFC_parameter:['property','Uniform_property'],Export_tabblad:['propertySet','Uniform_propertyset'],Data_type:['dataType','Uniform_datatype']};for(const [field,[value,stored]] of Object.entries(fields)){if(applyAll||row[field]===old[value])row[field]=v[value];row[stored]=v[value];}row.Uniform_id=key;row.Uniform_name=v.name;row.Mapping_pending=row.Revit_parameter?'':'x';}noNewDuplicates(data,next);});
}
export function updateApplication(data,index,entity,values){return atomic(data,next=>{
 let row=next.rows[index];if(!row||entity&&row[entity]!=='x')throw Error('Toepassing bestaat niet meer.');
 const key=propertyKey(row,index);ensureHeaders(next,['Uniform_id','Mapping_pending']);
 if(entity&&entities(next).filter(e=>row[e]==='x').length>1){const original=row;row={...original};for(const e of entities(next))row[e]=e===entity?'x':'';original[entity]='';original.Uniform_id=key;next.rows.push(row);}
 row.Uniform_id=key;for(const [field,value] of Object.entries(values)){if(!['Revit_parameter','Export_tabblad','IFC_parameter','Data_type','Y/N'].includes(field))throw Error('Onbekend toepassingsveld.');row[field]=field==='Y/N'?(value==='x'?'x':''):text(value,field,field==='Revit_parameter');}if(!types.includes(row.Data_type))throw Error('Kies een geldig datatype.');row.Mapping_pending=row.Revit_parameter?'':'x';noNewDuplicates(data,next);
 });}
export function addApplication(data,key,entity,allowed){if(!allowed.has(entity))throw Error('Kies een IFC-entiteit uit de catalogus.');return atomic(data,next=>{
 const group=groupRows(next,key);if(group.some(({row})=>row[entity]==='x'))throw Error('Deze entiteit is al gekoppeld. Wijzig de bestaande toepassing.');const defaults=uniformDefaults(next,key);if(!defaults.property||!defaults.propertySet||!defaults.dataType)throw Error('Leg eerst de standaardinstellingen vast.');ensureHeaders(next,[entity,'Uniform_id','Mapping_origin','Mapping_pending','Source_ifc_references']);const empty=group.find(({row})=>!entities(next).some(e=>row[e]==='x'));const row=empty?empty.row:{...group[0].row};for(const e of entities(next))row[e]='';Object.assign(row,{Uniform_id:key,Mapping_origin:'user',Source_ifc_references:'[]',Revit_parameter:defaults.revit,IFC_parameter:defaults.property,Export_tabblad:defaults.propertySet,Data_type:defaults.dataType,Mapping_pending:defaults.revit?'':'x','Y/N':'x',[entity]:'x'});group.forEach(({row})=>row.Uniform_id=key);if(!empty)next.rows.push(row);noNewDuplicates(data,next);return row;
 });}
export function compatibility(a,b){
 const reasons=[];if(a.Data_type!==b.Data_type)reasons.push('verschillende datatypes');const x=parseJson(a.Source_property_constraints,{}),y=parseJson(b.Source_property_constraints,{});const sorted=v=>JSON.stringify((v||[]).map(i=>typeof i==='object'?JSON.stringify(i):i).sort());if(sorted(x.units)!==sorted(y.units))reasons.push('verschillende of ontbrekende eenheden');if(sorted(x.allowedValues)!==sorted(y.allowedValues))reasons.push('verschillende of ontbrekende keuzewaarden');if(JSON.stringify(x.constraints||{})!==JSON.stringify(y.constraints||{}))reasons.push('verschillende toepassingsvoorwaarden');return reasons;
}
export function mergeProperties(data,targetKey,sourceKey,reason){
 text(reason,'onderbouwing');if(targetKey===sourceKey)throw Error('Kies een andere eigenschap.');
 return atomic(data,next=>{const target=groupRows(next,targetKey),source=groupRows(next,sourceKey);const reasons=[...new Set([...target,...source].flatMap(({row})=>compatibility(target[0].row,row)))];if(reasons.length)throw Error('Niet samengevoegd: '+reasons.join(', ')+'. Controleer eerst de bronafspraken; er worden geen waarden geconverteerd.');ensureHeaders(next,['Uniform_id','Uniform_name','Uniform_merge_reason']);const name=target[0].row.Uniform_name||target[0].row.Source_name||target[0].row.IFC_parameter;for(const {row} of [...target,...source]){row.Uniform_id=targetKey;row.Uniform_name=name;row.Uniform_merge_reason=reason.trim();}return targetKey;});
}
export function groupEntries(entries){const groups=new Map();entries.forEach((entry,index)=>{const key=entry.item.uri;if(!groups.has(key))groups.set(key,{key,item:entry.item,entries:[]});groups.get(key).entries.push({...entry,index});});return [...groups.values()];}
