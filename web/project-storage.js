// Project persistence is independent of domain validation: the caller validates
// loaded projects before exposing them for editing. Legacy data remains intact.
const DB_NAME='udps-project-store',STORE='projects',DEFAULT_KEY='udps-project-v1';
const globalValue=name=>{try{return globalThis[name];}catch{return undefined;}};
const validRevision=value=>Number.isSafeInteger(value)&&value>0;
const validRecord=value=>value?.schema===1&&validRevision(value.revision)&&value.project&&typeof value.project==='object'&&!Array.isArray(value.project);
const validHead=value=>value?.schema===1&&validRevision(value.revision)&&['indexeddb','localstorage','pending'].includes(value.backend);
const join=items=>[...new Set(items.filter(Boolean))].join(' ');
function commitError(error,state='not-committed'){const failure=Error(error?.message||'Browser storage failed');failure.commitState=state;return failure;}
const message={
 failed:'Automatisch bewaren mislukt. Bewaar je project nu als JSON-bestand.',
 fallback:'De uitgebreide browseropslag is niet beschikbaar. Het project is bewaard in de beperkte browseropslag; bewaar ook een JSON-bestand.',
 unavailable:'De nieuwste opgeslagen projectversie kan nu niet veilig worden vastgesteld. Er is geen oudere kopie automatisch geopend. Gebruik je JSON-backup of herstel de browseropslag.',
 unreadable:'Een opgeslagen projectkopie is niet leesbaar. Bewaar beschikbare gegevens als JSON voordat je verder werkt.'
};

