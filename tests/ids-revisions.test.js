import test from 'node:test';
import assert from 'node:assert/strict';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {readIds} from '../web/ids-document.js';
import {compareIdsRevisions,idsRevisionCandidates} from '../web/ids-revisions.js';

const NS='http://standards.buildingsmart.org/IDS';
const XS='http://www.w3.org/2001/XMLSchema';
const literal=(key,text)=>`<${key}><simpleValue>${text}</simpleValue></${key}>`;
const property=(name='Code',type='IFCLABEL',extra='',attributes='')=>`<property dataType="${type}"${attributes}>${literal('propertySet','Example_Set')}${literal('baseName',name)}${extra}</property>`;
const entity=name=>`<entity>${literal('name',name)}</entity>`;
const specification=({identifier='one',name='Specification',ifc='IFC4',app=entity('IFCWALL'),requirements=property(),min='1',max='unbounded',attributes=''}={})=>`<specification${identifier?' identifier="'+identifier+'"':''} name="${name}" ifcVersion="${ifc}"${attributes}><applicability minOccurs="${min}" maxOccurs="${max}">${app}</applicability>${requirements===null?'':`<requirements>${requirements}</requirements>`}</specification>`;
const document=(specifications,extra='')=>`<ids xmlns="${NS}" xmlns:xs="${XS}"${extra}><info><title>Revision fixture</title></info><specifications>${specifications}</specifications></ids>`;
const parse=xml=>readIds(xml,{DOMParser,XMLSerializer,fileName:'revision.ids'});
const choice={property:'Chosen_Code',dataType:'Text',entities:['IfcWall'],acknowledgeScope:true,acknowledgeValues:true};
const first='spec:0/requirement:0';

test('Reordered specifications and requirements reuse only their unique semantic predecessors',async()=>{
 const old=await parse(document(specification({identifier:'a',requirements:property('Alpha')+property('Beta')})+specification({identifier:'b',name:'Second',app:entity('IFCDOOR'),requirements:property('Gamma')})));
 const current=await parse(document(specification({identifier:'b',name:'Renamed presentation',app:entity('IFCDOOR'),requirements:property('Gamma')})+specification({identifier:'a',requirements:property('Beta')+property('Alpha')})));
 const decisions={[first]:{revitParameter:'AlphaRevit'},'spec:0/requirement:1':{revitParameter:'BetaRevit'},'spec:1/requirement:0':{revitParameter:'GammaRevit'}};
 const result=compareIdsRevisions(old,current,decisions);
 assert.deepEqual(result.counts,{unchanged:3,modified:0,added:0,removed:0,ambiguous:0});
 assert.equal(result.decisions['spec:1/requirement:1'].revitParameter,'AlphaRevit');assert.equal(result.decisions['spec:1/requirement:0'].revitParameter,'BetaRevit');assert.equal(result.decisions[first].revitParameter,'GammaRevit');
 assert.notEqual(result.decisions['spec:1/requirement:1'],decisions[first]);assert.notEqual(old.id,current.id);
});

test('Namespace aliases, document formatting and restriction/target ordering do not invent source changes',async()=>{
 const enumeration=`<entity><name><xs:restriction base="xs:string"><xs:enumeration value="IFCWALL"/><xs:enumeration value="IFCDOOR"/></xs:restriction></name></entity>`;
 const oldXml=document(specification({app:enumeration,ifc:'IFC4 IFC4X3_ADD2',requirements:property('Code','IFCLABEL',`<value><xs:restriction base="xs:string"><xs:pattern value="A.*"/><xs:minLength value="2"/></xs:restriction></value>`)}));
 const newXml=oldXml.replaceAll('xs:','x:').replace('xmlns:xs=', 'xmlns:x=').replace('IFC4 IFC4X3_ADD2','IFC4X3_ADD2 IFC4').replace('<x:enumeration value="IFCWALL"/><x:enumeration value="IFCDOOR"/>','<x:enumeration value="IFCDOOR"/><x:enumeration value="IFCWALL"/>').replace('<x:pattern value="A.*"/><x:minLength value="2"/>','<x:minLength value="2"/><x:pattern value="A.*"/>').replace(`xmlns="${NS}"`,`xmlns:i="${NS}"`).replace(/<(\/?)([A-Za-z][A-Za-z0-9]*)(?=[\s>])/g,'<$1i:$2').replace(/></g,'>\n  <');
 const old=await parse(oldXml),current=await parse(newXml),result=compareIdsRevisions(old,current,{[first]:choice});
 assert.equal(result.counts.unchanged,1);assert.deepEqual(result.decisions[first],choice);
});

