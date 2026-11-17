import test from 'node:test';
import assert from 'node:assert/strict';
import {validate,generate} from '../web/core.js';

const ref={documentId:'sha256:'+'a'.repeat(64),requirementId:'spec:1/requirement:1',specificationId:'spec:1'};
function project(references){
 return {headers:['Revit_parameter','IFC_parameter','Y/N','Export_tabblad','Data_type','IfcWall','IDS_requirements'],rows:[{Revit_parameter:'FireRating',IFC_parameter:'FireRating','Y/N':'x',Export_tabblad:'Pset_WallCommon',Data_type:'Label',IfcWall:'x',IDS_requirements:JSON.stringify(references)}]};
}

test('Bewuste IDS-voorwaarden blijven zichtbaar na bewaren en heropenen en blokkeren export niet',()=>{
 const refs=[{...ref,conditions:{conditional:true},values:{constrained:true}}];
 const data=validate(project(refs));
 const result=generate(data);
 assert.equal(result.errors.length,0);
 assert.equal(result.mappings,1);
 assert.equal(result.warnings.length,1);
 assert.match(result.warnings[0],/toepassingsvoorwaarden en waarde-eisen/);
 assert.match(result.warnings[0],/oorspronkelijke IDS/);
 assert.match(result.warnings[0],/IFC-model afzonderlijk/);
 const reopened=validate(JSON.parse(JSON.stringify(data)));
 assert.equal(reopened.rows[0].IDS_requirements,JSON.stringify(refs));
 assert.deepEqual(generate(reopened).warnings,result.warnings);
 assert.equal(generate(reopened).text,result.text);
});

test('Elke niet-uitgevoerde IDS-voorwaarde wordt ook via bewaarde bevestigingen gemeld',()=>{
 for(const [evidence,expected,absent] of [
  [{conditions:{conditional:true}},/toepassingsvoorwaarden/,/waarde-eisen/],
  [{values:{constrained:true}},/waarde-eisen/,/toepassingsvoorwaarden/],
  [{decisions:{acknowledgeScope:true}},/toepassingsvoorwaarden/,/waarde-eisen/],
  [{decisions:{acknowledgeValues:true}},/waarde-eisen/,/toepassingsvoorwaarden/],
 ]){
  const result=generate(validate(project([{...ref,...evidence}])));
  assert.equal(result.warnings.length,1);
  assert.match(result.warnings[0],expected);
  assert.doesNotMatch(result.warnings[0],absent);
  assert.equal(result.errors.length,0);
 }
});

test('Rechtstreekse en uitgeschakelde IDS-koppelingen geven geen waarschuwing over niet-uitgevoerde voorwaarden',()=>{
 assert.deepEqual(generate(validate(project([ref]))).warnings,[]);
 const data=validate(project([{...ref,conditions:{conditional:true}}]));
 data.rows[0]['Y/N']='';
 assert.deepEqual(generate(data).warnings,[]);
});

test('Onleesbare IDS-herkomst verdwijnt niet stil uit de exportbeoordeling',()=>{
 for(const value of ['{broken','{}','[null]']){
  const data=validate(project([]));data.rows[0].IDS_requirements=value;
  const result=generate(data);
  assert.equal(result.errors.length,0);
  assert.equal(result.warnings.length,1);
  assert.match(result.warnings[0],/IDS-herkomst is niet leesbaar/);
 }
});
