import test from 'node:test';
import assert from 'node:assert/strict';
import {planIdsImport,applyIdsImport,readIds,validateIdsImports} from '../web/ids.js';
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
 await assert.rejects(readIds('x'.repeat(2*1024*1024+1),{DOMParser:null}),/2 MB/);
 await assert.rejects(readIds('<ids/>',{DOMParser:null}),/XML-parser/);
});

// Controlled DOM adapter exercises actual handlers; it is not a native browser/parser test.
function ui(t,read=async()=>document()){
 const before=globalThis.document,ids=['importIds','idsDialog','idsFile','idsChoose','closeIds','idsSummary','idsRequirements','idsSelectAll','idsSelectNone','idsAdd','idsError','idsSaved','idsOpenSaved'];
 const elements=Object.fromEntries(ids.map(id=>[id,{id,value:'',textContent:'',innerHTML:'',disabled:false,open:false,addEventListener(){},showModal(){this.open=true;},close(){this.open=false;},click(){}}]));
 globalThis.document={getElementById:id=>{assert(elements[id],id);return elements[id];}};t.after(()=>{globalThis.document=before;});
 let data=empty(),changes=0;const notices=[];
 initIdsUI({data:()=>data,catalog:()=>catalog,changed(){changes++;},notice:s=>notices.push(s)},{readIds:read,applyIdsImport});
 return {e:elements,get data(){return data;},set data(value){data=value;},get changes(){return changes;},notices};
}
test('IDS handler previews partial input, selects supported rows and preserves source after save/reopen',async t=>{
 const s=ui(t,async()=>document([requirement(),requirement({id:'spec:0/requirement:1',eligible:false,cardinality:'optional',reasons:['Optionele property'],xml:'<property/>'})]));
 s.e.importIds.onclick();assert.equal(s.e.idsDialog.open,true);assert.equal(s.e.idsAdd.disabled,true);
 await s.e.idsFile.onchange({target:{files:[{name:'test.ids',size:100,text:async()=>'<ids/>'}],value:'test.ids'}});
 assert.match(s.e.idsSummary.textContent,/gedeeltelijke import/);assert.match(s.e.idsRequirements.innerHTML,/Optionele property/);
 s.e.idsSelectAll.onclick();assert.match(s.e.idsSummary.textContent,/1 geselecteerd/);s.e.idsAdd.onclick();
 assert.equal(s.data.rows.length,1);assert.equal(s.changes,1);assert.equal(s.e.idsDialog.open,false);
 s.data=validate(JSON.parse(JSON.stringify(s.data)));s.e.importIds.onclick();assert.match(s.e.idsSaved.innerHTML,/example.ids/);
 s.e.idsSaved.value=s.data.idsImports[0].id;s.e.idsSaved.onchange();assert.equal(s.e.idsOpenSaved.disabled,false);await s.e.idsOpenSaved.onclick();assert.match(s.e.idsSummary.textContent,/specificaties/);
});
test('IDS handler rejects a late parse after closing or replacing the project',async t=>{
 let resolve;const pending=new Promise(r=>resolve=r),s=ui(t,()=>pending);
 s.e.importIds.onclick();const load=s.e.idsFile.onchange({target:{files:[{name:'test.ids',size:100,text:async()=>'<ids/>'}],value:'test.ids'}});
 await new Promise(r=>setImmediate(r));s.e.closeIds.onclick();s.e.importIds.onclick();resolve(document());await load;
 assert.equal(s.e.idsAdd.disabled,true);assert.equal(s.e.idsRequirements.innerHTML,'');assert.equal(s.data.rows.length,0);
});
test('IDS handler clears old selection when a replacement source fails',async t=>{
 let calls=0;const s=ui(t,async()=>{if(calls++)throw Error('Malformed XML');return document();});
 s.e.importIds.onclick();const event=()=>({target:{files:[{name:'test.ids',size:100,text:async()=>'<ids/>'}],value:'test.ids'}});
 await s.e.idsFile.onchange(event());s.e.idsSelectAll.onclick();assert.equal(s.e.idsAdd.disabled,false);
 await s.e.idsFile.onchange(event());assert.equal(s.e.idsAdd.disabled,true);assert.equal(s.e.idsRequirements.innerHTML,'');assert.match(s.e.idsError.textContent,/Malformed/);assert.equal(s.data.rows.length,0);
});
