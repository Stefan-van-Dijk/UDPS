// The DOM parser is intentionally loaded only inside this worker.
import {DOMParser,XMLSerializer} from './vendor/ids-parser/xmldom.js?v=1.11.1';
import {decodeIdsBytes,readIds,IDS_MAX_BYTES} from './ids-document.js?v=1.11.1';

self.onmessage=async event=>{
 const request=event.data;
 const progress=stage=>self.postMessage({type:'progress',stage});
 try{
  let xml,encoding,byteDigest;
  if(request?.type==='file'){
   const file=request.file;
   if(!file||typeof file.arrayBuffer!=='function'||!Number.isFinite(file.size)||file.size<0)throw Error('Verwacht een lokaal IDS-bestand.');
   if(file.size>IDS_MAX_BYTES)throw Error('IDS-bestand is groter dan 10 MiB.');
   progress('reading');const buffer=await file.arrayBuffer();
   progress('decoding');({xml,encoding,byteDigest}=await decodeIdsBytes(buffer));
  }else if(request?.type==='text'){
   if(typeof request.xml!=='string')throw Error('Verwacht IDS XML-tekst.');
   xml=request.xml;
  }else throw Error('Onbekende IDS-invoer.');
  progress('parsing');
  const result=await readIds(xml,{fileName:request.fileName,DOMParser,XMLSerializer,sourceEncoding:encoding??request.sourceEncoding,sourceByteDigest:byteDigest??request.sourceByteDigest});
  self.postMessage({type:'result',result});
 }catch(error){
  self.postMessage({type:'error',name:error?.name||'Error',message:error?.message||'Het IDS-bestand kon niet worden gelezen.'});
 }
};
