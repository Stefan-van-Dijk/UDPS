import test from 'node:test';
import assert from 'node:assert/strict';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {readIds,decodeIdsBytes,IDS_MAX_BYTES} from '../web/ids-document.js';

const NS='http://standards.buildingsmart.org/IDS';
const source=body=>`<?xml version="1.0" encoding="UTF-8"?><ids xmlns="${NS}" xmlns:xs="http://www.w3.org/2001/XMLSchema"><info><title>Generic import</title></info><specifications><specification name="All facets" ifcVersion="IFC4"><applicability minOccurs="0" maxOccurs="unbounded"><entity><name><xs:restriction base="xs:string"><xs:enumeration value="IFCWALL"/><xs:enumeration value="IFCWINDOW"/></xs:restriction></name></entity><classification><system><simpleValue>Example system</simpleValue></system><value><xs:restriction base="xs:string"><xs:pattern value="A.*"/></xs:restriction></value></classification></applicability><requirements>${body}</requirements></specification></specifications></ids>`;
const parse=xml=>readIds(xml,{fileName:'generated.ids',DOMParser,XMLSerializer});

test('Generic reading retains conditions, all six facets and exact scalar values independently of export',async()=>{
 const xml=source(`<entity><name><simpleValue>IFCWALL</simpleValue></name></entity><attribute><name><simpleValue>Name</simpleValue></name><value><simpleValue> Ä exact </simpleValue></value></attribute><classification><system><simpleValue>Example system</simpleValue></system></classification><property dataType="IFCLABEL"><propertySet><simpleValue>Example_Set</simpleValue></propertySet><baseName><simpleValue>Code </simpleValue></baseName><value><xs:restriction base="xs:string"><xs:enumeration value="A"/><xs:enumeration value="B"/></xs:restriction></value></property><material cardinality="optional"><value><simpleValue>Wood</simpleValue></value></material><partOf relation="IFCRELAGGREGATES"><entity><name><simpleValue>IFCBUILDING</simpleValue></name></entity></partOf>`);
 const doc=await parse(xml);assert.equal(doc.documentSchema,2);assert.equal(doc.xml,xml);
 const spec=doc.specifications[0];assert.equal(spec.applicability.length,2);assert.equal(spec.requirements.length,6);
 assert.deepEqual(spec.requirements.map(r=>r.kind),['entity','attribute','classification','property','material','partOf']);
 assert.equal(spec.requirements[1].parameters.value.value,' Ä exact ');
 assert.equal(spec.requirements[3].parameters.baseName.value,'Code ');
 assert.equal(spec.requirements[5].parameters.entity.parameters.name.value,'IFCBUILDING');
 assert.deepEqual(spec.applicability[0].parameters.name.facets.map(f=>f.value),['IFCWALL','IFCWINDOW']);
});

test('Namespace prefixes do not change meaning and metadata version is not the IDS format version',async()=>{
 const xml=`<i:ids xmlns:i="${NS}"><i:info><i:title> Prefix title </i:title><i:version>0.9.7 business revision</i:version><i:description>Exact description</i:description></i:info><i:specifications><i:specification name="Prefixed" identifier="stable-id" ifcVersion="IFC4 IFC4X3_ADD2"><i:applicability/><i:requirements><i:attribute><i:name><i:simpleValue>Name</i:simpleValue></i:name><i:value><i:simpleValue>A&#x9;B</i:simpleValue></i:value></i:attribute></i:requirements></i:specification></i:specifications></i:ids>`;
 const doc=await parse(xml);assert.equal(doc.format.profile,'ids-1.0');assert.equal(doc.format.mappingAllowed,true);
 assert.equal(doc.title,' Prefix title ');assert.equal(doc.info.version,'0.9.7 business revision');
 assert.deepEqual(doc.specifications[0].ifcVersions,['IFC4','IFC4X3_ADD2']);
 assert.equal(doc.specifications[0].identifier,'stable-id');assert.equal(doc.specifications[0].requirements[0].parameters.value.value,'A\tB');
});

