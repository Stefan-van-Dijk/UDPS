import {IDS_MAX_BYTES} from './ids-document.js?v=1.12.1';
const messages={reading:'IDS-bestand lezen…',decoding:'Tekencodering controleren…',parsing:'IDS-eisen en voorwaarden lezen…'};
const abortError=()=>new DOMException('IDS-inladen geannuleerd.','AbortError');
const checkFile=file=>{
 if(!file||typeof file.arrayBuffer!=='function'||!Number.isFinite(file.size)||file.size<0)throw Error('Verwacht een lokaal IDS-bestand.');
 if(file.size>IDS_MAX_BYTES)throw Error('IDS-bestand is groter dan 10 MiB.');
};
function processIds(request,{signal,onProgress,timeoutMs=60000}={}){
 if(signal?.aborted)return Promise.reject(abortError());
 if(typeof globalThis.Worker!=='function')return Promise.reject(Error('Deze browser ondersteunt geen achtergrondverwerking voor IDS. Gebruik een actuele browser. Het project is niet gewijzigd.'));
 if(!Number.isFinite(timeoutMs)||timeoutMs<=0)return Promise.reject(Error('Ongeldige maximale verwerkingstijd.'));
 return new Promise((resolve,reject)=>{
  let worker,timer,settled=false;
  const finish=(error,result)=>{
   if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);
   if(worker){worker.onmessage=null;worker.onerror=null;worker.onmessageerror=null;worker.terminate();}
   error?reject(error):resolve(result);
  };
  const cancel=()=>finish(abortError());
  signal?.addEventListener('abort',cancel,{once:true});
  try{
   worker=new Worker(new URL('./ids-worker.js?v=1.12.1',import.meta.url),{type:'module',name:'udps-ids-reader'});
   // A cancelled request must never publish a late result, even during startup.
   if(signal?.aborted){cancel();return;}
   worker.onmessage=event=>{
    if(settled)return;
    const data=event.data;
    if(data?.type==='progress'&&Object.hasOwn(messages,data.stage)){
     try{onProgress?.({stage:data.stage,message:messages[data.stage]});}catch(error){finish(error);}
    }else if(data?.type==='result'){
     if(!data.result||typeof data.result.xml!=='string'||!Array.isArray(data.result.specifications))finish(Error('De IDS-achtergrondverwerking gaf geen leesbaar document terug.'));
     else finish(null,data.result);
    }else if(data?.type==='error'){
     const error=Error(data.message||'Het IDS-bestand kon niet worden gelezen.');error.name=data.name||'Error';finish(error);
    }
   };
   worker.onerror=event=>{event.preventDefault?.();finish(Error('IDS-achtergrondverwerking kon niet starten of is onderbroken. Herlaad de app en probeer opnieuw. Het project is niet gewijzigd.'));};
   worker.onmessageerror=()=>finish(Error('De IDS-achtergrondverwerking kon het document niet overdragen. Het project is niet gewijzigd.'));
   timer=setTimeout(()=>finish(Error('Het lezen van de IDS duurde langer dan de maximale verwerkingstijd. Probeer een kleiner bestand. Het project is niet gewijzigd.')),timeoutMs);
   worker.postMessage(request);
  }catch(error){finish(Error('IDS-achtergrondverwerking kon niet starten: '+(error?.message||'onbekende fout')+'. Het project is niet gewijzigd.'));}
 });
}
// File bytes and decoded XML stay off the main interface thread. Each request owns
// one worker, making cancellation a real termination rather than a stale-result flag.
export async function loadIdsFile(file,options={}){
 if(options.signal?.aborted)throw abortError();checkFile(file);
 return processIds({type:'file',file,fileName:options.fileName??file.name??'Ingeladen.ids'},options);
}
export async function loadIdsText(xml,options={}){
 if(options.signal?.aborted)throw abortError();
 if(typeof xml!=='string')throw Error('Verwacht IDS XML-tekst.');
 if(xml.length>IDS_MAX_BYTES)throw Error('IDS-tekst is groter dan 10 MiB in UTF-8.');
 return processIds({type:'text',xml,fileName:options.fileName??'Ingeladen.ids',sourceEncoding:options.sourceEncoding,sourceByteDigest:options.sourceByteDigest},options);
}
