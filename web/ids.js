// IDS is an information requirement source, never a confirmed bSDD relation.
const IDS='http://standards.buildingsmart.org/IDS',XS='http://www.w3.org/2001/XMLSchema',XSI='http://www.w3.org/2001/XMLSchema-instance';
export const IDS_MAX_BYTES=2*1024*1024;
const MAX_DOCUMENTS=20,MAX_SAVED_BYTES=10*1024*1024,MAX_REQUIREMENTS=2000,MAX_SPECIFICATIONS=200;
const byteLength=value=>new TextEncoder().encode(value).length;
const datatypeMap={IFCBOOLEAN:'Boolean',IFCINTEGER:'Integer',IFCREAL:'Real',IFCTEXT:'Text',IFCLABEL:'Label',IFCIDENTIFIER:'Identifier',IFCLOGICAL:'Logical',IFCLENGTHMEASURE:'Length',IFCPOSITIVELENGTHMEASURE:'PositiveLength',IFCAREAMEASURE:'Area',IFCVOLUMEMEASURE:'Volume',IFCCOUNTMEASURE:'Count',IFCPLANEANGLEMEASURE:'PlaneAngle',IFCPOSITIVEPLANEANGLEMEASURE:'PositivePlaneAngle',IFCRATIOMEASURE:'Ratio',IFCPOSITIVERATIOMEASURE:'PositiveRatio',IFCNORMALISEDRATIOMEASURE:'NormalisedRatio',IFCTHERMALTRANSMITTANCEMEASURE:'ThermalTransmittance',IFCTHERMODYNAMICTEMPERATUREMEASURE:'ThermodynamicTemperature',IFCPOWERMEASURE:'Power',IFCPRESSUREMEASURE:'Pressure',IFCFREQUENCYMEASURE:'Frequency',IFCFORCEMEASURE:'Force',IFCVOLUMETRICFLOWRATEMEASURE:'VolumetricFlowRate',IFCELECTRICCURRENTMEASURE:'ElectricalCurrent',IFCELECTRICVOLTAGEMEASURE:'ElectricalVoltage',IFCILLUMINANCEMEASURE:'Illuminance',IFCLUMINOUSFLUXMEASURE:'LuminousFlux',IFCLUMINOUSINTENSITYMEASURE:'LuminousIntensity'};
const field=value=>typeof value==='string'&&!!value.trim()&&value.length<=500&&!/[\t\r\n]/.test(value);
// IDS simpleValue uses xs:string: whitespace is part of an IFC output identity.
// UDPS cannot safely preserve boundary whitespace or control characters; exclude, never normalize.
const identity=value=>field(value)&&value===value.trim()&&!/[\u0000-\u001f\u007f-\u009f]/.test(value);
const children=node=>Array.from(node?.children||node?.childNodes||[]).filter(n=>n.nodeType===1);
const named=(node,name)=>children(node).filter(n=>n.namespaceURI===IDS&&n.localName===name);
const one=(node,name)=>{const list=named(node,name);return list.length===1?list[0]:null;};
const attribute=(node,name)=>node?.getAttribute(name)||'';
function literal(node){const values=children(node);return values.length===1&&values[0].namespaceURI===IDS&&values[0].localName==='simpleValue'&&!children(values[0]).length?values[0].textContent:'';}
function supportedAttributes(node,allowed){return Array.from(node?.attributes||[]).every(a=>a.namespaceURI==='http://www.w3.org/2000/xmlns/'||!a.namespaceURI&&allowed.includes(a.localName));}
function sourceXml(node){return new XMLSerializer().serializeToString(node);}
function entities(catalog){return (catalog?.ifc?.items||[]).filter(x=>x.kind==='class'&&/^Ifc[A-Za-z0-9]+$/.test(x.code)&&!/[A-Z]{2,}$/.test(x.code)).map(x=>x.code);}