test('Schema locations remain non-fetched hints; missing, relative and local hints can be read',async()=>{
 for(const location of ['',NS+' ./ids.xsd',NS+' file:///local/schema/ids.xsd',NS+' https://example.invalid/schema.xsd',NS+' '+NS+'/1.0/ids.xsd']){
  const xml=source('').replace('<ids xmlns=',`<ids xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"${location?` xsi:schemaLocation="${location}"`:''} xmlns=`);
  const doc=await parse(xml);assert.equal(doc.format.mappingAllowed,true);assert.equal(doc.format.profile,'ids-1.0');assert(doc.warnings.length);
  assert.equal(doc.format.schemaLocations.length,location?1:0);
 }
});

test('Explicit historical and future hints are readable without claiming conversion or mapping support',async()=>{
 for(const [version,profile] of [['0.9.6','ids-legacy'],['0.9.7','ids-legacy'],['1.1','ids-future'],['2.0','ids-future']]){
  const xml=source('<material/>').replace('<ids xmlns=',`<ids xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="${NS} ${NS}/${version}/ids.xsd" xmlns=`);
  const doc=await parse(xml);assert.equal(doc.format.profile,profile);assert.equal(doc.format.mappingAllowed,false);
  assert.equal(doc.specifications[0].requirements[0].kind,'material');assert(doc.warnings.some(w=>w.includes(version)));
 }
});

test('All restriction operators and unknown extensions remain inspectable without being executed',async()=>{
 const xml=source(`<property dataType="IFCREAL" uri="urn:source" instructions="Keep this"><propertySet><simpleValue>Example_Set</simpleValue></propertySet><baseName><simpleValue>Value</simpleValue></baseName><value><xs:restriction base="xs:double"><xs:annotation><xs:documentation>Exact source note</xs:documentation></xs:annotation><xs:minInclusive value="1.5"/><xs:maxExclusive value="9"/><xs:totalDigits value="3"/><xs:fractionDigits value="1"/><xs:pattern value="[0-9].*"/></xs:restriction></value><extension xmlns="urn:extension" custom="unchanged">retained</extension></property><customFacet xmlns="urn:extension"><value>opaque</value></customFacet>`);
 const doc=await parse(xml),req=doc.specifications[0].requirements[0],restriction=req.parameters.value;
 assert.equal(req.attributes.instructions,'Keep this');assert.equal(req.attributes.uri,'urn:source');
 assert.equal(restriction.base,'xs:double');assert.equal(restriction.baseNamespace,'http://www.w3.org/2001/XMLSchema');
 assert.deepEqual(restriction.facets.map(f=>[f.kind,f.value]),[['minInclusive','1.5'],['maxExclusive','9'],['totalDigits','3'],['fractionDigits','1'],['pattern','[0-9].*']]);
 assert.equal(restriction.annotations[0].text,'Exact source note');assert.equal(req.unknown[0].attributes.custom,'unchanged');
 assert.equal(doc.specifications[0].requirements[1].kind,'unknown');assert.equal(doc.specifications[0].requirements[1].sourceKind,'customFacet');assert(doc.warnings.some(w=>w.includes('Onbekend')));
});

test('Ambiguous values and duplicate parameters are preserved without choosing a first value',async()=>{
 const doc=await parse(source('<property><propertySet><simpleValue>A</simpleValue></propertySet><propertySet><simpleValue>B</simpleValue></propertySet><baseName><simpleValue>One</simpleValue><simpleValue>Two</simpleValue></baseName></property>'));
 const req=doc.specifications[0].requirements[0];assert.equal(req.parameters.propertySet.kind,'ambiguous');
 assert.deepEqual(req.parameters.propertySet.values.map(x=>x.value),['A','B']);
 assert.equal(req.parameters.baseName.kind,'ambiguous');assert.deepEqual(req.parameters.baseName.values.map(x=>x.value),['One','Two']);
});

