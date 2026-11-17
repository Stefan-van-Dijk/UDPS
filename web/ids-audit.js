// A real, local XSD check. Full IDS semantic audit and IFC validation are separate.
// Engine and schemas are pinned under vendor/ids-audit/; file content is never uploaded.
const MAX_BYTES=10*1024*1024;
const assetRoot=new URL('./vendor/ids-audit/',import.meta.url);
const isNode=typeof process==='object'&&!!process.versions?.node;
let assetPromise;
const notRunChecks=()=>[
 {id:'ids-semantics',status:'not-run',label:'Volledige IDS-inhoudsaudit',message:'Niet uitgevoerd. Een geldige XSD-structuur bewijst nog geen volledige IDS-geldigheid.'},
 {id:'ifc-model',status:'not-run',label:'IFC-modelcontrole',message:'Niet uitgevoerd. Dit onderdeel controleert geen IFC-model.'}
];
function report(status,issues=[],message=''){
 return {status,complete:false,schema:'IDS 1.0',engine:'libxml2 2.13.8 / xmllint-wasm 5.3.0',
 checks:[{id:'xsd',status,label:'IDS 1.0 XSD-controle',message},...notRunChecks()],issues};
}
function abortError(){const error=new Error('IDS-controle geannuleerd.');error.name='AbortError';return error;}
async function assets(){
 if(!assetPromise)assetPromise=Promise.all(['ids.xsd','xml.xsd','XMLSchema.xsd'].map(async name=>{
  const url=new URL('schemas/'+name,assetRoot);let contents;
  if(isNode){const fs=await import('node:fs/promises');contents=await fs.readFile(url,'utf8');}
  else{const response=await fetch(url,{credentials:'same-origin'});if(!response.ok)throw Error('Lokaal controleschema niet beschikbaar ('+response.status+').');contents=await response.text();}
  if(contents.length>512*1024)throw Error('Ongeldig lokaal controleschema.');
  return {fileName:'/schemas/'+name,contents};
 })).catch(error=>{assetPromise=undefined;throw error;});
 return assetPromise;
}
function runEngine(inputFiles,{signal,timeoutMs}){
 return new Promise(async(resolve,reject)=>{
  let worker,timer,settled=false;
  const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);if(worker)worker.terminate();error?reject(error):resolve(value);};
  const cancel=()=>finish(abortError());
  if(signal?.aborted){cancel();return;}
  try{
   if(isNode){const module=await import('node:worker_threads');worker=new module.Worker(new URL('xmllint-node.cjs',assetRoot));}
   else{if(typeof Worker!=='function'||typeof WebAssembly!=='object')throw Error('Deze browser ondersteunt de lokale XSD-controle niet.');worker=new Worker(new URL('xmllint-browser.mjs',assetRoot),{type:'module'});}
   if(signal?.aborted){cancel();return;}
   signal?.addEventListener('abort',cancel,{once:true});
   const handle=data=>{if(data?.['xmllint-wasm']!==true)return;if([0,3,4].includes(data.exitCode))finish(null,data);else finish(Error(data.stderr||'De lokale XML-controle kon niet worden voltooid.'));};
   if(isNode){worker.on('message',handle);worker.on('error',error=>finish(error));worker.on('exit',code=>{if(!settled)finish(Error('De XML-controle is onverwacht gestopt ('+code+').'));});}
   else{worker.addEventListener('message',event=>handle(event.data));worker.addEventListener('error',()=>finish(Error('De lokale XML-controle kon niet worden geladen.')));}
   timer=setTimeout(()=>finish(Error('De IDS-controle duurde te lang; bron bekijken en bewaren blijven beschikbaar.')),timeoutMs);
   // --nonet disables network resolution. --path resolves the fixed schema's
   // imports from this worker's preloaded virtual FS, never from the input IDS.
   worker.postMessage({'xmllint-wasm':true,inputFiles,args:['--nonet','--path','/schemas','--schema','/schemas/ids.xsd','--noout','input.ids'],initialMemory:256,maxMemory:2048});
  }catch(error){finish(error);}
 });
}
function diagnostics(stderr){
 const issues=[];
 for(const line of String(stderr||'').split('\n')){
  const match=/^input\.ids:(\d+):\s*(.*)$/.exec(line);
  if(match)issues.push({severity:'error',code:'XSD_INVALID',line:Number(match[1]),message:match[2]});
 }
 return issues.length?issues:[{severity:'error',code:'XSD_INVALID',message:'Het IDS-document voldoet niet aan het meegeleverde IDS 1.0-schema.'}];
}
export async function auditIdsDocument(preview,{signal,timeoutMs=15000}={}){
 if(signal?.aborted)throw abortError();
 if(typeof preview?.xml!=='string')return report('unavailable',[{severity:'error',code:'XML_MISSING',message:'Er is geen IDS-bron om te controleren.'}]);
 if(new TextEncoder().encode(preview.xml).length>MAX_BYTES)return report('unavailable',[{severity:'error',code:'AUDIT_LIMIT',message:'De XML overschrijdt de controlegrens van 10 MiB.'}]);
 if(preview.format?.profile&&preview.format.profile!=='ids-1.0')return report('unsupported',[{severity:'warning',code:'SCHEMA_VERSION',message:'De lokale XSD-controle ondersteunt IDS 1.0. Dit document blijft als bron beschikbaar.'}]);
 // Apply the same passive-input boundary even if this helper is called directly.
 const declarations=preview.xml.replace(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>/g,'');
 if(/<!\s*(DOCTYPE|ENTITY)\b/i.test(declarations))return report('invalid',[{severity:'error',code:'UNSAFE_XML',message:'DTD en eigen XML-entiteiten zijn niet toegestaan.'}]);
 try{
  const schemas=await assets();if(signal?.aborted)throw abortError();
  // XMLSchema-instance's attributes are built into libxml2. This empty namespace
  // declaration satisfies the redundant import without downloading a document.
  const xsi={fileName:'/schemas/XMLSchema-instance',contents:'<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" targetNamespace="http://www.w3.org/2001/XMLSchema-instance"/>'};
  // The parser hands us Unicode text; the virtual FS writes UTF-8. Only the
  // validation copy's encoding declaration changes, never the saved IDS source.
  const validationXml=preview.xml.replace(/^(\uFEFF?\s*<\?xml\s[^?]*\bencoding\s*=\s*)(['"])[A-Za-z][A-Za-z0-9._-]*\2/i,'$1"UTF-8"');
  const result=await runEngine([...schemas,xsi,{fileName:'input.ids',contents:validationXml}],{signal,timeoutMs:Number.isFinite(timeoutMs)?Math.max(1,Math.min(timeoutMs,60000)):15000});
  return result.exitCode===0?report('valid',[],'De XML voldoet aan het meegeleverde IDS 1.0-XSD.'):report('invalid',diagnostics(result.stderr),'De XML wijkt af van het meegeleverde IDS 1.0-XSD.');
 }catch(error){if(error.name==='AbortError')throw error;return report('unavailable',[{severity:'warning',code:'AUDIT_UNAVAILABLE',message:error.message||'De lokale IDS-controle is niet beschikbaar.'}]);}
}
