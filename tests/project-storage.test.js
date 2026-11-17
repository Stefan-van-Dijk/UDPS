import test from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory} from 'fake-indexeddb';
import {createProjectStore} from '../web/project-storage.js';

const key='udps-project-v1',fallbackKey=key+':storage-fallback-v1',headKey=key+':storage-head-v1';
const project=name=>({version:1,source:name,headers:['Revit_parameter','IFC_parameter','Export_tabblad','Data_type','Y/N'],rows:[],idsImports:[{xml:'<ids>exact original</ids>',decisions:{'spec:0/requirement:0':{revitParameter:'Code',acknowledgeScope:true}}}]});
function memory(seed={}){
 const values=new Map(Object.entries(seed));let fail=()=>false;
 return {getItem:k=>values.get(k)??null,setItem(k,v){if(fail(k,v))throw Error('QuotaExceededError');values.set(k,String(v));},removeItem:k=>values.delete(k),values,failWrites(fn){fail=fn;}};
}
function controlledFactory(){
 const actual=new IDBFactory(),control={failReads:false,failWrites:false,failPut:false,dropCompletion:false,committedWrites:0};
 const factory={open(...args){const request=actual.open(...args);request.addEventListener('success',()=>{const db=request.result,transaction=db.transaction.bind(db);db.transaction=(store,mode,...rest)=>{
  if(mode==='readonly'&&control.failReads||mode==='readwrite'&&control.failWrites)throw Error('Controlled IndexedDB failure');
  const tx=transaction(store,mode,...rest);
  if(mode==='readwrite'&&control.failPut){const objectStore=tx.objectStore.bind(tx);tx.objectStore=name=>{const result=objectStore(name),put=result.put.bind(result);result.put=(...args)=>{const pending=put(...args);queueMicrotask(()=>tx.abort());return pending;};return result;};}
  if(mode==='readwrite'&&control.dropCompletion){Object.defineProperty(tx,'oncomplete',{configurable:true,get:()=>null,set(){}});tx.addEventListener('complete',()=>control.committedWrites++);}
  return tx;
 };});return request;}};
 return {factory,control};
}

test('Legacy local project migrates through a committed IndexedDB transaction without changing the legacy bytes',async()=>{
 const original=JSON.stringify(project('legacy'),null,2),storage=memory({[key]:original}),factory=new IDBFactory();
 const first=await createProjectStore({indexedDB:factory,storage}).load();
 assert.equal(first.backend,'indexeddb');assert.deepEqual(first.project,JSON.parse(original));assert.equal(storage.getItem(key),original);
 const restored=await createProjectStore({indexedDB:factory,storage}).load();
 assert.equal(restored.backend,'indexeddb');assert.deepEqual(restored.project,first.project);
 assert.equal(storage.getItem(fallbackKey),null);
});

test('Large projects persist in IndexedDB when the limited fallback storage rejects project-sized writes',async()=>{
 const storage=memory(),factory=new IDBFactory();storage.failWrites((_k,v)=>v.length>200);
 const data=project('large');data.idsImports[0].xml='x'.repeat(6*1024*1024);
 const saved=await createProjectStore({indexedDB:factory,storage}).save(data);assert.equal(saved.backend,'indexeddb');
 const restored=await createProjectStore({indexedDB:factory,storage}).load();assert.equal(restored.project.idsImports[0].xml,data.idsImports[0].xml);
});

test('Queued saves capture the project at invocation and the last invoked save is persisted',async()=>{
 const storage=memory(),factory=new IDBFactory(),store=createProjectStore({indexedDB:factory,storage}),data=project('first');
 const first=store.save(data);data.source='second';const second=store.save(data);data.source='unsaved third';
 const outcomes=await Promise.all([first,second]);assert(outcomes.every(x=>x.backend==='indexeddb'));
 const restored=await createProjectStore({indexedDB:factory,storage}).load();assert.equal(restored.project.source,'second');
});

test('Fallback data newer than an older IndexedDB record is selected after failed IndexedDB writes',async()=>{
 const storage=memory(),{factory,control}=controlledFactory(),store=createProjectStore({indexedDB:factory,storage});
 assert.equal((await store.save(project('old IDB'))).backend,'indexeddb');
 control.failWrites=true;const saved=await store.save(project('new fallback'));assert.equal(saved.backend,'localstorage');assert.match(saved.warning,/beperkte browseropslag/);
 const restored=await createProjectStore({indexedDB:factory,storage}).load();assert.equal(restored.backend,'localstorage');assert.equal(restored.project.source,'new fallback');
});

