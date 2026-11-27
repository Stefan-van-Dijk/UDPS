const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { createRequire } = require("node:module");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const source = readFileSync(path.join(__dirname, "../../web/test/studio-storage.js"), "utf8");
const namespace = "udps-studio-test-v1";
const fallbackKey = `${namespace}:fallback`, authorityKey = `${namespace}:backend`;

function api(globals = {}) {
  const context = vm.createContext({ TextEncoder, setTimeout, clearTimeout, ...globals });
  vm.runInContext(source, context);
  return context.UDPSStudioStorage;
}

function memory(seed = {}) {
  const values = new Map(Object.entries(seed)), reads = [], writes = [];
  let failure;
  return {
    values, reads, writes,
    getItem(key) { reads.push(key); if (failure?.("read", key)) throw Error("Storage denied"); return values.get(key) ?? null; },
    setItem(key, value) { if (failure?.("write", key, value)) throw Error("QuotaExceededError"); writes.push([key, String(value)]); values.set(key, String(value)); },
    failWith(callback) { failure = callback; }
  };
}

const workspace = name => ({ schema: 1, name, worksheets: [{ id: "sheet-1", name: "Gevel", rows: [] }], sources: [{ id: "ids-1", xml: '<ids encoding="UTF-16">Oorspronkelijke bron</ids>' }] });
const plain = value => JSON.parse(JSON.stringify(value));
const record = data => JSON.stringify({ schema: 1, workspace: data });
const head = backend => JSON.stringify({ schema: 1, backend });
const storageError = name => Object.assign(new Error(name), { name });

test("the standalone global exposes the requested asynchronous API", async () => {
  const storage = memory(), store = api().create({ indexedDB: null, localStorage: storage });
  const initial = store.load();
  assert(initial instanceof Promise || typeof initial.then === "function");
  const empty = await initial;
  assert.equal(empty.workspace, null);
  assert.match(empty.warning, /beperkte browseropslag/);
  const data = workspace("Eerste Studio");
  assert.match((await store.save(data)).warning, /IndexedDB/);
  const restored = await api().create({ indexedDB: null, localStorage: storage }).load();
  assert.deepEqual(plain(restored.workspace), data);
});

test("fallback operations use only their own namespace and never read or write legacy keys", async () => {
  const legacy = { "udps-project-v1": "legacy project bytes", "udps-project-v1:filters": "legacy view bytes", "udps-project-v1:storage-fallback-v1": "legacy fallback bytes" };
  const storage = memory(legacy), store = api().create({ indexedDB: null, localStorage: storage });
  assert.equal((await store.load()).workspace, null);
  await store.save(workspace("Studio"));
  for (const [key, value] of Object.entries(legacy)) assert.equal(storage.values.get(key), value);
  assert(storage.reads.every(key => key.startsWith(`${namespace}:`)));
  assert(storage.writes.every(([key]) => key.startsWith(`${namespace}:`)));
  const other = api().create({ indexedDB: null, localStorage: storage, namespace: "another-studio" });
  assert.equal((await other.load()).workspace, null);
});

test("queued saves capture values at invocation and an intervening load observes the earlier capture", async () => {
  const storage = memory(), store = api().create({ indexedDB: null, localStorage: storage }), data = workspace("first");
  const first = store.save(data);
  data.name = "second";
  data.sources[0].xml = "Second exact XML";
  const between = store.load();
  const second = store.save(data);
  data.name = "unsaved third";
  data.sources[0].xml = "Unsaved XML";
  const [, middle] = await Promise.all([first, between, second]);
  assert.equal(middle.workspace.name, "first");
  assert.equal(middle.workspace.sources[0].xml, workspace("first").sources[0].xml);
  const writes = storage.writes.filter(([key]) => key === fallbackKey).map(([, text]) => JSON.parse(text).workspace);
  assert.deepEqual(writes.map(item => item.name), ["first", "second"]);
  const restored = await store.load();
  assert.equal(restored.workspace.name, "second");
  assert.equal(restored.workspace.sources[0].xml, "Second exact XML");
  restored.workspace.name = "changed returned object";
  assert.equal((await store.load()).workspace.name, "second");
});

