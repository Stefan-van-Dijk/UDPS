import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {planIdsImport,applyIdsImport,readIds,validateIdsImports,mappingProposals,saveIdsSource,IDS_MAX_BYTES,IDS_PROJECT_MAX_BYTES} from '../web/ids.js';
import {validate,generate} from '../web/core.js';
import {initIdsUI} from '../web/ids-ui.js';

const headers=['Y/N','Revit_parameter','IFC_parameter','Export_tabblad','Data_type'];
const empty=()=>validate({headers,rows:[]});
const catalog={ifc:{items:[{kind:'class',code:'IfcWall'},{kind:'class',code:'IfcWindow'},{kind:'class',code:'IfcDoor'}]}};
const requirement=(extra={})=>({id:'spec:0/requirement:0',kind:'property',propertySet:'Foo_Bar',property:'Foo',ifcDataType:'IFCLABEL',dataType:'Label',entity:'IfcWall',cardinality:'required',eligible:true,reasons:[],...extra});
const document=(requirements=[requirement()])=>({schema:1,id:'sha256:'+'a'.repeat(64),fileName:'example.ids',title:'Official example',xml:'<ids>retained original input</ids>',specifications:[{id:'spec:0',name:'Example',ifcVersions:['IFC2X3','IFC4'],reasons:[],minOccurs:'1',maxOccurs:'unbounded',applicabilityXml:'<applicability/>',requirements}]});

test('IDS mapping stays pending, retains complete source once and survives JSON project roundtrip',()=>{
 const data=empty(),preview=document();
 const result=applyIdsImport(data,catalog,preview,['spec:0/requirement:0']);
 assert.equal(result.added,1);assert.equal(data.rows[0].Mapping_pending,'x');
 assert.equal(data.rows[0].IfcWall,'x');assert.equal(data.rows[0].IFC_parameter,'Foo');assert.equal(data.rows[0].Data_type,'Label');
 assert.equal(data.rows[0].Source_uri,undefined);assert.equal(data.rows[0].Mapping_origin,'ids');
 assert.equal(data.idsImports[0].xml,preview.xml);assert(generate(data).errors.some(e=>e.includes('nog koppelen')));
 const saved=validate(JSON.parse(JSON.stringify(data)));assert.deepEqual(saved.idsImports,data.idsImports);
 assert.deepEqual(JSON.parse(saved.rows[0].IDS_requirements),[{documentId:preview.id,requirementId:'spec:0/requirement:0',specificationId:'spec:0'}]);
 saved.rows[0].Revit_parameter='QA_Foo';saved.rows[0].Mapping_pending='';assert.equal(generate(saved).errors.length,0);
});

test('Repeated IDS requirements preserve existing Revit names without duplicating rows or provenance',()=>{
 const data=empty(),preview=document();applyIdsImport(data,catalog,preview,['spec:0/requirement:0']);
 data.rows[0].Revit_parameter='Existing_Revit';data.rows[0].Mapping_pending='';
 const result=applyIdsImport(data,catalog,preview,['spec:0/requirement:0']);
 assert.equal(result.added,0);assert.equal(result.skipped,1);assert.equal(data.rows.length,1);assert.equal(data.rows[0].Revit_parameter,'Existing_Revit');
 assert.equal(data.idsImports.length,1);assert.equal(JSON.parse(data.rows[0].IDS_requirements).length,1);
});

test('A conflicting datatype rejects the entire import and preserves original project',()=>{
 const data=empty();data.headers.push('IfcWall');data.rows.push({'Y/N':'x',Revit_parameter:'Keep',IFC_parameter:'Foo',Export_tabblad:'Foo_Bar',Data_type:'Text',IfcWall:'x'});
 const before=structuredClone(data),preview=document([requirement({id:'spec:0/requirement:1',property:'New'}),requirement()]);
 assert.throws(()=>applyIdsImport(data,catalog,preview,['spec:0/requirement:1','spec:0/requirement:0']),/datatype/i);assert.deepEqual(data,before);
});

