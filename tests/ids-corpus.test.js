import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {readIds} from '../web/ids-document.js';

const IDS='http://standards.buildingsmart.org/IDS',XS='http://www.w3.org/2001/XMLSchema';
const root=new URL('./fixtures/ids/official/',import.meta.url);
const provenance=JSON.parse(fs.readFileSync(new URL('./fixtures/ids/official-provenance.json',import.meta.url)));
const elements=node=>Array.from(node?.childNodes||[]).filter(n=>n.nodeType===1);
const direct=(node,name)=>elements(node).filter(n=>n.namespaceURI===IDS&&n.localName===name);
const counts=nodes=>nodes.reduce((result,node)=>{result[node.localName]=(result[node.localName]||0)+1;return result;},{});
const addCounts=(target,source)=>{for(const [key,value] of Object.entries(source))target[key]=(target[key]||0)+value;};

// Real XML DOM implementation at a documented dependency boundary, not a browser/IFC validator.
class StrictParser extends DOMParser{
 constructor(){super({onError:(level,message)=>{if(level==='error'||level==='fatalError')throw Error(message);}});}
}
async function read(xml,fileName='generic.ids'){
 const previous=globalThis.XMLSerializer;globalThis.XMLSerializer=XMLSerializer;
 try{return await readIds(xml,{fileName,DOMParser:StrictParser});}
 finally{if(previous===undefined)delete globalThis.XMLSerializer;else globalThis.XMLSerializer=previous;}
}

function assertValue(source,value,label){
 assert(value,label+' omitted parameter');
 const nested=elements(source);
 if(nested.length===1&&nested[0].namespaceURI===IDS&&nested[0].localName==='simpleValue'){
  assert.equal(value.kind,'literal',label);assert.equal(value.value,nested[0].textContent,label+' literal changed');
 }else if(nested.length===1&&nested[0].namespaceURI===XS&&nested[0].localName==='restriction'){
  assert.equal(value.kind,'restriction',label);assert.equal(value.base,nested[0].getAttribute('base'),label+' restriction base');
  assert.deepEqual(value.facets.map(f=>({kind:f.kind,value:f.value})),elements(nested[0]).map(n=>({kind:n.localName,value:n.getAttribute('value')})),label+' restriction facets changed');
  assert.equal(typeof value.xml,'string',label+' restriction XML missing');
 }else assert.equal(typeof value.xml,'string',label+' original unsupported parameter must remain visible');
}
function assertFacet(source,actual,label){
 assert.equal(actual.kind,source.localName,label+' facet kind');assert.equal(typeof actual.xml,'string',label+' facet XML');
 assert(actual.xml.length,label+' empty facet XML');
 for(const child of elements(source)){
  if(child.namespaceURI===IDS&&child.localName==='entity')assertFacet(child,actual.parameters.entity,label+'/entity');
  else if(child.namespaceURI===IDS)assertValue(child,actual.parameters[child.localName],label+'/'+child.localName);
 }
 for(const attr of Array.from(source.attributes||[]).filter(a=>!a.namespaceURI)){
  assert.equal(actual.attributes[attr.localName],attr.value,label+' attribute '+attr.localName);
 }
}

test('Official IDS XML corpus is unchanged and every applicability/requirement facet and restriction is retained',async()=>{
 assert.equal(provenance.sourceCommit,'870f9c4e6e8f414e737b4d84ca1aa9b46fc6c8f3');
 assert.equal(provenance.license.spdx,'CC-BY-ND-4.0');assert.equal(provenance.files.length,334);
 let bytes=0,specifications=0;const applicability={},requirements={},restrictions={},labels={};
 for(const fixture of provenance.files){
  const raw=fs.readFileSync(new URL(fixture.path,root));bytes+=raw.length;
  assert.equal(raw.length,fixture.bytes,fixture.path+' size changed');assert.equal(createHash('sha256').update(raw).digest('hex'),fixture.sha256,fixture.path+' hash changed');
  const xml=raw.toString('utf8'),source=new StrictParser().parseFromString(xml,'application/xml');
  const expected=direct(direct(source.documentElement,'specifications')[0],'specification');
  const parsed=await read(xml,fixture.path.split('/').at(-1));
  assert.equal(parsed.xml,xml,fixture.path+' complete source changed');assert.equal(parsed.specifications.length,expected.length,fixture.path+' specification lost');specifications+=expected.length;
  labels[fixture.path.split('/').at(-1).split('-')[0]]=(labels[fixture.path.split('/').at(-1).split('-')[0]]||0)+1;
  for(const [index,spec] of expected.entries()){
   const actual=parsed.specifications[index],apps=elements(direct(spec,'applicability')[0]),reqs=elements(direct(spec,'requirements')[0]);
   assert.equal(actual.name,spec.getAttribute('name'),fixture.path+' specification name');
   assert.deepEqual(actual.ifcVersions,spec.getAttribute('ifcVersion').trim().split(/\s+/),fixture.path+' IFC versions');
   assert.equal(actual.applicability.length,apps.length,fixture.path+' applicability lost');assert.equal(actual.requirements.length,reqs.length,fixture.path+' requirement lost');
   apps.forEach((node,i)=>assertFacet(node,actual.applicability[i],fixture.path+'/applicability/'+i));
   reqs.forEach((node,i)=>assertFacet(node,actual.requirements[i],fixture.path+'/requirements/'+i));
   addCounts(applicability,counts(apps));addCounts(requirements,counts(reqs));
  }
  for(const node of Array.from(source.getElementsByTagNameNS(XS,'*')))restrictions[node.localName]=(restrictions[node.localName]||0)+1;
 }
 assert.equal(bytes,380272);assert.equal(bytes,provenance.totalBytes);assert.equal(specifications,334);
 assert.deepEqual(applicability,provenance.counts.applicability);assert.deepEqual(requirements,provenance.counts.requirements);
 assert.deepEqual(restrictions,provenance.counts.restrictionElements);assert.deepEqual(labels,provenance.counts.filenameLabels);
 assert.deepEqual(requirements,{attribute:96,classification:27,entity:29,material:29,partOf:34,property:118});
});