test("validation and JSON failures reject without replacing data or stopping later saves", async () => {
  const storage = memory(), validations = [];
  const store = api({ UDPSStudioWorkspace: { validate(data) { validations.push(data.name); if (data.name === "invalid") throw Error("Naam is ongeldig."); return data; } } }).create({ indexedDB: null, localStorage: storage });
  await store.save(workspace("keep"));
  const before = new Map(storage.values), cyclic = workspace("cycle");
  cyclic.self = cyclic;
  await assert.rejects(store.save(null), /werkomgeving/);
  await assert.rejects(store.save([]), /werkomgeving/);
  await assert.rejects(store.save(cyclic), /als JSON/);
  await assert.rejects(store.save(workspace("invalid")), /Naam is ongeldig/);
  assert.deepEqual(storage.values, before);
  await store.save(workspace("next"));
  assert.equal((await store.load()).workspace.name, "next");
  assert(validations.includes("invalid"));
});

test("the size bound measures UTF-8 JSON bytes before touching a backend", async () => {
  const storage = memory(), store = api().create({ indexedDB: null, localStorage: storage });
  await store.save(workspace("keep"));
  const before = new Map(storage.values);
  await assert.rejects(store.save({ name: "é".repeat(16 * 1024 * 1024) }), /32 MiB/);
  assert.deepEqual(storage.values, before);
});

test("corrupt fallback JSON, envelopes and domain data stay intact and require recovery", async () => {
  for (const saved of ["{broken", JSON.stringify({ schema: 88, workspace: workspace("wrong schema") }), record(null)]) {
    const storage = memory({ [fallbackKey]: saved, [authorityKey]: head("localstorage") });
    await assert.rejects(api().create({ indexedDB: null, localStorage: storage }).load(), /niet leesbaar|ongeldig/);
    assert.equal(storage.values.get(fallbackKey), saved);
    assert.equal(storage.writes.length, 0);
  }
  const saved = record(workspace("invalid domain")), storage = memory({ [fallbackKey]: saved });
  const store = api({ UDPSStudioWorkspace: { validate() { throw Error("Invalid model"); } } }).create({ indexedDB: null, localStorage: storage });
  await assert.rejects(store.load(), /bewaarde Studio-werkomgeving is ongeldig/);
  assert.equal(storage.values.get(fallbackKey), saved);
});

test("quota failure is a rejected save and preserves the previous committed fallback", async () => {
  const storage = memory(), store = api().create({ indexedDB: null, localStorage: storage });
  await store.save(workspace("committed"));
  const previous = new Map(storage.values);
  storage.failWith((operation, key) => operation === "write" && key === fallbackKey);
  await assert.rejects(store.save(workspace("unsaved")), /vol of niet beschikbaar/);
  assert.deepEqual(storage.values, previous);
  storage.failWith(() => false);
  assert.equal((await store.load()).workspace.name, "committed");
  await store.save(workspace("recovered"));
  assert.equal((await store.load()).workspace.name, "recovered");
});

test("initial explicit IDB unavailability permits visible fallback but other open errors do not", async () => {
  for (const name of ["SecurityError", "NotSupportedError"]) {
    const storage = memory(), indexedDB = { open() { throw storageError(name); } };
    const store = api().create({ indexedDB, localStorage: storage });
    assert.match((await store.save(workspace(name))).warning, /beperkte browseropslag/);
    assert.equal((await store.load()).workspace.name, name);
  }
  const storage = memory({ [fallbackKey]: record(workspace("older")) });
  const store = api().create({ indexedDB: { open() { throw storageError("UnknownError"); } }, localStorage: storage });
  await assert.rejects(store.load(), /geen oudere reservekopie geopend/);
  await assert.rejects(store.save(workspace("current")), /geen oudere reservekopie geopend/);
  assert.equal(storage.writes.length, 0);
  assert.equal(storage.reads.length, 0);
});

test("a known IDB authority never opens an older fallback, including a later browser boot", async () => {
  const older = record(workspace("old fallback")), storage = memory({ [fallbackKey]: older, [authorityKey]: head("indexeddb") });
  for (const indexedDB of [null, { open() { throw storageError("SecurityError"); } }]) {
    const store = api().create({ indexedDB, localStorage: storage });
    await assert.rejects(store.load(), /nieuwste Studio-werkomgeving kan nu niet veilig worden vastgesteld/);
    await assert.rejects(store.save(workspace("keep current")), /geen oudere reservekopie geopend/);
  }
  assert.equal(storage.values.get(fallbackKey), older);
  assert(!storage.reads.includes(fallbackKey));
  assert.equal(storage.writes.length, 0);
});

