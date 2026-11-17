import test from 'node:test';
import assert from 'node:assert/strict';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {readIds,mappingProposals,planIdsImport,applyIdsImport,preflightIdsImport,saveIdsSource,validateIdsImports} from '../web/ids.js';
import {buildIdsWorkspace} from '../web/ids-workflow.js';
import {validate,generate} from '../web/core.js';
import {propertyGroups,uniformDefaults,setUniformDefaults} from '../web/uniform.js';
const catalog={ifc:{items:['IfcWall','IfcDoor','IfcWindow'].map(code=>({kind:'class',code}))}};
const empty=()=>validate({headers:['Y/N','Revit_parameter','IFC_parameter','Export_tabblad','Data_type'],rows:[]});
const literal=(name,value)=>`<${name}><simpleValue>${value}</simpleValue></${name}>`;
const property=({name='Code',type='IFCLABEL',set='Example',extra=''}={})=>`<property${type?' dataType="'+type+'"':''}>${literal('propertySet',set)}${literal('baseName',name)}${extra}</property>`;
const entity=names=>`<entity><name>${Array.isArray(names)?'<xs:restriction base="xs:string">'+names.map(n=>'<xs:enumeration value="'+n+'"/>').join('')+'</xs:restriction>':'<simpleValue>'+names+'</simpleValue>'}</name></entity>`;
const specification=({name='Spec',entities='IFCWALL',scope='',requirements=property()}={})=>`<specification name="${name}" ifcVersion="IFC4"><applicability minOccurs="1" maxOccurs="unbounded">${entity(entities)}${scope}</applicability><requirements>${requirements}</requirements></specification>`;
const source=specs=>`<ids xmlns="http://standards.buildingsmart.org/IDS" xmlns:xs="http://www.w3.org/2001/XMLSchema"><info><title>Workflow test</title></info><specifications>${specs}</specifications></ids>`;
const parse=specs=>readIds(source(specs),{DOMParser,XMLSerializer});
const first='spec:0/requirement:0',second='spec:1/requirement:0';
function addRow(data,values={}){for(const k of ['IfcWall','IfcDoor','Mapping_pending','Uniform_id'])if(!data.headers.includes(k))data.headers.push(k);const row=Object.fromEntries(data.headers.map(h=>[h,'']));Object.assign(row,{'Y/N':'x',IFC_parameter:'Code',Export_tabblad:'Example',Data_type:'Label',IfcWall:'x'},values);data.rows.push(row);return row;}

test('Worklist groups exact definitions while retaining independent scope, value and source requirements',async()=>{
 const cls=value=>`<classification>${literal('system','Test')}${literal('value',value)}</classification>`;
 const doc=await parse(specification({name:'A',scope:cls('A')})+specification({name:'B',scope:cls('B')})+specification({name:'C',entities:'IFCDOOR',requirements:property({extra:literal('value','ABC')})}));
 const choices=Object.fromEntries(doc.specifications.flatMap(s=>s.requirements.map(r=>[r.id,{acknowledgeScope:true,acknowledgeValues:true,revitParameter:'Revit_Code'}])));
 const before=structuredClone(doc),workspace=buildIdsWorkspace(empty(),catalog,doc,choices);
 assert.equal(workspace.groups.length,1);const group=workspace.groups[0];
 assert.equal(group.requirements.length,3);assert.deepEqual(group.entities,['IfcWall','IfcDoor']);assert.equal(group.reviewGroups.length,3);
 assert.equal(group.requirementIds.length,3);assert.equal(group.eligibleIds.length,3);assert.equal(group.revitParameter,'Revit_Code');assert.equal(group.revitSuggested,false);
 assert.deepEqual(doc,before,'Grouping must not rewrite evidence');
 const result=planIdsImport(empty(),catalog,doc,group.eligibleIds,choices);
 assert.equal(result.added,2);assert.equal(result.skipped,1);assert.equal(propertyGroups(result.project).length,1,'One new definition is one central property');
 assert.equal(result.project.rows[0].Uniform_id,result.project.rows[1].Uniform_id);
 assert.equal(JSON.parse(result.project.rows[0].IDS_requirements).length,2);assert.equal(JSON.parse(result.project.rows[1].IDS_requirements).length,1);
 assert.equal(result.project.idsImports[0].xml,doc.xml);assert.equal(generate(result.project).warnings.length,2);
});