test('Excluded requirements and fabricated unknown entities cannot be selected',()=>{
 const data=empty(),before=structuredClone(data);
 assert.throws(()=>planIdsImport(data,catalog,document([requirement({eligible:false,reasons:['Voorwaardelijke toepassing']})]),['spec:0/requirement:0']),/Voorwaardelijke/);
 assert.throws(()=>planIdsImport(data,catalog,document([requirement({entity:'IfcMadeUp'})]),['spec:0/requirement:0']),/IFC/);
 assert.deepEqual(data,before);
});

test('Only selected supported requirements are imported; full source retains excluded criteria',()=>{
 const preview=document([requirement(),requirement({id:'spec:0/requirement:1',eligible:false,reasons:['Optional'],cardinality:'optional'})]);
 const result=planIdsImport(empty(),catalog,preview,['spec:0/requirement:0']);
 assert.equal(result.added,1);assert.deepEqual(result.project.idsImports[0].selectedRequirementIds,['spec:0/requirement:0']);assert.equal(result.project.idsImports[0].xml,preview.xml);
});

test('Saved IDS documents are bounded and cannot replace another source with the same identity',()=>{
 assert.throws(()=>validateIdsImports([{schema:1,id:'bad',fileName:'a.ids',xml:'x',selectedRequirementIds:[]}]),/IDS/);
 const data=empty(),preview=document();applyIdsImport(data,catalog,preview,['spec:0/requirement:0']);
 const before=structuredClone(data);assert.throws(()=>applyIdsImport(data,catalog,{...preview,xml:'different'},['spec:0/requirement:0']),/inhoud/);assert.deepEqual(data,before);
});

test('XML boundary rejects DTD/entities and oversized input before requiring a parser',async()=>{
 await assert.rejects(readIds('<!DOCTYPE ids [<!ENTITY x "bad">]><ids/>',{DOMParser:null}),/DTD|entiteiten/);
 await assert.rejects(readIds('x'.repeat(IDS_MAX_BYTES+1),{DOMParser:null}),/10 MiB/);
 await assert.rejects(readIds('<ids/>',{DOMParser:null}),/XML-parser/);
});

const NS='http://standards.buildingsmart.org/IDS';
const xmlText=value=>String(value).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const value=(name,text)=>'<'+name+'><simpleValue>'+xmlText(text)+'</simpleValue></'+name+'>';
const propertyXml=({propertySet='Foo_Bar',property='Foo',dataType='IFCLABEL',extra='',cardinality='required'}={})=>'<property'+(dataType?' dataType="'+dataType+'"':'')+' cardinality="'+cardinality+'">'+value('propertySet',propertySet)+value('baseName',property)+extra+'</property>';
const xmlDocument=({entity='IFCWALL',appExtra='',requirements=propertyXml(),hint='',version='',appXml}={})=>'<ids xmlns="'+NS+'" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"'+(hint?' xsi:schemaLocation="'+NS+' '+hint+'"':'')+'><info><title>Generic test</title>'+(version?'<version>'+version+'</version>':'')+'</info><specifications><specification name="Synthetic" ifcVersion="IFC4"><applicability minOccurs="1" maxOccurs="unbounded">'+(appXml??'<entity>'+value('name',entity)+'</entity>'+appExtra)+'</applicability><requirements>'+requirements+'</requirements></specification></specifications></ids>';
const parse=xml=>readIds(xml,{DOMParser,XMLSerializer});

test('IDS literals retain exact xs:string identities and unsafe identities disable proposals',async()=>{
 for(const [key,text] of [['propertySet',' Foo_Bar'],['propertySet','Foo_Bar '],['property',' Foo'],['property','Foo '],['property','Foo\tBar']]){
  const xml=xmlDocument({requirements:propertyXml({[key]:text})}),preview=await parse(xml),r=preview.specifications[0].requirements[0];
  assert.equal(r.parameters[key==='property'?'baseName':key].value,text);
  assert.equal(mappingProposals(preview,catalog)[0].eligible,false);assert.equal(preview.xml,xml);
 }
 const preview=await parse(xmlDocument({entity:' IFCWALL '}));
 assert.equal(mappingProposals(preview,catalog)[0].eligible,false,'Boundary spaces cannot turn a source entity into a known identity');
});

