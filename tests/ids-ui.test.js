import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {initIdsUI} from '../web/ids-ui.js';
import {readIds,applyIdsImport,saveIdsSource} from '../web/ids.js';
import {validate} from '../web/core.js';

const NS='http://standards.buildingsmart.org/IDS';
const literal=(name,text)=>`<${name}><simpleValue>${text}</simpleValue></${name}>`;
const property=(name='First',extra='')=>`<property dataType="IFCLABEL">${literal('propertySet','Example_Set')}${literal('baseName',name)}${extra}</property>`;
const xml=({appExtra='',requirements=property()}={})=>`<ids xmlns="${NS}" xmlns:xs="http://www.w3.org/2001/XMLSchema"><info><title>UI fixture</title></info><specifications><specification name="UI specification" ifcVersion="IFC4"><applicability minOccurs="1" maxOccurs="unbounded"><entity>${literal('name','IFCWALL')}</entity>${appExtra}</applicability><requirements>${requirements}</requirements></specification></specifications></ids>`;
const catalog={ifc:{items:[{kind:'class',code:'IfcWall'},{kind:'class',code:'IfcDoor'}]}};
const empty=()=>validate({headers:['Y/N','Revit_parameter','IFC_parameter','Export_tabblad','Data_type'],rows:[]});
const parse=(text,options)=>readIds(text,{...options,DOMParser,XMLSerializer});