export function createProjectStore(options={}){
 const factory=Object.hasOwn(options,'indexedDB')?options.indexedDB:globalValue('indexedDB');
 const storage=Object.hasOwn(options,'storage')?options.storage:globalValue('localStorage');
 const key=options.key||DEFAULT_KEY,dbName=options.dbName||DB_NAME,timeoutMs=options.timeoutMs??5000;
 const fallbackKey=key+':storage-fallback-v1',headKey=key+':storage-head-v1';
 let dbPromise=null,clock=0,queue=Promise.resolve();
 const ordered=operation=>{const result=queue.then(operation,operation);queue=result.catch(()=>{});return result;};
 const nextRevision=()=>clock=Math.max(clock+1,Date.now()*1024);
 function localState(){
  const state={fallback:null,head:null,legacy:null,warnings:[]};
  if(!storage)return state;
  let fallback,head;
  try{fallback=storage.getItem(fallbackKey);head=storage.getItem(headKey);state.fallbackText=fallback;state.headText=head;}
  catch{state.warnings.push('De reserveopslag van deze browser is niet bereikbaar.');state.inaccessible=true;state.hasSavedEvidence=!!fallback;return state;}
  try{
   if(fallback){let parsed;try{parsed=JSON.parse(fallback);if(!validRecord(parsed))throw Error('record');}catch(error){state.invalidFallback=true;throw error;}state.fallback=parsed;clock=Math.max(clock,parsed.revision);}
   if(head){const parsed=JSON.parse(head);if(!validHead(parsed))throw Error('head');state.head=parsed;clock=Math.max(clock,parsed.revision);}
  }catch{state.warnings.push(message.unreadable);state.unreadable=true;}
  return state;
 }
 function writeHead(record,backend){
  if(!storage)return false;
  try{storage.setItem(headKey,JSON.stringify({schema:1,revision:record.revision,backend}));return true;}catch{return false;}
 }
 function restoreFailedPending(record,previous){
  if(!storage||!Object.hasOwn(previous,'headText'))return;
  try{
   const current=JSON.parse(storage.getItem(headKey)||'null');
   // Do not undo another save that completed while this attempt was failing.
   if(!validHead(current)||current.backend!=='pending'||current.revision!==record.revision)return;
   if(previous.headText===null)storage.removeItem(headKey);else storage.setItem(headKey,previous.headText);
  }catch{ /* An inaccessible marker remains guarded until storage recovers. */ }
 }
 function open(){
  if(!factory?.open)return Promise.reject(Error('IndexedDB unavailable'));
  if(dbPromise)return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
   let settled=false,request;
   const finish=(error,db)=>{if(settled){db?.close();return;}settled=true;clearTimeout(timer);error?reject(error):resolve(db);};
   const timer=setTimeout(()=>finish(Error('IndexedDB opening timed out')),timeoutMs);
   try{
    request=factory.open(dbName,1);
    request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE);};
    request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();dbPromise=null;};finish(null,db);};
    request.onerror=()=>finish(request.error||Error('IndexedDB open failed'));
    request.onblocked=()=>finish(Error('IndexedDB blocked'));
   }catch(error){finish(error);}
  }).catch(error=>{dbPromise=null;throw error;});
  return dbPromise;
 }
 async function transaction(mode,record){
  let db;try{db=await open();}catch(error){throw mode==='readwrite'?commitError(error):error;}
  return new Promise((resolve,reject)=>{
   let tx,request,result,requestError,settled=false;
   const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(result);};
   const timer=setTimeout(()=>{
    let aborted=!tx;try{tx?.abort();aborted=true;}catch{}
    const error=Error('IndexedDB transaction timed out');
    finish(mode==='readwrite'?commitError(error,aborted?'not-committed':'unknown'):error);
   },timeoutMs);
   try{
    tx=db.transaction(STORE,mode);const store=tx.objectStore(STORE);
    tx.oncomplete=()=>finish(requestError?(mode==='readwrite'?commitError(requestError):requestError):undefined);
    // A request error alone is not a transaction outcome. Wait for abort or
    // complete so a failed attempt cannot be mistaken for an uncertain commit.
    tx.onerror=()=>{requestError=tx.error||request?.error||Error('IndexedDB transaction failed');};
    tx.onabort=()=>{const error=tx.error||requestError||Error('IndexedDB transaction aborted');finish(mode==='readwrite'?commitError(error):error);};
    request=mode==='readonly'?store.get(key):store.put(record,key);
    request.onsuccess=()=>{result=request.result;};
    request.onerror=()=>{requestError=request.error||Error('IndexedDB request failed');};
   }catch(error){
    let aborted=!tx;try{tx?.abort();aborted=true;}catch{}
    finish(mode==='readwrite'?commitError(error,aborted?'not-committed':'unknown'):error);
   }
  });
 }
 async function persist(project){
  const local=localState(),record={schema:1,revision:nextRevision(),project};
  // Once fallback B is newer than IndexedDB A, no later IDB write may leave a
  // marker that still calls B current. A pending head prevents stale recovery
  // if the tab closes between the transaction commit and its final marker.
  const pending=writeHead(record,'pending');
  let indexedError;
  if(!local.fallback||pending){
   try{
    await transaction('readwrite',record);writeHead(record,'indexeddb');
    // After the caller explicitly replaces a recovery-blocked project, remove
    // only the corrupt fallback we observed, and only after the new commit.
    // A newer fallback from another save and the original legacy key survive.
    if(local.invalidFallback)try{if(storage?.getItem(fallbackKey)===local.fallbackText)storage.removeItem(fallbackKey);}catch{}
    return {backend:'indexeddb',...(local.warnings.length?{warning:join(local.warnings)}:{})};
   }catch(error){indexedError=error;}
  }else indexedError=Error('Cannot safely supersede fallback');
  try{
   if(!storage)throw indexedError||Error('localStorage unavailable');
   storage.setItem(fallbackKey,JSON.stringify(record));writeHead(record,'localstorage');
   return {backend:'localstorage',warning:join([...local.warnings,message.fallback])};
  }catch{
   // Neither backend accepted this snapshot. A confirmed failure must not
   // strand an intact previous project behind our temporary pending marker.
   // Keep the marker when a timed-out transaction might still have committed.
   if(pending&&indexedError?.commitState==='not-committed')restoreFailedPending(record,local);
   return {backend:'none',warning:join([...local.warnings,message.failed])};
  }
 }
 function snapshot(project){
  const text=JSON.stringify(project);if(!text)throw Error('Geen project om te bewaren.');
  const parsed=JSON.parse(text);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('Ongeldig project om te bewaren.');
  return parsed;
 }
 return {
  load(){return ordered(async()=>{
   const local=localState();let indexed=null,indexedError,indexedCorrupt=false;
   try{const value=await transaction('readonly');if(value!==undefined){if(!validRecord(value)){indexedCorrupt=true;throw Error('Invalid IndexedDB record');}indexed=value;clock=Math.max(clock,value.revision);}}
   catch(error){indexedError=error;}
   if(local.unreadable||indexedCorrupt)return {backend:'none',recoveryRequired:true,warning:join([...local.warnings,message.unreadable])};
   if(local.inaccessible&&local.hasSavedEvidence)return {backend:'none',recoveryRequired:true,warning:join([...local.warnings,message.unavailable])};
   const candidates=[indexed,local.fallback].filter(Boolean).sort((a,b)=>b.revision-a.revision);
   const newest=candidates[0];
   if(local.head&&(!newest||local.head.revision>newest.revision)||indexedError&&local.head?.backend==='indexeddb'&&local.head.revision>=Number(newest?.revision||0)){
    return {backend:'none',recoveryRequired:true,warning:join([...local.warnings,message.unavailable])};
   }
   if(newest){
    const backend=newest===indexed?'indexeddb':'localstorage';
    return {project:newest.project,backend,...(local.warnings.length||indexedError||backend==='localstorage'?{warning:join([...local.warnings,...(backend==='localstorage'?[message.fallback]:[])])}: {})};
   }
   let legacy,legacyText;
   try{legacyText=storage?.getItem(key);if(legacyText){legacy=JSON.parse(legacyText);if(!legacy||typeof legacy!=='object'||Array.isArray(legacy))throw Error('Invalid legacy');}}
   catch{return {backend:'none',...(legacyText?{recoveryRequired:true}:{}),warning:legacyText?message.unreadable:'Browseropslag is niet beschikbaar. Bewaar je project als JSON-bestand.'};}
   if(legacy){
    const saved=await persist(legacy);
    return {project:legacy,...saved};
   }
   return {backend:'none',...(indexedError?{warning:'Browseropslag is niet beschikbaar. Bewaar je project als JSON-bestand.'}:{})};
  });},
  save(project){
   // Capture at invocation, not when its queued transaction starts. Later edits
   // cannot rewrite an earlier snapshot or race an older save past a newer one.
   let copy;try{copy=snapshot(project);}catch(error){return Promise.reject(error);}
   return ordered(()=>persist(copy));
  }
 };
}