test('A recovered IndexedDB write supersedes an older fallback, and unavailable IndexedDB never revives that old fallback',async()=>{
 const storage=memory(),{factory,control}=controlledFactory(),store=createProjectStore({indexedDB:factory,storage});
 control.failWrites=true;assert.equal((await store.save(project('fallback B'))).backend,'localstorage');
 control.failWrites=false;assert.equal((await store.save(project('IDB C'))).backend,'indexeddb');
 let restored=await createProjectStore({indexedDB:factory,storage}).load();assert.equal(restored.project.source,'IDB C');
 control.failReads=true;restored=await createProjectStore({indexedDB:factory,storage}).load();
 assert.equal(restored.backend,'none');assert.equal(restored.project,undefined);assert.equal(restored.recoveryRequired,true);assert.match(restored.warning,/geen oudere kopie automatisch geopend/);
});

test('An unsafe superseding IndexedDB write is not made when an existing fallback cannot be marked',async()=>{
 const storage=memory(),{factory,control}=controlledFactory(),store=createProjectStore({indexedDB:factory,storage});
 control.failWrites=true;await store.save(project('fallback B'));control.failWrites=false;
 storage.failWrites(k=>k===headKey);const saved=await store.save(project('fallback C'));
 assert.equal(saved.backend,'localstorage');const restored=await createProjectStore({indexedDB:factory,storage}).load();assert.equal(restored.project.source,'fallback C');
});

test('When both backends fail the API reports no successful save and retains the original legacy copy',async()=>{
 const original=JSON.stringify(project('legacy')),storage=memory({[key]:original});storage.failWrites(()=>true);
 const store=createProjectStore({indexedDB:null,storage});const outcome=await store.save(project('new unsaved'));
 assert.equal(outcome.backend,'none');assert.match(outcome.warning,/Automatisch bewaren mislukt/);assert.equal(storage.getItem(key),original);
});

test('Unavailable IndexedDB can use a committed fallback without replacing the legacy key',async()=>{
 const original=JSON.stringify(project('legacy')),storage=memory({[key]:original});
 const first=await createProjectStore({indexedDB:null,storage}).load();assert.equal(first.backend,'localstorage');assert.equal(first.project.source,'legacy');
 await createProjectStore({indexedDB:null,storage}).save(project('new local'));
 const restored=await createProjectStore({indexedDB:null,storage}).load();assert.equal(restored.project.source,'new local');assert.equal(storage.getItem(key),original);
});

test('Invalid local JSON and IndexedDB blocking give actionable outcomes rather than hanging',async()=>{
 const corrupt=await createProjectStore({indexedDB:null,storage:memory({[key]:'{broken'})}).load();
 assert.equal(corrupt.backend,'none');assert.equal(corrupt.recoveryRequired,true);assert.match(corrupt.warning,/niet leesbaar/);
 const blockedFactory={open(){const request={};queueMicrotask(()=>request.onblocked?.());return request;}};
 const blocked=await createProjectStore({indexedDB:blockedFactory,storage:memory(),timeoutMs:15}).save(project('fallback'));
 assert.equal(blocked.backend,'localstorage');
 const stalled=await createProjectStore({indexedDB:{open:()=>({})},storage:memory(),timeoutMs:10}).save(project('timeout'));
 assert.equal(stalled.backend,'localstorage');
});

test('Invalid project input rejects before writing any marker or replacing saved data',async()=>{
 const storage=memory(),store=createProjectStore({indexedDB:new IDBFactory(),storage});await store.save(project('keep'));
 const before=new Map(storage.values),cyclic={};cyclic.self=cyclic;
 await assert.rejects(store.save(cyclic),/circular/i);await assert.rejects(store.save(null),/Ongeldig project/);
 assert.deepEqual(storage.values,before);assert.equal((await store.load()).project.source,'keep');
});

test('An unreadable recovery head cannot authorize an older fallback when IndexedDB is inaccessible',async()=>{
 const storage=memory(),{factory,control}=controlledFactory(),store=createProjectStore({indexedDB:factory,storage});
 control.failWrites=true;await store.save(project('fallback B'));control.failWrites=false;await store.save(project('IDB C'));
 storage.values.set(headKey,'{broken');control.failReads=true;
 const result=await createProjectStore({indexedDB:factory,storage}).load();assert.equal(result.backend,'none');assert.equal(result.project,undefined);assert.match(result.warning,/niet leesbaar/);
});

