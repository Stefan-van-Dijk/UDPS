// IDS sources remain evidence. UDPS mappings describe parameters, not IDS compliance.
import {IDS_MAX_BYTES} from './ids-document.js?v=1.10.0';
export {readIds,decodeIdsBytes,IDS_MAX_BYTES} from './ids-document.js?v=1.10.0';
export const IDS_PROJECT_MAX_BYTES=32*1024*1024;
const MAX_DOCUMENTS=20,MAX_SAVED_BYTES=16*1024*1024,MAX_REFERENCES=50000;
const byteLength=value=>new TextEncoder().encode(value).length;
const datatypeMap={IFCBOOLEAN:'Boolean',IFCINTEGER:'Integer',IFCREAL:'Real',IFCTEXT:'Text',IFCLABEL:'Label',IFCIDENTIFIER:'Identifier',IFCLOGICAL:'Logical',IFCLENGTHMEASURE:'Length',IFCPOSITIVELENGTHMEASURE:'PositiveLength',IFCAREAMEASURE:'Area',IFCVOLUMEMEASURE:'Volume',IFCCOUNTMEASURE:'Count',IFCPLANEANGLEMEASURE:'PlaneAngle',IFCPOSITIVEPLANEANGLEMEASURE:'PositivePlaneAngle',IFCRATIOMEASURE:'Ratio',IFCPOSITIVERATIOMEASURE:'PositiveRatio',IFCNORMALISEDRATIOMEASURE:'NormalisedRatio',IFCTHERMALTRANSMITTANCEMEASURE:'ThermalTransmittance',IFCTHERMODYNAMICTEMPERATUREMEASURE:'ThermodynamicTemperature',IFCPOWERMEASURE:'Power',IFCPRESSUREMEASURE:'Pressure',IFCFREQUENCYMEASURE:'Frequency',IFCFORCEMEASURE:'Force',IFCVOLUMETRICFLOWRATEMEASURE:'VolumetricFlowRate',IFCELECTRICCURRENTMEASURE:'ElectricalCurrent',IFCELECTRICVOLTAGEMEASURE:'ElectricalVoltage',IFCILLUMINANCEMEASURE:'Illuminance',IFCLUMINOUSFLUXMEASURE:'LuminousFlux',IFCLUMINOUSINTENSITYMEASURE:'LuminousIntensity'};
// Kept independent of core.js: core validates stored IDS sources and must not form a cycle.
const coreTypes=new Set('Area Boolean ClassificationReference ColorTemperature Count Currency ElectricalCurrent ElectricalEfficacy ElectricalVoltage Force Frequency Identifier Illuminance Integer Label Length Logical LuminousFlux LuminousIntensity NormalisedRatio PlaneAngle PositiveLength PositivePlaneAngle PositiveRatio Power Pressure Ratio Real Text ThermalTransmittance ThermodynamicTemperature Volume VolumetricFlowRate'.split(' '));
const field=value=>typeof value==='string'&&!!value.trim()&&value.length<=500&&!/[\u0000-\u001f\u007f-\u009f]/.test(value);
// xs:string whitespace is part of an IFC identity. Never silently trim it.
const identity=value=>field(value)&&value===value.trim();
const requirementId=value=>typeof value==='string'&&/^spec:\d+\/requirement:\d+$/.test(value);
const digest=value=>typeof value==='string'&&/^sha256:[a-f0-9]{64}$/.test(value);
const entities=catalog=>(catalog?.ifc?.items||[]).filter(x=>x.kind==='class'&&/^Ifc[A-Za-z0-9]+$/.test(x.code)&&!/[A-Z]{2,}$/.test(x.code)).map(x=>x.code);
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const unique=value=>[...new Set(value)];
function checkedDecisions(value={},draft=false){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>MAX_REFERENCES)throw Error('Ongeldige IDS-keuzes.');
 const result={};
 for(const [id,input] of Object.entries(value)){
  if(!requirementId(id)||!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['entities','propertySet','property','dataType','acknowledgeScope','acknowledgeValues','includeOptional'].includes(k)))throw Error('Ongeldige IDS-keuze.');
  const decision={};
  if(own(input,'entities')){
   if(!Array.isArray(input.entities)||input.entities.length>2000||input.entities.some(e=>typeof e!=='string'||e.length>500||!draft&&(!identity(e)||!/^Ifc[A-Za-z0-9]+$/.test(e))))throw Error('Ongeldige IFC-entiteiten in IDS-keuze.');
   decision.entities=unique(input.entities);
  }
  for(const k of ['propertySet','property'])if(own(input,k)){if(typeof input[k]!=='string'||input[k].length>500||!draft&&!identity(input[k]))throw Error('Ongeldige eigenschapsnaam in IDS-keuze.');decision[k]=input[k];}
  if(own(input,'dataType')){if(typeof input.dataType!=='string'||input.dataType.length>500||!draft&&!coreTypes.has(input.dataType))throw Error('Ongeldig datatype in IDS-keuze.');decision.dataType=input.dataType;}
  for(const k of ['acknowledgeScope','acknowledgeValues','includeOptional'])if(own(input,k)){if(typeof input[k]!=='boolean')throw Error('Ongeldige bevestiging in IDS-keuze.');decision[k]=input[k];}
  if(Object.keys(decision).length)result[id]=decision;
 }
 return result;
}

