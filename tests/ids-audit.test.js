import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {auditIdsDocument} from '../web/ids-audit.js';
const example=fs.readFileSync(new URL('../web/examples/required-property.ids',import.meta.url),'utf8');
const valid=()=>({xml:example,format:{profile:'ids-1.0'}});

test('Actual local WASM engine validates the pinned IDS XSD and reports its separate evidence limits',async()=>{
 const preview=valid(),before=structuredClone(preview),result=await auditIdsDocument(preview);
 assert.equal(result.status,'valid');assert.equal(result.complete,false);assert.deepEqual(preview,before);
 assert.equal(result.checks.find(c=>c.id==='xsd').status,'valid');
 assert.equal(result.checks.find(c=>c.id==='ids-semantics').status,'not-run');
 assert.equal(result.checks.find(c=>c.id==='ifc-model').status,'not-run');assert.deepEqual(result.issues,[]);
});

test('XSD errors include a real source line and do not turn readable XML into a success',async()=>{
 for(const xml of [example.replace('ifcVersion="IFC2X3 IFC4"',''),example.replace('<title>','<unknown>').replace('</title>','</unknown>'),example.replace('dataType="IFCLABEL"','dataType="badLowerCase"')]){
  const result=await auditIdsDocument({xml});assert.equal(result.status,'invalid');
  assert(result.issues.some(i=>i.severity==='error'&&i.code==='XSD_INVALID'&&i.line>0));
 }
});

test('Real XSD check covers restriction structure and typed metadata, not IFC names or model validity',async()=>{
 const unknownIfc=await auditIdsDocument({xml:example.replace('IFCWALL','NOTANIFCENTITY')});
 assert.equal(unknownIfc.status,'valid','IDS entity names are strings in XSD; a full IDS audit is separate');assert.equal(unknownIfc.complete,false);
 const wrongCardinality=await auditIdsDocument({xml:example.replace('<property dataType=', '<property cardinality="sometimes" dataType=')});
 assert.equal(wrongCardinality.status,'invalid');
 const wrongRestriction=await auditIdsDocument({xml:example.replace('<simpleValue>IFCWALL</simpleValue>','<xs:restriction base="xs:string"><xs:minLength value="not-a-number"/></xs:restriction>')});
 assert.equal(wrongRestriction.status,'invalid');
});

test('Input schema URLs are never used instead of the fixed local schema',async()=>{
 for(const location of ['https://untrusted.invalid/evil.xsd','file:///etc/passwd','./another.xsd']){
  const xml=example.replace(/http:\/\/standards\.buildingsmart\.org\/IDS\/1\.0\/ids\.xsd/g,location);
  const result=await auditIdsDocument({xml});assert.equal(result.status,'valid');
 }
});

test('Decoded UTF-16/legacy source declarations validate as Unicode without changing source evidence',async()=>{
 for(const encoding of ['UTF-16','windows-1252']){
  const xml=example.replace(/encoding="[^"]+"/,'encoding="'+encoding+'"').replace('Test IDS','één IDS');
  const preview={xml};const result=await auditIdsDocument(preview);assert.equal(result.status,'valid');assert.equal(preview.xml,xml);
 }
});

test('Unsafe input and explicit unsupported format stay bounded and never claim a completed audit',async()=>{
 const unsafe=await auditIdsDocument({xml:'<!DOCTYPE ids SYSTEM "file:///etc/passwd"><ids/>'});
 assert.equal(unsafe.status,'invalid');assert.equal(unsafe.issues[0].code,'UNSAFE_XML');
 const unsupported=await auditIdsDocument({xml:example,format:{profile:'ids-future'}});assert.equal(unsupported.status,'unsupported');
 const large=await auditIdsDocument({xml:' '.repeat(10*1024*1024+1)});assert.equal(large.status,'unavailable');assert.equal(large.issues[0].code,'AUDIT_LIMIT');
 assert.equal((await auditIdsDocument({})).status,'unavailable');
});

test('Cancelling a check rejects distinctly; a time limit returns unavailable rather than valid',async()=>{
 const cancelled=new AbortController();cancelled.abort();await assert.rejects(auditIdsDocument(valid(),{signal:cancelled.signal}),{name:'AbortError'});
 const active=new AbortController();const pending=auditIdsDocument(valid(),{signal:active.signal});setTimeout(()=>active.abort(),1);
 await assert.rejects(pending,{name:'AbortError'});
 const timed=await auditIdsDocument(valid(),{timeoutMs:1});assert.equal(timed.status,'unavailable');assert.equal(timed.complete,false);assert.match(timed.issues[0].message,/lang/);
});

test('Pinned runtime and offline schema bytes match the published provenance manifest',()=>{
 const base=new URL('../web/vendor/ids-audit/',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('provenance.json',base)));
 assert.equal(manifest.engine.version,'5.3.0');assert.equal(manifest.idsSchema.commit,'870f9c4e6e8f414e737b4d84ca1aa9b46fc6c8f3');
 for(const file of manifest.files){const bytes=fs.readFileSync(new URL(file.path,base));assert.equal(bytes.length,file.bytes,file.path);assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256,file.path);}
});

test('Official reference self-test rejects a crashed negative case rather than counting it as invalid',()=>{
 const script=fileURLToPath(new URL('../scripts/ids-audit-reference.py',import.meta.url));
 const probe=`import importlib.util,sys,subprocess,tempfile,pathlib,io,contextlib,json
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('ids_reference',${JSON.stringify(script)})
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
with tempfile.TemporaryDirectory() as folder:
 path=pathlib.Path(folder)/'input.ids';path.write_text('<ids/>')
 with patch.object(module.subprocess,'run',return_value=subprocess.CompletedProcess([], -7, '', '')):
  report=module.run_audit('dotnet','unused',path)
 assert report['status']=='unavailable' and not report['complete'] and not report['valid']
 with patch.object(module.subprocess,'run',return_value=subprocess.CompletedProcess([], 16, 'Completed with status: IdsContentError.', '')):
  report=module.run_audit('dotnet','unused',path)
 assert report['status']=='invalid' and report['complete']
 extraction=pathlib.Path(folder)/'extract';extraction.mkdir()
 good={'status':'valid','complete':True,'valid':True,'exitCode':0,'output':''}
 crash={'status':'unavailable','complete':False,'valid':False,'exitCode':-7,'output':'reference crashed'}
 output=io.StringIO()
 with patch.object(sys,'argv',['ids-audit-reference.py','--self-test','--dotnet','unused']),patch.object(module,'prepare_tool',return_value=(path,extraction)),patch.object(module,'run_audit',side_effect=[good,crash]),contextlib.redirect_stdout(output):
  result=module.main()
 assert result==2 and json.loads(output.getvalue())['status']=='unavailable'
 print('reference crash boundary passed')
`;
 const result=spawnSync('python3',['-c',probe],{encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
 assert.equal(result.status,0,result.stderr||result.stdout);assert.match(result.stdout,/reference crash boundary passed/);
});