// A controlled DOM adapter exercises actual event handlers with the real parser/planner.
// Native rendering and file pickers require the separate browser acceptance check.
function ui(t,services={}){
 const previous=globalThis.document;
 const ids=[...readFileSync(new URL('../web/index.html',import.meta.url),'utf8').matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 const elements=Object.fromEntries(ids.map(id=>[id,{id,value:'',textContent:'',innerHTML:'',disabled:false,checked:false,open:false,events:{},addEventListener(name,handler){this.events[name]=handler;},showModal(){this.open=true;},close(){this.open=false;},click(){}}]));
 globalThis.document={getElementById(id){assert(elements[id],`Missing DOM adapter for ${id}`);return elements[id];}};
 t.after(()=>{globalThis.document=previous;});
 let data=empty(),changes=0;const notices=[],calls={saved:[],applied:[]};
 initIdsUI({data:()=>data,catalog:()=>catalog,changed(){changes++;},notice:m=>notices.push(m)},{readIds:parse,saveIdsSource(...args){calls.saved.push(structuredClone(args.slice(1)));return saveIdsSource(...args);},applyIdsImport(...args){calls.applied.push(structuredClone(args.slice(2)));return applyIdsImport(...args);},...services});
 const load=async text=>{const bytes=new TextEncoder().encode(text);await elements.idsFile.onchange({target:{files:[{name:'ui-fixture.ids',size:bytes.length,arrayBuffer:async()=>bytes.buffer}],value:'ui-fixture.ids'}});};
 return {e:elements,load,calls,notices,get data(){return data;},set data(next){data=next;},get changes(){return changes;}};
}
const edit=(s,id,field,value)=>s.e.idsRequirements.onchange({target:{dataset:{idsDecision:id,field},type:'text',value}});

test('Source-only save retains a complete non-property IDS without adding fabricated mappings',async t=>{
 const source=xml({requirements:`<classification>${literal('system','Example classification')}${literal('value','42')}</classification><material>${literal('value','Timber')}</material>`});
 const s=ui(t);s.e.importIds.onclick();await s.load(source);
 assert.equal(s.e.idsAdd.disabled,true);assert.equal(s.e.idsSaveSource.disabled,false);
 assert.match(s.e.idsSummary.textContent,/2 eisen · 0 bruikbare/);
 assert.match(s.e.idsRequirements.innerHTML,/Classificatie/);assert.match(s.e.idsRequirements.innerHTML,/Materiaal/);
 s.e.idsSaveSource.onclick();assert.equal(s.data.rows.length,0);assert.equal(s.data.idsImports.length,1);assert.equal(s.data.idsImports[0].xml,source);
 assert.deepEqual(s.data.idsImports[0].selectedRequirementIds,[]);assert.equal(s.changes,1);assert.equal(s.e.idsDialog.open,true);
 assert.match(s.e.idsError.textContent,/geen koppelingen toegevoegd/);
});

test('Conditional scope needs explicit acknowledgment and revoking it clears a selected proposal',async t=>{
 const source=xml({appExtra:`<classification>${literal('system','Classification')}${literal('value','42')}</classification>`});
 const s=ui(t);s.e.importIds.onclick();await s.load(source);
 assert.match(s.e.idsSummary.textContent,/0 bruikbare/);assert.equal(s.e.idsSelectAll.disabled,true);
 s.e.idsScopeAck.checked=true;s.e.idsScopeAck.onchange();assert.match(s.e.idsSummary.textContent,/1 bruikbare/);
 s.e.idsSelectAll.onclick();assert.equal(s.e.idsAdd.disabled,false);assert.match(s.e.idsSummary.textContent,/1 geselecteerd/);
 s.e.idsScopeAck.checked=false;s.e.idsScopeAck.onchange();assert.equal(s.e.idsAdd.disabled,true);assert.match(s.e.idsSummary.textContent,/0 geselecteerd/);
 s.e.idsScopeAck.checked=true;s.e.idsScopeAck.onchange();s.e.idsSelectAll.onclick();s.e.idsAdd.onclick();
 assert.equal(s.data.rows.length,1);const ref=JSON.parse(s.data.rows[0].IDS_requirements)[0];
 assert.equal(ref.decisions.acknowledgeScope,true);assert.equal(ref.conditions.conditional,true);assert.equal(s.data.idsImports[0].xml,source);
});

test('Restriction details render as passive escaped source and explicit value acknowledgment enables mapping',async t=>{
 const restriction='<value><xs:restriction base="xs:string"><xs:pattern value="A.*"/><xs:enumeration value="A&amp;B"/></xs:restriction></value>';
 const source=xml({requirements:property('Restricted',restriction)}),s=ui(t);s.e.importIds.onclick();await s.load(source);
 assert.match(s.e.idsRequirements.innerHTML,/pattern: &quot;A\.\*&quot;/);assert.match(s.e.idsRequirements.innerHTML,/enumeration: &quot;A&amp;B&quot;/);
 assert.match(s.e.idsRequirements.innerHTML,/&lt;property/);assert.doesNotMatch(s.e.idsRequirements.innerHTML,/<xs:restriction/);
 assert.equal(s.e.idsSelectAll.disabled,true);s.e.idsValuesAck.checked=true;s.e.idsValuesAck.onchange();
 s.e.idsSelectAll.onclick();s.e.idsAdd.onclick();const ref=JSON.parse(s.data.rows[0].IDS_requirements)[0];
 assert.equal(ref.decisions.acknowledgeValues,true);assert.equal(ref.values.constrained,true);assert.equal(s.data.idsImports[0].xml,source);
});

test('Select-all applies to filtered results rather than hidden eligible requirements',async t=>{
 const s=ui(t);s.e.importIds.onclick();await s.load(xml({requirements:property('Alpha')+property('Beta')}));
 s.e.idsSearch.value='Beta';s.e.idsSearch.oninput();assert.match(s.e.idsRequirements.innerHTML,/Beta/);assert.doesNotMatch(s.e.idsRequirements.innerHTML,/data-ids-requirement="spec:0\/requirement:0"/);
 s.e.idsSelectAll.onclick();assert.match(s.e.idsSummary.textContent,/1 geselecteerd/);s.e.idsAdd.onclick();
 assert.equal(s.data.rows.length,1);assert.equal(s.data.rows[0].IFC_parameter,'Beta');
});

test('Clearing draft overrides removes those decisions and source-only save remains usable',async t=>{
 const s=ui(t);s.e.importIds.onclick();await s.load(xml());const id='spec:0/requirement:0';
 edit(s,id,'property','Renamed');edit(s,id,'dataType','Text');edit(s,id,'entities','IfcDoor');
 edit(s,id,'property','');edit(s,id,'dataType','');edit(s,id,'entities','');
 s.e.idsSaveSource.onclick();assert.equal(s.data.idsImports?.length,1,s.e.idsError.textContent);
 const decisions=s.data.idsImports[0].decisions||{};
 for(const key of ['property','dataType','entities'])assert.equal(Object.hasOwn(decisions[id]||{},key),false,`Empty ${key} should remove the override`);
});

test('Uploading a previously saved IDS displays the same stored choices that will be applied',async t=>{
 const source=xml({appExtra:`<classification>${literal('system','Classification')}</classification>`}),s=ui(t);
 s.e.importIds.onclick();await s.load(source);edit(s,'spec:0/requirement:0','property','Changed');
 s.e.idsScopeAck.checked=true;s.e.idsScopeAck.onchange();s.e.idsSaveSource.onclick();s.e.closeIds.onclick();
 s.e.importIds.onclick();await s.load(source);
 assert.match(s.e.idsRequirements.innerHTML,/value="Changed"/);assert.match(s.e.idsSummary.textContent,/1 bruikbare/);
 assert.match(s.e.idsRequirements.innerHTML,/data-field="acknowledgeScope" checked/);
 s.e.idsSelectAll.onclick();s.e.idsAdd.onclick();assert.equal(s.data.rows[0].IFC_parameter,'Changed');
});

test('A late decoded file cannot populate a replacement project',async t=>{
 let resolve;const buffer=new Promise(r=>resolve=r),s=ui(t),bytes=new TextEncoder().encode(xml());
 s.e.importIds.onclick();const pending=s.e.idsFile.onchange({target:{files:[{name:'late.ids',size:bytes.length,arrayBuffer:()=>buffer}],value:'late.ids'}});
 s.data=empty();resolve(bytes.buffer);await pending;
 assert.equal(s.e.idsRequirements.innerHTML,'');assert.equal(s.e.idsAdd.disabled,true);assert.equal(s.e.idsSaveSource.disabled,true);assert.equal(s.data.idsImports,undefined);assert.equal(s.changes,0);
});

test('A prohibited specification without requirements exposes its conditions and complete source',async t=>{
 const source=readFileSync(new URL('./fixtures/ids/official/ids/pass-prohibited_specifications_passes_if_the_applicability_does_not_matches.ids',import.meta.url),'utf8');
 const s=ui(t);s.e.importIds.onclick();await s.load(source);
 assert.match(s.e.idsSummary.textContent,/1 specificaties · 0 eisen/);
 assert.match(s.e.idsRequirements.innerHTML,/Specificatie zonder afzonderlijke eisen/);
 assert.match(s.e.idsRequirements.innerHTML,/toepassingsaantallen 0 \/ 0/);
 assert.match(s.e.idsRequirements.innerHTML,/Toepassingsvoorwaarden bekijken/);
 assert.match(s.e.idsRequirements.innerHTML,/Volledige oorspronkelijke IDS bekijken/);
 assert.doesNotMatch(s.e.idsRequirements.innerHTML,/data-ids-requirement=/);
 assert.equal(s.e.idsSelectAll.disabled,true);s.e.idsSaveSource.onclick();
 assert.equal(s.data.idsImports[0].xml,source);assert.equal(s.data.rows.length,0);
});
