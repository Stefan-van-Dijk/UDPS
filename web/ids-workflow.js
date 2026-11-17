// A parameter worklist is a presentation layer over complete IDS evidence.
import {mappingProposals,idsDefinitionKey,preflightIdsImport} from './ids.js?v=1.11.3';
export {preflightIdsImport} from './ids.js?v=1.11.3';
const unique=items=>[...new Set(items)];
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const valueIdentity=value=>typeof value==='string'&&!!value;
function canonical(value,raw=false){
 if(Array.isArray(value))return value.map(item=>canonical(item,raw));
 if(!value||typeof value!=='object')return value;
 // Unknown/raw nodes can carry unparsed nested semantics only in their XML.
 const preserveXml=typeof value.xml==='string'&&(!value.kind||['unknown','ambiguous'].includes(value.kind)||value.namespace&&!['http://standards.buildingsmart.org/IDS','http://www.w3.org/2001/XMLSchema'].includes(value.namespace));
 return Object.fromEntries(Object.keys(value).sort().filter(k=>raw||!['id','path','warnings'].includes(k)&&(k!=='xml'||preserveXml)).map(k=>[k,canonical(value[k],raw||k==='attributes'||k.endsWith('Attributes'))]));
}
function scopeEvidence(requirement,specification,preview){
 return {ifcVersions:specification?.ifcVersions,minOccurs:specification?.minOccurs,maxOccurs:specification?.maxOccurs,applicability:specification?.applicability,applicabilityAttributes:specification?.applicabilityAttributes,specificationUnknown:specification?.unknown,specificationAttributes:Object.fromEntries(Object.entries(specification?.attributes||{}).filter(([key])=>!['name','identifier','description','instructions','ifcVersion'].includes(key))),documentUnknown:preview?.unknown,documentAttributes:preview?.attributes,targets:requirement.entities};
}
// Intern complete application semantics once per specification/context. Repeating a
// large unknown scope must not copy its entire XML into every requirement key.
function scopeContextIndex(specifications){
 const bySpecification=new Map(),bySemantics=new Map(),byTargets=new Map();
 return requirement=>{
  const specification=specifications.get(requirement.specificationId);let base=bySpecification.get(requirement.specificationId);
  if(!base){
   // Document-wide metadata is identical for every requirement in this workspace.
   const evidence=scopeEvidence(requirement,specification);delete evidence.targets;
   const key=JSON.stringify(canonical(evidence));base=bySemantics.get(key);
   if(!base){base={id:bySemantics.size};bySemantics.set(key,base);}
   bySpecification.set(requirement.specificationId,base);
  }
  const key=JSON.stringify([base.id,requirement.entities]);let context=byTargets.get(key);
  if(!context){context={id:byTargets.size,key};byTargets.set(key,context);}
  return context;
 };
}
function reviewIdentity(requirement,specification,scopeContext){
 return JSON.stringify(canonical({scopeContext:scopeContext.id,requirementsAttributes:specification?.requirementsAttributes,cardinality:requirement.cardinality,value:requirement.parameters?.value,propertySet:requirement.parameters?.propertySet,baseName:requirement.parameters?.baseName,attributes:requirement.attributes,unknown:requirement.unknown}));
}
function applicationReviewGroups(proposals,specifications,scopeContext){
 const groups=[],byScope=new Map(),parameterKeys=new Map();
 for(const requirement of proposals){
  if(requirement.kind!=='property'||!requirement.conditions?.conditional)continue;
  const specification=specifications.get(requirement.specificationId),key=scopeContext(requirement).key;
  let group=byScope.get(key);
  if(!group){group={id:'scope:'+groups.length,key,requirementIds:[],requirements:[],parameterNames:[],parameterLabels:[],entities:[],conditions:specification?.applicability||[],specificationNames:[],minOccurs:specification?.minOccurs,maxOccurs:specification?.maxOccurs,acknowledged:false};groups.push(group);byScope.set(key,group);parameterKeys.set(group,new Set());}
  group.requirementIds.push(requirement.id);group.requirements.push(requirement);group.entities.push(...requirement.entities);group.specificationNames.push(requirement.specificationName);
  const definition=idsDefinitionKey(requirement.propertySet,requirement.property,requirement.dataType);
  if(!parameterKeys.get(group).has(definition)){parameterKeys.get(group).add(definition);group.parameterNames.push({definitionKey:definition,propertySet:requirement.propertySet,property:requirement.property,dataType:requirement.dataType});}
 }
 for(const group of groups){group.entities=unique(group.entities);group.specificationNames=unique(group.specificationNames);group.parameterLabels=unique(group.parameterNames.map(p=>[p.propertySet,p.property].filter(Boolean).join(' / ')));group.acknowledged=group.requirements.every(r=>r.decision.acknowledgeScope===true);}
 return groups;
}
function existingMappings(data){
 const result=new Map(),entities=data.headers.filter(h=>/^Ifc[A-Za-z0-9]+$/.test(h));
 for(const [index,row] of data.rows.entries())if(row['Y/N']==='x'){
  const key=idsDefinitionKey(row.Export_tabblad,row.IFC_parameter,row.Data_type);
  if(!result.has(key))result.set(key,[]);
  result.get(key).push({index,row,entities:entities.filter(e=>row[e]==='x')});
 }
 return result;
}
/** The same exact parameter definition is shown once; its source requirements never merge. */
export function buildIdsWorkspace(data,catalog,preview,decisions={}){
 const previous=data.idsImports?.find(d=>d.id===preview.id),effective={...previous?.decisions,...preview.decisions,...decisions};
 const proposals=mappingProposals(preview,catalog,effective),specifications=new Map((preview.specifications||[]).map(s=>[s.id,s]));
 const groups=[],byDefinition=new Map(),reviewIndexes=new Map(),otherRequirements=[],existing=existingMappings(data),scopeContext=scopeContextIndex(specifications);
 for(const requirement of proposals){
  if(requirement.kind!=='property'){
   otherRequirements.push({...requirement,reasons:['Deze '+requirement.kind+'-eis gebruikt een andere IFC-route. Bewaar de bron en controleer deze eis buiten gewone UDPS-propertykoppelingen.'],warnings:[]});continue;
  }
  const concrete=valueIdentity(requirement.propertySet)&&valueIdentity(requirement.property),key=concrete?idsDefinitionKey(requirement.propertySet,requirement.property,requirement.dataType||requirement.ifcDataType||''):JSON.stringify(['unresolved',requirement.id]);
  let group=byDefinition.get(key);
  if(!group){
   group={id:'parameter:'+encodeURIComponent(key),definitionKey:key,propertySet:requirement.propertySet,property:requirement.property,dataType:requirement.dataType,ifcDataTypes:[],requirements:[],requirementIds:[],eligibleIds:[],entities:[],reasons:[],warnings:[],reviewGroups:[],conflicts:[],revitParameter:'',revitByEntity:{},existingMappings:[]};
   groups.push(group);byDefinition.set(key,group);reviewIndexes.set(group,new Map());
  }
  group.requirements.push(requirement);group.requirementIds.push(requirement.id);if(requirement.eligible)group.eligibleIds.push(requirement.id);
  group.ifcDataTypes.push(requirement.ifcDataType);group.entities.push(...requirement.entities);group.reasons.push(...requirement.reasons);group.warnings.push(...requirement.warnings);
  if(requirement.conditions?.conditional||requirement.values?.constrained||requirement.cardinality==='optional'){
   const specification=specifications.get(requirement.specificationId),key=reviewIdentity(requirement,specification,scopeContext(requirement));
   let review=reviewIndexes.get(group).get(key);
   if(!review){review={id:group.id+':review:'+group.reviewGroups.length,key,requirementIds:[],requirements:[],specificationNames:[],scope:!!requirement.conditions?.conditional,values:!!requirement.values?.constrained,optional:requirement.cardinality==='optional',conditions:specification?.applicability||[],minOccurs:specification?.minOccurs,maxOccurs:specification?.maxOccurs,label:''};group.reviewGroups.push(review);reviewIndexes.get(group).set(key,review);}
   review.requirementIds.push(requirement.id);review.requirements.push(requirement);review.specificationNames.push(requirement.specificationName);
  }
 }
 const names=new Map();for(const group of groups){const key=JSON.stringify([group.propertySet,group.property]);if(!names.has(key))names.set(key,[]);names.get(key).push(group);}
 for(const group of groups){
  for(const field of ['ifcDataTypes','entities','reasons','warnings'])group[field]=unique(group[field].filter(Boolean));
  group.existingMappings=(existing.get(idsDefinitionKey(group.propertySet,group.property,group.dataType))||[]).map(({index,row,entities})=>({index,entities,revitParameter:row.Revit_parameter,pending:row.Mapping_pending==='x'}));
  const writtenNames=unique(group.requirements.filter(r=>own(r.decision,'revitParameter')).map(r=>r.decision.revitParameter));
  const existingNames=unique(group.existingMappings.map(r=>r.revitParameter).filter(Boolean));
  group.hasRevitDecision=writtenNames.length>0;
  group.revitParameter=writtenNames.length===1?writtenNames[0]:!writtenNames.length&&existingNames.length===1?existingNames[0]:'';
  group.revitSuggested=!writtenNames.length&&existingNames.length===1;
  group.existingRevitParameter=existingNames.length===1?existingNames[0]:'';
  group.revitParameterMixed=writtenNames.length>1||!writtenNames.length&&existingNames.length>1;
  for(const entity of group.entities){
   const overrides=unique(group.requirements.filter(r=>own(r.decision.revitByEntity||{},entity)).map(r=>r.decision.revitByEntity[entity]));
   if(overrides.length===1)group.revitByEntity[entity]=overrides[0];
   else if(overrides.length>1)group.conflicts.push('Verschillende Revit-uitzonderingen voor '+entity+'.');
  }
  for(const review of group.reviewGroups){
   review.specificationNames=unique(review.specificationNames);review.label=review.specificationNames.join(', ');
   review.scopeAcknowledged=review.requirements.every(r=>r.decision.acknowledgeScope===true);
   review.valuesAcknowledged=review.requirements.every(r=>r.decision.acknowledgeValues===true);
   review.optionalIncluded=review.requirements.every(r=>r.decision.includeOptional===true);
  }
  const peers=names.get(JSON.stringify([group.propertySet,group.property]));
  if(peers.length>1)group.warnings.push('Deze propertyset en eigenschapsnaam hebben verschillende datatypevoorstellen. Ze blijven afzonderlijk; overlappende uitvoerkoppelingen worden vóór toevoegen gecontroleerd.');
  group.status=group.conflicts.length?'conflict':group.eligibleIds.length===group.requirementIds.length?'ready':group.eligibleIds.length?'partial':'review';
 }
 const emptySpecifications=(preview.specifications||[]).filter(s=>!s.requirements?.length);
 const scopeReviewGroups=applicationReviewGroups(proposals,specifications,scopeContext);
 return {groups,scopeReviewGroups,otherRequirements,emptySpecifications,proposals,decisions:effective,counts:{specifications:preview.specifications?.length||0,requirements:proposals.length,parameters:groups.length,eligibleRequirements:proposals.filter(p=>p.eligible).length,readyParameters:groups.filter(g=>g.status==='ready').length,scopeReviews:scopeReviewGroups.length,other:otherRequirements.length}};
}