// Saved originals are bounded passive evidence; schema 1 remains backwards compatible.
export function validateIdsImports(value){
 if(value===undefined)return undefined;
 if(!Array.isArray(value)||value.length>MAX_DOCUMENTS)throw Error('Ongeldige of te veel opgeslagen IDS-bronnen.');
 const seen=new Set();
 const result=value.map(d=>{
  if(!d||d.schema!==1||!digest(d.id)||seen.has(d.id)||!field(d.fileName)||typeof d.xml!=='string'||!d.xml||byteLength(d.xml)>IDS_MAX_BYTES||!Array.isArray(d.selectedRequirementIds)||d.selectedRequirementIds.length>MAX_REFERENCES||d.selectedRequirementIds.some(id=>!requirementId(id)))throw Error('Ongeldige opgeslagen IDS-bron.');
  seen.add(d.id);
  const record={schema:1,id:d.id,fileName:d.fileName,xml:d.xml,selectedRequirementIds:unique(d.selectedRequirementIds)};
  if(d.decisions!==undefined)record.decisions=checkedDecisions(d.decisions);
  if(d.documentSchema!==undefined){if(![1,2].includes(d.documentSchema))throw Error('Ongeldige opgeslagen IDS-documentversie.');record.documentSchema=d.documentSchema;}
  if(d.sourceEncoding!==undefined){if(!field(d.sourceEncoding)||d.sourceEncoding.length>80)throw Error('Ongeldige IDS-tekstcodering.');record.sourceEncoding=d.sourceEncoding;}
  if(d.sourceByteDigest!==undefined){if(!digest(d.sourceByteDigest))throw Error('Ongeldige IDS-bestandsidentiteit.');record.sourceByteDigest=d.sourceByteDigest;}
  return record;
 });
 if(byteLength(JSON.stringify(result))>MAX_SAVED_BYTES)throw Error('Opgeslagen IDS-bronnen zijn samen groter dan 16 MB projectgegevens.');
 return result;
}

