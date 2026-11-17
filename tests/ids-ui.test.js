import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {initIdsUI} from '../web/ids-ui.js';
import {readIds,applyIdsImport,saveIdsSource} from '../web/ids.js';
import {validate,generate} from '../web/core.js';

const NS='http://standards.buildingsmart.org/IDS';
const literal=(name,text)=>`<${name}><simpleValue>${text}</simpleValue></${name}>`;
const property=(name='First',extra='',type='IFCLABEL')=>`<property dataType="${type}">${literal('propertySet','Example_Set')}${literal('baseName',name)}${extra}</property>`;
const specification=({name='UI specification',identifier='spec-ui',entity='IFCWALL',appExtra='',requirements=property(),min='1',max='unbounded'}={})=>`<specification name="${name}" identifier="${identifier}" ifcVersion="IFC4"><applicability minOccurs="${min}" maxOccurs="${max}"><entity>${literal('name',entity)}</entity>${appExtra}</applicability>${requirements===null?'':`<requirements>${requirements}</requirements>`}</specification>`;
const documentXml=specs=>`<ids xmlns="${NS}" xmlns:xs="http://www.w3.org/2001/XMLSchema"><info><title>UI fixture</title></info><specifications>${specs}</specifications></ids>`;
const xml=options=>documentXml(specification(options));
const catalog={ifc:{items:[{kind:'class',code:'IfcWall'},{kind:'class',code:'IfcDoor'},{kind:'class',code:'IfcWindow'}]}};
const empty=()=>validate({headers:['Y/N','Revit_parameter','IFC_parameter','Export_tabblad','Data_type'],rows:[]});
const parse=(text,options)=>readIds(text,{...options,DOMParser,XMLSerializer});
const conditional=`<classification>${literal('system','Classification')}${literal('value','42')}</classification>`;

