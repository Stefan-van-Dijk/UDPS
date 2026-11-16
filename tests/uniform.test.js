import test from 'node:test';
import assert from 'node:assert/strict';
import {validate,generate} from '../web/core.js';
import {propertyGroups,groupEntries,setUniformDefaults,updateApplication,addApplication,mergeProperties,ensurePropertyIds,uniformDefaults} from '../web/uniform.js';
import {addMappings} from '../web/mapping.js';
const headers=['Y/N','Revit_parameter','IFC_parameter','Export_tabblad','Data_type','Source_uri','Source_property_constraints','IfcDoor','IfcWindow'];
const row=(extra={})=>({'Y/N':'x',Revit_parameter:'FireRating',IFC_parameter:'FireRating',Export_tabblad:'Common',Data_type:'Text',Source_uri:'https://example.org/fire',Source_property_constraints:'{"units":[],"allowedValues":[],"constraints":{}}',IfcDoor:'x',IfcWindow:'',...extra});
const project=(rows=[row()])=>validate({headers,rows});
const defaults={name:'Brandwerendheid',revit:'RC_Brandwerendheid',property:'FireRating',propertySet:'RC_Prestaties',dataType:'Text'};
test('Same URI groups across entities, names alone never merge different source concepts',()=>{const d=project([row(),row({IfcDoor:'',IfcWindow:'x'}),row({Source_uri:'https://example.org/other'})]);assert.equal(propertyGroups(d).length,2);assert.equal(groupEntries(d.rows.map(r=>({item:{uri:r.Source_uri},selection:{}}))).length,2);});
test('Uniform defaults apply across entities, preserve a deliberate exception, and survive JSON',()=>{const d=project([row(),row({IfcDoor:'',IfcWindow:'x'})]);setUniformDefaults(d,'https://example.org/fire',defaults);assert(d.rows.every(r=>r.Revit_parameter==='RC_Brandwerendheid'));updateApplication(d,1,'IfcWindow',{Revit_parameter:'WindowRating'});setUniformDefaults(d,'https://example.org/fire',{...defaults,revit:'RC_Nieuw'});assert.deepEqual(d.rows.map(r=>r.Revit_parameter),['RC_Nieuw','WindowRating']);const restored=validate(JSON.parse(JSON.stringify(d)));assert.equal(propertyGroups(restored).length,1);assert.equal(generate(restored).errors.length,0);assert.equal(generate(restored).mappings,2);assert.match(generate(restored).text,/WindowRating/);setUniformDefaults(d,'https://example.org/fire',defaults,true);assert(d.rows.every(r=>r.Revit_parameter==='RC_Brandwerendheid'));});
test('Editing one entity splits a legacy multi-entity row without changing its other applications',()=>{const d=project([row({IfcWindow:'x'})]);updateApplication(d,0,'IfcDoor',{Revit_parameter:'DoorRating',Export_tabblad:'DoorSet'});assert.equal(d.rows.length,2);assert.equal(d.rows.find(r=>r.IfcWindow==='x').Revit_parameter,'FireRating');assert.equal(d.rows.find(r=>r.IfcDoor==='x').Export_tabblad,'DoorSet');assert.equal(propertyGroups(d).length,1);assert.equal(generate(d).errors.length,0);});
test('Manual entity inherits defaults, records own provenance and rejects unknown and duplicate entities atomically',()=>{const d=project();setUniformDefaults(d,'https://example.org/fire',defaults);addApplication(d,'https://example.org/fire','IfcWindow',new Set(['IfcDoor','IfcWindow']));assert.equal(d.rows[1].Mapping_origin,'user');assert.equal(d.rows[1].Source_ifc_references,'[]');assert.equal(d.rows[1].Revit_parameter,'RC_Brandwerendheid');const before=JSON.stringify(d);assert.throws(()=>addApplication(d,'https://example.org/fire','IfcWindow',new Set(['IfcWindow'])));assert.throws(()=>addApplication(d,'https://example.org/fire','IfcFake',new Set(['IfcWindow'])));assert.equal(JSON.stringify(d),before);});
test('First entity reuses an unlinked own property and stable IDs cannot collide after deletion',()=>{const d=project([row({Source_uri:'',IfcDoor:''})]);ensurePropertyIds(d);const key=propertyGroups(d)[0].key;addApplication(d,key,'IfcDoor',new Set(['IfcDoor']));assert.equal(d.rows.length,1);d.rows.splice(0,1);d.rows.push(row({Source_uri:''}));ensurePropertyIds(d);assert.notEqual(propertyGroups(d)[0].key,key);});
test('Explicit merge retains source identity and rejects unit/value/type conflicts without mutation',()=>{const d=project([row(),row({Source_uri:'https://example.org/equal',IfcDoor:'',IfcWindow:'x'})]);assert.throws(()=>mergeProperties(d,'https://example.org/fire','https://example.org/equal',''));mergeProperties(d,'https://example.org/fire','https://example.org/equal','Zelfde classificatie en norm gecontroleerd');assert.equal(propertyGroups(d).length,1);assert.equal(new Set(d.rows.map(r=>r.Source_uri)).size,2);for(const change of [{Data_type:'Real'},{Source_property_constraints:'{"units":["min"]}'},{Source_property_constraints:'{"allowedValues":[{"value":"EI 60"}]}'}]){const p=project([row(),row({Source_uri:'https://example.org/other',...change})]);const before=JSON.stringify(p);assert.throws(()=>mergeProperties(p,'https://example.org/fire','https://example.org/other','Same name'),/Niet samengevoegd/);assert.equal(JSON.stringify(p),before);}});
test('Conflicting uniform output is refused and original project remains unchanged',()=>{const d=project([row(),row({Source_uri:'https://example.org/other',IFC_parameter:'Other'})]);const before=JSON.stringify(d);assert.throws(()=>setUniformDefaults(d,'https://example.org/other',{...defaults,propertySet:'Common'},true),/dubbele/);assert.equal(JSON.stringify(d),before);});

