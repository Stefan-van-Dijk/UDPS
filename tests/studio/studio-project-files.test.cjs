const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../../web/test/project-files.js','utf8');
const files=vm.runInNewContext(source+';UDPSProjectFiles',{structuredClone});
function project(){return {name:'Project A',standards:{width:'Breedte'},rows:[{id:'stable-door',key:'width',entity:'IfcDoor',propertySet:'Pset_DoorCommon',name:'Width',type:'Length',label:'Breedte',active:true,override:null},{id:'stable-window',key:'width',entity:'IfcWindow',propertySet:'Pset_WindowCommon',name:'Width',type:'Length',label:'Breedte',active:false,override:'Raambreedte'}]};}
test('Studio file preserves application ids, independent baseline and project values',()=>{
 const p=project();p.studioContext={schema:1,bookId:'project-a',basisVersion:'1.0',baseProject:structuredClone(p)};
 const raw=files.save(p), reopened=files.open(raw,'project.json');
 assert.deepEqual(Array.from(reopened.rows,r=>r.id),['stable-door','stable-window']);
 assert.deepEqual(Array.from(reopened.rows,r=>files.parameterOf(reopened,r)),['Breedte','Raambreedte']);
 assert.deepEqual(Array.from(reopened.rows,r=>r.active),[true,false]);
 assert.equal(reopened.studioContext.bookId,'project-a');
 assert.equal(reopened.studioContext.baseProject.rows[0].id,'stable-door');
 reopened.studioContext.baseProject.rows[0].name='Mutated';assert.equal(p.rows[0].name,'Width');
 assert.equal(reopened.sourceData.studioContext,undefined);
 assert.deepEqual(Array.from(files.open(files.save(reopened),'again.json').rows,r=>r.id),['stable-door','stable-window']);
});
test('legacy files remain valid without Studio metadata',()=>{
 const p=project();const raw=JSON.parse(files.save(p));assert.ok(!raw.headers.includes('Studio_application_ids'));assert.equal(raw.studioContext,undefined);assert.equal(files.open(JSON.stringify(raw),'old.json').rows.length,2);
});
test('Studio rejects duplicate ids and malformed context instead of corrupting comparisons',()=>{
 const p=project();p.studioContext={schema:1,bookId:'id',basisVersion:null,baseProject:null};const raw=JSON.parse(files.save(p));
 raw.rows[1].Studio_application_ids=JSON.stringify({IfcWindow:'stable-door'});assert.throws(()=>files.open(JSON.stringify(raw),'bad.json'),/dubbele/);
 raw.studioContext={schema:9,bookId:'id'};assert.throws(()=>files.open(JSON.stringify(raw),'bad.json'),/basisgegevens/);
});
test('Studio keeps original source metadata and passive rows alongside stable ids',()=>{
 const p=files.open(JSON.stringify({version:1,source:'Input',headers:['Revit_parameter','IFC_parameter','Y/N','Export_tabblad','Data_type','IfcDoor','Source_uri'],rows:[{Revit_parameter:'R',IFC_parameter:'A','Y/N':'x',Export_tabblad:'P',Data_type:'Text',IfcDoor:'x',Source_uri:'urn:example:a'},{Revit_parameter:'',IFC_parameter:'Passive','Y/N':'',Export_tabblad:'P',Data_type:'Text',IfcDoor:'',Source_uri:'urn:example:passive'}],custom:{keep:true}}),'input.json');
 p.studioContext={schema:1,bookId:'id',basisVersion:'1',baseProject:null};const raw=JSON.parse(files.save(p));assert.equal(raw.rows.length,2);assert.equal(raw.rows[1].Source_uri,'urn:example:passive');assert.deepEqual(raw.custom,{keep:true});assert.equal(files.open(JSON.stringify(raw),'open.json').rows[0].id,p.rows[0].id);
});
test('new source applications never collide with a preserved Studio identity after rows shift',()=>{
 const p=project();p.rows[0].id='udps-1-IfcWindow';p.studioContext={schema:1,bookId:'id',basisVersion:null,baseProject:null};const raw=JSON.parse(files.save(p));
 raw.rows.splice(1,0,{Revit_parameter:'New',IFC_parameter:'New','Y/N':'x',Export_tabblad:'P',Data_type:'Text',IfcWindow:'x'});
 const opened=files.open(JSON.stringify(raw),'sources.json');assert.equal(opened.rows.length,3);assert.equal(opened.rows[0].id,'udps-1-IfcWindow');assert.notEqual(opened.rows[1].id,'udps-1-IfcWindow');assert.equal(new Set(opened.rows.map(row=>row.id)).size,3);
});