const literal=value=>value?.kind==='literal'?value.value:'';
function finiteNames(value){
 if(Object.keys(value?.wrapperAttributes||{}).length)return null;
 if(value?.kind==='literal'&&!Object.keys(value.attributes||{}).length)return [value.value];
 const xs='http://www.w3.org/2001/XMLSchema';
 // Only a pure string enumeration is a proven union. Patterns/bounds/unknown
 // facets or QName namespaces need explicit resolution, never a JS-regexp guess.
 if(value?.kind==='restriction'&&value.baseNamespace===xs&&value.base?.split(':').at(-1)==='string'&&Object.keys(value.attributes||{}).every(k=>['base','id'].includes(k))&&Array.isArray(value.facets)&&value.facets.length&&value.facets.every(f=>f.kind==='enumeration'&&f.namespace===xs&&typeof f.value==='string'&&Object.keys(f.attributes||{}).every(k=>['value','id'].includes(k))))return unique(value.facets.map(f=>f.value));
 return null;
}
const hasValue=value=>value!==undefined&&value!==null;
function unknownValueMetadata(value){
 if(!value||typeof value!=='object')return false;
 if(Object.keys(value.wrapperAttributes||{}).length)return true;
 if(value.kind==='literal')return Object.keys(value.attributes||{}).length>0;
 if(value.kind==='restriction'){
  const xs='http://www.w3.org/2001/XMLSchema',operators=['enumeration','pattern','minInclusive','maxInclusive','minExclusive','maxExclusive','length','minLength','maxLength','totalDigits','fractionDigits','whiteSpace'];
  return value.baseNamespace!==xs||Object.keys(value.attributes||{}).some(k=>!['base','id'].includes(k))||(value.facets||[]).some(f=>f.namespace!==xs||!operators.includes(f.kind)||Object.keys(f.attributes||{}).some(k=>!['value','id'].includes(k)));
 }
 return ['unknown','ambiguous'].includes(value.kind)||(value.values||[]).some(unknownValueMetadata);
}
function sourceRecord(preview){
 const record={schema:1,id:preview.id,fileName:preview.fileName,xml:preview.xml,selectedRequirementIds:[]};
 for(const k of ['documentSchema','sourceEncoding','sourceByteDigest'])if(preview[k]!==undefined)record[k]=preview[k];
 return record;
}
function mergedDecisions(preview,decisions,draft=false){return checkedDecisions({...preview.decisions,...decisions},draft);}

/** Translate a full IDS document into explicit, reviewable parameter proposals.
 * No restriction is executed as a JavaScript regexp, and no subclass is inferred.
 */