test('Equal scope evidence groups review actions but different conditions never share an acknowledgment group',async()=>{
 const scope=value=>`<classification>${literal('system','Test')}${literal('value',value)}</classification>`;
 const doc=await parse(specification({name:'First',scope:scope('A')})+specification({name:'Same content',scope:scope('A')})+specification({name:'Different',scope:scope('B')}));
 const group=buildIdsWorkspace(empty(),catalog,doc).groups[0];assert.equal(group.reviewGroups.length,2);
 assert.deepEqual(group.reviewGroups[0].requirementIds,[first,second]);assert.equal(group.reviewGroups[1].requirementIds.length,1);
 const ids=group.reviewGroups[0].requirementIds,choices=Object.fromEntries(ids.map(id=>[id,{acknowledgeScope:true}]));
 const updated=buildIdsWorkspace(empty(),catalog,doc,choices).groups[0];assert.deepEqual(updated.eligibleIds,ids);assert.equal(updated.status,'partial');
});

test('Unknown specification semantics are never collapsed into one review action',async()=>{
 const firstSpec=specification({name:'One'}).replace('<specification ','<specification vendorRule="One" '),secondSpec=specification({name:'Two'}).replace('<specification ','<specification vendorRule="Two" ');
 const doc=await parse(firstSpec+secondSpec),workspace=buildIdsWorkspace(empty(),catalog,doc);
 assert.equal(workspace.groups.length,1);assert.equal(workspace.groups[0].reviewGroups.length,2);
 assert(workspace.groups[0].reviewGroups.every(g=>g.scope&&g.requirementIds.length===1));
});

test('Different datatypes and symbolic names stay separate, with exact name identities preserved',async()=>{
 const doc=await parse(specification({requirements:property()+property({type:'IFCINTEGER'})+property({name:' Code '})+property({name:'Other'})}));
 const groups=buildIdsWorkspace(empty(),catalog,doc).groups;
 assert.equal(groups.length,4);assert(groups.filter(g=>g.property==='Code').every(g=>g.warnings.some(w=>w.includes('verschillende datatype'))));
 assert.equal(groups.find(g=>g.property===' Code ').eligibleIds.length,0);assert.equal(groups.find(g=>g.property===' Code ').property,' Code ');
 const symbolic='<property dataType="IFCLABEL">'+literal('propertySet','Example')+'<baseName><xs:restriction base="xs:string"><xs:pattern value="A.*"/></xs:restriction></baseName></property>';
 const unresolved=buildIdsWorkspace(empty(),catalog,await parse(specification({requirements:symbolic+symbolic}))).groups;
 assert.equal(unresolved.length,2,'Unresolved name expressions are not silently a shared concrete property');
});

test('Other IFC routes give one actionable route explanation rather than impossible property fixes',async()=>{
 const doc=await parse(specification({requirements:`<material>${literal('value','Material')}</material><attribute>${literal('name','Name')}</attribute>`}));
 const workspace=buildIdsWorkspace(empty(),catalog,doc);assert.equal(workspace.groups.length,0);assert.equal(workspace.otherRequirements.length,2);
 for(const r of [...workspace.otherRequirements,...mappingProposals(doc,catalog)]){assert.equal(r.eligible,false);assert.equal(r.reasons.length,1);assert.doesNotMatch(r.reasons[0],/eigenschapsnaam|datatype/);}
});

test('Direct Revit names and entity exceptions are applied, stored and roundtripped without pending errors',async()=>{
 const doc=await parse(specification({entities:['IFCWALL','IFCDOOR']})),data=empty(),choices={[first]:{revitParameter:'Code_Default',revitByEntity:{IfcDoor:'Code_Door'}}};
 const preview=preflightIdsImport(data,catalog,doc,[first],choices);
 assert.equal(preview.canApply,true);assert.deepEqual(preview.counts,{new:2,reuse:0,conflict:0,skip:0,link:0});assert.equal(data.rows.length,0);
 const result=applyIdsImport(data,catalog,doc,[first],choices);assert.deepEqual(result.changes,preview.changes);assert.deepEqual(result.counts,preview.counts);
 assert.equal(data.rows.find(r=>r.IfcWall==='x').Revit_parameter,'Code_Default');assert.equal(data.rows.find(r=>r.IfcDoor==='x').Revit_parameter,'Code_Door');assert(data.rows.every(r=>r.Mapping_pending===''));
 assert.equal(generate(data).errors.length,0);
 const group=propertyGroups(data)[0],defaults=uniformDefaults(data,group.key);assert.equal(defaults.revit,'Code_Default');
 setUniformDefaults(data,group.key,{...defaults,revit:'Updated_Default'});assert.equal(data.rows.find(r=>r.IfcWall==='x').Revit_parameter,'Updated_Default');assert.equal(data.rows.find(r=>r.IfcDoor==='x').Revit_parameter,'Code_Door','Entity exception survives a central default change');
 const restored=validate(JSON.parse(JSON.stringify(data)));assert.deepEqual(restored.idsImports[0].decisions,choices);
 assert.deepEqual(buildIdsWorkspace(restored,catalog,doc).groups[0].revitByEntity,{IfcDoor:'Code_Door'});
});