test('Parameter wrapper attributes remain distinct from literal and restriction attributes in every value form',async()=>{
 const doc=await parse(source('<property><propertySet custom="wrapper"><simpleValue custom="literal">Set</simpleValue></propertySet><baseName custom="ambiguous"><simpleValue>A</simpleValue><simpleValue>B</simpleValue></baseName><value custom="restriction"><xs:restriction base="xs:string"><xs:enumeration value="A"/></xs:restriction></value></property><material><value custom="unknown"/></material><attribute><name custom="first"><simpleValue>A</simpleValue></name><name custom="second"><simpleValue>B</simpleValue></name></attribute>'));
 const [property,material,attribute]=doc.specifications[0].requirements;
 assert.deepEqual(property.parameters.propertySet.wrapperAttributes,{custom:'wrapper'});
 assert.deepEqual(property.parameters.propertySet.attributes,{custom:'literal'});
 assert.deepEqual(property.parameters.baseName.wrapperAttributes,{custom:'ambiguous'});
 assert.deepEqual(property.parameters.value.wrapperAttributes,{custom:'restriction'});
 assert.deepEqual(material.parameters.value.wrapperAttributes,{custom:'unknown'});
 assert.deepEqual(attribute.parameters.name.values.map(v=>v.wrapperAttributes),[{custom:'first'},{custom:'second'}]);
 assert.deepEqual(doc.specifications[0].applicability[0].parameters.name.wrapperAttributes,{});
});

test('Unknown XSD restriction operators are retained with an explicit warning',async()=>{
 const doc=await parse(source('<material><value><xs:restriction base="xs:string"><xs:unknownOperator value="unchanged"/></xs:restriction></value></material>'));
 const restriction=doc.specifications[0].requirements[0].parameters.value;
 assert.equal(restriction.facets[0].kind,'unknownOperator');assert.equal(restriction.facets[0].value,'unchanged');
 assert(doc.warnings.some(w=>w.includes('Onbekende restrictie-inhoud')));
});

test('Required document-structure ambiguity disables mapping while retaining readable evidence',async()=>{
 const xml=source('<material/>').replace('</info>','</info><info><title>Second title</title></info>');
 const doc=await parse(xml);assert.equal(doc.format.mappingAllowed,false);assert.equal(doc.infoEntries.filter(x=>x.name==='title').length,2);
 assert.equal(doc.specifications[0].requirements.length,1);
 const duplicateApp=await parse(source('<material/>').replace('<requirements>','<applicability/><requirements>'));
 assert.equal(duplicateApp.format.mappingAllowed,false);assert.equal(duplicateApp.specifications[0].requirements.length,1);
});

test('Malformed XML, wrong roots and DTD/entities are rejected rather than repaired',async()=>{
 for(const xml of [source('<material/>').replace('</requirements>','</requirement>'),'<ids','<ids xmlns="urn:other"/>','<!DOCTYPE ids [<!ENTITY x "bad">]>'+source(''),source('<material/>').replace('name="All facets"','name=unquoted')])await assert.rejects(parse(xml),/XML|namespace|DTD|IDS/);
});

test('DTD-like text inside XML comments or CDATA is harmless source content',async()=>{
 const xml=source('<material><value><simpleValue><![CDATA[<!DOCTYPE literal> & <!ENTITY literal>]]></simpleValue></value></material>').replace('<info>','<!-- <!DOCTYPE example> --><?example <!DOCTYPE literal> ?><info>');
 const doc=await parse(xml);assert.equal(doc.xml,xml);
 assert.equal(doc.specifications[0].requirements[0].parameters.value.value,'<!DOCTYPE literal> & <!ENTITY literal>');
});

test('Document and decoded-text resource bounds are explicit',async()=>{
 await assert.rejects(parse('x'.repeat(IDS_MAX_BYTES+1)),/10 MiB/);
 await assert.rejects(parse(source('<unknown>'.repeat(70)+'</unknown>'.repeat(70))),/64 nestniveaus/);
 const spec='<specification name="s" ifcVersion="IFC4"><applicability/></specification>';
 await assert.rejects(parse(`<ids xmlns="${NS}"><info><title>Resource</title></info><specifications>${spec.repeat(5001)}</specifications></ids>`),/5.000 specificaties/);
});

