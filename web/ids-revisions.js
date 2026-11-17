// Compare passive IDS evidence. A match never deletes rows or proves model compliance.
const XS='http://www.w3.org/2001/XMLSchema';
const OPERATORS=new Set(['enumeration','pattern','minInclusive','maxInclusive','minExclusive','maxExclusive','length','minLength','maxLength','totalDigits','fractionDigits','whiteSpace']);
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const unique=values=>[...new Set(values)];
const clone=value=>structuredClone(value);
const sorted=values=>values.map(value=>{const item=canonical(value);return {item,key:JSON.stringify(item)};}).sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0).map(x=>x.item);
function canonical(value){
 if(Array.isArray(value))return value.map(canonical);
 if(!value||typeof value!=='object')return value;
 return Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,canonical(value[k])]));
}
const signature=value=>JSON.stringify(canonical(value));
const omit=(value={},keys=[])=>Object.fromEntries(Object.entries(value).filter(([key])=>!keys.includes(key)));
function raw(node){return {name:node.name,namespace:node.namespace,attributes:node.attributes,text:node.text,xml:node.xml};}
function valueMeaning(value){
 if(!value||typeof value!=='object')return value;
 if(value.parameters)return facetMeaning(value);
 const shared={kind:value.kind,wrapperAttributes:value.wrapperAttributes||{}};
 if(value.kind==='literal')return {...shared,value:value.value,attributes:value.attributes||{}};
 if(value.kind==='restriction')return {...shared,base:{namespace:value.baseNamespace||'',name:(value.base||'').split(':').at(-1)},attributes:omit(value.attributes,['base']),facets:sorted((value.facets||[]).map(f=>({kind:f.kind,namespace:f.namespace,value:f.value,attributes:omit(f.attributes,['value'])})))};
 return {...shared,values:(value.values||[]).map(valueMeaning),text:value.text,xml:value.xml};
}
function facetMeaning(facet){
 return {kind:facet.kind,cardinality:facet.cardinality||undefined,attributes:omit(facet.attributes,['cardinality']),parameters:Object.fromEntries(Object.entries(facet.parameters||{}).map(([key,value])=>[key,valueMeaning(value)])),unknown:(facet.unknown||[]).map(raw),...(facet.kind==='unknown'?{xml:facet.xml}:{} )};
}
function documentMeaning(document){
 // schemaLocation is an unfetched hint, not the identity of a schema or an IDS revision.
 return {profile:document.format?.profile||'',mappingAllowed:document.format?.mappingAllowed!==false,attributes:Object.fromEntries(Object.entries(document.attributes||{}).filter(([key])=>!/(^|:)schemaLocation$/.test(key))),unknown:(document.unknown||[]).map(raw)};
}
function scopeMeaning(specification){
 return {ifcVersions:unique(specification.ifcVersions||[]).sort(),minOccurs:String(specification.minOccurs??'1'),maxOccurs:String(specification.maxOccurs??'1'),description:specification.description||'',instructions:specification.instructions||'',attributes:omit(specification.attributes,['identifier','name','ifcVersion','description','instructions']),applicabilityAttributes:omit(specification.applicabilityAttributes,['minOccurs','maxOccurs']),requirementsAttributes:specification.requirementsAttributes||[],applicability:sorted((specification.applicability||[]).map(facetMeaning)),unknown:(specification.unknown||[]).map(raw)};
}
function unknownValue(value){
 if(!value||typeof value!=='object')return false;
 if(value.parameters)return unknownFacet(value);
 if(Object.keys(value.wrapperAttributes||{}).length)return true;
 if(value.kind==='literal')return Object.keys(value.attributes||{}).length>0;
 if(value.kind==='restriction')return value.baseNamespace!==XS||Object.keys(value.attributes||{}).some(k=>!['base','id'].includes(k))||(value.facets||[]).some(f=>f.namespace!==XS||!OPERATORS.has(f.kind)||Object.keys(f.attributes||{}).some(k=>!['value','id'].includes(k)));
 return true;
}
function unknownFacet(facet){
 const allowed=facet.kind==='property'?['dataType','cardinality','uri','instructions']:facet.kind==='partOf'?['relation','cardinality','uri','instructions']:['cardinality','uri','instructions'];
 return facet.kind==='unknown'||(facet.unknown||[]).length>0||Object.keys(facet.attributes||{}).some(k=>!allowed.includes(k))||Object.values(facet.parameters||{}).some(unknownValue);
}
function safeContext(document,specification){
 return document.format?.mappingAllowed!==false&&!(document.unknown||[]).length&&!Object.keys(document.attributes||{}).some(k=>!/(^|:)schemaLocation$/.test(k)&&k!=='version')&&!(specification.unknown||[]).length&&!Object.keys(specification.attributes||{}).some(k=>!['identifier','name','ifcVersion','description','instructions'].includes(k))&&!Object.keys(specification.applicabilityAttributes||{}).some(k=>!['minOccurs','maxOccurs'].includes(k))&&!(specification.requirementsAttributes||[]).some(attrs=>Object.keys(attrs).some(k=>k!=='description'))&&!(specification.applicability||[]).some(unknownFacet);
}
function units(specification){
 return specification.requirements?.length?specification.requirements:[{id:specification.id,kind:'specification',parameters:{},attributes:{},cardinality:null}];
}
function unitLabel(unit,specification){
 const p=unit.parameters||{},literal=value=>value?.kind==='literal'?value.value:'';
 const set=literal(p.propertySet),name=literal(p.baseName)||literal(p.name)||literal(p.system);
 return set&&name?set+' / '+name:name||specification.name||unit.kind;
}
function unitAnchor(unit){
 const p=unit.parameters||{};
 const names=unit.kind==='property'?['propertySet','baseName']:unit.kind==='attribute'?['name']:unit.kind==='classification'?['system']:unit.kind==='entity'?['name']:[];
 return names.length?signature({kind:unit.kind,names:Object.fromEntries(names.map(k=>[k,valueMeaning(p[k])]))}):'';
}
function indexBy(items,key){
 const result=new Map();for(const item of items){const value=key(item);if(value===undefined||value===null||value==='')continue;const group=result.get(value)||[];group.push(item);result.set(value,group);}return result;
}
function checkedDocument(document){
 if(!document||!Array.isArray(document.specifications))throw Error('Lees beide IDS-documenten voordat je versies vergelijkt.');
 if(document.specifications.length>5000)throw Error('Te veel IDS-specificaties om te vergelijken.');
 let count=0;for(const s of document.specifications){if(!s||!s.id||!Array.isArray(s.requirements))throw Error('Ongeldige IDS-specificatie voor bronvergelijking.');count+=s.requirements.length||1;}
 if(count>50000)throw Error('Te veel IDS-eisen om te vergelijken.');
 return document;
}
function rowReferences(rows){
 const index=new Map(),warnings=[];
 for(const [i,row] of (rows||[]).entries()){
  if(!row?.IDS_requirements)continue;
  let refs;try{refs=JSON.parse(row.IDS_requirements);if(!Array.isArray(refs))throw Error();}catch{warnings.push('Regel '+(i+1)+': IDS-herkomst is niet leesbaar; betrokken wijzigingen kunnen niet volledig worden aangewezen.');continue;}
  if(refs.some(ref=>!ref||typeof ref.documentId!=='string'||typeof ref.requirementId!=='string'))warnings.push('Regel '+(i+1)+': IDS-herkomst is onvolledig; betrokken wijzigingen kunnen niet volledig worden aangewezen.');
  for(const ref of refs){if(!ref||typeof ref.documentId!=='string'||typeof ref.requirementId!=='string')continue;const key=ref.documentId+'\u0000'+ref.requirementId,found=index.get(key)||new Set();found.add(i);index.set(key,found);}
 }
 return {index,warnings};
}