test('A confirmed failed save restores the last committed head and a fresh load recovers the committed project',async()=>{
 const storage=memory(),{factory,control}=controlledFactory(),store=createProjectStore({indexedDB:factory,storage});
 await store.save(project('committed A'));const committedHead=storage.getItem(headKey);
 control.failPut=true;storage.failWrites(k=>k===fallbackKey);
 const failed=await store.save(project('failed B'));assert.equal(failed.backend,'none');assert.match(failed.warning,/Automatisch bewaren mislukt/);
 assert.equal(storage.getItem(headKey),committedHead,'A failed attempt must not claim a newer committed project');
 control.failPut=false;storage.failWrites(()=>false);
 const restored=await createProjectStore({indexedDB:factory,storage}).load();assert.equal(restored.backend,'indexeddb');assert.notEqual(restored.recoveryRequired,true);assert.equal(restored.project.source,'committed A');
});

test('A known failed first save removes only its own temporary marker',async()=>{
 const storage=memory();storage.failWrites(k=>k===fallbackKey);
 assert.equal((await createProjectStore({indexedDB:null,storage}).save(project('failed'))).backend,'none');
 assert.equal(storage.getItem(headKey),null);assert.equal(storage.getItem(fallbackKey),null);
});

test('A concurrently published newer head is preserved when this attempt fails',async()=>{
 const storage=memory(),{factory,control}=controlledFactory(),store=createProjectStore({indexedDB:factory,storage});
 await store.save(project('A'));control.failPut=true;let newerHead;
 storage.failWrites(k=>{if(k!==fallbackKey)return false;const pending=JSON.parse(storage.getItem(headKey));newerHead=JSON.stringify({...pending,revision:pending.revision+1,backend:'indexeddb'});storage.values.set(headKey,newerHead);return true;});
 assert.equal((await store.save(project('failed B'))).backend,'none');assert.equal(storage.getItem(headKey),newerHead);
});

test('A timed-out write that may have committed retains its guard instead of rolling back the head',async()=>{
 const storage=memory(),{factory,control}=controlledFactory(),store=createProjectStore({indexedDB:factory,storage,timeoutMs:40});
 await store.save(project('A'));const before=JSON.parse(storage.getItem(headKey));
 control.dropCompletion=true;storage.failWrites(k=>k===fallbackKey);
 assert.equal((await store.save(project('B committed but notification lost'))).backend,'none');
 assert.equal(control.committedWrites,1,'The actual transaction must have committed before its missing notification times out');
 const guarded=JSON.parse(storage.getItem(headKey));assert.equal(guarded.backend,'pending');assert(guarded.revision>before.revision);
 control.dropCompletion=false;storage.failWrites(()=>false);
 const restored=await createProjectStore({indexedDB:factory,storage}).load();assert.equal(restored.project.source,'B committed but notification lost');
});

test('Corrupt IndexedDB data requires recovery and cannot silently open a legacy project instead',async()=>{
 const factory=new IDBFactory(),storage=memory({[key]:JSON.stringify(project('legacy A'))});
 await createProjectStore({indexedDB:factory,storage}).save(project('B'));
 await new Promise((resolve,reject)=>{const request=factory.open('udps-project-store',1);request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('projects','readwrite');tx.objectStore('projects').put({schema:1,revision:'corrupt',project:project('corrupt B')},key);tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>reject(tx.error);};});
 const restored=await createProjectStore({indexedDB:factory,storage}).load();assert.equal(restored.backend,'none');assert.equal(restored.project,undefined);assert.equal(restored.recoveryRequired,true);
 assert.equal(JSON.parse(storage.getItem(key)).source,'legacy A');
});

test('Corrupt saved fallback state requires recovery even if another readable project exists',async()=>{
 const factory=new IDBFactory(),storage=memory(),store=createProjectStore({indexedDB:factory,storage});
 await store.save(project('A'));storage.values.set(fallbackKey,'{broken saved project');
 const restored=await createProjectStore({indexedDB:factory,storage}).load();assert.equal(restored.backend,'none');assert.equal(restored.project,undefined);assert.equal(restored.recoveryRequired,true);
 assert.equal((await store.save(project('explicit replacement'))).backend,'indexeddb');
 const replaced=await createProjectStore({indexedDB:factory,storage}).load();assert.equal(replaced.project.source,'explicit replacement');assert.notEqual(replaced.recoveryRequired,true);assert.equal(storage.getItem(fallbackKey),null);
});

test('A new browser without supported storage has no saved-state recovery requirement',async()=>{
 for(const storage of [undefined,memory(),{getItem(){throw Error('Storage unsupported');},setItem(){throw Error('Storage unsupported');}}]){
  const restored=await createProjectStore({indexedDB:null,storage}).load();assert.equal(restored.backend,'none');assert.equal(restored.project,undefined);assert.notEqual(restored.recoveryRequired,true);
 }
});
