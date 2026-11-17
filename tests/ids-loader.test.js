import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {Worker as ThreadWorker} from 'node:worker_threads';
import {loadIdsFile,loadIdsText} from '../web/ids-loader.js';
import {IDS_MAX_BYTES} from '../web/ids-document.js';

const source=`<?xml version="1.0" encoding="UTF-8"?><ids xmlns="http://standards.buildingsmart.org/IDS" xmlns:xs="http://www.w3.org/2001/XMLSchema"><info><title>Worker example</title></info><specifications><specification name="Two entities" ifcVersion="IFC4"><applicability minOccurs="1" maxOccurs="unbounded"><entity><name><xs:restriction base="xs:string"><xs:enumeration value="IFCWALL"/><xs:enumeration value="IFCDOOR"/></xs:restriction></name></entity><classification><system><simpleValue>Test system</simpleValue></system></classification></applicability><requirements><property dataType="IFCLABEL"><propertySet><simpleValue>Worker_Set</simpleValue></propertySet><baseName><simpleValue>Code </simpleValue></baseName><value><xs:restriction base="xs:string"><xs:pattern value="A.*"/></xs:restriction></value></property><attribute><name><simpleValue>Name</simpleValue></name></attribute><material><value><simpleValue>Timber</simpleValue></value></material><classification><system><simpleValue>Required system</simpleValue></system></classification><entity><name><simpleValue>IFCWALL</simpleValue></name></entity><partOf relation="IFCRELAGGREGATES"><entity><name><simpleValue>IFCBUILDING</simpleValue></name></entity></partOf></requirements></specification></specifications></ids>`;

// The actual browser module worker, bundled parser and postMessage contract run in
// a Node worker-thread adapter. This is not native browser acceptance evidence.
class WorkerAdapter{
 static instances=[];
 constructor(url,options){
  assert.equal(options.type,'module');this.terminated=false;
  const boot=`import {parentPort} from 'node:worker_threads';
   globalThis.self={postMessage:data=>parentPort.postMessage(data)};
   await import(${JSON.stringify(String(url))});
   parentPort.on('message',data=>self.onmessage({data}));`;
  this.thread=new ThreadWorker(boot,{eval:true,type:'module'});
  this.thread.on('message',data=>this.onmessage?.({data}));
  this.thread.on('error',error=>this.onerror?.({message:error.message,preventDefault(){}}));
  WorkerAdapter.instances.push(this);
 }
 postMessage(value){this.thread.postMessage(value);}
 terminate(){this.terminated=true;return this.thread.terminate();}
}
function installWorker(t,implementation=WorkerAdapter){
 const previous=globalThis.Worker;globalThis.Worker=implementation;
 t.after(async()=>{if(previous===undefined)delete globalThis.Worker;else globalThis.Worker=previous;for(const worker of WorkerAdapter.instances)if(!worker.terminated)await worker.terminate();WorkerAdapter.instances.length=0;});
}
const file=(text=source,name='generic.ids')=>new File([text],name);

test('The actual module worker reads all six facets and exact source without reading bytes on the main thread',async t=>{
 installWorker(t);const original=Blob.prototype.arrayBuffer;let mainReads=0;
 Blob.prototype.arrayBuffer=function(){mainReads++;throw Error('Main-thread file read must not occur');};
 const progress=[];
 try{
  const doc=await loadIdsFile(file(),{onProgress:p=>progress.push(p)});
  assert.equal(mainReads,0);assert.equal(doc.xml,source);assert.equal(doc.fileName,'generic.ids');assert.equal(doc.sourceEncoding,'utf-8');
  assert.equal(doc.id,'sha256:'+createHash('sha256').update(source).digest('hex'));
  assert.equal(doc.sourceByteDigest,doc.id);
  assert.deepEqual(doc.specifications[0].requirements.map(r=>r.kind),['property','attribute','material','classification','entity','partOf']);
  assert.equal(doc.specifications[0].requirements[0].parameters.baseName.value,'Code ');
  assert.deepEqual(doc.specifications[0].applicability[0].parameters.name.facets.map(f=>f.value),['IFCWALL','IFCDOOR']);
  assert.deepEqual(progress.map(p=>p.stage),['reading','decoding','parsing']);assert(progress.every(p=>typeof p.message==='string'&&!Object.hasOwn(p,'percent')));
  assert.equal(WorkerAdapter.instances.length,1);assert.equal(WorkerAdapter.instances[0].terminated,true);
 }finally{Blob.prototype.arrayBuffer=original;}
});