test('Existing filled names are preserved, pending single-entity rows fill explicitly and shared rows remain intact',async()=>{
 const doc=await parse(specification({entities:['IFCWALL','IFCDOOR']})),data=empty();
 addRow(data,{Revit_parameter:'Keep',Uniform_id:'existing'});addRow(data,{IfcWall:'',IfcDoor:'x',Mapping_pending:'x',Uniform_id:'pending'});
 const choices={[first]:{revitParameter:'Incoming'}},before=structuredClone(data),preview=preflightIdsImport(data,catalog,doc,[first],choices);
 assert.equal(preview.counts.reuse,2);assert.equal(preview.counts.link,1);assert.equal(preview.changes.find(c=>c.entity==='IfcWall').revitParameter,'Keep');assert.equal(preview.changes.find(c=>c.entity==='IfcDoor').updateRevit,true);
 assert.deepEqual(data,before);
 const applied=applyIdsImport(data,catalog,doc,[first],choices);assert.deepEqual(applied.changes,preview.changes);assert.equal(data.rows[0].Revit_parameter,'Keep');assert.equal(data.rows[0].Uniform_id,'existing');assert.equal(data.rows[1].Revit_parameter,'Incoming');assert.equal(data.rows[1].Uniform_id,'pending');
 const shared=empty();addRow(shared,{IfcDoor:'x',Mapping_pending:'x'});
 const p=preflightIdsImport(shared,catalog,doc,[first],choices);assert(p.changes.every(c=>c.revitParameter===''));assert(p.changes.every(c=>c.warnings.length===1));assert.equal(p.counts.link,0);
 applyIdsImport(shared,catalog,doc,[first],choices);assert.equal(shared.rows.length,1);assert.equal(shared.rows[0].Revit_parameter,'');
});

test('Consistent existing names are suggestions until explicitly chosen for new entities',async()=>{
 const doc=await parse(specification({entities:['IFCWALL','IFCDOOR']})),data=empty();addRow(data,{Revit_parameter:'Existing'});
 const group=buildIdsWorkspace(data,catalog,doc).groups[0];assert.equal(group.revitParameter,'Existing');assert.equal(group.revitSuggested,true);assert.equal(group.hasRevitDecision,false);
 const dry=preflightIdsImport(data,catalog,doc,[first]);assert.equal(dry.changes.find(c=>c.status==='new').revitParameter,'');
 const chosen=preflightIdsImport(data,catalog,doc,[first],{[first]:{revitParameter:group.revitParameter}});assert.equal(chosen.changes.find(c=>c.status==='new').revitParameter,'Existing');
});

test('Preflight shows conflicts and skips without mutation and application rejects the whole selection',async()=>{
 const doc=await parse(specification({requirements:property()+property({name:'New'})})),data=empty();addRow(data,{Revit_parameter:'Keep',Data_type:'Text'});const before=structuredClone(data);
 const ids=doc.specifications[0].requirements.map(r=>r.id),preview=preflightIdsImport(data,catalog,doc,ids);
 assert.equal(preview.canApply,false);assert.equal(preview.counts.conflict,1);assert.equal(preview.counts.new,1);assert(preview.errors.some(e=>e.includes('datatype')));
 assert.deepEqual(data,before);assert.throws(()=>applyIdsImport(data,catalog,doc,ids),/datatype/);assert.deepEqual(data,before);
 const blocked=preflightIdsImport(data,catalog,doc,['spec:99/requirement:0']);assert.equal(blocked.counts.skip,1);assert.equal(blocked.canApply,false);
});

