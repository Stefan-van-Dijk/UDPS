import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {classDetails} from '../web/bsdd.js';
import {collectProperties} from '../web/property-loader.js';
import {addMappings} from '../web/mapping.js';
import {validate} from '../web/core.js';
import {ILS,IFC} from '../web/sources.js';

const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/oe-window-chain.json',import.meta.url)));
const expected=name=>fixture.responses.find(r=>r.className===name&&r.endpoint==='Class/v1').response;
async function storedResponse(url){
 const request=new URL(url),kind=request.pathname.slice('/api/'.length);
 const uri=request.searchParams.get(kind==='Class/v1'?'Uri':'ClassUri');
 const stored=fixture.responses.find(r=>r.endpoint===kind&&(r.response.uri||r.response.classUri)===uri);
 assert(stored,'Unexpected request '+url);
 if(kind==='Class/v1')assert.equal(request.searchParams.get('IncludeChildClassReferences'),'true');
 return {ok:true,json:async()=>structuredClone(stored.response)};
}

test('Published Raam and Dakraam hierarchy survives normalization without adding parent properties',async()=>{
 const raam=await classDetails(expected('Raam').uri,storedResponse);
 const dakraam=await classDetails(expected('Dakraam').uri,storedResponse);
 assert.equal(dakraam.parentClassReference.uri,raam.uri);
 assert(raam.childClassReferences.some(r=>r.uri===dakraam.uri));
 assert.deepEqual(dakraam.hierarchy,expected('Dakraam').hierarchy);
 assert.equal(dakraam.propertySchema,5);
 assert.equal(raam.properties.length,2);
 assert.equal(dakraam.properties.length,2);
 assert(raam.properties.every(p=>p.classUri===raam.uri));
 assert(dakraam.properties.every(p=>p.classUri===dakraam.uri));
});

test('Raam and Dakraam keep their distinct class constraints on the shared ObjectType property',async()=>{
 const details=await Promise.all(['Raam','Dakraam'].map(n=>classDetails(expected(n).uri,storedResponse)));
 const targets=[{uri:IFC+'/class/IfcWindow',code:'IfcWindow'}];
 const result=await collectProperties(details.map(d=>({source:ILS,entity:'IfcWindow',version:'2.0.1',class:{uri:d.uri,name:d.name},classes:[{uri:d.uri}],ifcTargets:targets})),async uri=>details.find(d=>d.uri===uri));
 assert.equal(result.entries.length,4);
 const objectTypes=result.entries.filter(e=>e.item.code==='ObjectType');
 assert.equal(objectTypes.length,2);
 assert.equal(objectTypes[0].item.uri,objectTypes[1].item.uri);
 assert.notEqual(objectTypes[0].item.relationUri,objectTypes[1].item.relationUri);
 assert.deepEqual(objectTypes.map(e=>e.item.constraints.predefinedValue),['Raam','Dakraam']);
 const project=validate({headers:['Y/N','IFC_parameter','Revit_parameter','Export_tabblad','Data_type'],rows:[]});
 assert.deepEqual(addMappings(project,{ifc:{items:[{kind:'class',code:'IfcWindow'}]}},objectTypes,'Type'),{added:1,skipped:1});
 assert.equal(project.rows.length,1);
 const contexts=JSON.parse(project.rows[0].Source_contexts);
 assert.equal(contexts.length,2);
 assert.deepEqual(contexts.map(c=>c.constraints.constraints.predefinedValue),['Raam','Dakraam']);
 assert.deepEqual(contexts.map(c=>c.classUri),details.map(d=>d.uri));
});