// Saved originals are bounded passive evidence; they are not executed or treated as authority.
export function validateIdsImports(value){
 if(value===undefined)return undefined;
 if(!Array.isArray(value)||value.length>MAX_DOCUMENTS)throw Error('Ongeldige of te veel opgeslagen IDS-bronnen.');
 let size=0;const seen=new Set();
 return value.map(d=>{
  if(!d||d.schema!==1||!/^sha256:[a-f0-9]{64}$/.test(d.id)||seen.has(d.id)||!field(d.fileName)||typeof d.xml!=='string'||!d.xml||byteLength(d.xml)>IDS_MAX_BYTES||!Array.isArray(d.selectedRequirementIds)||d.selectedRequirementIds.length>MAX_REQUIREMENTS||d.selectedRequirementIds.some(id=>typeof id!=='string'||!/^spec:\d+\/requirement:\d+$/.test(id)))throw Error('Ongeldige opgeslagen IDS-bron.');
  seen.add(d.id);size+=byteLength(d.xml);if(size>MAX_SAVED_BYTES)throw Error('Opgeslagen IDS-bronnen zijn samen groter dan 10 MB.');
  return {schema:1,id:d.id,fileName:d.fileName,xml:d.xml,selectedRequirementIds:[...new Set(d.selectedRequirementIds)]};
 });
}