test("an already-open fallback instance cannot overwrite authority claimed by a newer IDB instance", async () => {
  const storage = memory(), store = api().create({ indexedDB: null, localStorage: storage });
  await store.save(workspace("fallback"));
  const previous = storage.values.get(fallbackKey);
  storage.values.set(authorityKey, head("indexeddb"));
  await assert.rejects(store.save(workspace("stale tab")), /nieuwste Studio-werkomgeving kan nu niet veilig worden vastgesteld/);
  await assert.rejects(store.load(), /geen oudere reservekopie geopend/);
  assert.equal(storage.values.get(fallbackKey), previous);
});

test("blocked IDB opening fails promptly and a late successful connection is closed", async () => {
  let request, closes = 0;
  const indexedDB = { open(name, version) { assert.equal(name, namespace); assert.equal(version, 1); request = {}; queueMicrotask(() => request.onblocked()); return request; } };
  const storage = memory({ [fallbackKey]: record(workspace("older")) }), store = api().create({ indexedDB, localStorage: storage });
  await assert.rejects(store.load(), /geen oudere reservekopie geopend/);
  request.result = { close() { closes++; } };
  request.onsuccess();
  assert.equal(closes, 1);
  assert.equal(storage.reads.length, 0);
});

test("inaccessible or corrupt authority/storage fails in Dutch without erasing data", async () => {
  const storage = memory({ [authorityKey]: "{broken", [fallbackKey]: record(workspace("keep")) });
  await assert.rejects(api().create({ indexedDB: null, localStorage: storage }).load(), /opslagkeuze.*niet leesbaar/);
  assert.equal(storage.values.get(authorityKey), "{broken");
  assert.equal(storage.writes.length, 0);
  const blocked = memory(); blocked.failWith(operation => operation === "read");
  await assert.rejects(api().create({ indexedDB: null, localStorage: blocked }).load(), /niet veilig worden gelezen/);
  await assert.rejects(api().create({ indexedDB: null, localStorage: null }).save(workspace("current")), /Browseropslag is niet beschikbaar/);
});

// Exercise the real IndexedDB request/transaction protocol when the existing
// development dependency is available; do not replace it with a hand-built DB.
let IDBFactory;
try { ({ IDBFactory } = require("fake-indexeddb")); } catch {}
if (!IDBFactory && process.env.UDPS_TEST_PACKAGE) {
  ({ IDBFactory } = createRequire(path.resolve(process.env.UDPS_TEST_PACKAGE))("fake-indexeddb"));
}
const idbTest = (name, body) => test(name, { skip: !IDBFactory && "fake-indexeddb is niet geïnstalleerd" }, body);

function controlledFactory() {
  const actual = new IDBFactory(), control = { failReads: false, abortWrites: false, abortAfterPut: false, successfulRequests: 0 };
  return { control, factory: { open(...args) {
    const request = actual.open(...args);
    request.addEventListener("success", () => {
      const db = request.result, transaction = db.transaction.bind(db);
      db.transaction = (stores, mode) => {
        if (mode === "readonly" && control.failReads) throw Error("Controlled read failure");
        const tx = transaction(stores, mode);
        if (mode === "readwrite" && control.abortWrites) queueMicrotask(() => tx.abort());
        if (mode === "readwrite" && control.abortAfterPut) {
          const objectStore = tx.objectStore.bind(tx);
          tx.objectStore = name => {
            const store = objectStore(name), put = store.put.bind(store);
            store.put = (...args) => {
              const pending = put(...args);
              pending.addEventListener("success", () => { control.successfulRequests++; tx.abort(); });
              return pending;
            };
            return store;
          };
        }
        return tx;
      };
    });
    return request;
  } } };
}