test('Changed classification applicability invalidates former scope and value approvals',async()=>{
 const scope=value=>entity('IFCWALL')+`<classification>${literal('system','Example Classification')}${literal('value',value)}</classification>`;
 const old=await parse(document(specification({app:scope('A')}))),current=await parse(document(specification({app:scope('B')})));
 const result=compareIdsRevisions(old,current,{[first]:choice});
 assert.equal(result.counts.modified,1);assert.deepEqual(result.decisions,{});assert.equal(result.changes[0].canReuse,false);assert.match(result.changes[0].reason,/opnieuw beoordelen/);
});

test('Changed property names, datatypes, value restrictions, cardinalities and IFC versions require fresh decisions',async()=>{
 const old=await parse(document(specification()));
 const sources=[specification({requirements:property('Renamed')}),specification({requirements:property('Code','IFCTEXT')}),specification({requirements:property('Code','IFCLABEL',literal('value','New'))}),specification({requirements:property('Code','IFCLABEL','',' cardinality="optional"')}),specification({ifc:'IFC2X3'}),specification({min:'0'}),specification({max:'1'})];
 for(const source of sources){const result=compareIdsRevisions(old,await parse(document(source)),{[first]:choice});assert.equal(result.counts.modified,1);assert.deepEqual(result.decisions,{});}
});

test('Added and removed specifications do not reuse decisions or delete existing export rows',async()=>{
 const old=await parse(document(specification({identifier:'keep',name:'Keep'})+specification({identifier:'removed',name:'Removed',requirements:property('Old')})));
 const current=await parse(document(specification({identifier:'keep',name:'Keep'})+specification({identifier:'new',name:'Added',app:entity('IFCDOOR'),requirements:property('New')})));
 const rows=[{Revit_parameter:'Existing',IDS_requirements:JSON.stringify([{documentId:old.id,requirementId:'spec:1/requirement:0'}])}],before=structuredClone(rows);
 const result=compareIdsRevisions(old,current,{[first]:choice,'spec:1/requirement:0':choice},{rows});
 assert.deepEqual(result.counts,{unchanged:1,modified:0,added:1,removed:1,ambiguous:0});assert.deepEqual(result.decisions,{[first]:choice});
 assert.deepEqual(result.changes.find(c=>c.status==='removed').impactedRows,[0]);assert.deepEqual(rows,before);
});

test('Duplicate specification identifiers remain ambiguous even when names and order look usable',async()=>{
 const old=await parse(document(specification({identifier:'duplicate',name:'A'})+specification({identifier:'duplicate',name:'B',requirements:property('Other')})));
 const current=await parse(document(specification({identifier:'duplicate',name:'B',requirements:property('Other')})+specification({identifier:'duplicate',name:'A'})));
 const result=compareIdsRevisions(old,current,{[first]:choice,'spec:1/requirement:0':choice});
 assert.equal(result.counts.ambiguous,2);assert.deepEqual(result.decisions,{});assert.equal(result.ambiguityGroups.length,1);assert.equal(result.ambiguityGroups[0].previousIds.length,2);assert(result.changes.every(c=>c.ambiguityGroupId&&c.canReuse===false));
});

test('Repeated identical requirements cannot inherit choices based on their position',async()=>{
 const old=await parse(document(specification({requirements:property()+property()}))),current=await parse(document(specification({requirements:property()+property()})).replace('Revision fixture','New title'));
 const result=compareIdsRevisions(old,current,{[first]:{revitParameter:'First'},'spec:0/requirement:1':{revitParameter:'Second'}});
 assert.equal(result.counts.ambiguous,2);assert.deepEqual(result.decisions,{});assert.equal(result.ambiguityGroups.length,1);assert.equal(result.changes[0].candidatePreviousCount,2);
});