test('Worker byte decoding preserves UTF-16 source, encoding and original-byte identity',async t=>{
 installWorker(t);const xml=source.replace('UTF-8','UTF-16'),body=Buffer.from(xml,'utf16le'),bytes=Buffer.concat([Buffer.from([0xff,0xfe]),body]);
 const doc=await loadIdsFile(new File([bytes],'utf16.ids'));
 assert.equal(doc.xml,xml);assert.equal(doc.sourceEncoding,'utf-16le');
 assert.equal(doc.sourceByteDigest,'sha256:'+createHash('sha256').update(bytes).digest('hex'));
 assert.equal(doc.id,'sha256:'+createHash('sha256').update(xml).digest('hex'));
});

test('Saved XML can use the same background reader and retains original decoding evidence',async t=>{
 installWorker(t);const digest='sha256:'+'a'.repeat(64),doc=await loadIdsText(source,{fileName:'saved.ids',sourceEncoding:'utf-16be',sourceByteDigest:digest});
 assert.equal(doc.xml,source);assert.equal(doc.fileName,'saved.ids');assert.equal(doc.sourceEncoding,'utf-16be');assert.equal(doc.sourceByteDigest,digest);
 assert.equal(WorkerAdapter.instances[0].terminated,true);
});

test('Malformed XML, forbidden declarations and invalid bytes reject with parser/decoder errors',async t=>{
 installWorker(t);
 await assert.rejects(loadIdsText('<ids>'),/ongeldige XML/);
 await assert.rejects(loadIdsText('<!DOCTYPE ids><ids/>'),/DTD/);
 await assert.rejects(loadIdsFile(new File([new Uint8Array([0xc3,0x28])],'invalid.ids')),/ongeldige bytes/);
 assert(WorkerAdapter.instances.every(w=>w.terminated));
});

test('Abort before startup and resource limits create no worker and mutate no project',async t=>{
 installWorker(t);const controller=new AbortController();controller.abort();
 await assert.rejects(loadIdsFile(file(),{signal:controller.signal}),{name:'AbortError'});
 await assert.rejects(loadIdsFile({size:IDS_MAX_BYTES+1,arrayBuffer(){throw Error('must not read');}}),/10 MiB/);
 await assert.rejects(loadIdsText('x'.repeat(IDS_MAX_BYTES+1)),/10 MiB/);
 assert.equal(WorkerAdapter.instances.length,0);
});

test('Abort during actual worker processing terminates the owned worker and rejects the request',async t=>{
 installWorker(t);const controller=new AbortController(),progress=[];
 await assert.rejects(loadIdsFile(file(),{signal:controller.signal,onProgress:p=>{progress.push(p.stage);if(p.stage==='parsing')controller.abort();}}),{name:'AbortError'});
 assert(progress.includes('parsing'));assert.equal(WorkerAdapter.instances[0].terminated,true);
});

test('Unavailable or blocked workers fail explicitly instead of silently parsing on the main thread',async t=>{
 installWorker(t,undefined);delete globalThis.Worker;
 await assert.rejects(loadIdsFile(file()),/geen achtergrondverwerking/);
 globalThis.Worker=class {constructor(){throw Error('Blocked by browser policy');}};
 await assert.rejects(loadIdsFile(file()),/kon niet starten.*Blocked by browser policy/);
});

test('A timed-out worker is terminated and late progress/result cannot publish',async t=>{
 let instance;class QuietWorker{constructor(){instance=this;this.terminated=false;}postMessage(){this.saved=this.onmessage;}terminate(){this.terminated=true;}}
 installWorker(t,QuietWorker);const progress=[];
 await assert.rejects(loadIdsFile(file(),{timeoutMs:5,onProgress:p=>progress.push(p)}),/maximale verwerkingstijd/);
 assert.equal(instance.terminated,true);instance.saved({data:{type:'progress',stage:'parsing'}});instance.saved({data:{type:'result',result:{xml:source,specifications:[]}}});
 assert.deepEqual(progress,[]);assert.equal(instance.onmessage,null);
});

test('Pinned browser parser bundle and license match their provenance',()=>{
 const root=new URL('../web/vendor/ids-parser/',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('provenance.json',root)));
 assert.equal(manifest.name,'@xmldom/xmldom');assert.equal(manifest.version,'0.9.12');assert.equal(manifest.license,'MIT');
 for(const [name,sha] of Object.entries(manifest.sha256))assert.equal(createHash('sha256').update(fs.readFileSync(new URL(name,root))).digest('hex'),sha,name+' changed without provenance update');
 assert.match(fs.readFileSync(new URL('LICENSE',root),'utf8'),/Permission is hereby granted/);
});
