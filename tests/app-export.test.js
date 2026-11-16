import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {generate,validate} from '../web/core.js';

class Element {
 constructor(){this.value='';this.hidden=false;this.disabled=false;this.textContent='';this.classList={toggle(){}};}
 set innerHTML(value){this.html=value;} get innerHTML(){return this.html||'';}
 addEventListener(){} querySelectorAll(){return [];} showModal(){} close(){}
}
let sequence=0;
async function app(t,project){
 const saved=Object.fromEntries(['document','window','fetch','localStorage','navigator'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const elements=Object.fromEntries([...fs.readFileSync(new URL('../web/index.html',import.meta.url),'utf8').matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element()]));
 const writes=[];const storage=new Map([['udps-project-v1',JSON.stringify(project)]]);
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:async text=>writes.push(text)}}});
 globalThis.document={getElementById:id=>{assert(elements[id],id);return elements[id];},addEventListener(){},querySelectorAll(){return [];}};
 globalThis.window={};
 globalThis.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)};
 globalThis.fetch=async path=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(new URL('../web/'+path.replace('./',''),import.meta.url),'utf8'))});
 t.after(()=>{clearTimeout(globalThis.window.toastTimer);for(const [key,descriptor] of Object.entries(saved)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});
 await import('../web/app.js?export-test='+sequence++);
 await new Promise(resolve=>setImmediate(resolve));
 return {elements,writes};
}
const project=rows=>validate({headers:['Y/N','Revit_parameter','IFC_parameter','Export_tabblad','Data_type','IfcDoor','Mapping_pending'],rows});
const row=extra=>({'Y/N':'x',Revit_parameter:'QA_FireRating',IFC_parameter:'FireRating',Export_tabblad:'QA_Set',Data_type:'Text',IfcDoor:'x',...extra});

test('Invalid or empty exports disable both output actions and cannot copy via the real handler',async t=>{
 for(const [name,data] of [['duplicates',project([row(),row({Revit_parameter:'Other'})])],['pending',project([row({Revit_parameter:'',Mapping_pending:'x'})])],['empty',project([])]])await t.test(name,async t=>{
  const {elements:e,writes}=await app(t,data);
  assert.equal(e.download.disabled,true);
  assert.equal(e.copy.disabled,true);
  await e.copy.onclick();
  assert.deepEqual(writes,[]);
 });
});

test('Valid export copies the current generated text and keeps both actions available',async t=>{
 const data=project([row()]);const {elements:e,writes}=await app(t,data);
 assert.equal(e.download.disabled,false);assert.equal(e.copy.disabled,false);
 await e.copy.onclick();assert.deepEqual(writes,[generate({...data,exportOrder:'propertyset'}).text]);
});
