// Read IDS evidence without interpreting it as an executable UDPS export contract.
const IDS='http://standards.buildingsmart.org/IDS';
const XS='http://www.w3.org/2001/XMLSchema';
const XSI='http://www.w3.org/2001/XMLSchema-instance';
const XMLNS='http://www.w3.org/2000/xmlns/';
const PARSER_ERROR='http://www.mozilla.org/newlayout/xml/parsererror.xml';
const XSD_FACETS=new Set(['enumeration','pattern','length','minLength','maxLength','minInclusive','minExclusive','maxInclusive','maxExclusive','totalDigits','fractionDigits','whiteSpace']);
export const IDS_MAX_BYTES=10*1024*1024;
export const IDS_LIMITS=Object.freeze({bytes:IDS_MAX_BYTES,specifications:5000,facets:50000,elements:250000,depth:64});
const byteLength=value=>new TextEncoder().encode(value).length;
const elements=node=>Array.from(node?.childNodes||node?.children||[]).filter(n=>n.nodeType===1);
const named=(node,name)=>elements(node).filter(n=>n.namespaceURI===IDS&&n.localName===name);
const attr=(node,name)=>node?.getAttribute(name)??'';
const has=(node,name)=>!!node?.hasAttribute(name);
const attributes=node=>Object.fromEntries(Array.from(node?.attributes||[]).filter(a=>a.namespaceURI!==XMLNS).map(a=>[a.name||a.localName,a.value]));
const hash=async bytes=>{
 if(!globalThis.crypto?.subtle)throw Error('Deze browser ondersteunt geen SHA-256 voor IDS-bronidentiteit.');
 const digest=await globalThis.crypto.subtle.digest('SHA-256',bytes);
 return 'sha256:'+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
};

