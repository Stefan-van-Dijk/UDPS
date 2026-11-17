import {readIds,applyIdsImport,mappingProposals,saveIdsSource,IDS_MAX_BYTES} from './ids.js?v=1.10.0';
import {decodeIdsBytes} from './ids-document.js?v=1.10.0';
import {types} from './core.js?v=1.10.0';
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={entity:'IFC-entiteit',property:'Eigenschap',attribute:'IFC-attribuut',classification:'Classificatie',material:'Materiaal',partOf:'Onderdeelrelatie',name:'Naam',predefinedType:'Predefined type',propertySet:'Propertyset',baseName:'Eigenschapsnaam',value:'Waarde',system:'Classificatiesysteem'};
const message=value=>typeof value==='string'?value:value?.message||JSON.stringify(value);
function valueText(value){
 if(!value)return 'Niet opgegeven';
 if(value.kind==='literal')return JSON.stringify(value.value);
 if(value.kind==='restriction')return (value.facets||[]).map(f=>f.kind+': '+JSON.stringify(f.value)).join(' · ')||'Restrictie';
 if(value.parameters)return Object.entries(value.parameters).map(([k,v])=>(labels[k]||k)+': '+valueText(v)).join(' · ');
 return value.xml||JSON.stringify(value);
}
export function initIdsUI(api,injected={}){
 const services={readIds,applyIdsImport,mappingProposals,saveIdsSource,decodeIdsBytes,...injected};
 let preview=null,decisions={},selected=new Set(),ticket=0,page=0;
 const pageSize=40;
 const requirements=()=>preview?.specifications.flatMap(s=>s.requirements)||[];
 const proposals=()=>preview?services.mappingProposals(preview,api.catalog(),decisions):[];
 const decision=id=>(decisions[id]??={});
 function reset(){
  preview=null;decisions={};selected.clear();page=0;
  $('idsRequirements').innerHTML='';$('idsSummary').textContent='Kies een IDS-bestand om alle eisen te bekijken.';$('idsError').textContent='';
  $('idsSearch').value='';$('idsFilter').value='all';
  for(const id of ['idsScopeAck','idsValuesAck','idsOptional'])$(id).checked=false;
  selection();
 }
 function savedSources(){
  const saved=api.data().idsImports||[];
  $('idsSaved').innerHTML='<option value="">Bewaarde IDS-bron kiezen</option>'+saved.map(d=>`<option value="${esc(d.id)}">${esc(d.fileName)}</option>`).join('');
  $('idsSaved').disabled=!saved.length;$('idsOpenSaved').disabled=true;
 }
 function selection(){
  const list=proposals(),eligible=new Set(list.filter(r=>r.eligible).map(r=>r.id));
  for(const id of selected)if(!eligible.has(id))selected.delete(id);
  $('idsAdd').disabled=!selected.size;$('idsSelectAll').disabled=!eligible.size;$('idsSelectNone').disabled=!selected.size;$('idsSaveSource').disabled=!preview;
  if(preview)$('idsSummary').textContent=preview.title+' · '+preview.specifications.length+' specificaties · '+requirements().length+' eisen · '+eligible.size+' bruikbare koppelvoorstellen · '+selected.size+' geselecteerd. '+(eligible.size<requirements().length?'Dit is een gedeeltelijke import van koppelingen. ':'')+'De volledige IDS kan afzonderlijk worden bewaard. Revit-namen koppel je na het toevoegen.';
 }
 function filtered(){
  const q=$('idsSearch').value.toLocaleLowerCase('nl'),filter=$('idsFilter').value,lookup=new Map(proposals().map(p=>[p.id,p]));
  return preview.specifications.flatMap(s=>s.requirements.length?s.requirements.map(r=>({r,s,p:lookup.get(r.id)||{id:r.id,kind:r.kind,eligible:false,reasons:['Geen koppelvoorstel.'],warnings:[]}})):[{s,r:{id:s.id,kind:'specification',parameters:{}},p:{id:s.id,eligible:false,reasons:['Deze specificatie heeft geen afzonderlijke eisen. Bekijk de toepassingsvoorwaarden.'],warnings:[]},specificationOnly:true}]).filter(({s,r,p})=>{
   const category=p.eligible?'ready':r.kind==='property'&&r.cardinality!=='prohibited'?'review':'other';
   return (filter==='all'||category===filter)&&[s.name,r.kind,p.propertySet,p.property,...(p.entities||[]),...Object.values(r.parameters||{}).map(valueText),...(s.applicability||[]).map(valueText),...(p.reasons||[]),...(p.warnings||[])].join(' ').toLocaleLowerCase('nl').includes(q);
  });
 }
 function edits(r,p){
  if(r.kind!=='property'||r.cardinality==='prohibited')return '';
  const d=decisions[r.id]||{},scope=p.conditions?.conditional||p.requiresScopeReview,values=p.values?.constrained||p.requiresValuesReview;
  const checkbox=(field,text)=>`<label><input type="checkbox" data-ids-decision="${esc(r.id)}" data-field="${field}" ${d[field]?'checked':''}>${text}</label>`;
  return `<details class="ids-edit"><summary>Koppelvoorstel beoordelen of aanpassen</summary><div class="ids-fields">
   <label>Propertyset<input data-ids-decision="${esc(r.id)}" data-field="propertySet" value="${esc(d.propertySet??p.propertySet??'')}"></label>
   <label>Eigenschapsnaam<input data-ids-decision="${esc(r.id)}" data-field="property" value="${esc(d.property??p.property??'')}"></label>
   <label>UDPS-datatype<select data-ids-decision="${esc(r.id)}" data-field="dataType"><option value="">Nog kiezen</option>${types.map(t=>`<option value="${t}" ${(d.dataType??p.dataType)===t?'selected':''}>${t}</option>`).join('')}</select></label>
   <label>IFC-entiteiten, gescheiden door komma's<input data-ids-decision="${esc(r.id)}" data-field="entities" value="${esc((d.entities??p.entities??[]).join(', '))}" placeholder="Bijvoorbeeld IfcWall, IfcDoor"></label></div>
   ${scope?checkbox('acknowledgeScope','Ik gebruik een entiteitbrede parameterdefinitie; UDPS voert de toepassingsfilters niet uit.'):''}
   ${values?checkbox('acknowledgeValues','Ik controleer de waarde-eisen apart; UDPS dwingt deze niet af.'):''}
   ${r.cardinality==='optional'?checkbox('includeOptional','Deze optionele eigenschap ook voorbereiden.'):''}
   <small>Deze keuzes veranderen alleen het koppelvoorstel. De oorspronkelijke IDS blijft ongewijzigd.</small></details>`;
 }
 function render(){
  if(!preview)return;
  const found=filtered();page=Math.min(page,Math.max(0,Math.ceil(found.length/pageSize)-1));
  const warnings=[...(preview.format?.warnings||[]),...(preview.warnings||[])];
  $('idsRequirements').innerHTML=(warnings.length?'<div class="ids-document-warnings">'+[...new Set(warnings.map(message))].map(w=>'<p>'+esc(w)+'</p>').join('')+'</div>':'')+
   found.slice(page*pageSize,(page+1)*pageSize).map(({s,r,p,specificationOnly})=>`<section class="ids-requirement"><h3>${esc(s.name)}</h3><small>${esc(s.ifcVersions.join(', '))} · ${specificationOnly?'Specificatie zonder afzonderlijke eisen':esc(labels[r.kind]||r.kind)+' · '+esc(r.cardinality||'required')} · toepassingsaantallen ${esc(s.minOccurs??'1')} / ${esc(s.maxOccurs??'1')}</small>
   ${specificationOnly?'':`<label class="ids-select"><input type="checkbox" data-ids-requirement="${esc(r.id)}" ${selected.has(r.id)?'checked':''} ${p.eligible?'':'disabled'}><span><strong>${esc(p.propertySet&&p.property?p.propertySet+' / '+p.property:labels[r.kind]||r.kind+'-eis')}</strong><small>${esc((p.entities||[]).join(', ')||'Geen directe IFC-toepassing')} · ${esc(p.ifcDataType||p.dataType||'Datatype nog beoordelen')}</small></span></label>`}
   ${(p.reasons||[]).map(reason=>'<p class="relation-warning">'+esc(message(reason))+'</p>').join('')}${(p.warnings||[]).map(w=>'<p class="ids-note">'+esc(message(w))+'</p>').join('')}
   ${Object.keys(r.parameters||{}).length?'<dl class="ids-parameters">'+Object.entries(r.parameters).map(([k,v])=>'<dt>'+esc(labels[k]||k)+'</dt><dd>'+esc(valueText(v))+'</dd>').join('')+'</dl>':''}
   ${edits(r,p)}<details><summary>Toepassingsvoorwaarden bekijken</summary>${(s.applicability||[]).map(f=>'<p><strong>'+esc(labels[f.kind]||f.kind)+'</strong> · '+esc(valueText(f))+'</p>').join('')}<pre>${esc(s.applicabilityXml||'')}</pre></details>
   ${specificationOnly?'':`<details><summary>Oorspronkelijke eis bekijken</summary><pre>${esc(r.xml||'')}</pre></details>`}</section>`).join('')+(found.length?'':'<p>Geen eisen met dit filter. De volledige bron blijft beschikbaar.</p>')+
   `<details class="ids-full-source"><summary>Volledige oorspronkelijke IDS bekijken</summary><pre>${esc(preview.xml)}</pre></details>`;
  $('idsPageInfo').textContent=found.length+' getoond door filter · pagina '+(page+1)+' van '+Math.max(1,Math.ceil(found.length/pageSize));
  $('idsPagePrev').disabled=page===0;$('idsPageNext').disabled=(page+1)*pageSize>=found.length;selection();
 }
 async function load(xml,fileName,saved={}){
  const run=++ticket,project=api.data();reset();$('idsSummary').textContent='IDS-eisen lezen…';
  try{
   const result=await services.readIds(xml,{fileName,catalog:api.catalog(),sourceEncoding:saved.sourceEncoding,sourceByteDigest:saved.sourceByteDigest});
   if(run!==ticket||project!==api.data())return;
   preview=result;const previous=project.idsImports?.find(d=>d.id===result.id);decisions=JSON.parse(JSON.stringify(saved.decisions??previous?.decisions??{}));render();
  }catch(e){if(run===ticket){$('idsSummary').textContent='Geen IDS-eisen geladen.';$('idsError').textContent='IDS niet geladen: '+e.message;}}
 }
 $('importIds').onclick=()=>{ticket++;reset();savedSources();$('idsDialog').showModal();};
 $('idsChoose').onclick=()=>$('idsFile').click();
 $('idsFile').onchange=async e=>{
  const file=e.target.files?.[0];if(!file)return;
  const run=++ticket,project=api.data();reset();
  try{
   if(file.size>IDS_MAX_BYTES)throw Error('IDS-bestand is groter dan '+IDS_MAX_BYTES/1024/1024+' MiB.');
   const decoded=file.arrayBuffer?await services.decodeIdsBytes(await file.arrayBuffer()):{xml:await file.text()};
   if(run!==ticket||project!==api.data())return;
   await load(decoded.xml,file.name,{sourceEncoding:decoded.encoding,sourceByteDigest:decoded.byteDigest});
  }catch(error){if(run===ticket)$('idsError').textContent='IDS niet geladen: '+error.message;}
  finally{e.target.value='';}
 };
 $('closeIds').onclick=()=>{ticket++;$('idsDialog').close();};$('idsDialog').addEventListener('cancel',()=>ticket++);
 $('idsRequirements').onchange=e=>{
  const t=e.target;
  if(t.dataset.idsDecision){const d=decision(t.dataset.idsDecision),field=t.dataset.field;if(t.type!=='checkbox'&&!t.value)delete d[field];else d[field]=t.type==='checkbox'?t.checked:field==='entities'?t.value.split(',').map(x=>x.trim()).filter(Boolean):t.value;render();return;}
  const id=t.dataset.idsRequirement;if(!proposals().some(r=>r.id===id&&r.eligible))return;t.checked?selected.add(id):selected.delete(id);selection();
 };
 for(const [id,field] of [['idsScopeAck','acknowledgeScope'],['idsValuesAck','acknowledgeValues'],['idsOptional','includeOptional']])$(id).onchange=()=>{
  for(const r of requirements())if(r.kind==='property')decision(r.id)[field]=$(id).checked;
  render();
 };
 $('idsSelectAll').onclick=()=>{for(const {p} of filtered())if(p.eligible)selected.add(p.id);render();};
 $('idsSelectNone').onclick=()=>{selected.clear();render();};
 for(const id of ['idsSearch','idsFilter'])$(id)[id==='idsSearch'?'oninput':'onchange']=()=>{page=0;render();};
 $('idsPagePrev').onclick=()=>{page=Math.max(0,page-1);render();};$('idsPageNext').onclick=()=>{page++;render();};
 $('idsSaved').onchange=()=>{$('idsOpenSaved').disabled=!$('idsSaved').value;};
 $('idsOpenSaved').onclick=async()=>{const saved=api.data().idsImports?.find(d=>d.id===$('idsSaved').value);if(saved)await load(saved.xml,saved.fileName,saved);};
 $('idsSaveSource').onclick=()=>{
  try{if(!preview)throw Error('Laad eerst een IDS-bestand.');services.saveIdsSource(api.data(),preview,decisions);api.changed();savedSources();$('idsError').textContent='Volledige IDS-bron bewaard. Er zijn geen koppelingen toegevoegd.';}
  catch(e){$('idsError').textContent='Niet bewaard: '+e.message;}
 };
 $('idsAdd').onclick=()=>{
  try{if(!preview)throw Error('Laad eerst een IDS-bestand.');const result=services.applyIdsImport(api.data(),api.catalog(),preview,[...selected],decisions);api.changed();api.notice?.(result.added+' IDS-koppelingen toegevoegd; '+result.skipped+' bestaande koppelingen behouden. Vul de Revit-namen in en controleer de IDS-aandachtspunten.');ticket++;$('idsDialog').close();}
  catch(e){$('idsError').textContent='Niet toegevoegd: '+e.message;}
 };
 reset();return {open(){$('importIds').onclick();}};
}