export async function readIds(xml,{fileName='Ingeladen.ids',catalog,DOMParser:Parser=globalThis.DOMParser}={}){
 if(typeof xml!=='string'||byteLength(xml)>IDS_MAX_BYTES)throw Error('IDS-bestand is groter dan 2 MB of bevat geen XML-tekst.');
 if(/<!\s*(DOCTYPE|ENTITY)\b/i.test(xml))throw Error('DTD en eigen XML-entiteiten zijn niet toegestaan in een IDS-bestand.');
 if(!Parser)throw Error('De XML-parser van de browser is niet beschikbaar.');
 if(!field(fileName))throw Error('Ongeldige IDS-bestandsnaam.');
 const doc=new Parser().parseFromString(xml,'application/xml'),root=doc.documentElement;
 if(!root||doc.getElementsByTagNameNS('*','parsererror').length)throw Error('Het IDS-bestand bevat ongeldige XML.');
 if(root.namespaceURI!==IDS||root.localName!=='ids')throw Error('Verwacht een IDS-bestand met de officiële IDS-namespace.');
 const schema=attribute(root,'version'),location=root.getAttributeNS(XSI,'schemaLocation')||'',parts=location.trim().split(/\s+/),index=parts.indexOf(IDS),schemaUrl=index>=0?parts[index+1]:'';
 if(schema&&schema!=='1.0'&&schema!=='1.0.0'||!/^https?:\/\/standards\.buildingsmart\.org\/IDS\/1\.0\/ids\.xsd$/.test(schemaUrl||''))throw Error('Alleen IDS 1.0 met een expliciete IDS/1.0/ids.xsd-verwijzing wordt ondersteund.');
 let count=0;const walk=(node,depth=0)=>{if(++count>20000||depth>64)throw Error('Het IDS-bestand bevat te veel of te diep geneste XML-elementen.');if(![IDS,XS].includes(node.namespaceURI))throw Error('Het IDS-bestand bevat een onbekende XML-namespace.');children(node).forEach(n=>walk(n,depth+1));};walk(root);
 const info=one(root,'info'),specs=one(root,'specifications');
 if(!info||!one(info,'title')||!specs||children(root).some(n=>n.namespaceURI!==IDS||!['info','specifications'].includes(n.localName)))throw Error('De IDS-opbouw is ongeldig: info/title en specifications zijn vereist.');
 const specificationNodes=named(specs,'specification');
 if(!specificationNodes.length||specificationNodes.length>MAX_SPECIFICATIONS||children(specs).length!==specificationNodes.length)throw Error('Verwacht 1 tot 200 IDS-specificaties.');
 const known=entities(catalog),specifications=[];let requirementCount=0;
 for(const [si,spec] of specificationNodes.entries()){
  const app=one(spec,'applicability'),reqs=one(spec,'requirements'),name=attribute(spec,'name'),ifcVersions=attribute(spec,'ifcVersion').trim().split(/\s+/),reasons=[];
  if(!field(name)||!ifcVersions.length||ifcVersions.some(v=>!['IFC2X3','IFC4','IFC4X3_ADD2'].includes(v)))reasons.push('Naam of IFC-versie ontbreekt of wordt niet ondersteund.');
  if(!app||named(spec,'requirements').length>1||children(spec).some(n=>n.namespaceURI!==IDS||!['applicability','requirements'].includes(n.localName))||!supportedAttributes(spec,['name','ifcVersion','identifier','description','instructions']))reasons.push('De specificatie heeft een niet ondersteunde structuur.');
  const entity=one(app,'entity'),entityName=literal(one(entity,'name')),entityCode=known.find(e=>e.toUpperCase()===entityName)||'';
  if(!entity||!entityCode)reasons.push('Kiesbare IFC-entiteit ontbreekt; alleen één letterlijke IFC-naam uit de geladen catalogus wordt ondersteund.');
  if(app&&(!supportedAttributes(app,['minOccurs','maxOccurs'])||children(app).some(n=>n.namespaceURI!==IDS||n.localName!=='entity')||children(app).length!==1)||entity&&(!supportedAttributes(entity,[])||children(entity).some(n=>n.namespaceURI!==IDS||n.localName!=='name')||children(entity).length!==1))reasons.push('Voorwaardelijke toepassing of predefinedType kan niet door UDPS worden uitgevoerd.');
  const min=app?.hasAttribute('minOccurs')?attribute(app,'minOccurs'):'1',max=app?.hasAttribute('maxOccurs')?attribute(app,'maxOccurs'):'1';
  if(!/^\d+$/.test(min)||!(max==='unbounded'||/^\d+$/.test(max))||max==='0'||max!=='unbounded'&&Number(min)>Number(max))reasons.push(max==='0'?'Deze specificatie verbiedt de toepassing; er worden geen gewenste properties toegevoegd.':'Niet ondersteunde toepassingsaantallen.');
  const requirements=[];
  for(const [ri,node] of children(reqs).entries()){
   if(++requirementCount>MAX_REQUIREMENTS)throw Error('Het IDS-bestand bevat meer dan 2000 eisen.');
   const issues=[...reasons],kind=node.localName,cardinality=node.hasAttribute('cardinality')?attribute(node,'cardinality'):'required',pset=literal(one(node,'propertySet')),property=literal(one(node,'baseName')),ifcDataType=attribute(node,'dataType'),dataType=datatypeMap[ifcDataType]||'';
   if(node.namespaceURI!==IDS||kind!=='property')issues.push('Dit '+kind+'-facet is geen rechtstreeks te koppelen IFC-property.');
   if(cardinality!=='required')issues.push(cardinality==='prohibited'?'Verboden property; niet toevoegen.':cardinality==='optional'?'Optionele property; niet als verplichte koppeling toegevoegd.':'Onbekende cardinaliteit.');
   if(kind==='property'){
    if(!identity(pset)||!identity(property))issues.push('Alleen letterlijke propertyset- en propertynamen zonder begin-/eindspaties of besturingstekens worden ondersteund; geen patronen of naamrestricties.');
    if(pset.startsWith('Qto_'))issues.push('Quantity sets hebben een afzonderlijke exportroute nodig.');
    if(!dataType)issues.push('Het IDS-datatype ontbreekt of heeft geen ondersteunde UDPS-vertaling.');
    if(children(node).some(n=>n.namespaceURI!==IDS||!['propertySet','baseName'].includes(n.localName)))issues.push('Waarde-eisen of andere propertyvoorwaarden worden bewaard, maar kunnen hier niet worden uitgevoerd.');
    if(!supportedAttributes(node,['dataType','cardinality','uri','instructions']))issues.push('Niet ondersteunde eigenschapsattributen.');
   }
   requirements.push({id:'spec:'+si+'/requirement:'+ri,kind,cardinality,entity:entityCode,propertySet:pset,property,ifcDataType,dataType,instructions:attribute(node,'instructions'),uri:attribute(node,'uri'),eligible:!issues.length,reasons:[...new Set(issues)],xml:sourceXml(node)});
  }
  specifications.push({id:'spec:'+si,name:name||'Naamloze specificatie',identifier:attribute(spec,'identifier'),ifcVersions,description:attribute(spec,'description'),instructions:attribute(spec,'instructions'),minOccurs:min,maxOccurs:max,applicabilityXml:app?sourceXml(app):'',reasons:[...new Set(reasons)],requirements});
 }
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(xml)),id='sha256:'+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 return {schema:1,id,fileName,title:one(info,'title').textContent.trim()||fileName,xml,specifications};
}