// Controlled DOM adapter; handlers use the real parser, grouping, planner and revision comparator.
// This proves data/interaction boundaries, not native layout, file-picker or accessibility behavior.
function ui(t,services={}){
 const previous=globalThis.document;
 const ids=[...readFileSync(new URL('../web/index.html',import.meta.url),'utf8').matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 ids.push('idsEntityChoices','idsEntitySearch');
 const elements=Object.fromEntries(ids.map(id=>[id,{id,value:'',textContent:'',innerHTML:'',disabled:false,checked:false,hidden:false,open:false,classList:{toggle(){}},events:{},addEventListener(name,handler){this.events[name]=handler;},showModal(){this.open=true;},close(){this.open=false;},click(){},focus(){}}]));
 globalThis.document={getElementById(id){assert(elements[id],`Missing DOM adapter for ${id}`);return elements[id];}};
 t.after(()=>{globalThis.document=previous;});
 let data=empty(),changes=0;const notices=[],calls={saved:[],applied:[]};
 initIdsUI({data:()=>data,catalog:()=>catalog,changed(){changes++;},notice:m=>notices.push(m)},{readIds:parse,auditIdsDocument:async()=>({status:'valid',issues:[],complete:false}),saveIdsSource(...args){calls.saved.push(structuredClone(args.slice(1)));return saveIdsSource(...args);},applyIdsImport(...args){calls.applied.push(structuredClone(args.slice(2)));return applyIdsImport(...args);},...services});
 const load=async(text,name='ui-fixture.ids')=>{await elements.idsFile.onchange({target:{files:[{name,size:Buffer.byteLength(text),text:async()=>text}],value:name}});};
 return {e:elements,load,calls,notices,get data(){return data;},set data(next){data=next;},get changes(){return changes;}};
}
const edit=(s,field,value)=>s.e.idsDetail.onchange({target:{dataset:{idsField:field},type:'text',value}});
const acknowledge=(s,index,field,checked=true)=>s.e.idsDetail.onchange({target:{dataset:{idsReview:String(index),field},type:'checkbox',checked}});
const focus=(s,id)=>s.e.idsRequirements.onclick({target:{dataset:{idsFocus:id}}});
const openOthers=s=>{s.e.idsOther.open=true;s.e.idsOther.events.toggle();};
const complete=s=>{s.e.idsSelectAll.onclick();s.e.idsReview.onclick();assert.equal(s.e.idsAdd.disabled,false,s.e.idsChanges.innerHTML);s.e.idsAdd.onclick();};

test('A shared definition is displayed once and maps all exact IFC targets with preserved source references',async t=>{
 const source=documentXml(specification({name:'Wall',identifier:'wall'})+specification({name:'Door',identifier:'door',entity:'IFCDOOR'}));
 const s=ui(t);s.e.importIds.onclick();await s.load(source);
 assert.match(s.e.idsSummary.textContent,/2 eisen · 1 parameterdefinities/);
 assert.equal([...s.e.idsRequirements.innerHTML.matchAll(/data-ids-group=/g)].length,1);
 assert.match(s.e.idsDetail.innerHTML,/Alle onderliggende IDS-eisen \(2\)/);
 edit(s,'revitParameter','QA_Shared');
 s.e.idsSelectAll.onclick();s.e.idsAdd.onclick();assert.equal(s.data.rows.length,0,'Direct add must not bypass the preflight step');
 assert.match(s.e.idsError.textContent,/eerst.*wijzigingsoverzicht/);
 s.e.idsReview.onclick();assert.match(s.e.idsChanges.innerHTML,/2 nieuw · 0 hergebruiken · 0 conflicten/);
 s.e.idsAdd.onclick();assert.equal(s.data.rows.length,2);assert(s.data.rows.every(r=>r.Revit_parameter==='QA_Shared'));
 assert.equal(new Set(s.data.rows.map(r=>r.Uniform_id)).size,1);
 assert.deepEqual(s.data.rows.map(r=>JSON.parse(r.IDS_requirements)[0].requirementId).sort(),['spec:0/requirement:0','spec:1/requirement:0']);
 assert.equal(s.data.idsImports[0].xml,source);assert.equal(generate(s.data).errors.length,0);
 });

test('Grouped default and per-entity exception remain distinct in the reviewed and applied result',async t=>{
 const source=documentXml(specification({identifier:'wall'})+specification({identifier:'door',entity:'IFCDOOR'})),s=ui(t);s.e.importIds.onclick();await s.load(source);
 edit(s,'revitParameter','QA_Default');
 s.e.idsDetail.onchange({target:{dataset:{idsEntityRevit:'IfcDoor'},value:'QA_Door'}});
 s.e.idsSelectAll.onclick();s.e.idsReview.onclick();assert.match(s.e.idsChanges.innerHTML,/QA_Default/);assert.match(s.e.idsChanges.innerHTML,/QA_Door/);
 s.e.idsAdd.onclick();assert.equal(s.data.rows.find(r=>r.IfcWall==='x').Revit_parameter,'QA_Default');assert.equal(s.data.rows.find(r=>r.IfcDoor==='x').Revit_parameter,'QA_Door');
 });

test('Only a matching condition group is acknowledged and revocation clears its selection',async t=>{
 const other=conditional.replace('42','99'),source=documentXml(specification({name:'Group42',identifier:'42',appExtra:conditional})+specification({name:'Group99',identifier:'99',appExtra:other}));
 const s=ui(t);s.e.importIds.onclick();await s.load(source);
 assert.match(s.e.idsSummary.textContent,/0 bruikbare eisen/);assert.equal(s.e.idsSelectAll.disabled,true);
 acknowledge(s,0,'acknowledgeScope');assert.match(s.e.idsSummary.textContent,/1 bruikbare eisen/);
 s.e.idsSelectAll.onclick();assert.match(s.e.idsSummary.textContent,/1 geselecteerd/);
 acknowledge(s,0,'acknowledgeScope',false);assert.match(s.e.idsSummary.textContent,/0 geselecteerd/);assert.equal(s.e.idsReview.disabled,true);
 acknowledge(s,1,'acknowledgeScope');s.e.idsSelectAll.onclick();s.e.idsReview.onclick();s.e.idsAdd.onclick();
 const refs=JSON.parse(s.data.rows[0].IDS_requirements);assert.equal(refs.length,1);assert.equal(refs[0].requirementId,'spec:1/requirement:0');assert.equal(refs[0].decisions.acknowledgeScope,true);
 });

test('Value restrictions stay passive and need their separate acknowledgment',async t=>{
 const restriction='<value><xs:restriction base="xs:string"><xs:pattern value="A.*"/><xs:enumeration value="A&amp;B"/></xs:restriction></value>';
 const source=xml({appExtra:conditional,requirements:property('Restricted',restriction)}),s=ui(t);s.e.importIds.onclick();await s.load(source);
 assert.match(s.e.idsDetail.innerHTML,/pattern: &quot;A\.\*&quot;/);assert.match(s.e.idsDetail.innerHTML,/enumeration: &quot;A&amp;B&quot;/);assert.doesNotMatch(s.e.idsDetail.innerHTML,/<xs:restriction/);
 acknowledge(s,0,'acknowledgeScope');assert.equal(s.e.idsSelectAll.disabled,true,'Scope approval is not value approval');
 acknowledge(s,0,'acknowledgeValues');complete(s);
 const ref=JSON.parse(s.data.rows[0].IDS_requirements)[0];assert.equal(ref.conditions.conditional,true);assert.equal(ref.values.constrained,true);assert.equal(s.data.idsImports[0].xml,source);
 });

test('Source-only save retains non-property requirements with a relevant route explanation and no fabricated mappings',async t=>{
 const source=xml({requirements:`<classification>${literal('system','Example classification')}${literal('value','42')}</classification><material>${literal('value','Timber')}</material>`});
 const s=ui(t);s.e.importIds.onclick();await s.load(source);
 assert.equal(s.e.idsAdd.disabled,true);assert.equal(s.e.idsSaveSource.disabled,false);assert.match(s.e.idsSummary.textContent,/2 eisen · 0 parameterdefinities/);
 assert.equal(s.e.idsOtherBody.innerHTML,'','Other-route details are lazy until opened');openOthers(s);
 assert.match(s.e.idsOtherBody.innerHTML,/Classificatie/);assert.match(s.e.idsOtherBody.innerHTML,/Materiaal/);assert.match(s.e.idsOtherBody.innerHTML,/andere IFC-route/);
 assert.doesNotMatch(s.e.idsOtherBody.innerHTML,/eigenschapsnaam.*propertysetnaam|datatype ontbreekt/);
 s.e.idsSaveSource.onclick();assert.equal(s.data.rows.length,0);assert.equal(s.data.idsImports[0].xml,source);assert.deepEqual(s.data.idsImports[0].selectedRequirementIds,[]);
 assert.equal(s.changes,1);assert.equal(s.e.idsDialog.open,true);assert.match(s.e.idsError.textContent,/geen koppelingen toegevoegd/);
 });

test('Filtering narrows select-all and excludes unshown definitions',async t=>{
 const s=ui(t);s.e.importIds.onclick();await s.load(xml({requirements:property('Alpha')+property('Beta')}));
 s.e.idsSearch.value='Beta';s.e.idsSearch.oninput();assert.match(s.e.idsRequirements.innerHTML,/Beta/);assert.doesNotMatch(s.e.idsRequirements.innerHTML,/data-ids-focus="spec:0\/requirement:0"/);
 complete(s);assert.equal(s.data.rows.length,1);assert.equal(s.data.rows[0].IFC_parameter,'Beta');
 });

test('Preflight reports existing datatype conflicts without mutating the project or allowing apply',async t=>{
 const s=ui(t);s.data.headers.push('IfcWall');s.data.rows.push({'Y/N':'x',Revit_parameter:'Keep',IFC_parameter:'First',Export_tabblad:'Example_Set',Data_type:'Text',IfcWall:'x'});
 const before=structuredClone(s.data);s.e.importIds.onclick();await s.load(xml());s.e.idsSelectAll.onclick();s.e.idsReview.onclick();
 assert.match(s.e.idsChanges.innerHTML,/0 nieuw · 0 hergebruiken · 1 conflicten/);assert.equal(s.e.idsAdd.disabled,true);
 s.e.idsAdd.onclick();assert.deepEqual(s.data,before);assert.equal(s.changes,0);
 });

test('A changed project invalidates the reviewed mutation counts and preserves the newly existing name',async t=>{
 const s=ui(t);s.e.importIds.onclick();await s.load(xml());edit(s,'revitParameter','Requested');s.e.idsSelectAll.onclick();s.e.idsReview.onclick();assert.match(s.e.idsChanges.innerHTML,/1 nieuw/);
 s.data.headers.push('IfcWall');s.data.rows.push({'Y/N':'x',Revit_parameter:'KeepConcurrent',IFC_parameter:'First',Export_tabblad:'Example_Set',Data_type:'Label',IfcWall:'x'});
 s.e.idsAdd.onclick();assert.equal(s.data.rows.length,1);assert.match(s.e.idsError.textContent,/project is gewijzigd/);assert.match(s.e.idsChanges.innerHTML,/1 hergebruiken/);
 s.e.idsAdd.onclick();assert.equal(s.data.rows.length,1);assert.equal(s.data.rows[0].Revit_parameter,'KeepConcurrent');
 });

test('Cleared saved overrides stay cleared after source reopen, and fresh file upload shows stored choices',async t=>{
 const source=xml({appExtra:conditional}),s=ui(t);s.e.importIds.onclick();await s.load(source);
 edit(s,'property','Changed');acknowledge(s,0,'acknowledgeScope');s.e.idsSaveSource.onclick();s.e.closeIds.onclick();s.e.importIds.onclick();await s.load(source);
 assert.match(s.e.idsDetail.innerHTML,/value="Changed"/);assert.match(s.e.idsSummary.textContent,/1 bruikbare eisen/);
 edit(s,'property','');s.e.idsSaveSource.onclick();assert.equal(Object.hasOwn(s.data.idsImports[0].decisions['spec:0/requirement:0'],'property'),false);
 s.e.closeIds.onclick();s.e.importIds.onclick();s.e.idsSaved.value=s.data.idsImports[0].id;await s.e.idsOpenSaved.onclick();
 assert.match(s.e.idsDetail.innerHTML,/value="First"/);assert.doesNotMatch(s.e.idsDetail.innerHTML,/value="Changed"/);
 });

test('Explicit source comparison reuses only unchanged choices and keeps changed conditions unapproved',async t=>{
 const old=documentXml(specification({name:'Wall',identifier:'wall',appExtra:conditional})+specification({name:'Door',identifier:'door',entity:'IFCDOOR',appExtra:conditional}));
 const next=documentXml(specification({name:'Door',identifier:'door',entity:'IFCDOOR',appExtra:conditional.replace('42','99')})+specification({name:'Wall',identifier:'wall',appExtra:conditional}));
 const s=ui(t);s.e.importIds.onclick();await s.load(old);edit(s,'revitParameter','QA_Prior');acknowledge(s,0,'acknowledgeScope');acknowledge(s,1,'acknowledgeScope');s.e.idsSaveSource.onclick();const previous=s.data.idsImports[0];
 await s.load(next,'new-version.ids');assert.match(s.e.idsSummary.textContent,/0 bruikbare eisen/);assert.equal(s.e.idsCompareReuse.disabled,true);
 s.e.idsRevision.value=previous.id;s.e.idsRevision.onchange();await s.e.idsCompare.onclick();assert.match(s.e.idsComparison.innerHTML,/1 ongewijzigd · 1 gewijzigd/);assert.equal(s.e.idsCompareReuse.disabled,false);
 s.e.idsCompareReuse.onclick();assert.match(s.e.idsSummary.textContent,/1 bruikbare eisen/);s.e.idsSaveSource.onclick();
 const current=s.data.idsImports.find(d=>d.id!==previous.id);assert.equal(current.previousDocumentId,previous.id);assert.equal(validate(JSON.parse(JSON.stringify(s.data))).idsImports.find(d=>d.id===current.id).previousDocumentId,previous.id);assert.equal(current.decisions['spec:1/requirement:0'].revitParameter,'QA_Prior');assert.equal(current.decisions['spec:1/requirement:0'].acknowledgeScope,true);assert.equal(current.decisions['spec:0/requirement:0'],undefined);
 assert.equal(s.data.rows.length,0);assert.equal(s.data.idsImports[0].xml,old);
 });

test('Late parsing cannot populate a closed dialog or a replacement project',async t=>{
 for(const kind of ['closed','replaced'])await t.test(kind,async t=>{
  let resolve;const result=new Promise(r=>resolve=r),s=ui(t,{readIds:()=>result});s.e.importIds.onclick();const pending=s.load(xml());
  await new Promise(r=>setImmediate(r));if(kind==='closed'){s.e.closeIds.onclick();s.e.importIds.onclick();}else s.data=empty();resolve(await parse(xml()));await pending;
  assert.equal(s.e.idsRequirements.innerHTML,'');assert.equal(s.e.idsSaveSource.disabled,true);assert.equal(s.data.idsImports,undefined);assert.equal(s.changes,0);
 });
 });

test('Replacing a source with malformed XML clears the old selection and preflight',async t=>{
 const s=ui(t);s.e.importIds.onclick();await s.load(xml());s.e.idsSelectAll.onclick();s.e.idsReview.onclick();assert.equal(s.e.idsAdd.disabled,false);
 await s.load('<ids>broken');assert.equal(s.e.idsAdd.disabled,true);assert.equal(s.e.idsRequirements.innerHTML,'');assert.equal(s.e.idsChanges.innerHTML,'');assert.match(s.e.idsError.textContent,/ongeldige XML/);assert.equal(s.data.rows.length,0);
 });

test('A prohibited specification without requirements exposes conditions and complete original source on demand',async t=>{
 const source=readFileSync(new URL('./fixtures/ids/official/ids/pass-prohibited_specifications_passes_if_the_applicability_does_not_matches.ids',import.meta.url),'utf8');
 const s=ui(t);s.e.importIds.onclick();await s.load(source);
 assert.match(s.e.idsSummary.textContent,/1 specificaties · 0 eisen/);assert.equal(s.e.idsOtherBody.innerHTML,'');openOthers(s);assert.match(s.e.idsOtherBody.innerHTML,/Specificatie zonder afzonderlijke eisen/);assert.match(s.e.idsOtherBody.innerHTML,/toepassingsaantallen 0 \/ 0/);assert.match(s.e.idsOtherBody.innerHTML,/IFCWINDOW/);
 assert.equal(s.e.idsSelectAll.disabled,true);assert.equal(s.e.idsXml.textContent,'');s.e.idsShowXml.onclick();assert.equal(s.e.idsXml.textContent,source);assert.equal(s.e.idsXmlPanel.open,true);
 s.e.idsSaveSource.onclick();assert.equal(s.data.idsImports[0].xml,source);assert.equal(s.data.rows.length,0);
 });

test('Invalid XSD feedback prevents adding while retaining source-only save',async t=>{
 const s=ui(t,{auditIdsDocument:async()=>({status:'invalid',issues:[{message:'Required attribute absent'}],complete:false})});s.e.importIds.onclick();await s.load(xml());s.e.idsSelectAll.onclick();
 assert.match(s.e.idsAudit.innerHTML,/Required attribute absent/);assert.match(s.e.idsAuditStatus.textContent,/Bestand voldoet niet/);assert.equal(s.e.idsStep2.hidden,false,'Blocking audit status must also be available while the parameter step is active');assert.equal(s.e.idsReview.disabled,true);s.e.idsTab3.onclick();s.e.idsAdd.onclick();assert.equal(s.data.rows.length,0);
 s.e.idsSaveSource.onclick();assert.equal(s.data.idsImports.length,1);
 });

test('Undo restores the exact project only before any subsequent project change',async t=>{
 for(const changed of [false,true])await t.test(changed?'later edit blocks undo':'unchanged import can undo',async t=>{
  const s=ui(t),before=structuredClone(s.data);s.e.importIds.onclick();await s.load(xml());edit(s,'revitParameter','QA_Code');complete(s);s.e.importIds.onclick();assert.equal(s.e.idsUndoImport.hidden,false);
  if(changed)s.data.rows[0].Revit_parameter='LaterEdit';s.e.idsUndoImport.onclick();
  if(changed){assert.equal(s.data.rows[0].Revit_parameter,'LaterEdit');assert.match(s.e.idsError.textContent,/intussen gewijzigd/);}else{assert.deepEqual(s.data,before);assert.match(s.e.idsError.textContent,/ongedaan gemaakt/);}
 });
 });

test('A late predecessor comparison cannot restore results or control state after choosing another predecessor',async t=>{
 for(const scenario of [{replacement:'B',reject:false},{replacement:'',reject:false},{replacement:'B',reject:true}])await t.test((scenario.replacement||'empty')+(scenario.reject?' after old failure':''),async t=>{
  const sourceA=xml().replace('UI fixture','Source A'),sourceB=xml({appExtra:conditional}).replace('UI fixture','Source B'),current=xml().replace('UI fixture','New source');
  let delay=false,resolvePrevious,rejectPrevious;
  const s=ui(t,{readIds:async(text,options)=>delay&&options.fileName==='A.ids'?new Promise((resolve,reject)=>{resolvePrevious=resolve;rejectPrevious=reject;}):parse(text,options)});
  s.e.importIds.onclick();await s.load(sourceA,'A.ids');edit(s,'revitParameter','QA_A');s.e.idsSaveSource.onclick();const idA=s.data.idsImports[0].id;
  await s.load(sourceB,'B.ids');s.e.idsSaveSource.onclick();const idB=s.data.idsImports.find(d=>d.id!==idA).id;
  await s.load(current,'Current.ids');delay=true;s.e.idsRevision.value=idA;s.e.idsRevision.onchange();const pending=s.e.idsCompare.onclick();
  await new Promise(resolve=>setImmediate(resolve));assert.equal(typeof resolvePrevious,'function');assert.equal(s.e.idsCompare.disabled,true);
  s.e.idsRevision.value=scenario.replacement?idB:'';s.e.idsRevision.onchange();s.e.idsError.textContent='Current selection state';
  assert.equal(s.e.idsCompare.disabled,!scenario.replacement);
  if(scenario.reject)rejectPrevious(Error('Stale predecessor failed'));else resolvePrevious(await parse(sourceA,{fileName:'A.ids'}));
  await pending;
  assert.equal(s.e.idsComparison.innerHTML,'');assert.equal(s.e.idsCompareReuse.disabled,true);assert.equal(s.e.idsCompare.disabled,!scenario.replacement);
  assert.equal(s.e.idsError.textContent,'Current selection state');assert.equal(s.e.idsRevision.value,scenario.replacement?idB:'');assert.equal(s.data.rows.length,0);
 });
});

test('Editing manual IFC targets revokes only the affected scope approval and selected requirements',async t=>{
 const source=xml({appExtra:conditional,requirements:property('Alpha')+property('Beta')}),s=ui(t);s.e.importIds.onclick();await s.load(source);
 s.e.idsScopes.open=true;s.e.idsScopes.events.toggle();s.e.idsScopesBody.onchange({target:{dataset:{idsScope:'scope:0'},checked:true}});
 s.e.idsSelectAll.onclick();assert.match(s.e.idsSummary.textContent,/2 geselecteerd/);
 focus(s,'spec:0/requirement:0');s.e.idsDetail.onchange({target:{dataset:{idsEntity:'IfcDoor'},checked:true}});
 assert.match(s.e.idsSummary.textContent,/1 bruikbare eisen · 1 geselecteerd/);s.e.idsSaveSource.onclick();
 const choices=s.data.idsImports[0].decisions;
 assert.deepEqual(choices['spec:0/requirement:0'].entities,['IfcWall','IfcDoor']);assert.equal(choices['spec:0/requirement:0'].acknowledgeScope,false);
 assert.equal(choices['spec:0/requirement:1'].acknowledgeScope,true);
 s.e.idsReview.onclick();s.e.idsAdd.onclick();assert.equal(s.data.rows.length,1);assert.equal(s.data.rows[0].IFC_parameter,'Beta');assert.equal(s.data.rows[0].IfcWall,'x');
});

test('One identical application group can approve several parameter definitions without approving a different classification',async t=>{
 const source=documentXml(specification({name:'Shared scope',identifier:'shared',appExtra:conditional,requirements:property('Alpha')+property('Beta')})+specification({name:'Other scope',identifier:'other',appExtra:conditional.replace('42','99'),requirements:property('Gamma')}));
 const s=ui(t);s.e.importIds.onclick();await s.load(source);
 assert.match(s.e.idsSummary.textContent,/3 eisen · 3 parameterdefinities · 0 bruikbare eisen/);assert.equal(s.e.idsScopesBody.innerHTML,'');assert.match(s.e.idsScopesCount.textContent,/2 toepassingsgroepen/);
 s.e.idsScopes.open=true;s.e.idsScopes.events.toggle();assert.equal([...s.e.idsScopesBody.innerHTML.matchAll(/data-ids-scope=/g)].length,2);assert.match(s.e.idsScopesBody.innerHTML,/2 eisen · 2 parameterdefinities/);
 s.e.idsScopesBody.onchange({target:{dataset:{idsScope:'scope:0'},checked:true}});assert.match(s.e.idsSummary.textContent,/2 bruikbare eisen/);
 complete(s);assert.deepEqual(s.data.rows.map(r=>r.IFC_parameter).sort(),['Alpha','Beta']);
 const refs=s.data.rows.flatMap(r=>JSON.parse(r.IDS_requirements));assert.deepEqual(refs.map(r=>r.requirementId).sort(),['spec:0/requirement:0','spec:0/requirement:1']);assert(refs.every(r=>r.conditions.conditional===true&&r.decisions.acknowledgeScope===true));
 assert.equal(s.data.idsImports[0].xml,source);assert.equal(s.data.idsImports[0].decisions['spec:1/requirement:0'],undefined);assert.equal(s.data.rows.some(r=>r.IFC_parameter==='Gamma'),false);
});

test('Many value contexts stay reachable through bounded detail pages without losing source requirements',async t=>{
 const count=120,source=xml({requirements:Array.from({length:count},(_,i)=>property('Repeated',literal('value','V'+String(i).padStart(3,'0')))).join('')}),s=ui(t);
 s.e.importIds.onclick();await s.load(source);assert.match(s.e.idsSummary.textContent,/120 eisen · 1 parameterdefinities/);
 const reviewIds=()=>[...s.e.idsDetail.innerHTML.matchAll(/data-ids-review="(\d+)"/g)].map(m=>Number(m[1]));
 const requirementIds=()=>[...s.e.idsDetail.innerHTML.matchAll(/data-ids-source="(spec:0\/requirement:\d+)"/g)].map(m=>m[1]);
 const move=(kind,delta)=>s.e.idsDetail.onclick({target:{dataset:{idsNav:kind,delta:String(delta)}}});
 assert.deepEqual(reviewIds(),Array.from({length:20},(_,i)=>i));assert.deepEqual(requirementIds(),Array.from({length:35},(_,i)=>'spec:0/requirement:'+i));
 move('review',1);assert.deepEqual(reviewIds(),Array.from({length:20},(_,i)=>i+20));assert.equal(requirementIds()[0],'spec:0/requirement:0');
 move('requirements',1);assert.equal(requirementIds()[0],'spec:0/requirement:35');assert.equal(requirementIds().at(-1),'spec:0/requirement:69');
 acknowledge(s,20,'acknowledgeValues');assert.match(s.e.idsSummary.textContent,/1 bruikbare eisen/);
 move('review',-1);move('requirements',-1);
 const allReviews=new Set(),allSources=new Set();
 for(let page=0;page<6;page++){const visible=reviewIds();assert(visible.length<=20);visible.forEach(id=>allReviews.add(id));if(page<5)move('review',1);}
 for(let page=0;page<4;page++){const visible=requirementIds();assert(visible.length<=35);visible.forEach(id=>allSources.add(id));if(page<3)move('requirements',1);}
 assert.deepEqual([...allReviews].sort((a,b)=>a-b),Array.from({length:count},(_,i)=>i));assert.deepEqual([...allSources].sort((a,b)=>Number(a.split(':').at(-1))-Number(b.split(':').at(-1))),Array.from({length:count},(_,i)=>'spec:0/requirement:'+i));
 complete(s);assert.equal(s.data.rows.length,1);const refs=JSON.parse(s.data.rows[0].IDS_requirements);assert.equal(refs.length,1);assert.equal(refs[0].requirementId,'spec:0/requirement:20');assert.equal(refs[0].decisions.acknowledgeValues,true);
 assert.equal(s.data.idsImports[0].xml,source);assert.equal((await parse(s.data.idsImports[0].xml)).specifications[0].requirements.length,count);
});

test('Source comparison surfaces malformed provenance and identifies actual affected project row numbers',async t=>{
 const previousXml=xml().replace('UI fixture','Previous source'),currentXml=xml().replace('UI fixture','Current source'),s=ui(t);
 s.e.importIds.onclick();await s.load(previousXml);s.e.idsSaveSource.onclick();const previous=s.data.idsImports[0];
 s.data.headers.push('IfcWall','IDS_requirements');
 const row=(property,refs)=>({'Y/N':'x',Revit_parameter:'Keep',IFC_parameter:property,Export_tabblad:'Example_Set',Data_type:'Label',IfcWall:'x',IDS_requirements:refs});
 s.data.rows.push(row('Broken','not-json'),row('Unrelated',''),row('First',JSON.stringify([{documentId:previous.id,specificationId:'spec:0',requirementId:'spec:0/requirement:0'}])));
 await s.load(currentXml,'Current.ids');s.e.idsRevision.value=previous.id;s.e.idsRevision.onchange();await s.e.idsCompare.onclick();
 assert.match(s.e.idsComparison.innerHTML,/Regel 1: IDS-herkomst is niet leesbaar/);assert.match(s.e.idsComparison.innerHTML,/bestaande regels 3/);assert.doesNotMatch(s.e.idsComparison.innerHTML,/1 bestaande regels/);assert.equal(s.data.rows.length,3);assert.equal(s.data.rows[0].IDS_requirements,'not-json');
});

test('The delegated application-group click permits the native checkbox default action',async t=>{
 const s=ui(t);s.e.importIds.onclick();await s.load(xml({appExtra:conditional}));
 s.e.idsScopes.open=true;s.e.idsScopes.events.toggle();
 const scope=/data-ids-scope="([^"]+)"/.exec(s.e.idsScopesBody.innerHTML)[1];
 const target={type:'checkbox',checked:true,dataset:{idsScope:scope}};
 // Returning false from a DOM0 click handler cancels/reverts checkbox activation.
 assert.notEqual(s.e.idsScopesBody.onclick({target}),false);
 s.e.idsScopesBody.onchange({target});assert.match(s.e.idsSummary.textContent,/1 bruikbare eisen/);
});