/** List every other retained source for an explicit user choice. Never infer a predecessor from its name. */
export function idsRevisionCandidates(saved,currentPreview){
 return (Array.isArray(saved)?saved:[]).filter(d=>d?.id&&d.id!==currentPreview?.id).map(d=>({id:d.id,fileName:d.fileName||'Bewaarde IDS',selectedRequirements:(d.selectedRequirementIds||[]).length}));
}

/**
 * Compare parsed revisions, returning decisions only for unique unchanged property requirements.
 * `counts` counts change records, not mappings. Ambiguous records refer to shared groups of all possible old IDs.
 * `options.rows` may be supplied to identify existing row indices; rows are never mutated.
 */
export function compareIdsRevisions(previousPreview,currentPreview,previousDecisions={},options={}){
 const previous=checkedDocument(previousPreview),current=checkedDocument(currentPreview);
 if(options.rows!==undefined&&(!Array.isArray(options.rows)||options.rows.length>10000))throw Error('Ongeldige projectregels voor IDS-bronvergelijking.');
 const previousSpecs=previous.specifications.map((s,index)=>({s,index})),currentSpecs=current.specifications.map((s,index)=>({s,index}));
 const remainingOld=new Set(previousSpecs),remainingNew=new Set(currentSpecs),pairs=[],changes=[],decisions={},ambiguityGroups=[];
 const contextSafety=new WeakMap(),scopeSignatures=new WeakMap(),unitSignatures=new WeakMap();
 const scopeSignature=specification=>{if(!scopeSignatures.has(specification))scopeSignatures.set(specification,signature(scopeMeaning(specification)));return scopeSignatures.get(specification);};
 const unitSignature=unit=>{if(!unitSignatures.has(unit))unitSignatures.set(unit,signature(facetMeaning(unit)));return unitSignatures.get(unit);};
 const meaningIndex=document=>{const index=new Map();for(const specification of document.specifications){const scope=scopeSignature(specification),byUnit=index.get(scope)||new Map();for(const unit of units(specification)){const key=unitSignature(unit),group=byUnit.get(key)||[];group.push({specification,unit});byUnit.set(key,group);}index.set(scope,byUnit);}return index;};
 const oldMeanings=meaningIndex(previous),newMeanings=meaningIndex(current),weakAmbiguities=new Map();
 const contextSafe=(document,specification)=>{if(!contextSafety.has(specification))contextSafety.set(specification,safeContext(document,specification));return contextSafety.get(specification);};
 const refs=rowReferences(options.rows),documentSame=signature(documentMeaning(previous))===signature(documentMeaning(current));
 const impacted=ids=>unique(ids.flatMap(id=>[...(refs.index.get(previous.id+'\u0000'+id)||[])])).sort((a,b)=>a-b);
 function ambiguity(olds,news,reason){
  const group={id:'ambiguity:'+ambiguityGroups.length,previousIds:unique(olds.map(x=>x.unit.id)),currentIds:unique(news.map(x=>x.unit.id)),reason};
  if(options.rows)group.impactedRows=impacted(group.previousIds);
  ambiguityGroups.push(group);return group;
 }
 function record(status,old,newer,reason,ambiguous=null){
  const oldUnit=old?.unit,newUnit=newer?.unit,kind=newUnit?.kind||oldUnit?.kind;
  const canReuse=status==='unchanged'&&kind==='property'&&contextSafe(previous,old.specification)&&contextSafe(current,newer.specification)&&!unknownFacet(oldUnit)&&!unknownFacet(newUnit);
  const oldIds=oldUnit?[oldUnit.id]:[];
  const item={status,...(oldUnit?{previousId:oldUnit.id,previousSpecificationId:old.specification.id}:{}),...(newUnit?{currentId:newUnit.id,currentSpecificationId:newer.specification.id}:{}),kind,label:unitLabel(newUnit||oldUnit,newer?.specification||old.specification),reason:status==='unchanged'&&!canReuse&&kind==='property'?'Ongewijzigde inhoud met onbekende of niet ondersteunde semantiek; keuzes opnieuw beoordelen.':reason,canReuse,...(ambiguous?{ambiguityGroupId:ambiguous.id,candidatePreviousCount:ambiguous.previousIds.length}:{}),...(options.rows&&!ambiguous?{impactedRows:impacted(oldIds)}:{})};
  changes.push(item);
  if(canReuse&&own(previousDecisions,oldUnit.id)&&previousDecisions[oldUnit.id]&&typeof previousDecisions[oldUnit.id]==='object'&&!Array.isArray(previousDecisions[oldUnit.id]))decisions[newUnit.id]=clone(previousDecisions[oldUnit.id]);
 }
 const wrap=(specification,unit)=>({specification,unit});
 function ambiguousSpecs(olds,news,reason){
  const oldUnits=olds.flatMap(x=>units(x.s).map(u=>wrap(x.s,u))),newUnits=news.flatMap(x=>units(x.s).map(u=>wrap(x.s,u))),group=ambiguity(oldUnits,newUnits,reason);
  if(newUnits.length){for(const item of newUnits)record('ambiguous',null,item,reason,group);}
  else for(const old of oldUnits)record('ambiguous',old,null,reason,group);
  olds.forEach(x=>remainingOld.delete(x));news.forEach(x=>remainingNew.delete(x));
 }
 // A duplicate identifier is never disambiguated with file order or a coincidental name.
 const oldIdentifiers=indexBy(previousSpecs,x=>x.s.identifier),newIdentifiers=indexBy(currentSpecs,x=>x.s.identifier);
 for(const id of new Set([...oldIdentifiers.keys(),...newIdentifiers.keys()])){
  const olds=oldIdentifiers.get(id)||[],news=newIdentifiers.get(id)||[];
  if(olds.length>1||news.length>1)ambiguousSpecs(olds,news,'Dubbele specificatie-identifier; de voorganger is niet eenduidig.');
 }
 function matchSpecifications(key,trusted=false){
  const oldIndex=indexBy([...remainingOld],key),newIndex=indexBy([...remainingNew],key);
  for(const [value,news] of newIndex){const olds=oldIndex.get(value)||[];if(olds.length===1&&news.length===1){pairs.push([olds[0],news[0],trusted]);remainingOld.delete(olds[0]);remainingNew.delete(news[0]);}}
 }
 const fullSpec=x=>signature({scope:scopeMeaning(x.s),requirements:sorted(units(x.s).map(facetMeaning))});
 matchSpecifications(x=>x.s.identifier||'',true);
 matchSpecifications(fullSpec,true);
 matchSpecifications(x=>x.s.name||'');
 matchSpecifications(x=>signature(scopeMeaning(x.s)));
 // Equal remaining content with multiple candidates is genuinely ambiguous.
 const oldFull=indexBy([...remainingOld],fullSpec),newFull=indexBy([...remainingNew],fullSpec);
 for(const [key,news] of newFull){const olds=oldFull.get(key)||[];if(olds.length)ambiguousSpecs(olds,news,'Meerdere inhoudelijk gelijke specificaties; geen keuze op basis van positie.');}
 function comparePair(oldEntry,newEntry,trusted){
  const oldSpec=oldEntry.s,newSpec=newEntry.s,oldUnits=new Set(units(oldSpec)),newUnits=new Set(units(newSpec));
  const contextSame=documentSame&&scopeSignature(oldSpec)===scopeSignature(newSpec);
  const full=unitSignature;
  function matched(oldUnit,newUnit){
   const same=contextSame&&full(oldUnit)===full(newUnit),scope=scopeSignature(oldSpec),key=full(oldUnit),olds=oldMeanings.get(scope)?.get(key)||[],news=newMeanings.get(scope)?.get(key)||[];
   if(same&&!trusted&&(olds.length!==1||news.length!==1)){
    const reason='De inhoud komt meermaals voor zonder unieke specificatie-identiteit; eerdere keuzes opnieuw beoordelen.';
    let byUnit=weakAmbiguities.get(scope);if(!byUnit){byUnit=new Map();weakAmbiguities.set(scope,byUnit);}let group=byUnit.get(key);if(!group){group=ambiguity(olds,news,reason);byUnit.set(key,group);}
    record('ambiguous',wrap(oldSpec,oldUnit),wrap(newSpec,newUnit),reason,group);
   }else record(same?'unchanged':'modified',wrap(oldSpec,oldUnit),wrap(newSpec,newUnit),same?'De eis en alle vastgelegde toepassings- en waardevoorwaarden zijn ongewijzigd.':'De eis, IFC-versie of toepassings-/waardevoorwaarden zijn gewijzigd; opnieuw beoordelen.');
   oldUnits.delete(oldUnit);newUnits.delete(newUnit);
  }
  const oldFull=indexBy([...oldUnits],full),newFull=indexBy([...newUnits],full);
  for(const [key,news] of newFull){const olds=oldFull.get(key)||[];if(!olds.length)continue;
   if(olds.length===1&&news.length===1)matched(olds[0],news[0]);
   else{const reason='Meerdere gelijke eisen; eerdere keuzes kunnen niet eenduidig worden overgenomen.',group=ambiguity(olds.map(u=>wrap(oldSpec,u)),news.map(u=>wrap(newSpec,u)),reason);for(const unit of news)record('ambiguous',null,wrap(newSpec,unit),reason,group);olds.forEach(u=>oldUnits.delete(u));news.forEach(u=>newUnits.delete(u));}
  }
  function matchUnits(key){const oldIndex=indexBy([...oldUnits],key),newIndex=indexBy([...newUnits],key);for(const [k,news] of newIndex){const olds=oldIndex.get(k)||[];if(olds.length===1&&news.length===1)matched(olds[0],news[0]);}}
  matchUnits(unitAnchor);matchUnits(u=>u.kind);
  // A possible same-kind predecessor is retained as ambiguity rather than guessed by order.
  const oldKinds=indexBy([...oldUnits],u=>u.kind),newKinds=indexBy([...newUnits],u=>u.kind);
  for(const [kind,news] of newKinds){const olds=oldKinds.get(kind)||[];if(!olds.length)continue;const reason='Gewijzigde eisen zonder unieke identiteit; kies de koppeling opnieuw.',group=ambiguity(olds.map(u=>wrap(oldSpec,u)),news.map(u=>wrap(newSpec,u)),reason);for(const unit of news)record('ambiguous',null,wrap(newSpec,unit),reason,group);olds.forEach(u=>oldUnits.delete(u));news.forEach(u=>newUnits.delete(u));}
  for(const unit of newUnits)record('added',null,wrap(newSpec,unit),'Nieuwe eis; nog geen eerdere keuze.');
  for(const unit of oldUnits)record('removed',wrap(oldSpec,unit),null,'Vervallen eis; bestaande exportregels blijven behouden totdat je deze zelf beoordeelt.');
 }
 for(const [oldEntry,newEntry,trusted] of pairs)comparePair(oldEntry,newEntry,trusted);
 for(const entry of remainingNew)for(const unit of units(entry.s))record('added',null,wrap(entry.s,unit),'Nieuwe specificatie of geen aantoonbare voorganger.');
 for(const entry of remainingOld)for(const unit of units(entry.s))record('removed',wrap(entry.s,unit),null,'Specificatie niet teruggevonden; bestaande exportregels worden niet verwijderd.');
 const counts={unchanged:0,modified:0,added:0,removed:0,ambiguous:0};for(const change of changes)counts[change.status]++;
 return {previousDocumentId:previous.id,currentDocumentId:current.id,counts,changes,ambiguityGroups,decisions,warnings:refs.warnings};
}