function xmlEncoding(xml){return /^\uFEFF?\s*<\?xml\s[^?]*\bencoding\s*=\s*(['"])([A-Za-z][A-Za-z0-9._-]*)\1/i.exec(xml)?.[2]||'';}
function decoder(label){try{return new TextDecoder(label,{fatal:true});}catch{throw Error('Niet ondersteunde XML-tekencodering: '+label+'.');}}
function decode(bytes,label){try{return decoder(label).decode(bytes);}catch(error){if(error.message?.startsWith('Niet ondersteunde'))throw error;throw Error('Het IDS-bestand bevat ongeldige bytes voor '+label+'.');}}
function encodingHeader(bytes,detected){
 const codec=detected?decoder(detected):null,parts=[];let tail='';
 try{for(let offset=0;offset<bytes.length;offset+=512){
  const bytesPart=bytes.subarray(offset,offset+512),part=codec?codec.decode(bytesPart,{stream:true}):String.fromCharCode(...bytesPart);parts.push(part);
  if((offset===0&&!/^\uFEFF?\s*<\?xml(?:\s|$)/i.test(part))||(tail+part).includes('?>'))break;
  tail=part.slice(-1);
 }}catch{throw Error('Het IDS-bestand bevat ongeldige bytes voor '+detected+'.');}
 return parts.join('');
}

// File.text() silently substitutes undecodable bytes and does not detect UTF-16.
// Keep a separate byte digest: the established document ID hashes decoded UTF-8 text.
export async function decodeIdsBytes(buffer){
 let bytes;
 if(buffer instanceof ArrayBuffer)bytes=new Uint8Array(buffer);
 else if(ArrayBuffer.isView(buffer))bytes=new Uint8Array(buffer.buffer,buffer.byteOffset,buffer.byteLength);
 else throw Error('Verwacht de oorspronkelijke IDS-bestandsbytes.');
 if(bytes.byteLength>IDS_MAX_BYTES)throw Error('IDS-bestand is groter dan 10 MiB.');
 if(!bytes.length)throw Error('Het IDS-bestand is leeg.');
 const starts=(...signature)=>signature.every((b,i)=>bytes[i]===b);
 if(starts(0,0,0xfe,0xff)||starts(0xff,0xfe,0,0))throw Error('UTF-32 XML wordt niet ondersteund; gebruik UTF-8 of UTF-16.');
 let detected='';
 if(starts(0xef,0xbb,0xbf))detected='utf-8';
 else if(starts(0xff,0xfe))detected='utf-16le';
 else if(starts(0xfe,0xff))detected='utf-16be';
 else if([0x09,0x0a,0x0d,0x20,0x3c].includes(bytes[0])&&bytes[1]===0&&bytes[3]===0)detected='utf-16le';
 else if(bytes[0]===0&&[0x09,0x0a,0x0d,0x20,0x3c].includes(bytes[1])&&bytes[2]===0)detected='utf-16be';
 const header=encodingHeader(bytes,detected);
 const declared=xmlEncoding(header);
 const declaredCanonical=declared?decoder(declared).encoding:'';
 const declaredGeneric=/^utf[-_]?16$/i.test(declared);
 if(detected&&declaredCanonical&&declaredCanonical!==detected&&!(declaredGeneric&&detected.startsWith('utf-16')))throw Error('XML-tekencodering '+declared+' past niet bij de BOM of bytevolgorde.');
 if(!detected&&declaredCanonical?.startsWith('utf-16'))throw Error('XML noemt UTF-16, maar de oorspronkelijke bytes hebben geen UTF-16-bytevolgorde.');
 const encoding=detected||declaredCanonical||'utf-8',xml=decode(bytes,encoding);
 if(byteLength(xml)>IDS_MAX_BYTES)throw Error('Gedecodeerde IDS-tekst is groter dan 10 MiB in UTF-8.');
 return {xml,encoding,byteDigest:await hash(bytes)};
}

function versionProfile(root){
 const warnings=[],raw=root.getAttributeNS?.(XSI,'schemaLocation')||'',tokens=raw.trim()?raw.trim().split(/\s+/):[],schemaLocations=[];
 for(let i=0;i<tokens.length;i+=2)schemaLocations.push({namespace:tokens[i],location:tokens[i+1]||''});
 if(tokens.length%2)warnings.push('schemaLocation bevat geen volledige namespace/locatie-paren.');
 const hints=[];
 for(const entry of schemaLocations.filter(x=>x.namespace===IDS)){
  const version=/\bIDS\/([0-9]+(?:\.[0-9]+){0,2})\//i.exec(entry.location.replace(/\\/g,'/'))?.[1];
  if(version)hints.push(version);
 }
 if(has(root,'version'))hints.push(attr(root,'version'));
 const unsupported=hints.filter(v=>!['1','1.0','1.0.0'].includes(v));
 let profile='ids-1.0';
 if(unsupported.length){
  profile=unsupported.every(v=>/^0\./.test(v))?'ids-legacy':unsupported.some(v=>/^\d/.test(v)&&Number(v.split('.')[0])>=1)?'ids-future':'ids-unknown-version';
  warnings.push('Expliciete IDS-versie '+[...new Set(unsupported)].join(', ')+' is alleen leesbaar; niet geconverteerd of gevalideerd voor mapping.');
 }
 if(!raw)warnings.push('Geen schemaLocation opgegeven; IDS 1.0-structuur gelezen zonder XSD-validatie.');
 else warnings.push('schemaLocation is een verwijzing; er is geen XSD opgehaald of volledige XSD-validatie uitgevoerd.');
 return {profile,schemaLocations,mappingAllowed:!unsupported.length,warnings};
}

export async function readIds(xml,{fileName='Ingeladen.ids',DOMParser:Parser=globalThis.DOMParser,XMLSerializer:Serializer=globalThis.XMLSerializer,sourceEncoding,sourceByteDigest}={}){
 if(typeof xml!=='string')throw Error('Verwacht IDS XML-tekst.');
 if(byteLength(xml)>IDS_MAX_BYTES)throw Error('IDS-tekst is groter dan 10 MiB in UTF-8.');
 const declarationSource=xml.replace(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>/g,'');
 if(/<!\s*(DOCTYPE|ENTITY)\b/i.test(declarationSource))throw Error('DTD en eigen XML-entiteiten zijn niet toegestaan in een IDS-bestand.');
 if(!Parser)throw Error('De XML-parser van de browser is niet beschikbaar.');
 if(typeof fileName!=='string'||!fileName||fileName.length>1024||/[\u0000-\u001f\u007f-\u009f]/.test(fileName))throw Error('Ongeldige IDS-bestandsnaam.');
 let doc;
 try{doc=new Parser({onError:(_level,message)=>{throw Error(message);}}).parseFromString(xml,'application/xml');}
 catch{throw Error('Het IDS-bestand bevat ongeldige XML.');}
 const root=doc?.documentElement;
 if(!root||root.namespaceURI===PARSER_ERROR||doc.getElementsByTagNameNS?.(PARSER_ERROR,'parsererror').length)throw Error('Het IDS-bestand bevat ongeldige XML.');
 if(root.namespaceURI!==IDS||root.localName!=='ids')throw Error('Verwacht een IDS-bestand met de officiële IDS-namespace.');
 const serializer=Serializer?new Serializer():null;
 const serialize=node=>serializer?serializer.serializeToString(node):typeof node?.toString==='function'&&node.toString().startsWith('<')?node.toString():'';
 let elementCount=0;
 const stack=[[root,0]];
 while(stack.length){const [node,depth]=stack.pop();if(++elementCount>IDS_LIMITS.elements||depth>IDS_LIMITS.depth)throw Error('Het IDS-bestand overschrijdt de grens van 250.000 XML-elementen of 64 nestniveaus.');for(const child of elements(node))stack.push([child,depth+1]);}
 const warnings=[],format=versionProfile(root),unknown=[];let facetCount=0,structureValid=true;
 const warning=(list,path,message)=>{const text=path+': '+message;list.push(text);if(list!==warnings)warnings.push(text);};
 const rawNode=(node,path)=>({name:node.localName||node.nodeName,namespace:node.namespaceURI||'',path,attributes:attributes(node),text:node.textContent??'',xml:serialize(node)});
 function readValue(node,path,list){
  const options=elements(node),wrapperAttributes=attributes(node);
  function option(value,optionPath){
   if(value.namespaceURI===IDS&&value.localName==='simpleValue'&&!elements(value).length)return {kind:'literal',value:value.textContent??'',attributes:attributes(value),xml:serialize(value)};
   if(value.namespaceURI===XS&&value.localName==='restriction'){
    const base=attr(value,'base'),facets=[],annotations=[];
    for(const child of elements(value)){
     if(child.namespaceURI===XS&&child.localName==='annotation'){annotations.push(rawNode(child,optionPath+'/annotation'));continue;}
     facets.push({kind:child.localName||child.nodeName,namespace:child.namespaceURI||'',value:has(child,'value')?attr(child,'value'):null,attributes:attributes(child),xml:serialize(child)});
     if(child.namespaceURI!==XS||!XSD_FACETS.has(child.localName))warning(list,optionPath,'Onbekende restrictie-inhoud is als broninformatie behouden.');
    }
    return {kind:'restriction',base,baseNamespace:value.lookupNamespaceURI?.(base.includes(':')?base.split(':')[0]:null)||'',facets,annotations,attributes:attributes(value),xml:serialize(value)};
   }
   warning(list,optionPath,'Onbekende waardevorm is als broninformatie behouden.');return {kind:'unknown',...rawNode(value,optionPath)};
  }
  if(options.length===1)return {...option(options[0],path),wrapperAttributes};
  warning(list,path,options.length?'Meerdere waardevormen; geen eerste waarde gekozen.':'Waardevorm ontbreekt.');
  return {kind:options.length?'ambiguous':'unknown',values:options.map((v,i)=>option(v,path+'/value:'+i)),wrapperAttributes,text:node.textContent??'',xml:serialize(node)};
 }
 const parameterNames={entity:['name','predefinedType'],property:['propertySet','baseName','value'],attribute:['name','value'],classification:['system','value'],material:['value'],partOf:['entity']};
 function readFacet(node,path,requirements){
  if(++facetCount>IDS_LIMITS.facets)throw Error('Het IDS-bestand bevat meer dan 50.000 facetten.');
  const kind=node.namespaceURI===IDS&&Object.hasOwn(parameterNames,node.localName)?node.localName:'unknown',list=[],parameters={},unrecognized=[];
  const result={id:path,path,kind,cardinality:requirements?(has(node,'cardinality')?attr(node,'cardinality'):'required'):null,attributes:attributes(node),parameters,xml:serialize(node),warnings:list,unknown:unrecognized};
  if(kind==='unknown'){Object.assign(result,{sourceKind:node.localName||node.nodeName,namespace:node.namespaceURI||''});warning(list,path,'Onbekend facet is als broninformatie behouden.');return result;}
  for(const name of parameterNames[kind]){
   const matches=named(node,name);if(!matches.length)continue;
   const values=matches.map((n,i)=>kind==='partOf'&&name==='entity'?readFacet(n,path+'/entity:'+i,false):readValue(n,path+'/'+name+(matches.length>1?':'+i:''),list));
   if(values.length===1)parameters[name]=values[0];
   else{parameters[name]={kind:'ambiguous',values,xml:matches.map(serialize).join('')};warning(list,path+'/'+name,'Parameter komt meermaals voor; geen eerste waarde gekozen.');}
  }
  for(const child of elements(node))if(child.namespaceURI!==IDS||!parameterNames[kind].includes(child.localName)){unrecognized.push(rawNode(child,path+'/'+(child.localName||child.nodeName)));warning(list,path,'Onbekende facetinhoud is als broninformatie behouden.');}
  return result;
 }
 const infos=named(root,'info'),containers=named(root,'specifications');
 if(infos.length!==1||containers.length!==1){structureValid=false;warning(warnings,'document','Verwacht één info- en één specifications-onderdeel; inhoud blijft leesbaar.');}
 const infoEntries=infos.flatMap(info=>elements(info).map((n,i)=>rawNode(n,'info/'+n.localName+':'+i))),info={};
 for(const entry of infoEntries){const key=entry.namespace===IDS?entry.name:'{'+entry.namespace+'}'+entry.name;if(Array.isArray(info[key]))info[key].push(entry.text);else if(Object.hasOwn(info,key))info[key]=[info[key],entry.text];else info[key]=entry.text;}
 const titleNodes=infos.flatMap(info=>named(info,'title'));if(titleNodes.length!==1){structureValid=false;warning(warnings,'info/title','Titel ontbreekt of komt meermaals voor.');}
 const specificationNodes=containers.flatMap(container=>elements(container));
 const actualSpecifications=specificationNodes.filter(n=>n.namespaceURI===IDS&&n.localName==='specification');
 if(actualSpecifications.length>IDS_LIMITS.specifications)throw Error('Het IDS-bestand bevat meer dan 5.000 specificaties.');
 if(!actualSpecifications.length){structureValid=false;warning(warnings,'specifications','Geen IDS-specificaties gevonden.');}
 const specifications=[];
 for(const [si,node] of actualSpecifications.entries()){
  const path='spec:'+si,apps=named(node,'applicability'),reqs=named(node,'requirements'),list=[],extra=[];
  if(apps.length!==1||reqs.length>1){structureValid=false;warning(list,path,'Toepassing ontbreekt of de toepassings-/eisenonderdelen komen meermaals voor.');}
  const app=apps[0],ifcVersions=attr(node,'ifcVersion').trim()?attr(node,'ifcVersion').trim().split(/\s+/):[];
  const applicability=apps.flatMap(a=>elements(a)).map((n,i)=>readFacet(n,path+'/applicability:'+i,false));
  const requirements=reqs.flatMap(a=>elements(a)).map((n,i)=>readFacet(n,path+'/requirement:'+i,true));
  if(!has(node,'name')||!attr(node,'name'))warning(list,path,'Specificatienaam ontbreekt.');
  if(!ifcVersions.length)warning(list,path,'IFC-versie ontbreekt.');
  for(const child of elements(node))if(child.namespaceURI!==IDS||!['applicability','requirements'].includes(child.localName)){extra.push(rawNode(child,path+'/'+(child.localName||child.nodeName)));warning(list,path,'Onbekende specificatie-inhoud is als broninformatie behouden.');}
  specifications.push({id:path,name:attr(node,'name')||'Naamloze specificatie',identifier:attr(node,'identifier'),ifcVersions,minOccurs:has(app,'minOccurs')?attr(app,'minOccurs'):'1',maxOccurs:has(app,'maxOccurs')?attr(app,'maxOccurs'):'1',description:attr(node,'description'),instructions:attr(node,'instructions'),attributes:attributes(node),applicabilityAttributes:attributes(app),requirementsAttributes:reqs.map(attributes),applicability,applicabilityXml:apps.map(serialize).join(''),requirements,reasons:[],warnings:list,unknown:extra});
 }
 for(const node of elements(root))if(node.namespaceURI!==IDS||!['info','specifications'].includes(node.localName)){unknown.push(rawNode(node,'document/'+(node.localName||node.nodeName)));warning(warnings,'document','Onbekende documentinhoud is als broninformatie behouden.');}
 for(const node of specificationNodes)if(node.namespaceURI!==IDS||node.localName!=='specification'){unknown.push(rawNode(node,'specifications/'+(node.localName||node.nodeName)));warning(warnings,'specifications','Onbekende inhoud is als broninformatie behouden.');}
 format.mappingAllowed&&=structureValid;
 const allWarnings=[...new Set([...format.warnings,...warnings])];
 return {schema:1,documentSchema:2,id:await hash(new TextEncoder().encode(xml)),fileName,title:titleNodes[0]?.textContent||fileName,xml,info,infoEntries,attributes:attributes(root),specifications,format,warnings:allWarnings,unknown,...(sourceEncoding?{sourceEncoding}:{}),...(sourceByteDigest?{sourceByteDigest}:{})};
}