test('Conflicting choices for one output slot are reported; an unspecified default does not conflict with an explicit choice',async()=>{
 const doc=await parse(specification()+specification()),data=empty(),ids=[first,second];
 const bad={[first]:{revitParameter:'One'},[second]:{revitParameter:'Two'}};
 assert.equal(preflightIdsImport(data,catalog,doc,ids,bad).counts.conflict,1);assert.throws(()=>applyIdsImport(data,catalog,doc,ids,bad),/Verschillende Revit/);assert.equal(data.rows.length,0);
 const good={[second]:{revitParameter:'Explicit'}},result=planIdsImport(data,catalog,doc,ids,good);assert.equal(result.project.rows[0].Revit_parameter,'Explicit');assert.equal(JSON.parse(result.project.rows[0].IDS_requirements).length,2);
});

test('Preflight includes saved-source and provenance failures before permitting an import',async()=>{
 const doc=await parse(specification()),data=empty();saveIdsSource(data,doc);
 const altered={...doc,xml:doc.xml+'<!--changed-->'},collision=preflightIdsImport(data,catalog,altered,[first]);assert.equal(collision.canApply,false);assert.match(collision.errors.join(' '),/verschillende inhoud/);
 const broken=empty();addRow(broken,{Revit_parameter:'Keep',IDS_requirements:'{broken'});if(!broken.headers.includes('IDS_requirements'))broken.headers.push('IDS_requirements');
 const before=structuredClone(broken),preview=preflightIdsImport(broken,catalog,doc,[first]);assert.equal(preview.canApply,false);assert.match(preview.errors.join(' '),/herkomst/);assert.deepEqual(broken,before);
});

test('Revit names reject export-control characters atomically while empty names deliberately remain pending',async()=>{
 const doc=await parse(specification()),data=empty();
 for(const name of ['Bad\tName',' Leading','Trailing ']){const choices={[first]:{revitParameter:name}};assert.equal(preflightIdsImport(data,catalog,doc,[first],choices).canApply,false);assert.throws(()=>applyIdsImport(data,catalog,doc,[first],choices),/Revit/);assert.equal(data.rows.length,0);}
 applyIdsImport(data,catalog,doc,[first],{[first]:{revitParameter:''}});assert.equal(data.rows[0].Mapping_pending,'x');assert(generate(data).errors.length);
});


test('Explicit previous IDS document is retained through source save, mapping import and project roundtrip',async()=>{
 const oldDoc=await parse(specification({name:'Earlier'})),nextDoc=await parse(specification({name:'Later'})),data=empty();
 saveIdsSource(data,oldDoc);const newId=nextDoc.id;nextDoc.previousDocumentId=oldDoc.id;
 saveIdsSource(data,nextDoc,{[first]:{revitParameter:'Revit_Code'}});
 let restored=validate(JSON.parse(JSON.stringify(data)));assert.equal(restored.idsImports[1].id,newId);assert.equal(restored.idsImports[1].previousDocumentId,oldDoc.id);assert.equal(restored.idsImports[1].xml,nextDoc.xml);
 const noLineageMetadata={...nextDoc};delete noLineageMetadata.previousDocumentId;
 applyIdsImport(restored,catalog,noLineageMetadata,[first]);restored=validate(JSON.parse(JSON.stringify(restored)));
 assert.equal(restored.idsImports[1].previousDocumentId,oldDoc.id,'Reopening or reimporting the same document preserves its chosen predecessor');
 assert.equal(restored.rows[0].Revit_parameter,'Revit_Code');assert.equal(JSON.parse(restored.rows[0].IDS_requirements)[0].documentId,newId);
 const reverse=validateIdsImports([...restored.idsImports].reverse());assert.equal(reverse[0].previousDocumentId,oldDoc.id,'Validation does not depend on collection order');
});

