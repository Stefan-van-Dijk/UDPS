import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeClass} from '../web/bsdd.js';

const fixtures=JSON.parse(fs.readFileSync(new URL('./fixtures/other-sources.json',import.meta.url))).sources;
let instance=0;
async function setup(t,saved){
 const beforeFetch=global.fetch,beforeStorage=global.localStorage,stored=new Map([['udps-relations-v1',JSON.stringify(saved)]]);
 global.localStorage={getItem:key=>stored.get(key)||null,setItem:(key,value)=>stored.set(key,value)};
 global.fetch=async url=>{
  if(url==='./relations.json')return {ok:true,json:async()=>({schema:1,registry:[],relations:{},details:{},products:{},libraries:[]})};
  const u=new URL(url),q=u.searchParams;let result;
  for(const s of Object.values(fixtures)){
   if(u.pathname.endsWith('/Class/v1')){
    if(q.get('Uri')===s.detail?.uri)result=s.detail;
    else if(s.alias&&q.get('Uri')===s.properties.classUri)result=s.alias;
    else if(q.get('Uri')===s.ifc?.uri)result=s.ifc;
   }
   if(u.pathname.endsWith('/Class/Properties/v1')&&q.get('ClassUri')===s.detail?.uri)result=s.properties;
   if(u.pathname.endsWith('/Dictionary/v1/Classes')&&q.get('Uri')===s.source)result=q.has('RelatedIfcEntities')?s.related:s.index;
  }
  assert(result,'Unexpected request: '+url);
  return {ok:true,json:async()=>structuredClone(result)};
 };
 t.after(()=>{global.fetch=beforeFetch;global.localStorage=beforeStorage;});
 const store=await import('../web/source-store.js?source-update='+instance++);
 await store.initStore();
 return {store,stored};
}
const empty=()=>({schema:1,registry:[],enabled:[],relations:{},details:{},products:{},libraries:[]});
const library={format:'udps-library',schema:1,id:'update-test',name:'Update test',version:'1.0',classes:[{code:'window',name:'Window',ifcEntities:['IfcWindow'],properties:[{code:'Finish',name:'Finish',propertySet:'Pset_Test',dataType:'Text'}]}]};

test('Applying a checked source update preserves later library imports and source choices',async t=>{
 const a={uri:'https://example.org/source/a',name:'A'},b={uri:'https://example.org/source/b',name:'B'};
 const {store,stored}=await setup(t,{...empty(),registry:[a,b],enabled:[a]});
 const update=await store.proposedUpdate();
 const imported=store.importLibrary(library,new Set(['IfcWindow']));
 store.disableSource(a.uri);store.enableSource(b.uri);
 const choices=structuredClone(store.sourceState());
 assert.equal(store.applyUpdate(update.next),true);
 for(const field of ['libraries','registry','enabled'])assert.deepEqual(store.sourceState()[field],choices[field],field+' must retain changes after preview');
 const persisted=JSON.parse(stored.get('udps-relations-v1'));
 assert.equal(persisted.libraries[0].id,library.id);
 assert(persisted.enabled.some(s=>s.uri===imported.uri));
 assert(persisted.enabled.some(s=>s.uri===b.uri));
 assert(!persisted.enabled.some(s=>s.uri===a.uri));
});

test('A source update applies checked results without reverting later unchecked caches',async t=>{
 const cci=fixtures.CCI,lca=fixtures.LCA;
 const oldCci=normalizeClass({...cci.detail,classProperties:cci.properties.classProperties}),oldLca=normalizeClass({...lca.detail,classProperties:lca.properties.classProperties});
 oldCci.name='Old CCI';oldLca.name='Old LCA';
 const {store}=await setup(t,{...empty(),enabled:[{uri:cci.source,name:'CCI'}],details:{[oldCci.uri]:oldCci,[oldLca.uri]:oldLca}});
 const update=await store.proposedUpdate();
 assert.equal(store.sourceState().details[oldCci.uri].name,'Old CCI','preview must not apply checked changes');
 assert.notEqual(update.next.details[oldCci.uri].name,'Old CCI');
 const currentLca=await store.loadDetails(oldLca.uri,{refresh:true});
 const products=await store.loadProducts(lca.source);
 const relation=await store.loadClasses(lca.source,lca.ifc.code);
 assert.equal(store.applyUpdate(update.next),true);
 assert.notEqual(store.sourceState().details[oldCci.uri].name,'Old CCI','checked result must be applied');
 assert.deepEqual(store.sourceState().details[oldLca.uri],currentLca,'unchecked detail refreshed after preview must survive');
 assert.deepEqual(store.sourceState().products[lca.source],products,'new product cache must survive');
 assert.deepEqual(store.sourceState().relations[JSON.stringify([lca.source,lca.ifc.code])],relation,'new relation cache must survive');
});