function addHeaders(data,fields){for(const field of fields)if(!data.headers.includes(field)){data.headers.push(field);data.rows.forEach(r=>r[field]='');}}
function references(value){if(!value)return [];try{const result=JSON.parse(value);if(Array.isArray(result)&&result.length<=MAX_REQUIREMENTS&&result.every(x=>typeof x.documentId==='string'&&typeof x.requirementId==='string'&&typeof x.specificationId==='string'))return result;}catch{}throw Error('Bestaande IDS-herkomst is niet leesbaar; er wordt niets overschreven.');}
export function planIdsImport(data,catalog,preview,selectedIds){
 if(!Array.isArray(selectedIds)||!selectedIds.length||new Set(selectedIds).size!==selectedIds.length)throw Error('Selecteer één of meer ondersteunde IDS-eigenschappen.');
 const next=structuredClone(data),known=new Set(entities(catalog)),requirements=new Map((preview.specifications||[]).flatMap(s=>s.requirements.map(r=>[r.id,{requirement:r,specification:s}])));
 const docs=validateIdsImports(next.idsImports)||[],record={schema:1,id:preview.id,fileName:preview.fileName,xml:preview.xml,selectedRequirementIds:[]};
 validateIdsImports([record]);const previous=docs.find(d=>d.id===preview.id);if(previous&&previous.xml!==preview.xml)throw Error('Dezelfde IDS-bronidentiteit heeft verschillende inhoud.');
 let added=0,skipped=0;
 for(const id of selectedIds){
  const entry=requirements.get(id),r=entry?.requirement,s=entry?.specification;
  if(!r?.eligible||r.kind!=='property'||r.cardinality!=='required')throw Error('IDS-eis is niet beschikbaar: '+(r?.reasons?.join(' ')||id));
  if(!known.has(r.entity)||!identity(r.propertySet)||!identity(r.property)||datatypeMap[r.ifcDataType]!==r.dataType)throw Error('Ongeldige IFC-entiteit, eigenschapsnaam of datatype in IDS-selectie.');
  const matches=next.rows.filter(row=>row['Y/N']==='x'&&row[r.entity]==='x'&&row.Export_tabblad===r.propertySet&&row.IFC_parameter===r.property);
  if(matches.length>1)throw Error('Bestaande dubbele IFC-koppeling: '+r.propertySet+' / '+r.property+'. Los deze eerst op.');
  if(matches[0]&&matches[0].Data_type!==r.dataType)throw Error('Conflicterend datatype voor '+r.propertySet+' / '+r.property+' / '+r.entity+'. Er is niets toegevoegd.');
  addHeaders(next,['Mapping_pending','Mapping_origin','Uniform_id','IDS_requirements',r.entity]);
  let row=matches[0];
  if(row)skipped++;
  else{if(next.rows.length>=10000)throw Error('Het project zou meer dan 10.000 regels bevatten.');row=Object.fromEntries(next.headers.map(h=>[h,'']));Object.assign(row,{'Y/N':'x',Revit_parameter:'',IFC_parameter:r.property,Export_tabblad:r.propertySet,Data_type:r.dataType,Mapping_pending:'x',Mapping_origin:'ids',Uniform_id:'ids:'+preview.id+':'+id,[r.entity]:'x'});next.rows.push(row);added++;}
  const refs=references(row.IDS_requirements),ref={documentId:preview.id,requirementId:id,specificationId:s.id};if(!refs.some(x=>JSON.stringify(x)===JSON.stringify(ref)))refs.push(ref);row.IDS_requirements=JSON.stringify(refs);
 }
 const saved=previous||record;saved.selectedRequirementIds=[...new Set([...saved.selectedRequirementIds,...selectedIds])];if(!previous)docs.push(saved);next.idsImports=validateIdsImports(docs);
 return {project:next,added,skipped,selected:selectedIds.length};
}
export function applyIdsImport(data,catalog,preview,selectedIds){const result=planIdsImport(data,catalog,preview,selectedIds);data.headers=result.project.headers;data.rows=result.project.rows;data.idsImports=result.project.idsImports;return {added:result.added,skipped:result.skipped,selected:result.selected};}