test('Unknown, self and malformed IDS predecessors reject atomically; circular history is invalid',async()=>{
 const oldDoc=await parse(specification({name:'Earlier'})),nextDoc=await parse(specification({name:'Later'})),data=empty();saveIdsSource(data,oldDoc);
 for(const previousDocumentId of ['sha256:'+'f'.repeat(64),nextDoc.id,'invalid']){
  const incoming={...nextDoc,previousDocumentId},before=structuredClone(data);
  assert.throws(()=>saveIdsSource(data,incoming),/vorige|vorig|versie/);assert.deepEqual(data,before);
  assert.equal(preflightIdsImport(data,catalog,incoming,[first]).canApply,false);assert.deepEqual(data,before);
  assert.throws(()=>applyIdsImport(data,catalog,incoming,[first]),/vorige|vorig|versie/);assert.deepEqual(data,before);
 }
 saveIdsSource(data,{...nextDoc,previousDocumentId:oldDoc.id});
 const cyclic=structuredClone(data.idsImports);cyclic[0].previousDocumentId=nextDoc.id;
 assert.throws(()=>validateIdsImports(cyclic),/kringverwijzing/);
 assert.throws(()=>validateIdsImports([data.idsImports[1]]),/ontbreekt/);
});


test('Global application review groups identical scopes across parameter definitions without sharing value or optional review',async()=>{
 const classification=`<classification>${literal('system','Test')}${literal('value','A')}</classification>`;
 const alpha=property({name:'Alpha',extra:literal('value','Required value')}),beta=property({name:'Beta',type:'IFCINTEGER'}).replace('<property ','<property cardinality="optional" ');
 const doc=await parse(specification({name:'Same scope',scope:classification,requirements:alpha+beta})),workspace=buildIdsWorkspace(empty(),catalog,doc);
 assert.equal(workspace.groups.length,2);assert.equal(workspace.scopeReviewGroups.length,1);
 const scope=workspace.scopeReviewGroups[0];assert.equal(scope.requirementIds.length,2);assert.equal(scope.parameterNames.length,2);assert.equal(scope.acknowledged,false);
 assert.deepEqual(scope.parameterLabels,['Example / Alpha','Example / Beta']);assert.deepEqual(scope.entities,['IfcWall']);
 const decisions=Object.fromEntries(scope.requirementIds.map(id=>[id,{acknowledgeScope:true}]));
 const reviewed=buildIdsWorkspace(empty(),catalog,doc,decisions);assert.equal(reviewed.scopeReviewGroups[0].acknowledged,true);
 assert.equal(reviewed.counts.eligibleRequirements,0,'Value and optional choices must remain separate');
 const alphaReview=reviewed.groups.find(g=>g.property==='Alpha').reviewGroups[0],betaReview=reviewed.groups.find(g=>g.property==='Beta').reviewGroups[0];
 assert.equal(alphaReview.valuesAcknowledged,false);assert.equal(betaReview.optionalIncluded,false);
 assert.equal(doc.specifications[0].requirements.length,2,'Only presentation grouped; source requirements remain distinct');
});

test('Global scope grouping retains differences in application filters, IFC version and unknown scope semantics',async()=>{
 const scope=value=>`<classification>${literal('system','Test')}${literal('value',value)}</classification>`;
 const a=specification({name:'A',scope:scope('A'),requirements:property({name:'Alpha'})}),b=specification({name:'B',scope:scope('B'),requirements:property({name:'Beta'})});
 const doc=await parse(a+b),workspace=buildIdsWorkspace(empty(),catalog,doc);assert.equal(workspace.scopeReviewGroups.length,2);
 const versioned=await parse(a+a.replace('ifcVersion="IFC4"','ifcVersion="IFC2X3"'));assert.equal(buildIdsWorkspace(empty(),catalog,versioned).scopeReviewGroups.length,2);
 const extended=await parse(a.replace('<specification ','<specification vendorScope="A" ')+a.replace('<specification ','<specification vendorScope="B" '));assert.equal(buildIdsWorkspace(empty(),catalog,extended).scopeReviewGroups.length,2);
});

test('Global scope acknowledgment cannot merge different manual targets or remove independent source references',async()=>{
 const scope=`<classification>${literal('system','Test')}${literal('value','A')}</classification>`;
 const doc=await parse(specification({scope,requirements:property({name:'Alpha'})+property({name:'Beta'})})),other='spec:0/requirement:1';
 const different={[first]:{entities:['IfcWall']},[other]:{entities:['IfcDoor']}},workspace=buildIdsWorkspace(empty(),catalog,doc,different);
 assert.equal(workspace.scopeReviewGroups.length,2);assert(workspace.scopeReviewGroups.every(g=>g.requirementIds.length===1));
 const acknowledged=Object.fromEntries(workspace.scopeReviewGroups[0].requirementIds.map(id=>[id,{...different[id],acknowledgeScope:true}]));
 const later=buildIdsWorkspace(empty(),catalog,doc,{...different,...acknowledged});assert.equal(later.scopeReviewGroups[0].acknowledged,true);assert.equal(later.scopeReviewGroups[1].acknowledged,false);
 const both=Object.fromEntries([first,other].map(id=>[id,{...different[id],acknowledgeScope:true,revitParameter:'Shared'}])),result=planIdsImport(empty(),catalog,doc,[first,other],both);
 assert.equal(result.project.rows.length,2);assert(result.project.rows.every(r=>JSON.parse(r.IDS_requirements).length===1));
 assert.equal(result.project.idsImports[0].xml,doc.xml);
});