test('Missing specification identifiers can still match unique unchanged content across reordering',async()=>{
 const a=specification({identifier:'',name:'A',requirements:property('Alpha')}),b=specification({identifier:'',name:'B',requirements:property('Beta')});
 const old=await parse(document(a+b)),current=await parse(document(b+a));
 const result=compareIdsRevisions(old,current,{[first]:choice});
 assert.equal(result.counts.unchanged,2);assert.deepEqual(result.decisions['spec:1/requirement:0'],choice);assert.equal(result.changes.find(c=>c.previousId===first).currentId,'spec:1/requirement:0');
});

test('Unknown scalar metadata stays visible but never carries approvals into another revision',async()=>{
 const source=document(specification({requirements:property().replace('<baseName>','<baseName ext:meaning="unknown">')}),' xmlns:ext="urn:unknown"');
 const old=await parse(source),current=await parse(source.replace('Revision fixture','Another author revision'));
 const result=compareIdsRevisions(old,current,{[first]:choice});assert.equal(result.counts.unchanged,1);assert.deepEqual(result.decisions,{});assert.equal(result.changes[0].canReuse,false);assert.match(result.changes[0].reason,/onbekende/);
});

test('Changed external metadata and document format cannot preserve former approval',async()=>{
 const old=await parse(document(specification()));
 for(const source of [document(specification(),' ext:semantics="new" xmlns:ext="urn:extra"'),document(specification(),' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="'+NS+' '+NS+'/0.9.7/ids.xsd"')]){
  const result=compareIdsRevisions(old,await parse(source),{[first]:choice});assert.equal(result.counts.modified,1);assert.deepEqual(result.decisions,{});
 }
});

test('Specifications without requirements are compared and do not create reusable parameter choices',async()=>{
 const old=await parse(document(specification({requirements:null,min:'0',max:'0'}))),current=await parse(document(specification({requirements:null,min:'0',max:'0'})).replace('Revision fixture','New document'));
 const same=compareIdsRevisions(old,current,{'spec:0':choice});assert.equal(same.counts.unchanged,1);assert.equal(same.changes[0].kind,'specification');assert.deepEqual(same.decisions,{});
 const changed=compareIdsRevisions(old,await parse(document(specification({requirements:null,min:'0',max:'unbounded'}))));assert.equal(changed.counts.modified,1);
});

test('Broken existing provenance is reported while unrelated matches still compare',async()=>{
 const old=await parse(document(specification())),current=await parse(document(specification()).replace('Revision fixture','New title'));
 const result=compareIdsRevisions(old,current,{[first]:choice},{rows:[{IDS_requirements:'broken'},{IDS_requirements:JSON.stringify([{documentId:old.id,requirementId:first}])}]});
 assert.equal(result.warnings.length,1);assert.equal(result.counts.unchanged,1);assert.deepEqual(result.changes[0].impactedRows,[1]);
});

test('Predecessor candidates are explicit and never inferred from equal file names',async()=>{
 const current=await parse(document(specification()));
 const saved=[{id:current.id,fileName:'same.ids'},{id:'old:1',fileName:'same.ids',selectedRequirementIds:[first]},{id:'unrelated:2',fileName:'another.ids',selectedRequirementIds:[]}];
 assert.deepEqual(idsRevisionCandidates(saved,current),[{id:'old:1',fileName:'same.ids',selectedRequirements:1},{id:'unrelated:2',fileName:'another.ids',selectedRequirements:0}]);
});

test('Large ambiguous groups share candidates instead of duplicating quadratic provenance',async()=>{
 const repeated=property().repeat(600),old=await parse(document(specification({requirements:repeated}))),current=await parse(document(specification({requirements:repeated})).replace('Revision fixture','New title'));
 const result=compareIdsRevisions(old,current,{[first]:choice});
 assert.equal(result.counts.ambiguous,600);assert.equal(result.ambiguityGroups.length,1);assert.equal(result.ambiguityGroups[0].previousIds.length,600);
 assert.equal(result.changes.filter(c=>Object.hasOwn(c,'candidatePreviousIds')).length,0);assert(JSON.stringify(result).length<400000);
});