test('Revit input and entity exceptions reach preflight immediately without a blur event',async t=>{
 const source=documentXml(specification({identifier:'wall'})+specification({identifier:'door',entity:'IFCDOOR'})),s=ui(t);s.e.importIds.onclick();await s.load(source);
 const group=/data-ids-revit="([^"]+)"/.exec(s.e.idsRequirements.innerHTML)[1];
 s.e.idsRequirements.oninput({target:{dataset:{idsRevit:group},value:'QA_Live'}});
 s.e.idsDetail.oninput({target:{dataset:{idsEntityRevit:'IfcDoor'},value:'QA_LiveDoor'}});
 s.e.idsSelectAll.onclick();s.e.idsReview.onclick();assert.match(s.e.idsChanges.innerHTML,/QA_LiveDoor/);assert.match(s.e.idsChanges.innerHTML,/QA_Live/);
 s.e.idsAdd.onclick();assert.equal(s.data.rows.find(r=>r.IfcDoor==='x').Revit_parameter,'QA_LiveDoor');assert.equal(s.data.rows.find(r=>r.IfcWall==='x').Revit_parameter,'QA_Live');
});

test('Manual IFC choices exclude predefined-type pseudo classes offered by the catalog',async t=>{
 const s=ui(t);catalog.ifc.items.push({kind:'class',code:'IfcWallSTANDARD'});t.after(()=>catalog.ifc.items.pop());s.e.importIds.onclick();await s.load(xml());
 assert.match(s.e.idsEntityChoices.innerHTML,/data-ids-entity="IfcWall"/);assert.doesNotMatch(s.e.idsEntityChoices.innerHTML,/IfcWallSTANDARD/);
});