test('Unknown nested application and specification semantics remain distinct review actions',async()=>{
 const extension=threshold=>`<v:scope xmlns:v="urn:vendor"><v:rule threshold="${threshold}"/></v:scope>`;
 const appDoc=await parse(specification({name:'First',scope:extension('A')})+specification({name:'Second',scope:extension('B')}));
 const app=buildIdsWorkspace(empty(),catalog,appDoc);assert.equal(app.groups.length,1);assert.equal(app.scopeReviewGroups.length,2);assert.equal(app.groups[0].reviewGroups.length,2);
 const specDoc=await parse(specification({name:'First'}).replace('</specification>',extension('A')+'</specification>')+specification({name:'Second'}).replace('</specification>',extension('B')+'</specification>'));
 const spec=buildIdsWorkspace(empty(),catalog,specDoc);assert.equal(spec.scopeReviewGroups.length,2);assert.equal(spec.groups[0].reviewGroups.length,2);
 const firstGroup=app.scopeReviewGroups[0],choices=Object.fromEntries(firstGroup.requirementIds.map(id=>[id,{acknowledgeScope:true}])),reviewed=buildIdsWorkspace(empty(),catalog,appDoc,choices);
 assert.equal(reviewed.scopeReviewGroups[0].acknowledged,true);assert.equal(reviewed.scopeReviewGroups[1].acknowledged,false);
 assert.equal(reviewed.counts.eligibleRequirements,1,'Confirming one unknown application cannot approve a distinct nested rule');
});

test('Unknown nested property/value/facet semantics stay separate within the parameter review',async()=>{
 const nested=threshold=>`<v:scope xmlns:v="urn:vendor"><v:rule threshold="${threshold}"/></v:scope>`;
 const variants=[threshold=>nested(threshold),threshold=>'<value>'+nested(threshold)+'</value>',threshold=>'<value><xs:restriction base="xs:string">'+nested(threshold)+'</xs:restriction></value>'];
 for(const variant of variants){
  const doc=await parse(specification({name:'First',requirements:property({extra:variant('A')})})+specification({name:'Second',requirements:property({extra:variant('B')})}));
  const group=buildIdsWorkspace(empty(),catalog,doc).groups[0];assert.equal(group.reviewGroups.length,2);
  const choices=Object.fromEntries(group.reviewGroups[0].requirementIds.map(id=>[id,{acknowledgeValues:true}])),reviewed=buildIdsWorkspace(empty(),catalog,doc,choices).groups[0];
  assert.equal(reviewed.reviewGroups[0].valuesAcknowledged,true);assert.equal(reviewed.reviewGroups[1].valuesAcknowledged,false);
 }
});

test('Equivalent known application facets remain grouped independently of XML namespace prefixes',async()=>{
 const scope=`<classification>${literal('system','Test')}${literal('value','A')}</classification>`;
 const firstSpec=specification({name:'First',scope}),secondSpec=specification({name:'Second',scope}).replace('<applicability ','<applicability xmlns:p="http://standards.buildingsmart.org/IDS" ').replace(/<(\/?)(entity|name|simpleValue|classification|system|value)(?=[\s>])/g,'<$1p:$2');
 // Limit prefix replacement to applicability: the namespace declaration is scoped there.
 const start=secondSpec.indexOf('<requirements>'),raw=firstSpec+secondSpec.slice(0,start)+specification({name:'Second',scope}).slice(specification({name:'Second',scope}).indexOf('<requirements>'));
 const doc=await parse(raw),workspace=buildIdsWorkspace(empty(),catalog,doc);assert.equal(workspace.scopeReviewGroups.length,1);assert.equal(workspace.groups[0].reviewGroups.length,1);assert.equal(workspace.scopeReviewGroups[0].requirementIds.length,2);
});
