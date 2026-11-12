import {validateRelation,ifcReferences} from './bsdd.js';
import {types,entities} from './core.js';
export const availableEntities=c=>c.ifc.items.filter(x=>x.kind==='class'&&/^Ifc[A-Za-z0-9]+$/.test(x.code)&&!/[A-Z]{2,}$/.test(x.code));
export function usages(d,item){return d.rows.map((row,index)=>({row,index,exact:row.Source_uri===item.uri})).filter(x=>x.exact||(!x.row.Source_uri&&[item.name,item.code].includes(x.row.IFC_parameter)));}
export function sourceType(item){const unit=item.units?.[0];if(['mm','cm','m'].includes(unit))return 'Length';if(['m2','m²'].includes(unit))return 'Area';if(['m3','m³'].includes(unit))return 'Volume';return types.includes(item.dataType)?item.dataType:({String:'Text',Number:'Real'}[item.dataType]||'Text');}
export function addMapping(d,c,item,revit,selected,group='ILS_OntwerpEnEngineering',datatype=sourceType(item),selection=null,allowPending=false){
 if(selection){if(selected.length!==1||!validateRelation(selection,item,selected[0]))throw Error('Eigenschap is niet verbonden met de gekozen IFC-entiteit en bronklasse.');}else if(!c.ils.items.some(x=>x.kind==='property'&&x.uri===item.uri))throw Error('Kies een eigenschap uit de bron.');
 if((!allowPending&&!revit.trim())||/[\t\r\n]/.test(revit))throw Error('Vul een geldige Revit-parameter in.');
 const allowed=new Set(availableEntities(c).map(x=>x.code));if(!selected.length||selected.some(e=>!allowed.has(e)))throw Error('Kies minstens één IFC-entiteit uit bSDD.');
 if(!group.trim()||/[\t\r\n]/.test(group))throw Error('Vul een geldige propertyset in.');
 if(!types.includes(datatype))throw Error('Kies een geldig UDPS-datatype.');
 const name=item.code;
 const overlap=d.rows.filter(r=>r['Y/N']==='x'&&r.Export_tabblad===group&&r.IFC_parameter===name&&selected.some(e=>r[e]==='x'));
 if(overlap.length)throw Error('Deze property is voor een gekozen entiteit al ingevuld. Wijzig de bestaande regel of kies andere entiteiten.');
 for(const h of ['Source_uri','Source_code','Source_version','Source_class','Source_class_uri','Source_dictionary','Source_property_dictionary','Source_property_dictionary_name','Source_relation_uri','Source_property_constraints','Source_ifc_references','Mapping_pending',...selected])if(!d.headers.includes(h)){d.headers.push(h);d.rows.forEach(r=>r[h]='');}
 const row=Object.fromEntries(d.headers.map(h=>[h,'']));Object.assign(row,{'Y/N':'x',IFC_parameter:name,Revit_parameter:revit.trim(),Export_tabblad:group,Data_type:datatype,Source_uri:item.uri,Source_code:item.code,Source_version:selection?.version||c.ils.version,Source_class:item.className||'',Source_class_uri:item.classUri||'',Source_dictionary:selection?.source||c.ils.uri,Source_property_dictionary:item.propertyDictionaryUri||selection?.source||c.ils.uri,Source_property_dictionary_name:item.propertyDictionaryName||'',Source_relation_uri:item.relationUri||'',Source_property_constraints:JSON.stringify({units:item.units||[],allowedValues:item.allowedValues||[],constraints:item.constraints||{}}),Source_ifc_references:JSON.stringify(selection?ifcReferences(selection.detail,selection.ifcTargets):[]),Mapping_pending:revit.trim()?'':'x'});selected.forEach(e=>row[e]='x');d.rows.push(row);return row;
}
export function unknownEntities(d,c){const allowed=new Set(availableEntities(c).map(x=>x.code));return entities(d).filter(e=>!allowed.has(e)&&d.rows.some(r=>r['Y/N']==='x'&&r[e]==='x'));}

export function addMappings(d,c,entries,revit=''){
 const next=structuredClone(d);let added=0,skipped=0;
 for(const {item,selection} of entries){if(!validateRelation(selection,item,selection.entity))throw Error('Ongeldige bronrelatie.');const exists=next.rows.some(r=>r['Y/N']==='x'&&r.Export_tabblad===item.propertySet&&r.IFC_parameter===item.code&&r[selection.entity]==='x');if(exists){skipped++;continue;}addMapping(next,c,item,revit,[selection.entity],item.propertySet,sourceType(item),selection,true);added++;}
 d.headers=next.headers;d.rows=next.rows;return {added,skipped};
}