test('UTF-8 BOM and no-BOM decode to one document identity while original bytes remain distinguishable',async()=>{
 const xml=source('<material><value><simpleValue>één &amp; twee</simpleValue></value></material>'),plain=new TextEncoder().encode(xml),bom=new Uint8Array(plain.length+3);bom.set([0xef,0xbb,0xbf]);bom.set(plain,3);
 const a=await decodeIdsBytes(plain),b=await decodeIdsBytes(bom);
 assert.equal(a.xml,xml);assert.equal(b.xml,xml);assert.equal(a.encoding,'utf-8');assert.notEqual(a.byteDigest,b.byteDigest);
 const da=await readIds(a.xml,{fileName:'bytes.ids',DOMParser,XMLSerializer,sourceEncoding:a.encoding,sourceByteDigest:a.byteDigest}),db=await parse(b.xml);
 assert.equal(da.id,db.id);assert.equal(da.sourceEncoding,'utf-8');assert.equal(da.sourceByteDigest,a.byteDigest);
 assert.equal(da.specifications[0].requirements[0].parameters.value.value,'één & twee');
});

function utf16(text,endian,bom){
 const le=Buffer.from(text,'utf16le');const bytes=new Uint8Array(le.length+(bom?2:0));
 if(bom)bytes.set(endian==='le'?[0xff,0xfe]:[0xfe,0xff]);
 for(let i=0;i<le.length;i+=2){bytes[(bom?2:0)+i]=le[i+(endian==='be'?1:0)];bytes[(bom?2:0)+i+1]=le[i+(endian==='be'?0:1)];}
 return bytes;
}

test('UTF-16 LE/BE with BOM or byte patterns preserve non-ASCII, surrogate pairs and XML entities',async()=>{
 const xml=source('<material><value><simpleValue>één 😀 &amp; twee</simpleValue></value></material>').replace('encoding="UTF-8"','encoding="UTF-16"');
 for(const endian of ['le','be'])for(const bom of [false,true]){
  const decoded=await decodeIdsBytes(utf16(xml,endian,bom));assert.equal(decoded.encoding,'utf-16'+endian);assert.equal(decoded.xml,xml);
  const doc=await parse(decoded.xml);assert.equal(doc.specifications[0].requirements[0].parameters.value.value,'één 😀 & twee');
 }
});

test('Declared browser-supported legacy encodings are decoded explicitly',async()=>{
 const xml=source('<material><value><simpleValue>café</simpleValue></value></material>').replace('encoding="UTF-8"','encoding="windows-1252"');
 const decoded=await decodeIdsBytes(Buffer.from(xml,'latin1'));assert.equal(decoded.encoding,'windows-1252');assert.equal(decoded.xml,xml);
});

test('An encoding declaration beyond the initial header sample is still honoured',async()=>{
 const xml=source('<material><value><simpleValue>café</simpleValue></value></material>').replace('encoding="UTF-8"',' '.repeat(600)+'encoding="windows-1252"');
 const decoded=await decodeIdsBytes(Buffer.from(xml,'latin1'));assert.equal(decoded.encoding,'windows-1252');assert.equal(decoded.xml,xml);
});

test('Invalid bytes, unsupported encodings and contradictory BOM declarations produce actionable errors',async()=>{
 await assert.rejects(decodeIdsBytes(new Uint8Array([0xc3,0x28])),/ongeldige bytes/);
 await assert.rejects(decodeIdsBytes(new Uint8Array([0xef,0xbb,0xbf,0xc3,0x28])),/ongeldige bytes/);
 await assert.rejects(decodeIdsBytes(new TextEncoder().encode(source('').replace('UTF-8','X-NOT-A-CODEC'))),/Niet ondersteunde XML-tekencodering/);
 await assert.rejects(decodeIdsBytes(utf16(source(''),'le',true)),/BOM of bytevolgorde/);
 await assert.rejects(decodeIdsBytes(new TextEncoder().encode(source('').replace('UTF-8','UTF-16'))),/geen UTF-16/);
 await assert.rejects(decodeIdsBytes(new Uint8Array([0xff,0xfe,0,0])),/UTF-32/);
});

test('Header sampling does not reject a valid multibyte character crossing its byte boundary',async()=>{
 const declaration='<?xml version="1.0" encoding="UTF-8"?>';
 const xml=declaration+' '.repeat(510-declaration.length)+'é'+source('').replace(/^<\?xml[^?]*\?>/,'');
 const body=new TextEncoder().encode(xml),bytes=new Uint8Array(body.length+3);bytes.set([0xef,0xbb,0xbf]);bytes.set(body,3);
 assert.equal((await decodeIdsBytes(bytes)).xml,xml);
});
