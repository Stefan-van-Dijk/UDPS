import {ifcReferences} from './bsdd.js?v=1.7.3';
// A failed class must never discard successfully loaded classes.
export async function collectProperties(selections,load,{isCurrent=()=>true,onProgress=()=>{}}={}){
 const entries=[],reports=[],seen=new Set();
 for(const s of selections){if(!isCurrent())return null;const report={source:s.source,entity:s.entity,className:s.class.name,available:0,excluded:[],error:'',warning:''};
 try{const detail=await load(s.class.uri);if(!isCurrent())return null;const references=ifcReferences(detail,s.ifcTargets);if(s.ifcTargets&&!references.length)throw Error('Geen bevestigde relatie tussen dit bouwproduct en de gekozen IFC 4.3-entiteit of het bijbehorende type.');report.classType=detail.classType||'Class';report.ifcReferences=references;report.relatedParts=(detail.classRelations||[]).filter(r=>r.relationType==='HasPart');report.propertyDictionaries=[...new Set(detail.properties.map(p=>p.propertyDictionaryName||p.propertyDictionaryUri).filter(Boolean))];report.warning=detail.loadWarning||'';report.total=detail.propertyCount??detail.properties.length;report.excluded=[...(detail.rejected||[])];
 for(const item of detail.properties){if(item.valueKind!=='Single'){report.excluded.push({name:item.name||item.code,reason:(item.valueKind||'Onbekend')+'-waarde: niet ondersteund als enkelvoudige UDPS-property'});continue;}
 const key=JSON.stringify([s.source,s.class.uri,s.entity,item.uri,item.propertySet,item.dataType,item.units]);if(seen.has(key))continue;seen.add(key);entries.push({item,selection:{...s,detail,ifcReferences:references}});report.available++;}
 }catch(e){report.error=e.message;}
 reports.push(report);onProgress({entries:[...entries],reports:[...reports]});
 }
 return {entries,reports};
}