const simple=(name,value)=>`<${name}><simpleValue>${value}</simpleValue></${name}>`;
const property=`<property dataType="IFCLABEL">${simple('propertySet','Generic_Set')}${simple('baseName','Generic_Property')}</property>`;
const document=(app,req=property,hint='')=>`<ids xmlns="${IDS}" xmlns:xs="${XS}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"${hint}><info><title>Generic reading case</title><version>0.9.7 author revision</version></info><specifications><specification name="Generic" ifcVersion="IFC4"><applicability minOccurs="0" maxOccurs="unbounded">${app}</applicability><requirements>${req}</requirements></specification></specifications></ids>`;

test('Reading does not require a catalog, an entity applicability facet or a particular schemaLocation URL',async()=>{
 const app=`<classification>${simple('system','Generic_System')}${simple('value','A.1')}</classification>`;
 for(const hint of ['',` xsi:schemaLocation="${IDS} ids.xsd"`,` xsi:schemaLocation="${IDS} ./schemas/ids.xsd"`]){
  const parsed=await read(document(app,property,hint));assert.equal(parsed.specifications[0].applicability[0].kind,'classification');
  assert.equal(parsed.specifications[0].requirements[0].parameters.baseName.value,'Generic_Property');
  assert.notEqual(parsed.format.mappingAllowed,false,'A schema hint or author document version is not an IDS version restriction');
 }
});

test('Prefix-independent reading retains all six facet kinds in both positions and exact complex restrictions',async()=>{
 const entity=`<entity>${simple('name','IFCWALL')}</entity>`;
 const facets=[entity,`<attribute>${simple('name','Name')}${simple('value','Exact value')}</attribute>`,property,
  `<classification>${simple('system','Generic_System')}<value><xs:restriction base="xs:string"><xs:pattern value="A.*"/><xs:minLength value="2"/></xs:restriction></value></classification>`,
  `<material>${simple('value','Material')}</material>`,`<partOf relation="IFCRELAGGREGATES">${entity}</partOf>`];
 const raw=document(facets.join(''),facets.join(''));
 const prefixed=raw.replace(`xmlns="${IDS}"`,`xmlns:i="${IDS}"`).replace(/<(\/?)([A-Za-z][A-Za-z0-9]*)(?=[\s>])/g,'<$1i:$2');
 for(const xml of [raw,prefixed]){
  const parsed=await read(xml),spec=parsed.specifications[0];
  assert.equal(parsed.xml,xml);assert.deepEqual(spec.applicability.map(f=>f.kind),['entity','attribute','property','classification','material','partOf']);
  assert.deepEqual(spec.requirements.map(f=>f.kind),['entity','attribute','property','classification','material','partOf']);
  assert.deepEqual(spec.requirements[3].parameters.value.facets.map(f=>({kind:f.kind,value:f.value})),[{kind:'pattern',value:'A.*'},{kind:'minLength',value:'2'}]);
  assert.equal(spec.requirements[5].parameters.entity.parameters.name.value,'IFCWALL');
 }
});

test('Historical format hints remain readable with an explicit conversion boundary',async()=>{
 const parsed=await read(document(`<entity>${simple('name','IFCWALL')}</entity>`,property,` xsi:schemaLocation="${IDS} ${IDS}/0.9.7/ids.xsd"`));
 assert.equal(parsed.specifications[0].requirements.length,1);assert.equal(parsed.format.mappingAllowed,false);
 assert(parsed.warnings.length||parsed.format.warnings.length,'Historical format must be identified');
});