test('IDS planning atomically rejects names with boundary whitespace, including an otherwise valid first selection',()=>{
 for(const extra of [{propertySet:' Foo_Bar'},{propertySet:'Foo_Bar '},{property:' Foo'},{property:'Foo '},{property:'Foo\u0001Bar'}]){
  const data=empty(),before=structuredClone(data),preview=document([requirement({id:'spec:0/requirement:1',property:'Valid'}),requirement(extra)]);
  assert.throws(()=>applyIdsImport(data,catalog,preview,['spec:0/requirement:1','spec:0/requirement:0']),/eigenschapsnaam/);assert.deepEqual(data,before);
 }
});

// Controlled DOM adapter exercises legacy API handlers, not native browser/parser behavior.
function ui(t,read=async()=>document()){
 const before=globalThis.document,ids=[...readFileSync(new URL('../web/index.html',import.meta.url),'utf8').matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
 ids.push('idsEntityChoices','idsEntitySearch');
 const elements=Object.fromEntries(ids.map(id=>[id,{id,value:'',textContent:'',innerHTML:'',disabled:false,hidden:false,open:false,classList:{toggle(){}},addEventListener(){},showModal(){this.open=true;},close(){this.open=false;},click(){}}]));
 globalThis.document={getElementById:id=>{assert(elements[id],id);return elements[id];}};t.after(()=>{globalThis.document=before;});
 let data=empty(),changes=0;const notices=[];
 initIdsUI({data:()=>data,catalog:()=>catalog,changed(){changes++;},notice:s=>notices.push(s)},{readIds:read,applyIdsImport,auditIdsDocument:async()=>({status:'valid',issues:[],complete:false})});
 return {e:elements,get data(){return data;},set data(value){data=value;},get changes(){return changes;},notices};
}
test('IDS handler previews partial input, requires mutation review and preserves source after save/reopen',async t=>{
 const s=ui(t,async()=>document([requirement(),requirement({id:'spec:0/requirement:1',eligible:false,cardinality:'optional',reasons:['Optionele property'],xml:'<property/>'})]));
 s.e.importIds.onclick();assert.equal(s.e.idsDialog.open,true);assert.equal(s.e.idsAdd.disabled,true);
 await s.e.idsFile.onchange({target:{files:[{name:'test.ids',size:100,text:async()=>'<ids/>'}],value:'test.ids'}});
 assert.match(s.e.idsSummary.textContent,/2 eisen · 1 parameterdefinities · 1 bruikbare eisen/);assert.match(s.e.idsDetail.innerHTML,/Optionele property|optionele eigenschap/);
 s.e.idsSelectAll.onclick();assert.match(s.e.idsSummary.textContent,/1 geselecteerd/);assert.equal(s.e.idsAdd.disabled,true);
 s.e.idsReview.onclick();assert.equal(s.e.idsAdd.disabled,false);s.e.idsAdd.onclick();
 assert.equal(s.data.rows.length,1);assert.equal(s.changes,1);assert.equal(s.e.idsDialog.open,false);
 s.data=validate(JSON.parse(JSON.stringify(s.data)));s.e.importIds.onclick();assert.match(s.e.idsSaved.innerHTML,/example.ids/);
 s.e.idsSaved.value=s.data.idsImports[0].id;s.e.idsSaved.onchange();assert.equal(s.e.idsOpenSaved.disabled,false);await s.e.idsOpenSaved.onclick();assert.match(s.e.idsSummary.textContent,/specificaties/);
});
test('IDS handler rejects a late legacy parse after closing the dialog',async t=>{
 let resolve;const pending=new Promise(r=>resolve=r),s=ui(t,()=>pending);
 s.e.importIds.onclick();const load=s.e.idsFile.onchange({target:{files:[{name:'test.ids',size:100,text:async()=>'<ids/>'}],value:'test.ids'}});
 await new Promise(r=>setImmediate(r));s.e.closeIds.onclick();s.e.importIds.onclick();resolve(document());await load;
 assert.equal(s.e.idsAdd.disabled,true);assert.equal(s.e.idsRequirements.innerHTML,'');assert.equal(s.data.rows.length,0);
});
test('IDS handler clears old selection and mutation review when a replacement source fails',async t=>{
 let calls=0;const s=ui(t,async()=>{if(calls++)throw Error('Malformed XML');return document();});
 s.e.importIds.onclick();const event=()=>({target:{files:[{name:'test.ids',size:100,text:async()=>'<ids/>'}],value:'test.ids'}});
 await s.e.idsFile.onchange(event());s.e.idsSelectAll.onclick();s.e.idsReview.onclick();assert.equal(s.e.idsAdd.disabled,false);
 await s.e.idsFile.onchange(event());assert.equal(s.e.idsAdd.disabled,true);assert.equal(s.e.idsRequirements.innerHTML,'');assert.equal(s.e.idsChanges.innerHTML,'');assert.match(s.e.idsError.textContent,/Malformed/);assert.equal(s.data.rows.length,0);
});

const enumeration=(name,names)=>'<'+name+'><xs:restriction base="xs:string">'+names.map(v=>'<xs:enumeration value="'+v+'"/>').join('')+'</xs:restriction></'+name+'>';
const firstId='spec:0/requirement:0';

test('Namespace and schema-location hints do not decide valid IDS 1.0 parameter identity',async()=>{
 for(const hint of ['', './ids.xsd','file:///local/ids.xsd','https://standards.buildingsmart.org/IDS/1.0/ids.xsd']){
  const source=xmlDocument({hint,version:'Release 2026.11'}),preview=await parse(source),proposal=mappingProposals(preview,catalog)[0];
  assert.equal(proposal.eligible,true,hint||'omitted hint');assert.equal(proposal.direct,true);assert.equal(preview.info.version,'Release 2026.11');
 }
});

test('Finite entity enumeration imports every exact target and merges repeated requirement provenance',async()=>{
 const appXml='<entity>'+enumeration('name',['IFCWALL','IFCDOOR'])+'</entity>';
 const preview=await parse(xmlDocument({appXml,requirements:propertyXml()+propertyXml()}));
 const proposals=mappingProposals(preview,catalog);assert.deepEqual(proposals[0].entities,['IfcWall','IfcDoor']);assert(proposals.every(p=>p.eligible));
 const data=empty(),ids=proposals.map(p=>p.id),result=applyIdsImport(data,catalog,preview,ids);
 assert.equal(result.added,2);assert.equal(result.skipped,2);assert.equal(data.rows.length,2);
 for(const row of data.rows){const refs=JSON.parse(row.IDS_requirements);assert.equal(refs.length,2);assert.deepEqual(refs[0].appliedTargets.entities,['IfcWall','IfcDoor']);row.Revit_parameter='Existing';}
 const again=applyIdsImport(data,catalog,preview,ids);assert.equal(again.added,0);assert.equal(again.skipped,4);
 assert(data.rows.every(r=>r.Revit_parameter==='Existing'&&JSON.parse(r.IDS_requirements).length===2));
});

test('Unknown entity enumeration members cannot be silently discarded',async()=>{
 const preview=await parse(xmlDocument({appXml:'<entity>'+enumeration('name',['IFCWALL','IFCUNKNOWN'])+'</entity>'}));
 assert.equal(mappingProposals(preview,catalog)[0].eligible,false);assert.deepEqual(mappingProposals(preview,catalog)[0].entities,[]);
 assert.equal(mappingProposals(preview,catalog,{[firstId]:{entities:['IfcWall']}})[0].eligible,false);
 const choices={[firstId]:{entities:['IfcWall'],acknowledgeScope:true}},result=planIdsImport(empty(),catalog,preview,[firstId],choices);
 assert.equal(result.added,1);assert.deepEqual(result.project.idsImports[0].decisions,choices);
 assert.deepEqual(JSON.parse(result.project.rows[0].IDS_requirements)[0].decisions,choices[firstId]);
});

test('Conditional applicability, values and optional properties require separate explicit choices',async()=>{
 const appExtra='<classification>'+value('system','NL-SfB')+value('value','21')+'</classification>';
 const preview=await parse(xmlDocument({appExtra,requirements:propertyXml({cardinality:'optional',extra:value('value','EI60')})}));
 let p=mappingProposals(preview,catalog)[0];assert.equal(p.eligible,false);assert.equal(p.conditions.conditional,true);assert.equal(p.values.constrained,true);
 const scopeOnly={[firstId]:{acknowledgeScope:true}};assert.equal(mappingProposals(preview,catalog,scopeOnly)[0].eligible,false);
 const choices={[firstId]:{acknowledgeScope:true,acknowledgeValues:true,includeOptional:true}},result=planIdsImport(empty(),catalog,preview,[firstId],choices);
 assert.equal(result.added,1);const ref=JSON.parse(result.project.rows[0].IDS_requirements)[0];
 assert.deepEqual(ref.decisions,choices[firstId]);assert.equal(ref.conditions.conditional,true);assert.equal(ref.values.constrained,true);
 assert.equal(ref.conditions.applicabilityIds.length,2);assert.equal(result.project.idsImports[0].xml,preview.xml);
 const restored=validate(JSON.parse(JSON.stringify(result.project)));assert.deepEqual(restored.idsImports[0].decisions,choices);
});

test('No entity applicability remains readable and needs an explicit target and scope choice',async()=>{
 const preview=await parse(xmlDocument({appXml:'<material>'+value('value','Wood')+'</material>'}));
 assert.equal(mappingProposals(preview,catalog)[0].eligible,false);
 const decisions={[firstId]:{entities:['IfcWindow','IfcDoor'],acknowledgeScope:true}};
 assert.equal(planIdsImport(empty(),catalog,preview,[firstId],decisions).added,2);
});

test('Name alternatives and patterns stay symbolic until one concrete name is chosen',async()=>{
 for(const nameRestriction of [enumeration('baseName',['Alpha','Beta']),'<baseName><xs:restriction base="xs:string"><xs:pattern value="A.*"/></xs:restriction></baseName>']){
  const req='<property dataType="IFCLABEL">'+enumeration('propertySet',['Pset_A','Pset_B'])+nameRestriction+'</property>',preview=await parse(xmlDocument({requirements:req}));
  const p=mappingProposals(preview,catalog)[0];assert.equal(p.eligible,false);assert.equal(p.property,'');assert.equal(p.propertySet,'');
  const decisions={[firstId]:{propertySet:'Pset_A',property:'Alpha'}},result=planIdsImport(empty(),catalog,preview,[firstId],decisions);
  assert.equal(result.added,1,'Alternatives must not turn into a required Cartesian product');assert.equal(result.project.rows[0].IFC_parameter,'Alpha');
  assert.deepEqual(JSON.parse(result.project.rows[0].IDS_requirements)[0].decisions,decisions[firstId]);
 }
});

test('Missing datatype is never guessed and unsafe original names require exact saved overrides',async()=>{
 const preview=await parse(xmlDocument({requirements:propertyXml({dataType:'',propertySet:' Pset_A ',property:' Alpha '})}));
 const initial=mappingProposals(preview,catalog)[0];assert.equal(initial.dataType,'');assert.equal(initial.eligible,false);
 const decisions={[firstId]:{propertySet:'Pset_A',property:'Alpha',dataType:'Text'}},result=planIdsImport(empty(),catalog,preview,[firstId],decisions);
 assert.equal(result.project.rows[0].Data_type,'Text');assert.equal(result.project.idsImports[0].xml,preview.xml);assert.deepEqual(result.project.idsImports[0].decisions,decisions);
 const draft=mappingProposals(preview,catalog,{[firstId]:{propertySet:'',property:'\t',dataType:''}})[0];assert.equal(draft.eligible,false);
});

test('Prohibited requirements and specifications cannot become positive mappings after acknowledgements',async()=>{
 const decisions={[firstId]:{acknowledgeScope:true,acknowledgeValues:true,includeOptional:true,entities:['IfcWall'],propertySet:'Pset_A',property:'A',dataType:'Text'}};
 for(const xml of [xmlDocument({requirements:propertyXml({cardinality:'prohibited'})}),xmlDocument().replace('minOccurs="1" maxOccurs="unbounded"','minOccurs="0" maxOccurs="0"')]){
  const preview=await parse(xml);assert.equal(mappingProposals(preview,catalog,decisions)[0].eligible,false);assert.throws(()=>planIdsImport(empty(),catalog,preview,[firstId],decisions),/verbiedt|Verboden/);
 }
 const nonstandard=await parse(xmlDocument().replace('minOccurs="1" maxOccurs="unbounded"','minOccurs="2" maxOccurs="3"'));
 assert.equal(mappingProposals(nonstandard,catalog,decisions)[0].eligible,false);
});

test('Full source-only retention preserves all facet kinds, encoding identity and legacy documents',async()=>{
 const requirements='<entity>'+value('name','IFCWALL')+'</entity><attribute>'+value('name','Name')+'</attribute><classification>'+value('system','Uniclass')+'</classification><material/>'+'<partOf><entity>'+value('name','IFCBUILDING')+'</entity></partOf>';
 const source=xmlDocument({requirements,hint:'https://standards.buildingsmart.org/IDS/0.9.7/ids.xsd'}),preview=await readIds(source,{DOMParser,XMLSerializer,sourceEncoding:'utf-16le',sourceByteDigest:'sha256:'+'f'.repeat(64)});
 const data=empty(),beforeRows=structuredClone(data.rows);assert.equal(preview.format.mappingAllowed,false);assert(mappingProposals(preview,catalog).every(p=>!p.eligible));
 assert.equal(saveIdsSource(data,preview).saved,true);assert.equal(saveIdsSource(data,preview).saved,false);
 assert.deepEqual(data.rows,beforeRows);assert.equal(data.idsImports.length,1);assert.equal(data.idsImports[0].sourceEncoding,'utf-16le');assert.equal(data.idsImports[0].sourceByteDigest,preview.sourceByteDigest);assert.deepEqual(data.idsImports[0].selectedRequirementIds,[]);
 assert.deepEqual(validate(JSON.parse(JSON.stringify(data))).idsImports,data.idsImports);
});

test('Stored-source limits measure JSON bytes and retain more than the former 2000 requirement references',()=>{
 const ids=Array.from({length:50000},(_,i)=>'spec:0/requirement:'+i),record={...document(),selectedRequirementIds:ids};
 assert.equal(validateIdsImports([record])[0].selectedRequirementIds.length,50000);
 assert.throws(()=>validateIdsImports([{...record,selectedRequirementIds:[...ids,'spec:0/requirement:50000']}]),/IDS/);
 assert.equal(validateIdsImports([{...record,xml:'x'.repeat(3*1024*1024),selectedRequirementIds:[]}])[0].xml.length,3*1024*1024);
 assert.throws(()=>validateIdsImports([{...record,xml:'"'.repeat(9*1024*1024),selectedRequirementIds:[]}]),/16 MB/);
});

test('Expanded enum imports and oversized provenance reject atomically',async()=>{
 const data=empty();data.headers.push('IfcDoor');data.rows.push({'Y/N':'x',Revit_parameter:'Keep',IFC_parameter:'Foo',Export_tabblad:'Foo_Bar',Data_type:'Text',IfcDoor:'x'});
 const preview=await parse(xmlDocument({appXml:'<entity>'+enumeration('name',['IFCWALL','IFCDOOR'])+'</entity>'})),before=structuredClone(data);
 assert.throws(()=>applyIdsImport(data,catalog,preview,[firstId]),/datatype/);assert.deepEqual(data,before);
 const refs=Array.from({length:6},(_,i)=>({documentId:preview.id,requirementId:'spec:0/requirement:'+i,specificationId:'spec:0'}));
 const full=empty();full.headers.push('IDS_requirements');full.rows=Array.from({length:8400},()=>Object.fromEntries(full.headers.map(k=>[k,k==='IDS_requirements'?JSON.stringify(refs):''])));
 const snapshot=structuredClone(full);assert.throws(()=>applyIdsImport(full,catalog,preview,[firstId]),/50.000/);assert.deepEqual(full,snapshot);
});

test('Entity enumeration is automatic only for a pure XSD string enumeration with proven namespaces',async()=>{
 const enumItems='<xs:enumeration value="IFCWALL"/><xs:enumeration value="IFCDOOR"/>';
 const restrictions=[
  '<xs:restriction base="xs:token">'+enumItems+'</xs:restriction>',
  '<xs:restriction xmlns:q="urn:unknown" base="q:string">'+enumItems+'</xs:restriction>',
  '<xs:restriction base="xs:string">'+enumItems+'<xs:pattern value="IFCW.*"/></xs:restriction>',
  '<xs:restriction base="xs:string"><xs:enumeration value="IFCWALL" vendor="unknown"/></xs:restriction>',
  '<xs:restriction base="xs:string"><q:enumeration xmlns:q="urn:unknown" value="IFCWALL"/></xs:restriction>'
 ];
 for(const restriction of restrictions){const preview=await parse(xmlDocument({appXml:'<entity><name>'+restriction+'</name></entity>'}));assert.equal(mappingProposals(preview,catalog)[0].eligible,false);assert.deepEqual(mappingProposals(preview,catalog)[0].entities,[]);}
 const alias=await parse(xmlDocument({appXml:'<entity><name><xs:restriction xmlns:q="http://www.w3.org/2001/XMLSchema" base="q:string">'+enumItems+'</xs:restriction></name></entity>'}));
 assert.equal(mappingProposals(alias,catalog)[0].eligible,true);assert.deepEqual(mappingProposals(alias,catalog)[0].entities,['IfcWall','IfcDoor']);
});

test('Source-only save and mapping import enforce the readable pretty-JSON project budget atomically',()=>{
 const data=empty();data.source='x'.repeat(IDS_PROJECT_MAX_BYTES-1024);
 assert(Buffer.byteLength(JSON.stringify(data,null,2))<IDS_PROJECT_MAX_BYTES);
 const preview={...document(),xml:'<ids>'+('x'.repeat(4096))+'</ids>'},beforeHeaders=[...data.headers],beforeRows=[...data.rows],beforeSource=data.source;
 assert.throws(()=>saveIdsSource(data,preview),/32 MiB/);assert.equal(data.idsImports,undefined);
 assert.throws(()=>applyIdsImport(data,catalog,preview,[firstId]),/32 MiB/);assert.equal(data.idsImports,undefined);
 assert.deepEqual(data.headers,beforeHeaders);assert.deepEqual(data.rows,beforeRows);assert.equal(data.source,beforeSource);
});

test('Source decisions replace one requirement at a time and explicit empty records clear saved overrides',async()=>{
 const preview=await parse(xmlDocument({requirements:propertyXml()+propertyXml({property:'Second'})})),secondId='spec:0/requirement:1';
 let data=empty();saveIdsSource(data,preview,{[firstId]:{property:'Changed',dataType:'Real'},[secondId]:{property:'Keep'}});
 data=validate(JSON.parse(JSON.stringify(data)));
 saveIdsSource(data,preview,{[firstId]:{dataType:'Real'}});
 assert.deepEqual(data.idsImports[0].decisions,{[firstId]:{dataType:'Real'},[secondId]:{property:'Keep'}},'A provided record replaces its fields; omitted records remain');
 data=validate(JSON.parse(JSON.stringify(data)));
 saveIdsSource(data,preview,{[firstId]:{}});
 assert.deepEqual(data.idsImports[0].decisions,{[secondId]:{property:'Keep'}},'An empty record clears only that requirement');
 data=validate(JSON.parse(JSON.stringify(data)));
 saveIdsSource(data,preview,{[secondId]:{}});
 assert.equal(data.idsImports[0].decisions,undefined,'Clearing the last override removes saved decisions');
 assert.equal(validate(JSON.parse(JSON.stringify(data))).idsImports[0].decisions,undefined);
});

test('Planning with explicit cleared decisions uses source values and retains the cleared state after roundtrip',async()=>{
 const preview=await parse(xmlDocument({requirements:propertyXml()+propertyXml({property:'Second'})})),secondId='spec:0/requirement:1';
 let data=empty();saveIdsSource(data,preview,{[firstId]:{property:'Changed',dataType:'Real'},[secondId]:{property:'Keep'}});
 data=validate(JSON.parse(JSON.stringify(data)));
 const reopened={...preview,decisions:structuredClone(data.idsImports[0].decisions)};
 const result=planIdsImport(data,catalog,reopened,[firstId],{[firstId]:{}});
 assert.equal(result.project.rows[0].IFC_parameter,'Foo');assert.equal(result.project.rows[0].Data_type,'Label');
 assert.deepEqual(result.project.idsImports[0].decisions,{[secondId]:{property:'Keep'}});
 const restored=validate(JSON.parse(JSON.stringify(result.project)));assert.deepEqual(restored.idsImports[0].decisions,{[secondId]:{property:'Keep'}});
 assert.equal(JSON.parse(restored.rows[0].IDS_requirements)[0].decisions,undefined);
 assert.deepEqual(data.idsImports[0].decisions,{[firstId]:{property:'Changed',dataType:'Real'},[secondId]:{property:'Keep'}},'Planning remains read-only');
});

test('Unknown requirement-container and scalar-name attributes need a separate values acknowledgment',async()=>{
 const base=xmlDocument(),variants=[
  base.replace('<requirements>','<requirements vendorRule="unknown">'),
  base.replace('<propertySet>','<propertySet vendorRule="unknown">'),
  base.replace('<baseName>','<baseName vendorRule="unknown">'),
  base.replace('<simpleValue>Foo_Bar</simpleValue>','<simpleValue vendorRule="unknown">Foo_Bar</simpleValue>'),
  base.replace('<simpleValue>Foo</simpleValue>','<simpleValue vendorRule="unknown">Foo</simpleValue>')
 ];
 for(const source of variants){
  const preview=await parse(source),initial=mappingProposals(preview,catalog)[0];
  assert.equal(initial.eligible,false,'Unknown scalar/container semantics cannot be silently ignored');assert.equal(initial.values.constrained,true);
  assert.equal(mappingProposals(preview,catalog,{[firstId]:{acknowledgeValues:true}})[0].eligible,true);
 }
 const description=await parse(base.replace('<requirements>','<requirements description="Known metadata">'));
 assert.equal(mappingProposals(description,catalog)[0].direct,true);
});

test('Unknown application-name wrapper attributes prevent automatic entity inference',async()=>{
 const app='<entity><name vendorRule="unknown"><xs:restriction base="xs:string"><xs:enumeration value="IFCWALL"/><xs:enumeration value="IFCDOOR"/></xs:restriction></name></entity>';
 const preview=await parse(xmlDocument({appXml:app})),initial=mappingProposals(preview,catalog)[0];
 assert.equal(initial.eligible,false);assert.deepEqual(initial.entities,[]);
 assert.equal(mappingProposals(preview,catalog,{[firstId]:{acknowledgeScope:true}})[0].eligible,false,'Acknowledging scope must not invent targets from an unknown wrapper');
 assert.equal(mappingProposals(preview,catalog,{[firstId]:{entities:['IfcWall','IfcDoor'],acknowledgeScope:true}})[0].eligible,true);
 const appContainer=await parse(xmlDocument().replace('<applicability ','<applicability vendorRule="unknown" '));
 assert.equal(mappingProposals(appContainer,catalog)[0].eligible,false);
 assert.equal(mappingProposals(appContainer,catalog,{[firstId]:{acknowledgeScope:true}})[0].eligible,true);
});