test('Multiline definitions remain metadata and cannot inject UDPS export lines',()=>{const d=project();d.headers.push('Source_description');d.rows[0].Source_description='A definition\nwith a new paragraph\tand a tab';assert.equal(generate(d).errors.length,0);assert(!generate(d).text.includes('paragraph'));d.rows[0].Revit_parameter='Unsafe\tColumn';assert(generate(d).errors.length>0);});

test('Editing other application fields preserves legacy empty-name fallback and existing pending state',()=>{
 const d=project([row({Revit_parameter:'',IfcWindow:'x'})]);
 assert.equal(generate(d).errors.length,0);
 updateApplication(d,0,'IfcDoor',{IFC_parameter:'DoorRating'});
 assert.equal(d.rows.length,2);
 assert.equal(generate(d).errors.length,0);
 setUniformDefaults(d,'https://example.org/fire',{...defaults,revit:'',propertySet:'Common'});
 assert.equal(generate(d).errors.length,0);
 const door=d.rows.findIndex(r=>r.IfcDoor==='x');
 updateApplication(d,door,'IfcDoor',{Revit_parameter:''});
 assert.match(generate(d).errors.join(' '),/Revit-parameter nog koppelen/);
 updateApplication(d,door,'IfcDoor',{Data_type:'Label'});
 assert.equal(d.rows[door].Mapping_pending,'x');
 assert.equal(d.rows.find(r=>r.IfcWindow==='x').Mapping_pending,'');
});

test('An explicitly empty saved Revit default survives reload and preserves matching deliberate exceptions',()=>{
 const key='https://example.org/fire',d=project([row({Revit_parameter:'Original'}),row({Revit_parameter:'Exception',IfcDoor:'',IfcWindow:'x'})]);
 setUniformDefaults(d,key,{...defaults,revit:''});
 updateApplication(d,0,'IfcDoor',{Revit_parameter:'Exception'});
 const restored=validate(JSON.parse(JSON.stringify(d)));
 assert.equal(uniformDefaults(restored,key).revit,'');
 addApplication(restored,key,'IfcWall',new Set(['IfcWall']));
 assert.equal(restored.rows[2].Revit_parameter,'');
 assert.equal(restored.rows[2].Mapping_pending,'x');
 setUniformDefaults(restored,key,{...defaults,revit:'Next'});
 assert.deepEqual(restored.rows.map(r=>r.Revit_parameter),['Exception','Exception','Next']);
 setUniformDefaults(restored,key,{...defaults,revit:'Replace'},true);
 assert(restored.rows.every(r=>r.Revit_parameter==='Replace'));
});