async function rawPut(factory, value) {
  await new Promise((resolve, reject) => {
    const request = factory.open(namespace, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction("snapshots", "readwrite");
      tx.objectStore("snapshots").put(value, "current");
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
  });
}

async function rawGet(factory) {
  return new Promise((resolve, reject) => {
    const request = factory.open(namespace, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction("snapshots", "readonly");
      const read = tx.objectStore("snapshots").get("current");
      tx.oncomplete = () => { db.close(); resolve(read.result); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
  });
}

idbTest("IDB persists a workspace at the 32 MiB JSON limit with only a small local backend marker", async () => {
  const factory = new IDBFactory(), storage = memory();
  storage.failWith((operation, _key, value) => operation === "write" && value.length > 200);
  const data = { name: "x".repeat(32 * 1024 * 1024 - JSON.stringify({ name: "" }).length) };
  await api().create({ indexedDB: factory, localStorage: storage }).save(data);
  const restored = await api().create({ indexedDB: factory, localStorage: storage }).load();
  assert.equal(restored.workspace.name, data.name);
  assert.equal(storage.values.has(fallbackKey), false);
  assert(storage.writes.every(([key]) => key === authorityKey));
});

idbTest("IDB transactions preserve invocation captures and the final save across a new boot", async () => {
  const factory = new IDBFactory(), storage = memory(), store = api().create({ indexedDB: factory, localStorage: storage });
  const data = workspace("first"), first = store.save(data);
  data.name = "second"; const second = store.save(data); data.name = "unsaved";
  await Promise.all([first, second]);
  assert.equal((await api().create({ indexedDB: factory, localStorage: storage }).load()).workspace.name, "second");
});

idbTest("a committed IDB snapshot never falls back after a read failure or aborted later write", async () => {
  const { factory, control } = controlledFactory(), storage = memory({ [fallbackKey]: record(workspace("older fallback")) });
  const store = api().create({ indexedDB: factory, localStorage: storage });
  await store.save(workspace("committed IDB"));
  const older = storage.values.get(fallbackKey);
  control.abortWrites = true;
  await assert.rejects(store.save(workspace("uncommitted")), /bewaren.*niet bevestigd/);
  control.abortWrites = false;
  assert.equal((await store.load()).workspace.name, "committed IDB");
  control.failReads = true;
  await assert.rejects(store.load(), /geen oudere reservekopie geopend/);
  await assert.rejects(api().create({ indexedDB: factory, localStorage: storage }).load(), /geen oudere reservekopie geopend/);
  assert.equal(storage.values.get(fallbackKey), older);
});

idbTest("a successful put request is not a confirmed save when its transaction later aborts", async () => {
  const { factory, control } = controlledFactory(), storage = memory();
  const store = api().create({ indexedDB: factory, localStorage: storage });
  await store.save(workspace("committed"));
  control.abortAfterPut = true;
  await assert.rejects(store.save(workspace("request succeeded but transaction aborted")), /bewaren.*niet bevestigd/);
  assert.equal(control.successfulRequests, 1);
  control.abortAfterPut = false;
  assert.equal((await store.load()).workspace.name, "committed");
});

idbTest("failure to guard backend authority prevents a new IDB write without destroying either copy", async () => {
  const factory = new IDBFactory(), storage = memory({ [fallbackKey]: record(workspace("old fallback")) });
  const store = api().create({ indexedDB: factory, localStorage: storage });
  await store.save(workspace("committed"));
  const before = new Map(storage.values);
  storage.failWith((operation, key) => operation === "write" && key === authorityKey);
  await assert.rejects(store.save(workspace("unprotected write")), /opslagkeuze.*niet veilig worden vastgelegd/);
  assert.equal((await rawGet(factory)).workspace.name, "committed");
  assert.deepEqual(storage.values, before);
});

idbTest("an empty IDB migrates only the own valid fallback and leaves its original bytes intact", async () => {
  const factory = new IDBFactory(), original = record(workspace("fallback to migrate"));
  const storage = memory({ [fallbackKey]: original, [authorityKey]: head("localstorage") });
  assert.equal((await api().create({ indexedDB: factory, localStorage: storage }).load()).workspace.name, "fallback to migrate");
  assert.equal(storage.values.get(fallbackKey), original);
  assert.equal(JSON.parse(storage.values.get(authorityKey)).backend, "indexeddb");
  await assert.rejects(api().create({ indexedDB: null, localStorage: storage }).load(), /geen oudere reservekopie geopend/);
});

idbTest("corrupt IDB snapshots are never replaced or rescued by an older fallback", async () => {
  const factory = new IDBFactory(), storage = memory({ [fallbackKey]: record(workspace("older fallback")) });
  await api().create({ indexedDB: factory, localStorage: storage }).save(workspace("original"));
  await rawPut(factory, { schema: 99, workspace: workspace("corrupt") });
  const before = new Map(storage.values);
  await assert.rejects(api().create({ indexedDB: factory, localStorage: storage }).load(), /bewaarde Studio-werkomgeving is niet leesbaar/);
  assert.deepEqual(storage.values, before);
  assert.equal((await rawGet(factory)).schema, 99);
});