export function mappingProposals(preview,catalog,decisions={}){
 const choices=mergedDecisions(preview,decisions,true),known=entities(catalog),byUpper=new Map(known.map(e=>[e.toUpperCase(),e])),proposals=[];
 for(const s of preview.specifications||[]){
  const modern=Array.isArray(s.applicability),app=modern?s.applicability:[],entityFacets=app.filter(f=>f.kind==='entity');
  const unknownDocument=(preview.unknown||[]).length>0||Object.keys(preview.attributes||{}).some(k=>!['xsi:schemaLocation','version'].includes(k)&&!k.endsWith(':schemaLocation'));
  const entityFacet=entityFacets.length===1?entityFacets[0]:null,sourceNames=entityFacet?finiteNames(entityFacet.parameters?.name):null;
  const completeNames=sourceNames?.length&&sourceNames.every(n=>identity(n)&&byUpper.has(n));
  const sourceEntities=completeNames?unique(sourceNames.map(n=>byUpper.get(n))):[];
  const min=String(s.minOccurs??'1'),max=String(s.maxOccurs??'unbounded'),prohibited=min==='0'&&max==='0';
  const validOccurs=(min==='1'||min==='0')&&max==='unbounded'||prohibited;
  const conditional=modern&&(app.length!==1||entityFacets.length!==1||Object.keys(entityFacet?.parameters||{}).some(k=>k!=='name')||Object.keys(entityFacet?.attributes||{}).length>0||Object.keys(s.applicabilityAttributes||{}).some(k=>!['minOccurs','maxOccurs'].includes(k))||(s.unknown||[]).length>0||(entityFacet?.unknown||[]).length>0||unknownDocument||Object.keys(s.attributes||{}).some(k=>!['name','ifcVersion','identifier','description','instructions'].includes(k)));
  for(const r of s.requirements||[]){
   const decision=choices[r.id]||{},parameters=r.parameters||{},attrs=r.attributes||{},issues=[],warnings=[];
   const sourceSet=modern?literal(parameters.propertySet):r.propertySet||'',sourceProperty=modern?literal(parameters.baseName):r.property||'';
   const propertySet=decision.propertySet??sourceSet,property=decision.property??sourceProperty;
   const ifcDataType=modern?attrs.dataType||'':r.ifcDataType||'',dataType=decision.dataType??datatypeMap[ifcDataType]??'';
   const cardinality=r.cardinality||'required';
   let targets=own(decision,'entities')?decision.entities:modern?sourceEntities:r.entity?[r.entity]:[];
   const manualTargets=own(decision,'entities')&&JSON.stringify([...targets].sort())!==JSON.stringify([...sourceEntities].sort());
   const scopeReview=conditional||manualTargets||modern&&!sourceEntities.length;
   const valueReview=modern?(hasValue(parameters.value)||Object.keys(parameters).some(k=>!['propertySet','baseName','value'].includes(k))||Object.keys(attrs).some(k=>!['dataType','cardinality','uri','instructions'].includes(k))||(r.unknown||[]).length>0||Object.values(parameters).some(unknownValueMetadata)||(s.requirementsAttributes||[]).some(a=>Object.keys(a).some(k=>k!=='description'))):false;
   const optional=cardinality==='optional';
   if(preview.format?.mappingAllowed===false)issues.push('Deze IDS-versie of documentstructuur wordt alleen als bron bewaard; omzetten naar UDPS is niet beschikbaar.');
   if(r.kind!=='property')issues.push('Dit '+r.kind+'-facet gebruikt een andere IFC-route dan een UDPS-property; de volledige eis blijft bewaard.');
   if(prohibited)issues.push('Deze specificatie verbiedt de toepassing; geen positieve parameterkoppeling toevoegen.');
   else if(!validOccurs)issues.push('Niet ondersteunde toepassingsaantallen; controleer de IDS-bron.');
   if(cardinality==='prohibited')issues.push('Verboden property; geen positieve parameterkoppeling toevoegen.');
   else if(optional&&!decision.includeOptional)issues.push('Optionele property: bevestig dat je hiervoor een parameterdefinitie wilt toevoegen.');
   else if(!['required','optional'].includes(cardinality))issues.push('Onbekende cardinaliteit.');
   if(!modern&&r.eligible===false&&cardinality==='required')issues.push(...r.reasons||['Deze IDS-eis is niet beschikbaar.']);
   if(!targets.length||targets.some(e=>!known.includes(e)))issues.push('Kies concrete bekende IFC-entiteiten; een onbekend of gedeeltelijk bekend doel wordt niet stilzwijgend overgeslagen.');
   if(!identity(propertySet)||!identity(property))issues.push('Kies een exacte eigenschapsnaam en propertysetnaam zonder begin-/eindspaties of besturingstekens. Naamrestricties blijven in de bron bewaard.');
   if(sourceSet.startsWith('Qto_')||propertySet.startsWith('Qto_'))issues.push('Quantity sets hebben een afzonderlijke exportroute nodig en kunnen hier niet als gewone property worden gekoppeld.');
   if(!coreTypes.has(dataType))issues.push('Het IDS-datatype ontbreekt of heeft geen ondersteunde UDPS-vertaling; kies het datatype expliciet.');
   if(scopeReview){warnings.push('UDPS voert de IDS-toepassingsvoorwaarden niet uit. De gekozen entiteiten krijgen een parameterdefinitie.');if(!decision.acknowledgeScope)issues.push('Bevestig de gekozen IFC-doelen en de toepassing: UDPS bewaakt de IDS-toepassingsvoorwaarden niet.');}
   if(valueReview){warnings.push('UDPS controleert of vult de vereiste IDS-waarden niet in.');if(!decision.acknowledgeValues)issues.push('Bevestig dat de IDS-waardevoorwaarden afzonderlijk worden gecontroleerd.');}
   if(optional&&decision.includeOptional)warnings.push('De optionele IDS-property wordt op uitdrukkelijke keuze als parameterdefinitie toegevoegd.');
   if(['entities','propertySet','property','dataType'].some(k=>own(decision,k)))warnings.push('Handmatige keuzes zijn vastgelegd; de oorspronkelijke IDS-eis blijft behouden.');
   if((s.ifcVersions||[]).some(v=>!['IFC2X3','IFC4','IFC4X3_ADD2'].includes(v)))warnings.push('Controleer de IFC-versie van de bron met de beoogde exporter en het model.');
   targets=unique(targets);
   const conditions={specificationId:s.id,minOccurs:min,maxOccurs:max,applicabilityIds:app.map(f=>f.id).filter(Boolean),conditional:scopeReview};
   const values={requirementId:r.id,parameter:'value',constrained:valueReview};
   const requiresReview=scopeReview||valueReview||optional||Object.keys(decision).length>0||!identity(sourceSet)||!identity(sourceProperty)||!datatypeMap[ifcDataType];
   proposals.push({...r,id:r.id,specificationId:s.id,specificationName:s.name,kind:r.kind,cardinality,propertySet,property,ifcDataType,dataType,entities:targets,entity:targets[0]||'',direct:r.kind==='property'&&!requiresReview&&!issues.length,eligible:!issues.length,reasons:unique(issues),warnings:unique(warnings),requiresReview,decision,conditions,values,appliedTargets:{propertySet,property,dataType,entities:targets}});
  }
 }
 return proposals;
}