test('Adding a requirement preserves the uniquely unchanged choices without specification identifiers',async()=>{
 const old=await parse(document(specification({identifier:'',requirements:property('Alpha')+property('Beta')})));
 const current=await parse(document(specification({identifier:'',requirements:property('Alpha')+property('Beta')+property('Gamma')})));
 const result=compareIdsRevisions(old,current,{[first]:choice});assert.equal(result.counts.unchanged,2);assert.equal(result.counts.added,1);assert.deepEqual(result.decisions[first],choice);
});

test('Presentation names do not disambiguate repeated content without unique identifiers',async()=>{
 const old=await parse(document(specification({identifier:'',name:'A'})+specification({identifier:'',name:'B'})));
 const current=await parse(document(specification({identifier:'',name:'A'})+specification({identifier:'',name:'C'})));
 const result=compareIdsRevisions(old,current,{[first]:choice,'spec:1/requirement:0':{revitParameter:'Different'}});
 assert.equal(result.counts.ambiguous,2);assert.deepEqual(result.decisions,{});assert.equal(result.ambiguityGroups.length,1);
});

test('Unique specification identifiers distinguish otherwise identical requirements',async()=>{
 const a=specification({identifier:'A',name:'Same'}),b=specification({identifier:'B',name:'Same'});
 const old=await parse(document(a+b)),current=await parse(document(b+a));
 const result=compareIdsRevisions(old,current,{[first]:{revitParameter:'First'},'spec:1/requirement:0':{revitParameter:'Second'}});
 assert.equal(result.counts.unchanged,2);assert.equal(result.decisions[first].revitParameter,'Second');assert.equal(result.decisions['spec:1/requirement:0'].revitParameter,'First');
});

test('Different explicit specification identifiers cannot pair through name, scope or identical content',async()=>{
 const previous=await parse(document(specification({identifier:'retired'})));
 const priorChoices={[first]:{revitParameter:'Previous'}};
 const rows=[{IDS_requirements:JSON.stringify([{documentId:previous.id,requirementId:first}])}];
 for(const requirements of [property(),property('Replacement')]){
  const current=await parse(document(specification({identifier:'new',requirements})));
  const result=compareIdsRevisions(previous,current,priorChoices,{rows});
  assert.deepEqual(result.counts,{unchanged:0,modified:0,added:1,removed:1,ambiguous:0});
  assert.deepEqual(result.decisions,{});
  assert.deepEqual(result.changes.find(change=>change.status==='removed').impactedRows,[0]);
 }
});

test('An anonymous ambiguity does not introduce a mismatched explicit predecessor',async()=>{
 const previous=await parse(document(specification({identifier:'retired'})+specification({identifier:''})));
 const current=await parse(document(specification({identifier:'new'})+specification({identifier:''})));
 const result=compareIdsRevisions(previous,current,{[first]:{revitParameter:'Retired'}});
 const explicitlyNew=result.changes.find(change=>change.currentId===first);
 const possiblePrevious=result.ambiguityGroups.find(group=>group.id===explicitlyNew.ambiguityGroupId);
 assert.deepEqual(possiblePrevious.previousIds,['spec:1/requirement:0']);
 assert.deepEqual(result.decisions,{});
});

test('A partial name match ignores a retired explicit ID when finding a unique anonymous predecessor',async()=>{
 const previous=await parse(document(specification({identifier:'retired',name:'Retired',requirements:property('Foo')})+
  specification({identifier:'',name:'Current',requirements:property('Foo')+property('Bar')})));
 const current=await parse(document(specification({identifier:'new',name:'Current',requirements:property('Foo')+property('Bar')+property('Baz')})));
 const result=compareIdsRevisions(previous,current,{[first]:{revitParameter:'Retired'},'spec:1/requirement:0':{revitParameter:'Keep'}});
 assert.deepEqual(result.counts,{unchanged:2,modified:0,added:1,removed:1,ambiguous:0});
 assert.deepEqual(result.decisions[first],{revitParameter:'Keep'});
});

test('Invalid reference records are reported without hiding the valid part of existing provenance',async()=>{
 const old=await parse(document(specification())),current=await parse(document(specification()).replace('Revision fixture','New title'));
 const result=compareIdsRevisions(old,current,{}, {rows:[{IDS_requirements:JSON.stringify([null,{documentId:old.id,requirementId:first}])}]});
 assert.equal(result.warnings.length,1);assert.deepEqual(result.changes[0].impactedRows,[0]);
});