test('Merge checks every retained source context and refuses unit, value or condition conflicts atomically',()=>{
 const catalog={ifc:{items:[{kind:'class',code:'IfcDoor'}]}};
 function entry(uri,code,classUri,agreements){
  const item={uri,code,name:code,classUri,propertySet:'Common',relationUri:classUri+'/relation',dataType:'Length',...agreements};
  return {item,selection:{entity:'IfcDoor',source:'https://example.org/dictionary',classes:[{uri:classUri}],detail:{uri:classUri,properties:[item]}}};
 }
 for(const conflicting of [{units:['cm']},{allowedValues:[{value:'2'}]},{constraints:{minInclusive:2}}]){
  const d=validate({headers:['Y/N','Revit_parameter','IFC_parameter','Export_tabblad','Data_type'],rows:[]});
  const base={units:['m'],allowedValues:[{value:'1'}],constraints:{minInclusive:1}};
  assert.deepEqual(addMappings(d,catalog,[entry('https://example.org/a','A','https://example.org/c1',base),entry('https://example.org/a','A','https://example.org/c2',{...base,...conflicting}),entry('https://example.org/b','B','https://example.org/c3',base)],'Mapped'),{added:2,skipped:1});
  assert.equal(JSON.parse(d.rows[0].Source_contexts).length,2);
  const before=JSON.stringify(d);
  assert.throws(()=>mergeProperties(d,'https://example.org/a','https://example.org/b','Meaning checked'),/Niet samengevoegd/);
  assert.equal(JSON.stringify(d),before);
 }
 const equal=project([row(),row({Source_uri:'https://example.org/other',IfcDoor:'',IfcWindow:'x'})]);
 equal.headers.push('Source_contexts');
 equal.rows.forEach(r=>r.Source_contexts=JSON.stringify([{constraints:JSON.parse(r.Source_property_constraints)}]));
 mergeProperties(equal,'https://example.org/fire','https://example.org/other','Definitions checked');
 assert.equal(propertyGroups(equal).length,1);
});

test('A retained source datatype conflict blocks merge after adding and reloading the project',()=>{
 const catalog={ifc:{items:[{kind:'class',code:'IfcDoor'}]}};
 function entry(uri,code,classUri,dataType){
  const item={uri,code,name:code,classUri,propertySet:'Common',relationUri:classUri+'/relation',dataType};
  return {item,selection:{entity:'IfcDoor',source:'https://example.org/dictionary',classes:[{uri:classUri}],detail:{uri:classUri,properties:[item]}}};
 }
 const d=validate({headers:['Y/N','Revit_parameter','IFC_parameter','Export_tabblad','Data_type'],rows:[]});
 assert.deepEqual(addMappings(d,catalog,[entry('https://example.org/a','A','https://example.org/c1','Text'),entry('https://example.org/a','A','https://example.org/c2','Real'),entry('https://example.org/b','B','https://example.org/c3','Text')],'Mapped'),{added:2,skipped:1});
 const restored=validate(JSON.parse(JSON.stringify(d))),before=JSON.stringify(restored);
 assert.throws(()=>mergeProperties(restored,'https://example.org/a','https://example.org/b','Meaning checked'),/datatypes/);
 assert.equal(JSON.stringify(restored),before);
 const contexts=JSON.parse(restored.rows[0].Source_contexts);
 assert.deepEqual(contexts.map(c=>c.dataType),['Text','Real']);
 assert.deepEqual(contexts.map(c=>c.sourceDataType),['Text','Real']);
});