function checkProjectBudget(data){if(byteLength(JSON.stringify(data,null,2))>IDS_PROJECT_MAX_BYTES)throw Error('Het project zou groter dan 32 MiB zijn. Bewaar minder IDS-bronnen of koppelingen in dit project.');}
function addHeaders(data,fields){for(const field of fields)if(!data.headers.includes(field)){data.headers.push(field);data.rows.forEach(r=>r[field]='');}}
function references(value){if(!value)return [];try{const result=JSON.parse(value);if(Array.isArray(result)&&result.length<=MAX_REFERENCES&&result.every(x=>x&&digest(x.documentId)&&requirementId(x.requirementId)&&/^spec:\d+$/.test(x.specificationId)))return result;}catch{}throw Error('Bestaande IDS-herkomst is niet leesbaar; er wordt niets overschreven.');}
function retainSource(data,preview,decisions,selected=[]){
 const docs=validateIdsImports(data.idsImports)||[],record=sourceRecord(preview);validateIdsImports([record]);
 const previous=docs.find(d=>d.id===preview.id);
 if(previous&&previous.xml!==preview.xml)throw Error('Dezelfde IDS-bronidentiteit heeft verschillende inhoud.');
 const saved=previous||record;saved.selectedRequirementIds=unique([...saved.selectedRequirementIds,...selected]);
 // Merge raw records first: an explicit {} replaces (clears) that requirement,
 // while an omitted requirement keeps its saved choice. Validate only afterwards.
 const choices=checkedDecisions({...saved.decisions,...preview.decisions,...decisions});
 if(Object.keys(choices).length)saved.decisions=choices;else delete saved.decisions;
 for(const k of ['documentSchema','sourceEncoding','sourceByteDigest'])if(record[k]!==undefined)saved[k]=record[k];
 if(!previous)docs.push(saved);
 data.idsImports=validateIdsImports(docs);return !previous;
}
// Source-only retention is useful even when the document has no UDPS-compatible facets.
export function saveIdsSource(data,preview,decisions={}){
 const next={idsImports:data.idsImports},saved=retainSource(next,preview,decisions);
 checkProjectBudget({...data,idsImports:next.idsImports});
 data.idsImports=next.idsImports;return {saved,id:preview.id};
}
export function planIdsImport(data,catalog,preview,selectedIds,decisions={}){
 if(!Array.isArray(selectedIds)||!selectedIds.length||selectedIds.length>MAX_REFERENCES||new Set(selectedIds).size!==selectedIds.length)throw Error('Selecteer één of meer ondersteunde IDS-eigenschappen.');
 const next=structuredClone(data),stored=(validateIdsImports(next.idsImports)||[]).find(d=>d.id===preview.id),effective={...stored?.decisions,...preview.decisions,...decisions};
 const proposals=new Map(mappingProposals(preview,catalog,effective).map(p=>[p.id,p]));
 // Validate retention before changing any output, then validate its final size again below.
 retainSource(next,preview,effective,selectedIds);
 let added=0,skipped=0;
 for(const id of selectedIds){
  const r=proposals.get(id);
  if(!r?.eligible||r.kind!=='property')throw Error('IDS-eis is niet beschikbaar: '+(r?.reasons?.join(' ')||id));
  for(const entity of r.entities){
   const matches=next.rows.filter(row=>row['Y/N']==='x'&&row[entity]==='x'&&row.Export_tabblad===r.propertySet&&row.IFC_parameter===r.property);
   if(matches.length>1)throw Error('Bestaande dubbele IFC-koppeling: '+r.propertySet+' / '+r.property+'. Los deze eerst op.');
   if(matches[0]&&matches[0].Data_type!==r.dataType)throw Error('Conflicterend datatype voor '+r.propertySet+' / '+r.property+' / '+entity+'. Er is niets toegevoegd.');
   addHeaders(next,['Mapping_pending','Mapping_origin','Uniform_id','IDS_requirements',entity]);
   let row=matches[0];
   if(row)skipped++;
   else{if(next.rows.length>=10000)throw Error('Het project zou meer dan 10.000 regels bevatten.');row=Object.fromEntries(next.headers.map(h=>[h,'']));Object.assign(row,{'Y/N':'x',Revit_parameter:'',IFC_parameter:r.property,Export_tabblad:r.propertySet,Data_type:r.dataType,Mapping_pending:'x',Mapping_origin:'ids',Uniform_id:'ids:'+preview.id+':'+id+':'+entity,[entity]:'x'});next.rows.push(row);added++;}
   const refs=references(row.IDS_requirements),ref={documentId:preview.id,requirementId:id,specificationId:r.specificationId};
   if(r.requiresReview||r.entities.length>1){ref.decisions=r.decision;ref.conditions=r.conditions;ref.values=r.values;ref.appliedTargets=r.appliedTargets;}
   // A re-import updates the reviewed snapshot for this source requirement, without duplicating it.
   const index=refs.findIndex(x=>x.documentId===ref.documentId&&x.requirementId===id&&x.specificationId===ref.specificationId);
   if(index>=0)refs[index]=ref;else refs.push(ref);
   if(refs.length>MAX_REFERENCES)throw Error('Te veel IDS-verwijzingen op één parameterregel.');
   row.IDS_requirements=JSON.stringify(refs);
  }
 }
 // Count provenance references project-wide, including existing mappings.
 let refCount=0;for(const row of next.rows){refCount+=references(row.IDS_requirements).length;if(refCount>MAX_REFERENCES)throw Error('Het project zou meer dan 50.000 IDS-verwijzingen bevatten.');}
 checkProjectBudget(next);
 return {project:next,added,skipped,selected:selectedIds.length};
}
export function applyIdsImport(data,catalog,preview,selectedIds,decisions={}){const result=planIdsImport(data,catalog,preview,selectedIds,decisions);data.headers=result.project.headers;data.rows=result.project.rows;data.idsImports=result.project.idsImports;return {added:result.added,skipped:result.skipped,selected:result.selected};}
