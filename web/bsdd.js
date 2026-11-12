import {IFC,ILS} from './sources.js';
const API='https://api.bsdd.buildingsmart.org/api/';
export const defaults=[{uri:ILS,name:'ILS Ontwerp en Engineering 2'},{uri:IFC,name:'IFC 4.3'}];
export const httpsUri=s=>{try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}};
async function get(path,params,fetcher){const r=await fetcher(API+path+'?'+new URLSearchParams(params),{headers:{Accept:'application/json'},signal:AbortSignal.timeout(30000),cache:'no-store'});if(!r.ok)throw Error('bSDD antwoordt met HTTP '+r.status);return r.json();}
export async function dictionaries(fetcher=fetch){let result=[],offset=0,total;do{const d=await get('Dictionary/v1',{Offset:offset,Limit:1000},fetcher);if(!Array.isArray(d.dictionaries)||d.offset!==offset||!Number.isInteger(d.totalCount)||(total!==undefined&&total!==d.totalCount))throw Error('Onvolledige woordenboekenlijst.');total=d.totalCount;if(!d.dictionaries.length&&offset<total)throw Error('Ontbrekende woordenboekenpagina.');result.push(...d.dictionaries.filter(x=>httpsUri(x.uri)).map(({uri,name,version,status,organizationName})=>({uri,name,version,status,organizationName})));offset+=d.dictionaries.length;if(offset>20000)throw Error('Bronlijst te groot.');}while(offset<total);return result;}
export async function relatedClasses(source,entity,fetcher=fetch){let items=[],offset=0,total,version;do{const d=await get('Dictionary/v1/Classes',{Uri:source,...(source===IFC?{SearchText:entity}:{RelatedIfcEntities:entity}),Offset:offset,Limit:1000,languageCode:'nl-NL'},fetcher);if(!Array.isArray(d.classes)||d.classesOffset!==offset||!Number.isInteger(d.classesTotalCount)||(total!==undefined&&(total!==d.classesTotalCount||version!==d.version)))throw Error('Bron veranderde of antwoord onvolledig.');total=d.classesTotalCount;version=d.version;if(!d.classes.length&&offset<total)throw Error('Ontbrekende klassenpagina.');items.push(...d.classes.filter(x=>source!==IFC||x.code===entity).map(x=>({uri:x.uri,code:x.code,name:x.name||x.code})));offset+=d.classes.length;if(offset>20000)throw Error('Te veel bronklassen.');}while(offset<total);return {source,entity,version,items,checkedAt:new Date().toISOString()};}
export function normalizeClass(d){
 if(!httpsUri(d.uri)||!Array.isArray(d.classProperties))throw Error('Klasse-eigenschappen ontbreken.');
 const rejected=[],properties=[];
 for(const p of d.classProperties){const reasons=[];if(!httpsUri(p.propertyUri))reasons.push('geen geldige eigenschap-URI');if(!p.propertySet)reasons.push('geen propertyset in de bron');if(!p.propertyCode&&!p.name)reasons.push('geen naam of code');if(reasons.length){rejected.push({name:p.name||p.propertyCode||'Naamloos',reason:reasons.join('; ')});continue;}properties.push({kind:'property',uri:p.propertyUri,code:p.propertyCode||p.name,name:p.name||p.propertyCode,propertySet:p.propertySet,dataType:p.dataType||'',units:p.units||[],description:p.description||p.definition||'',classUri:d.uri,className:d.name||d.code,relationUri:p.uri,propertyDictionaryUri:p.propertyDictionaryUri,valueKind:p.propertyValueKind||'Single'});}
 return {uri:d.uri,name:d.name||d.code,code:d.code,relatedIfcEntityNames:d.relatedIfcEntityNames||[],properties,rejected,propertyCount:d.classProperties.length,propertySchema:2,checkedAt:new Date().toISOString()};
}
export async function classDetails(uri,fetcher=fetch){
 const d=await get('Class/v1',{Uri:uri,languageCode:'nl-NL'},fetcher);if(d.uri!==uri)throw Error('Onverwachte bronklasse.');
 let properties=[],offset=0,total;const seen=new Set();
 do {const page=await get('Class/Properties/v1',{ClassUri:uri,Offset:offset,Limit:1000,languageCode:'nl-NL'},fetcher);
 if(page.classProperties==null&&page.totalCount===0&&page.count===0)page.classProperties=[];
 if(page.classUri!==uri||!Array.isArray(page.classProperties)||page.offset!==offset||!Number.isInteger(page.totalCount)||page.totalCount<0||page.count!==page.classProperties.length||(total!==undefined&&total!==page.totalCount))throw Error('Onvolledige of gewijzigde eigenschappenlijst.');
 total=page.totalCount;if(!page.classProperties.length&&offset<total)throw Error('Eigenschappenpagina ontbreekt.');
 for(const p of page.classProperties){const key=p.uri||JSON.stringify([p.propertyUri,p.propertySet,p.propertyCode,p.name]);if(seen.has(key))throw Error('Dubbele eigenschappenpagina ontvangen.');seen.add(key);properties.push(p);}
 offset+=page.classProperties.length;if(offset>total||offset>20000)throw Error('Onjuiste of te grote eigenschappenlijst.');
 }while(offset<total);
 return normalizeClass({...d,classProperties:properties});
}
export function relationshipKey(source,entity){return JSON.stringify([source,entity]);}
export function validateRelation(selection,item,entity){return selection?.entity===entity&&selection?.source&&selection.classes?.some(c=>c.uri===item.classUri)&&selection.detail?.uri===item.classUri&&selection.detail.properties.some(p=>p.uri===item.uri&&p.propertySet===item.propertySet&&p.relationUri===item.relationUri);}
