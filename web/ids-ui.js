import {readIds,applyIdsImport,saveIdsSource,IDS_MAX_BYTES} from './ids.js?v=1.11.5';
import {buildIdsWorkspace,preflightIdsImport} from './ids-workflow.js?v=1.11.5';
import {loadIdsFile,loadIdsText} from './ids-loader.js?v=1.11.5';
import {compareIdsRevisions,idsRevisionCandidates} from './ids-revisions.js?v=1.11.5';
import {auditIdsDocument} from './ids-audit.js?v=1.11.5';
import {types} from './core.js?v=1.11.5';
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={entity:'IFC-entiteit',property:'Eigenschap',attribute:'IFC-attribuut',classification:'Classificatie',material:'Materiaal',partOf:'Onderdeelrelatie',name:'Naam',predefinedType:'Predefined type',propertySet:'Propertyset',baseName:'Eigenschapsnaam',value:'Waarde',system:'Classificatiesysteem'};
const stateLabels={ready:'Gereed',partial:'Deels gereed',review:'Keuze nodig',conflict:'Conflict',new:'Nieuw',reuse:'Hergebruiken',skip:'Overslaan',unchanged:'Ongewijzigd',modified:'Gewijzigd',added:'Nieuw',removed:'Vervallen',ambiguous:'Niet eenduidig'};
const clone=value=>JSON.parse(JSON.stringify(value));
const message=value=>typeof value==='string'?value:value?.message||JSON.stringify(value);
const needsRevisionReview=entry=>entry.status!=='unchanged'||entry.kind==='property'&&!entry.canReuse;
function specificationNames(document){
 const names=new Map();
 document.specifications.forEach((spec,index)=>{
  const name=`Specificatie ${index+1}${spec.name?' · '+spec.name:''}`;
  names.set(spec.id,name);
  for(const requirement of spec.requirements)names.set(requirement.id,name);
 });
 return names;
}
function comparisonView(result,previous,current){
 const previousNames=specificationNames(previous),currentNames=specificationNames(current);
 const context=(ids,names)=>({count:ids.length,names:compactNames(new Set(ids.map(id=>names.get(id)).filter(Boolean)))});
 const rows=indices=>indices?.map(index=>index+1).join(', ');
 const groups=new Map(result.ambiguityGroups.map(group=>[group.id,{
  status:'ambiguous',labels:new Set(),currentIds:[],review:true,reason:group.reason,
  previous:context(group.previousIds,previousNames),rows:rows(group.impactedRows)
 }]));
 const review=[];
 const entries=result.changes.map(change=>{
  const group=groups.get(change.ambiguityGroupId),label=change.label||change.kind||'Eis';
  const currentIds=change.currentId?[change.currentId]:[];
  const entry={status:change.status,label,reason:change.reason,currentIds,review:needsRevisionReview(change),
   previous:group&&change.currentId?group.previous:context(change.previousId?[change.previousId]:[],previousNames),
   current:context(currentIds,currentNames),rows:group?.rows??rows(change.impactedRows)};
  if(group){
   if(!group.labels.size)review.push(group);
   group.labels.add(label);
   if(change.currentId)group.currentIds.push(change.currentId);
  }else if(entry.review)review.push(entry);
  return entry;
 });
 for(const group of groups.values()){
  group.label=compactNames(group.labels);
  group.current=context(group.currentIds,currentNames);
 }
 const {counts,warnings,decisions,previousDocumentId}=result;
 return {counts,warnings,decisions,previousDocumentId,entries,review};
}
function compactNames(values){
 const names=[...values],shown=names.slice(0,3).join(' · ');
 return names.length>3?`${shown} · ${names.length-3} meer`:shown;
}
function valueText(value){
 if(!value)return 'Niet opgegeven';
 if(value.kind==='literal')return JSON.stringify(value.value);
 if(value.kind==='restriction')return (value.facets||[]).map(f=>f.kind+': '+JSON.stringify(f.value)).join(' · ')||'Restrictie';
 if(value.parameters)return Object.entries(value.parameters).map(([k,v])=>(labels[k]||k)+': '+valueText(v)).join(' · ');
 return 'Onbekende waardevorm; bekijk de bron.';
}
export function initIdsUI(api,injected={}){
 const services={readIds,applyIdsImport,saveIdsSource,buildIdsWorkspace,preflightIdsImport,loadIdsFile,loadIdsText,compareIdsRevisions,idsRevisionCandidates,auditIdsDocument,...injected};
 let preview=null,project=null,decisions={},workspace=null,selected=new Set(),focusId='',step=1,page=0,ticket=0,compareTicket=0,controller=null,report=null,audit=null,comparison=null,lastImport=null,detailOwner='',scopePage=0,otherPage=0,reviewPage=0,reqPage=0,comparisonPage=0,changePage=0;
 const pageSize=35;
 let sourceSaveTicket=0,sourceSaveFeedback='';
 let pointerPressed=false,pendingRevitRender=null;
 const dialog=$('idsDialog');
 const currentGroup=()=>workspace?.groups.find(g=>g.requirementIds.includes(focusId))||workspace?.groups[0];
 const validProject=()=>project===api.data();
 function savedSources(){
  const saved=api.data().idsImports||[];
  $('idsSaved').innerHTML='<option value="">Bewaarde IDS-bron kiezen</option>'+saved.map(d=>`<option value="${esc(d.id)}">${esc(d.fileName)}</option>`).join('');
  $('idsSaved').disabled=!saved.length;$('idsOpenSaved').disabled=true;
 }
 function reset(){
  pendingRevitRender=null;sourceSaveFeedback='';
  preview=null;project=null;decisions={};workspace=null;selected.clear();focusId='';page=0;report=null;audit=null;comparison=null;compareTicket++;detailOwner='';scopePage=otherPage=reviewPage=reqPage=comparisonPage=changePage=0;
  for(const id of ['idsRequirements','idsDetail','idsChanges','idsComparison','idsAudit','idsXml'])$(id).innerHTML='';
  $('idsSummary').textContent='Kies een IDS-bestand om de benodigde parameters te bekijken.';$('idsError').textContent='';
  $('idsSearch').value='';$('idsFilter').value='all';$('idsRevision').innerHTML='<option value="">Kies een eerdere bronversie</option>';
  $('idsComparisonOptions').hidden=true;$('idsComparisonFilter').value='review';
  $('idsCompare').disabled=true;$('idsCompareReuse').disabled=true;$('idsShowXml').disabled=true;$('idsSaveSource').disabled=true;$('idsAuditStatus').textContent='';$('idsXmlPanel').open=false;
  $('idsReview').disabled=true;$('idsAdd').disabled=true;$('idsUndoImport').hidden=!lastImport;
  setStep(1);
 }
 function setStep(next){
  step=next;for(const n of [1,2,3]){$('idsStep'+n).hidden=n!==step;$('idsTab'+n).classList?.toggle('primary',n===step);$('idsTab'+n).disabled=n>1&&!preview;}
  $('idsAdd').hidden=step!==3;$('idsBack').hidden=step===1;
  if(step===1&&comparison)renderComparison();
 }
 function invalidate(){report=null;$('idsAdd').disabled=true;if(step===3)setStep(2);}
 function rebuild(){
  invalidate();workspace=services.buildIdsWorkspace(api.data(),api.catalog(),preview,decisions);
  const eligible=new Set(workspace.proposals.filter(p=>p.eligible).map(p=>p.id));for(const id of selected)if(!eligible.has(id))selected.delete(id);
 }
 function summary(){
  if(!workspace)return;
  const c=workspace.counts;
  $('idsSummary').textContent=preview.title+' · '+c.specifications+' specificaties · '+c.requirements+' eisen · '+c.parameters+' parameterdefinities · '+c.eligibleRequirements+' bruikbare eisen · '+selected.size+' geselecteerd.';
  $('idsSaveSource').disabled=false;$('idsShowXml').disabled=false;
  $('idsReview').disabled=!selected.size||audit?.status==='running'||audit?.status==='invalid';
  $('idsSelectAll').disabled=!workspace.groups.some(g=>g.eligibleIds.length);$('idsSelectNone').disabled=!selected.size;
 }
 function filteredGroups(){
  const q=$('idsSearch').value.toLocaleLowerCase('nl'),filter=$('idsFilter').value;
  return workspace.groups.filter(g=>(filter==='all'||filter===g.status||filter==='review'&&g.status==='partial')&&[g.propertySet,g.property,g.dataType,...g.entities,...g.reasons,...g.requirements.map(r=>r.specificationName)].join(' ').toLocaleLowerCase('nl').includes(q));
 }
 function renderList(){
  if(!workspace)return;
  const found=filteredGroups();page=Math.min(page,Math.max(0,Math.ceil(found.length/pageSize)-1));
  $('idsRequirements').innerHTML='<table class="ids-table"><thead><tr><th>Kiezen</th><th>Parameter / propertyset</th><th>Datatype</th><th>IFC</th><th>Revit-parameter</th><th>Status</th></tr></thead><tbody>'+found.slice(page*pageSize,(page+1)*pageSize).map(g=>{
   const chosen=g.eligibleIds.length&&g.eligibleIds.every(id=>selected.has(id));return `<tr class="${g.requirementIds.includes(focusId)?'ids-focused':''}"><td><input type="checkbox" aria-label="Selecteer ${esc(g.property||'parameter')}" data-ids-group="${esc(g.id)}" ${chosen?'checked':''} ${g.eligibleIds.length?'':'disabled'}></td><td><button class="ids-parameter-link" data-ids-focus="${esc(g.requirementIds[0])}">${esc(g.property||'Naam kiezen')}</button><small>${esc(g.propertySet||'Propertyset kiezen')} · ${g.requirementIds.length} eis/eisen</small></td><td>${esc(g.dataType||'Kiezen')}</td><td title="${esc(g.entities.join(', '))}">${g.entities.length}</td><td><input data-ids-revit="${esc(g.id)}" aria-label="Revit-parameter ${esc(g.property||'parameter')}" list="idsRevitOptions" value="${esc(g.revitParameter||'')}" placeholder="${g.revitParameterMixed?'Afwijkingen per toepassing':'Nog koppelen'}">${g.revitSuggested?'<small>Bestaande naam; nieuwe toepassingen vragen je keuze.</small>':''}</td><td><span class="ids-badge ${g.status}">${stateLabels[g.status]}</span></td></tr>`;
  }).join('')+'</tbody></table>'+(found.length?'':'<p>Geen parameterdefinities met dit filter.</p>');
  $('idsPageInfo').textContent=found.length+' parameters · pagina '+(page+1)+' van '+Math.max(1,Math.ceil(found.length/pageSize));
  $('idsPagePrev').disabled=page===0;$('idsPageNext').disabled=(page+1)*pageSize>=found.length;
  $('idsRevitOptions').innerHTML=[...new Set(api.data().rows.map(r=>r.Revit_parameter).filter(Boolean))].sort().map(s=>`<option value="${esc(s)}"></option>`).join('');
  renderOthers();renderScopes();summary();
 }
 function pager(kind,index,total,size,label){return total>size?`<div class="toolbar"><button data-ids-nav="${kind}" data-delta="-1" ${index?'':'disabled'}>Vorige ${label}</button><small>Pagina ${index+1} van ${Math.ceil(total/size)}</small><button data-ids-nav="${kind}" data-delta="1" ${(index+1)*size>=total?'disabled':''}>Volgende ${label}</button></div>`:'';}
 function navigate(e){
  const kind=e.target.dataset.idsNav;if(!kind)return false;const delta=Number(e.target.dataset.delta);
  if(kind==='scope'){scopePage=Math.max(0,scopePage+delta);renderScopes();}else if(kind==='other'){otherPage=Math.max(0,otherPage+delta);renderOthers();}else if(kind==='review'){reviewPage=Math.max(0,reviewPage+delta);renderDetail();}else if(kind==='requirements'){reqPage=Math.max(0,reqPage+delta);renderDetail();}else if(kind==='comparison'){comparisonPage=Math.max(0,comparisonPage+delta);renderComparison();}else if(kind==='changes'){changePage=Math.max(0,changePage+delta);renderChanges();}return true;
 }
 function renderScopes(){
  const scopes=workspace.scopeReviewGroups||[];$('idsScopesCount').textContent=scopes.length+' toepassingsgroepen gezamenlijk beoordelen';
  if(!$('idsScopes').open){$('idsScopesBody').innerHTML='';return;}
  scopePage=Math.min(scopePage,Math.max(0,Math.ceil(scopes.length/20)-1));
  $('idsScopesBody').innerHTML=pager('scope',scopePage,scopes.length,20,'toepassingsgroepen')+scopes.slice(scopePage*20,(scopePage+1)*20).map(s=>`<fieldset><legend>${esc(s.specificationNames.join(', '))}</legend><small>${s.requirementIds.length} eisen · ${s.parameterNames.length} parameterdefinities · ${esc(s.entities.join(', '))}</small>${s.conditions.map(f=>'<p>'+esc(labels[f.kind]||f.kind)+': '+esc(valueText(f))+'</p>').join('')}<details><summary>Betrokken parameters</summary><p>${s.parameterLabels.map(esc).join(' · ')}</p></details><label class="ids-check"><input type="checkbox" data-ids-scope="${esc(s.id)}" ${s.acknowledged?'checked':''}>Deze definities gebruiken voor de gekozen IFC-entiteiten; de getoonde toepassingsfilters apart controleren.</label></fieldset>`).join('');
 }
 function renderOthers(){
  $('idsOtherCount').textContent=workspace.otherRequirements.length+' andere eisen · '+workspace.emptySpecifications.length+' specificaties zonder losse eisen';
  if(!$('idsOther').open){$('idsOtherBody').innerHTML='';return;}
  const all=[...workspace.otherRequirements,...workspace.emptySpecifications.map(s=>({...s,emptySpecification:true}))];otherPage=Math.min(otherPage,Math.max(0,Math.ceil(all.length/35)-1));
  $('idsOtherBody').innerHTML=pager('other',otherPage,all.length,35,'andere eisen')+all.slice(otherPage*35,(otherPage+1)*35).map(r=>r.emptySpecification?`<section><strong>${esc(r.name)}</strong><p>Specificatie zonder afzonderlijke eisen · toepassingsaantallen ${esc(r.minOccurs)} / ${esc(r.maxOccurs)}</p>${(r.applicability||[]).map(f=>'<small>'+esc(labels[f.kind]||f.kind)+': '+esc(valueText(f))+'</small>').join('')}</section>`:`<section><strong>${esc(labels[r.kind]||r.kind)} · ${esc(r.specificationName)}</strong><p>${esc(r.reasons[0])}</p>${Object.entries(r.parameters||{}).map(([k,v])=>'<small>'+esc(labels[k]||k)+': '+esc(valueText(v))+'</small>').join('')}<button data-ids-source="${esc(r.id)}">Bron van deze eis bekijken</button></section>`).join('');
 }
 function renderDetail(targetRequirement){
  const g=currentGroup();if(!g){$('idsDetail').innerHTML='<p>Deze IDS bevat geen gewone propertydefinities. Bekijk de andere eisen of bewaar alleen de bron.</p>';return;}
  focusId=g.requirementIds.includes(focusId)?focusId:g.requirementIds[0];
  if(detailOwner!==focusId)reviewPage=reqPage=0;
  const targetGroup=targetRequirement?g.reviewGroups.findIndex(r=>r.requirementIds.includes(targetRequirement)):-1;
  if(targetGroup>=0)reviewPage=Math.floor(targetGroup/20);
  reviewPage=Math.min(reviewPage,Math.max(0,Math.ceil(g.reviewGroups.length/20)-1));reqPage=Math.min(reqPage,Math.max(0,Math.ceil(g.requirements.length/35)-1));
  const opened=detailOwner===focusId?Array.from($('idsDetail').querySelectorAll?.('details')||[]).map(d=>d.open):[];detailOwner=focusId;
  const field=(key,label,value)=>`<label>${label}<input data-ids-field="${key}" value="${esc(value||'')}"></label>`;
  const review=pager('review',reviewPage,g.reviewGroups.length,20,'voorwaardengroepen')+g.reviewGroups.slice(reviewPage*20,(reviewPage+1)*20).map((r,offset)=>{const i=reviewPage*20+offset;return `<fieldset data-ids-review-group="${i}" tabindex="-1"><legend>Voorwaarden ${i+1} · ${r.requirementIds.length} eisen</legend><small>${esc(r.label)}</small>${r.conditions.map(f=>'<p>'+esc(labels[f.kind]||f.kind)+': '+esc(valueText(f))+'</p>').join('')}${r.values?'<p>Waarde-eisen blijven afzonderlijk te controleren.</p>':''}${[['scope','acknowledgeScope','scopeAcknowledged','Deze definitie voor de gekozen entiteiten gebruiken; de toepassingsfilters apart controleren.'],['values','acknowledgeValues','valuesAcknowledged','Waarde-eisen apart controleren; UDPS vult of controleert deze waarden niet.'],['optional','includeOptional','optionalIncluded','Deze optionele eigenschap ook voorbereiden.']].filter(([condition])=>r[condition]).map(([,key,checked,label])=>`<label class="ids-check"><input type="checkbox" data-ids-review="${i}" data-field="${key}" ${r[checked]?'checked':''}>${label}</label>`).join('')}</fieldset>`;}).join('');
  $('idsDetail').innerHTML=`<h3>${esc(g.property||'Parameter beoordelen')}</h3><p>${g.requirementIds.length} broneisen · ${g.entities.length} IFC-toepassingen</p><div class="ids-fields">${field('propertySet','Propertyset',g.propertySet)}${field('property','Eigenschapsnaam',g.property)}<label>Datatype<select data-ids-field="dataType"><option value="">Kiezen</option>${types.map(t=>`<option ${g.dataType===t?'selected':''}>${t}</option>`).join('')}</select></label>${field('revitParameter','Standaard Revit-parameter',g.revitParameter)}</div><p class="ids-note">Een standaard geldt voor nieuwe koppelingen. Bestaande ingevulde namen blijven behouden. Leeg betekent later koppelen.</p>${[...new Set([...g.reasons,...g.warnings,...g.conflicts])].map(x=>'<p class="relation-warning">'+esc(x)+'</p>').join('')}
   ${review}<details><summary data-ids-disclosure="targets">IFC-doelen kiezen en uitzonderingen</summary><p>Een handmatige doelkeuze vraagt ook beoordeling van de toepassing.</p><input id="idsEntitySearch" type="search" aria-label="Zoek IFC-doel" placeholder="Zoek IFC-entiteit"><div id="idsEntityChoices"></div><h4>Revit-uitzonderingen per entiteit</h4>${g.entities.map(e=>`<label>${esc(e)}<input data-ids-entity-revit="${esc(e)}" value="${esc(g.revitByEntity[e]??'')}" placeholder="Standaard gebruiken"></label>`).join('')}</details>
   <details><summary data-ids-disclosure="requirements">Alle onderliggende IDS-eisen (${g.requirementIds.length})</summary>${pager('requirements',reqPage,g.requirements.length,35,'broneisen')}${g.requirements.slice(reqPage*35,(reqPage+1)*35).map(r=>`<section><strong>${esc(r.specificationName)}</strong><small>${esc(r.cardinality)} · ${esc(r.ifcDataType||'Datatype niet opgegeven')}</small>${Object.entries(r.parameters||{}).map(([k,v])=>'<p>'+esc(labels[k]||k)+': '+esc(valueText(v))+'</p>').join('')}<button data-ids-source="${esc(r.id)}">Bron van deze eis bekijken</button></section>`).join('')}</details>`;
  Array.from($('idsDetail').querySelectorAll?.('details')||[]).forEach((d,i)=>{d.open=opened[i]||false;});renderEntityChoices();
  if(targetRequirement)($('idsDetail').querySelector?.(`[data-ids-review-group="${targetGroup}"]`)||$('idsDetail')).focus();
 }
 function renderEntityChoices(){
  const host=$('idsEntityChoices');if(!host)return;const g=currentGroup(),q=($('idsEntitySearch')?.value||'').toLowerCase();
  host.innerHTML=(api.catalog()?.ifc?.items||[]).filter(x=>x.kind==='class'&&/^Ifc[A-Za-z0-9]+$/.test(x.code)&&!/[A-Z]{2,}$/.test(x.code)&&x.code.toLowerCase().includes(q)).map(x=>`<label class="ids-check"><input type="checkbox" data-ids-entity="${esc(x.code)}" ${g.entities.includes(x.code)?'checked':''}>${esc(x.code)}</label>`).join('');
 }
 function render(targetRequirement){
  pendingRevitRender=null;
  const active=document.activeElement,retain=dialog.contains?.(active)?{id:active.id,dataset:{...active.dataset},start:active.selectionStart,end:active.selectionEnd}:null;
  renderList();renderDetail(targetRequirement);
  if(retain&&!active.isConnected){
   const fields=Object.entries(retain.dataset);
   const target=retain.id?$(retain.id):fields.length?Array.from(dialog.querySelectorAll('input,select,button,summary')).find(node=>fields.every(([key,value])=>node.dataset[key]===value)):null;
   target?.focus({preventScroll:true});
   if(typeof retain.start==='number'&&target?.setSelectionRange)try{target.setSelectionRange(retain.start,retain.end);}catch{}
  }
 }
 function setSourceSaveFeedback(message){
  sourceSaveFeedback=message;
  $('idsError').textContent=message;
 }
 function sourceChoicesChanged(){
  if(!sourceSaveFeedback||$('idsError').textContent!==sourceSaveFeedback)return;
  sourceSaveTicket++;
  sourceSaveFeedback='';
  $('idsError').textContent='Keuzes gewijzigd. Bewaar de bron en keuzes opnieuw.';
 }
 function patch(ids,key,value){sourceChoicesChanged();for(const id of ids){const d=decisions[id]??={};if(value===undefined)delete d[key];else d[key]=value;}rebuild();render();}
 function draftRevit(g,value,entity){
  sourceChoicesChanged();
  for(const id of g.requirementIds){const d=decisions[id]??={};if(entity){const v={...d.revitByEntity};if(value)v[entity]=value;else delete v[entity];d.revitByEntity=v;}else d.revitParameter=value;}
  if(entity){if(value)g.revitByEntity[entity]=value;else delete g.revitByEntity[entity];}else{g.revitParameter=value;g.hasRevitDecision=true;g.revitSuggested=false;}
  invalidate();
 }
 function showPendingRevitEdit(){
  if(pointerPressed||pendingRevitRender!==ticket)return;
  pendingRevitRender=null;
  if(dialog.isConnected&&dialog.open&&validProject())render();
 }
 function releasePointer(){
  pointerPressed=false;
  if(pendingRevitRender!==null)setTimeout(showPendingRevitEdit);
 }
 dialog.addEventListener('pointerdown',()=>{pointerPressed=true;},true);
 document.addEventListener?.('pointerup',releasePointer,true);
 document.addEventListener?.('pointercancel',releasePointer,true);
 function finishRevitEdit(group,value,entity){
  draftRevit(group,value,entity);
  rebuild();
  // A text change can fire on pointerdown, before the intended click is delivered.
  pendingRevitRender=ticket;
  if(!pointerPressed)setTimeout(showPendingRevitEdit);
 }
 function renderAudit(){
  const names={running:'XSD-controle wordt uitgevoerd…',valid:'XSD gecontroleerd',invalid:'Bestand voldoet niet aan het IDS-XSD',unavailable:'XSD-controle niet beschikbaar',unsupported:'Formaat niet door deze XSD-controle ondersteund'};
  $('idsAuditStatus').textContent=names[audit?.status]||'Nog niet gecontroleerd';
  $('idsAudit').innerHTML='<strong>'+esc(names[audit?.status]||'Nog niet gecontroleerd')+'</strong><p>Een XSD-controle is geen volledige IDS-audit of IFC-modelcontrole.</p>'+(audit?.issues||[]).map(i=>'<p>'+esc(message(i))+'</p>').join('');summary();
 }
 async function accept(result,saved,run,loadedProject){
  if(run!==ticket||loadedProject!==api.data())return;preview=result;project=loadedProject;
  const previous=project.idsImports?.find(d=>d.id===result.id);decisions=clone(saved?.decisions??previous?.decisions??{});if(saved?.previousDocumentId||previous?.previousDocumentId)preview.previousDocumentId=saved?.previousDocumentId||previous.previousDocumentId;rebuild();render();setStep(2);savedSources();
  const candidates=services.idsRevisionCandidates(project.idsImports||[],preview);
  $('idsRevision').innerHTML='<option value="">Kies een eerdere bronversie</option>'+candidates.map(d=>`<option value="${esc(d.id)}">${esc(d.fileName||d.title||d.id)}</option>`).join('');
  audit={status:'running',issues:[]};renderAudit();
  try{const result=await services.auditIdsDocument(preview,{signal:controller?.signal});if(run!==ticket||!validProject())return;audit=result;renderAudit();}
  catch(e){if(run!==ticket||e.name==='AbortError')return;audit={status:'unavailable',issues:[{message:e.message}]};renderAudit();}
 }
 async function loadText(xml,fileName,saved={}){
  const run=++ticket,loadedProject=api.data();controller?.abort();controller=new AbortController();reset();$('idsSummary').textContent='IDS-eisen lezen…';
  try{const result=await (injected.readIds?services.readIds(xml,{fileName,...saved}):services.loadIdsText(xml,{fileName,...saved,signal:controller.signal}));await accept(result,saved,run,loadedProject);}
  catch(e){if(run===ticket&&e.name!=='AbortError'){$('idsError').textContent='IDS niet geladen: '+e.message;$('idsSummary').textContent='Geen IDS-eisen geladen.';}}
 }
 $('importIds').onclick=()=>{ticket++;controller?.abort();reset();savedSources();$('idsDialog').showModal();};
 $('idsChoose').onclick=()=>$('idsFile').click();
 $('idsFile').onchange=async e=>{
  const file=e.target.files?.[0];if(!file)return;const run=++ticket,loadedProject=api.data();controller?.abort();controller=new AbortController();reset();
  try{
   if(file.size>IDS_MAX_BYTES)throw Error('IDS-bestand is groter dan 10 MiB.');
   const result=injected.readIds?await services.readIds(await file.text(),{fileName:file.name}):await services.loadIdsFile(file,{signal:controller.signal,onProgress:p=>{if(run===ticket)$('idsSummary').textContent=p.message;}});
   await accept(result,{},run,loadedProject);
  }catch(error){if(run===ticket&&error.name!=='AbortError'){$('idsError').textContent='IDS niet geladen: '+error.message;$('idsSummary').textContent='Geen IDS-eisen geladen.';}}
  finally{e.target.value='';}
 };
 $('closeIds').onclick=()=>{ticket++;controller?.abort();$('idsDialog').close();};$('idsDialog').addEventListener('cancel',()=>{ticket++;controller?.abort();});
 $('idsRequirements').onclick=e=>{const id=e.target.dataset.idsFocus;if(id){focusId=id;render();}};
 $('idsRequirements').oninput=e=>{const g=workspace?.groups.find(g=>g.id===e.target.dataset.idsRevit);if(g)draftRevit(g,e.target.value);};
 $('idsRequirements').onchange=e=>{const t=e.target,g=workspace.groups.find(g=>g.id===(t.dataset.idsGroup||t.dataset.idsRevit));if(!g)return;if(t.dataset.idsRevit!==undefined){finishRevitEdit(g,t.value);return;}for(const id of g.eligibleIds)t.checked?selected.add(id):selected.delete(id);invalidate();renderList();};
 $('idsDetail').oninput=e=>{const t=e.target,g=currentGroup();if(t.id==='idsEntitySearch')renderEntityChoices();else if(g&&t.dataset.idsField==='revitParameter')draftRevit(g,t.value);else if(g&&t.dataset.idsEntityRevit)draftRevit(g,t.value,t.dataset.idsEntityRevit);};
 $('idsDetail').onchange=e=>{
  const t=e.target,g=currentGroup();if(!g)return;
  if(t.dataset.idsField==='revitParameter'){finishRevitEdit(g,t.value);return;}
  if(t.dataset.idsField){patch(g.requirementIds,t.dataset.idsField,t.value||undefined);return;}
  if(t.dataset.idsReview!==undefined){const r=g.reviewGroups[Number(t.dataset.idsReview)];patch(r.requirementIds,t.dataset.field,!!t.checked);return;}
  if(t.dataset.idsEntity){const es=new Set(g.entities);t.checked?es.add(t.dataset.idsEntity):es.delete(t.dataset.idsEntity);for(const id of g.requirementIds)(decisions[id]??={}).acknowledgeScope=false;patch(g.requirementIds,'entities',[...es]);return;}
  if(t.dataset.idsEntityRevit)finishRevitEdit(g,t.value,t.dataset.idsEntityRevit);
 };
 function showSource(e){const id=e.target.dataset.idsSource;if(!id)return;const r=workspace.proposals.find(r=>r.id===id);$('idsXml').textContent=r?.xml||'';$('idsXmlPanel').open=true;}
 $('idsDetail').onclick=e=>{if(!navigate(e))showSource(e);};$('idsOtherBody').onclick=e=>{if(!navigate(e))showSource(e);};$('idsScopesBody').onclick=e=>{navigate(e);};$('idsChanges').onclick=e=>{navigate(e);};
 $('idsComparison').onclick=e=>{
  const id=e.target.dataset.idsCompareFocus;
  if(navigate(e)||!id||!workspace||!validProject())return;
  const groupIndex=workspace.groups.findIndex(g=>g.requirementIds.includes(id));
  if(groupIndex<0)return;
  focusId=id;$('idsSearch').value='';$('idsFilter').value='all';page=Math.floor(groupIndex/pageSize);
  setStep(2);render(id);
 };
 $('idsOther').addEventListener('toggle',()=>{if(workspace)renderOthers();});
 $('idsScopes').addEventListener('toggle',()=>{if(workspace)renderScopes();});
 $('idsScopesBody').onchange=e=>{const s=workspace?.scopeReviewGroups?.find(s=>s.id===e.target.dataset.idsScope);if(s)patch(s.requirementIds,'acknowledgeScope',!!e.target.checked);};
 $('idsShowXml').onclick=()=>{$('idsXml').textContent=preview?.xml||'';$('idsXmlPanel').open=true;};
 $('idsSelectAll').onclick=()=>{for(const g of filteredGroups())for(const id of g.eligibleIds)selected.add(id);invalidate();renderList();};
 $('idsSelectNone').onclick=()=>{selected.clear();invalidate();renderList();};
 for(const id of ['idsSearch','idsFilter'])$(id)[id==='idsSearch'?'oninput':'onchange']=()=>{page=0;renderList();};
 $('idsPagePrev').onclick=()=>{page=Math.max(0,page-1);renderList();};$('idsPageNext').onclick=()=>{page++;renderList();};
 $('idsSaved').onchange=()=>{$('idsOpenSaved').disabled=!$('idsSaved').value;};
 $('idsOpenSaved').onclick=async()=>{const d=api.data().idsImports?.find(d=>d.id===$('idsSaved').value);if(d)await loadText(d.xml,d.fileName,d);};
 $('idsSaveSource').onclick=async()=>{
  const run=ticket,request=++sourceSaveTicket;
  try{
   if(!preview||!validProject())throw Error('Laad de IDS opnieuw voor het huidige project.');
   services.saveIdsSource(api.data(),preview,decisions);
   setSourceSaveFeedback('IDS-bron en keuzes bewaren…');
   const persistence=api.changed();
   savedSources();
   const backend=await persistence;
   if(run!==ticket||request!==sourceSaveTicket||!validProject()||$('idsError').textContent!==sourceSaveFeedback)return;
   setSourceSaveFeedback(backend==='indexeddb'?'Volledige IDS-bron en keuzes bewaard. Er zijn geen koppelingen toegevoegd.':
    backend==='localstorage'?'IDS-bron en keuzes bewaard in de beperkte browseropslag. Bewaar ook een JSON-bestand.':
    'Automatisch bewaren mislukt. De bron en keuzes staan nog in dit project. Sluit de dialoog en kies Menu → Project bewaren voor een JSON-bestand.');
  }catch(error){if(run===ticket&&request===sourceSaveTicket)setSourceSaveFeedback('Niet bewaard: '+error.message);}
 };
 $('idsRevision').onchange=()=>{compareTicket++;comparison=null;$('idsComparison').innerHTML='';$('idsComparisonOptions').hidden=true;$('idsCompareReuse').disabled=true;$('idsCompare').disabled=!$('idsRevision').value;};
 $('idsComparisonFilter').onchange=()=>{if(!comparison)return;comparisonPage=0;renderComparison();};
 $('idsCompare').onclick=async()=>{
  const d=project?.idsImports?.find(d=>d.id===$('idsRevision').value);if(!d||!preview)return;const run=ticket,current=preview,comparisonRun=++compareTicket;
  $('idsCompare').disabled=true;
  try{const old=await (injected.readIds?services.readIds(d.xml,{fileName:d.fileName}):services.loadIdsText(d.xml,{fileName:d.fileName,signal:controller.signal}));if(run!==ticket||comparisonRun!==compareTicket||d.id!==$('idsRevision').value||current!==preview||!validProject())return;
   const result=services.compareIdsRevisions(old,preview,d.decisions||{},{rows:project.rows});
   comparison=comparisonView(result,old,preview);
   $('idsComparisonOptions').hidden=false;$('idsComparisonFilter').value='review';
   comparisonPage=0;renderComparison();$('idsCompareReuse').disabled=!Object.keys(comparison.decisions).length;
  }catch(e){if(comparisonRun===compareTicket&&e.name!=='AbortError')$('idsError').textContent='Vergelijken mislukt: '+e.message;}finally{if(run===ticket&&comparisonRun===compareTicket)$('idsCompare').disabled=false;}
 };
 function renderComparison(){
  const {counts:c,entries,review,warnings}=comparison;
  const visible=$('idsComparisonFilter').value==='all'?entries:review;
  comparisonPage=Math.min(comparisonPage,Math.max(0,Math.ceil(visible.length/50)-1));
  const parameters=new Map(),conditions=new Map();
  for(const group of workspace.groups){
   for(const id of group.requirementIds)parameters.set(id,group);
   for(const requirement of group.reviewGroups)for(const id of requirement.requirementIds)conditions.set(id,requirement);
  }
  const items=visible.slice(comparisonPage*50,(comparisonPage+1)*50).map(entry=>{
   const {previous,current}=entry;
   const ambiguous=entry.status==='ambiguous';
   const side=(label,{names,count})=>{
    if(!ambiguous&&!names)return '';
    return `<small>${label}${ambiguous?` (${count} ${count===1?'eis':'eisen'})`:''}${names?' · '+esc(names):''}</small>`;
   };
   const context=!ambiguous&&previous.names&&previous.names===current.names?`<small>${esc(current.names)}</small>`:
    side('Vorige versie',previous)+side('Huidige versie',current);
   const id=entry.currentIds[0],parameter=parameters.get(id),condition=conditions.get(id);
   const openParameter=entry.review&&parameter&&entry.currentIds.every(id=>parameters.get(id)===parameter&&conditions.get(id)===condition);
   return `<li><strong>${stateLabels[entry.status]} · ${esc(entry.label)}</strong>${context}<small>${esc(entry.reason)}${entry.rows?' · bestaande regels '+entry.rows:''}</small>${openParameter?`<button type="button" data-ids-compare-focus="${esc(id)}">Bekijk parameter</button>`:''}</li>`;
  });
  $('idsComparison').innerHTML=`<p>${c.unchanged} ongewijzigd · ${c.modified} gewijzigd · ${c.added} nieuw · ${c.removed} vervallen · ${c.ambiguous} niet eenduidig.</p>`+
   warnings.map(x=>'<p class="relation-warning">'+esc(x)+'</p>').join('')+pager('comparison',comparisonPage,visible.length,50,'resultaten')+
   (items.length?`<ul>${items.join('')}</ul>`:'<p>Geen eisen om opnieuw te beoordelen.</p>');
 }
 $('idsCompareReuse').onclick=()=>{if(!comparison||!validProject()||comparison.previousDocumentId!==$('idsRevision').value)return;sourceChoicesChanged();preview.previousDocumentId=comparison.previousDocumentId;for(const [id,d] of Object.entries(comparison.decisions))if(!Object.hasOwn(decisions,id))decisions[id]=clone(d);rebuild();render();$('idsError').textContent='Eenduidige keuzes verwerkt. Bekijk de overige eisen bij Te beoordelen.';$('idsCompareReuse').disabled=true;};
 function review(){
  if(!preview||!validProject()||audit?.status==='running'||audit?.status==='invalid')return;
  report=services.preflightIdsImport(api.data(),api.catalog(),preview,[...selected],decisions);
  changePage=0;renderChanges();$('idsAdd').disabled=!report.canApply;setStep(3);
 }
 function renderChanges(){const c=report.counts;changePage=Math.min(changePage,Math.max(0,Math.ceil(report.changes.length/50)-1));$('idsChanges').innerHTML=`<p><strong>${c.new} nieuw · ${c.reuse} hergebruiken · ${c.conflict} conflicten · ${c.skip} overslaan</strong>${c.link?' · '+c.link+' bestaande lege Revit-koppelingen invullen':''}</p>`+(report.errors||[]).map(x=>'<p class="relation-warning">'+esc(x)+'</p>').join('')+pager('changes',changePage,report.changes.length,50,'wijzigingen')+'<div class="tablewrap"><table><thead><tr><th>Actie</th><th>IFC</th><th>Propertyset / eigenschap</th><th>Datatype</th><th>Revit-parameter</th><th>Toelichting</th></tr></thead><tbody>'+report.changes.slice(changePage*50,(changePage+1)*50).map(x=>`<tr><td>${stateLabels[x.status]}</td><td>${esc(x.entity)}</td><td>${esc(x.propertySet)} / ${esc(x.property)}</td><td>${esc(x.dataType)}</td><td>${esc(x.revitParameter||'Nog koppelen')}</td><td>${[...x.reasons,...(x.warnings||[])].map(esc).join(' ')}</td></tr>`).join('')+'</tbody></table></div>';
 }
 $('idsReview').onclick=review;
 $('idsAdd').onclick=()=>{
  try{
   if(step!==3||!report?.canApply||!validProject()||audit?.status==='invalid')throw Error('Controleer eerst het actuele wijzigingsoverzicht.');
   const latest=services.preflightIdsImport(api.data(),api.catalog(),preview,[...selected],decisions);if(JSON.stringify(latest)!==JSON.stringify(report)){review();throw Error('Het project is gewijzigd. Bekijk het vernieuwde overzicht voordat je toevoegt.');}
   const before=clone(api.data()),result=services.applyIdsImport(api.data(),api.catalog(),preview,[...selected],decisions);api.changed();lastImport={project:api.data(),before,after:JSON.stringify(api.data())};
   api.notice?.(result.added+' nieuwe IDS-koppelingen; '+(result.counts?.reuse||0)+' bestaande koppelingen hergebruikt. Ongedaan maken kan via IDS inladen.');ticket++;controller?.abort();$('idsDialog').close();
  }catch(e){$('idsError').textContent='Niet toegevoegd: '+e.message;}
 };
 $('idsUndoImport').onclick=()=>{
  try{if(!lastImport||lastImport.project!==api.data()||lastImport.after!==JSON.stringify(api.data()))throw Error('Het project is intussen gewijzigd; de import kan niet meer veilig ongedaan worden gemaakt.');const d=api.data();d.headers=clone(lastImport.before.headers);d.rows=clone(lastImport.before.rows);if(lastImport.before.idsImports)d.idsImports=clone(lastImport.before.idsImports);else delete d.idsImports;lastImport=null;api.changed();reset();savedSources();$('idsError').textContent='Laatste IDS-toevoeging ongedaan gemaakt.';}catch(e){$('idsError').textContent=e.message;}
 };
 for(const n of [1,2,3])$('idsTab'+n).onclick=()=>{if(n===3)review();else setStep(n);};
 $('idsBack').onclick=()=>setStep(Math.max(1,step-1));reset();return {open(){$('importIds').onclick();}};
}
