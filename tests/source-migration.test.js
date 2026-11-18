import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {IFC,ILS} from '../web/sources.js';

test('An updated bSDD registry survives reopening and a failed refresh', async t => {
  const makeSource = name => ({
    uri: `https://identifier.buildingsmart.org/uri/test/${name}/1.0`,
    name,
    version: '1.0',
    status: 'Active'
  });
  const bundled = makeSource('bundled');
  const legacy = makeSource('legacy');
  const updated = makeSource('updated');
  const library = {id: 'test', name: 'Test library', version: '1.0'};
  const libraryUri = 'urn:udps:library:test:1.0';
  const cacheKey = 'udps-relations-v1';
  const cache = {schema: 1, relations: {}, details: {}, products: {}};
  const stored = new Map([[cacheKey, JSON.stringify({
    ...cache,
    enabled: [legacy],
    registry: [legacy],
    libraries: [library]
  })]]);
  const originalFetch = global.fetch;
  const originalStorage = global.localStorage;
  let status = 200;
  global.localStorage = {getItem: key => stored.get(key), setItem: (key, value) => stored.set(key, value)};
  global.fetch = async url => {
    if (url === './relations.json') {
      return {ok: true, json: async () => ({...cache, registry: [bundled]})};
    }
    const endpoint = new URL(url);
    assert.equal(endpoint.pathname, '/api/Dictionary/v1');
    assert.equal(endpoint.searchParams.get('Offset'), '0');
    return {
      ok: status === 200,
      status,
      json: async () => ({dictionaries: [updated], offset: 0, totalCount: 1})
    };
  };
  t.after(() => {
    global.fetch = originalFetch;
    global.localStorage = originalStorage;
  });

  const before = await import('../web/source-store.js?registry-before-refresh');
  await before.initStore();
  const uris = store => store.sourceState().registry.map(source => source.uri);
  assert.deepEqual(uris(before), [bundled.uri, libraryUri]);
  await before.loadRegistry();
  assert.deepEqual(uris(before), [updated.uri, libraryUri]);

  const reopened = await import('../web/source-store.js?registry-after-refresh');
  await reopened.initStore();
  assert.deepEqual(uris(reopened), [updated.uri, libraryUri]);
  assert.deepEqual(reopened.sourceState().enabled, [legacy]);
  reopened.enableSource(updated.uri);

  status = 503;
  await assert.rejects(reopened.loadRegistry(), /HTTP 503/);
  assert.deepEqual(uris(reopened), [updated.uri, libraryUri]);

  const offline = await import('../web/source-store.js?registry-after-failure');
  await offline.initStore();
  assert.deepEqual(uris(offline), [updated.uri, libraryUri]);
  assert.deepEqual(offline.sourceState().enabled.map(source => source.uri), [legacy.uri, updated.uri]);
});
test('Updated O&E snapshot supersedes old browser caches without changing enabled sources',async()=>{const snapshot=JSON.parse(fs.readFileSync(new URL('../web/relations.json',import.meta.url))),key=JSON.stringify([ILS,'IfcDoor']);const relation=snapshot.relations[key];const uri=relation.items.find(c=>c.code==='Binnendeur').uri;const old={schema:1,enabled:[{uri:ILS,name:'ILS'}],relations:{[key]:{source:ILS,entity:'IfcDoor',version:'2.0.1',items:[]}},products:{[ILS]:{source:ILS,items:[],productsSchema:1}},details:{[uri]:{uri,properties:[],propertySchema:2}}};const oldFetch=global.fetch,oldStorage=global.localStorage;global.localStorage={getItem:()=>JSON.stringify(old),setItem(){}};global.fetch=async url=>{assert.equal(url,'./relations.json');return {ok:true,json:async()=>structuredClone(snapshot)};};try{const {initStore,loadClasses,loadDetails,loadProducts,sourceState}=await import('../web/source-store.js');await initStore();const r=await loadClasses(ILS,'IfcDoor');assert.equal(r.items.length,17);assert(r.ifcTargets.some(t=>t.uri===IFC+'/class/IfcDoorDOOR'));const d=await loadDetails(uri);assert.equal(d.properties.length,24);assert.equal(d.propertySchema,5);const index=await loadProducts(ILS);assert.equal(index.productsSchema,2);assert.equal(index.items.length,308);assert(index.items.some(c=>c.classType==='Material'));assert.deepEqual(sourceState().enabled,old.enabled);}finally{global.fetch=oldFetch;global.localStorage=oldStorage;}});
