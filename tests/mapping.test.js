import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {addMapping,availableEntities,usages,unknownEntities,sourceType} from '../web/mapping.js';
import {generate,validate} from '../web/core.js';
const c=JSON.parse(fs.readFileSync(new URL('../web/catalog.json',import.meta.url))),item=c.ils.items.find(x=>x.kind==='property'&&x.code==='Breedte');
const project=()=>({headers:['Y/N','Revit_parameter','IFC_parameter','Export_tabblad','Data_type','IfcWindow'],rows:[]});
test('Only exact IFC class codes are selectable, not invented or predefined codes',()=>{assert(availableEntities(c).some(x=>x.code==='IfcWindow'));assert(!availableEntities(c).some(x=>x.code.includes('.')||x.code==='IfcWindowWINDOW'));assert.throws(()=>addMapping(project(),c,item,'Width',['IfcFake']));});
test('Same source can use different Revit parameters on separate entities',()=>{const d=project();addMapping(d,c,item,'WindowWidth',['IfcWindow']);addMapping(d,c,item,'DoorWidth',['IfcDoor']);assert.equal(usages(d,item).length,2);const r=generate(validate(d));assert.equal(r.errors.length,0);assert.equal(r.mappings,2);assert.match(r.text,/WindowWidth/);assert.match(r.text,/DoorWidth/);assert.equal(sourceType(item),'Length');});
test('Overlapping property assignment rejected without partial changes',()=>{const d=project();addMapping(d,c,item,'Width',['IfcWindow']);const before=JSON.stringify(d);assert.throws(()=>addMapping(d,c,item,'OtherWidth',['IfcWindow','IfcDoor']));assert.equal(JSON.stringify(d),before);});
test('Manual duplicate mappings block export and unknown imports are identified',()=>{const d=project();addMapping(d,c,item,'Width',['IfcWindow']);d.rows.push({...d.rows[0],Revit_parameter:'Other'});assert(generate(d).errors.some(x=>x.includes('Dubbele')));d.headers.push('IfcFake');d.rows[0].IfcFake='x';assert.deepEqual(unknownEntities(d,c),['IfcFake']);});
test('Name-only old rows shown distinctly, source metadata survives JSON',()=>{const d=project();addMapping(d,c,item,'Width',['IfcWindow']);d.rows.push({...d.rows[0],Source_uri:''});assert.deepEqual(usages(d,item).map(x=>x.exact),[true,false]);assert.equal(validate(JSON.parse(JSON.stringify(d))).rows[0].Source_uri,item.uri);});


test('New source application reuses the central Revit preference and preserves source-specific output set',async()=>{const {setUniformDefaults,propertyGroups}=await import('../web/uniform.js');const d=project();addMapping(d,c,item,'Width',['IfcWindow']);setUniformDefaults(d,item.uri,{name:'Breedte',revit:'RC_Breedte',property:item.code,propertySet:'EigenSet',dataType:'Length'});addMapping(d,c,item,'',['IfcDoor'],'BronSet','Length',null,true);assert.equal(d.rows[1].Revit_parameter,'RC_Breedte');assert.equal(d.rows[1].Export_tabblad,'BronSet');assert.equal(propertyGroups(d).length,1);assert.equal(generate(d).errors.length,0);});
