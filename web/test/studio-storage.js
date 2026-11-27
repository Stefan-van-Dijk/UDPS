var UDPSStudioStorage = (() => {
  "use strict";
  const STORE = "snapshots", KEY = "current", MAX_BYTES = 32 * 1024 * 1024;
  const FALLBACK_WARNING = "IndexedDB is niet beschikbaar. De Studio gebruikt de beperkte browseropslag. Bewaar ook een JSON-kopie.";
  const globalValue = name => { try { return globalThis[name]; } catch { return undefined; } };
  const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const fail = (message, cause) => { const error = new Error(message); if (cause) error.cause = cause; return error; };

  function capture(workspace) {
    if (!object(workspace)) throw fail("Verwacht een Studio-werkomgeving om te bewaren.");
    let text, copy;
    try { text = JSON.stringify(workspace); copy = JSON.parse(text); }
    catch (error) { throw fail("De Studio-werkomgeving kan niet als JSON worden bewaard.", error); }
    if (!object(copy)) throw fail("Verwacht een geldige Studio-werkomgeving.");
    if (new TextEncoder().encode(text).byteLength > MAX_BYTES) throw fail("De Studio-werkomgeving is groter dan 32 MiB. Bewaar minder gegevens tegelijk.");
    const model = typeof UDPSStudioWorkspace !== "undefined" ? UDPSStudioWorkspace : globalValue("UDPSStudioWorkspace");
    if (typeof model?.validate === "function") {
      try { if (model.validate(copy) === false) throw new Error("Ongeldige werkomgeving."); }
      catch (error) { throw fail(`De Studio-werkomgeving is ongeldig: ${error.message || "controleer de gegevens."}`, error); }
    }
    return copy;
  }

  function readRecord(record) {
    if (!object(record) || record.schema !== 1 || !object(record.workspace)) throw fail("De bewaarde Studio-werkomgeving is niet leesbaar. De opgeslagen gegevens zijn ongewijzigd.");
    try { return capture(record.workspace); }
    catch (error) { throw fail("De bewaarde Studio-werkomgeving is ongeldig. De opgeslagen gegevens zijn ongewijzigd.", error); }
  }

  function create(options = {}) {
    const namespace = options.namespace ?? "udps-studio-test-v1";
    if (typeof namespace !== "string" || !namespace.trim() || namespace.length > 200 || /[\u0000-\u001f\u007f]/.test(namespace)) throw fail("Geef een geldige opslagnaam voor de Studio.");
    const factory = Object.hasOwn(options, "indexedDB") ? options.indexedDB : globalValue("indexedDB");
    const storage = Object.hasOwn(options, "localStorage") ? options.localStorage : globalValue("localStorage");
    const fallbackKey = `${namespace}:fallback`, authorityKey = `${namespace}:backend`;
    let backendPromise, queue = Promise.resolve();
    const ordered = operation => { const result = queue.then(operation); queue = result.catch(() => {}); return result; };
    const unavailable = error => ["SecurityError", "NotSupportedError"].includes(error?.name);

    function authority() {
      if (!storage) return null;
      let text;
      try { text = storage.getItem(authorityKey); }
      catch (error) { throw fail("De opslagkeuze van de Studio kan niet veilig worden gelezen. Er is geen reservekopie geopend.", error); }
      if (text === null) return null;
      try {
        const value = JSON.parse(text);
        if (!object(value) || value.schema !== 1 || !["indexeddb", "localstorage"].includes(value.backend)) throw new Error("Ongeldige opslagkeuze.");
        return value.backend;
      } catch (error) { throw fail("De bewaarde opslagkeuze van de Studio is niet leesbaar. De opgeslagen gegevens zijn ongewijzigd.", error); }
    }

    function mark(backend) {
      if (!storage) return;
      authority();
      try { storage.setItem(authorityKey, JSON.stringify({ schema: 1, backend })); }
      catch (error) { throw fail("De opslagkeuze van de Studio kon niet veilig worden vastgelegd. De werkomgeving is niet opnieuw bewaard.", error); }
    }

    function fallbackRecord() {
      if (!storage) throw fail("Browseropslag is niet beschikbaar. Bewaar de Studio-werkomgeving als JSON-bestand.");
      let text;
      try { text = storage.getItem(fallbackKey); }
      catch (error) { throw fail("De beperkte browseropslag kan niet worden gelezen. De huidige gegevens blijven behouden.", error); }
      if (text === null) return undefined;
      try { return JSON.parse(text); }
      catch (error) { throw fail("De bewaarde Studio-reservekopie is niet leesbaar. De opgeslagen gegevens zijn ongewijzigd.", error); }
    }

    function fallbackBackend() {
      if (authority() === "indexeddb") throw fail("De nieuwste Studio-werkomgeving kan nu niet veilig worden vastgesteld. De opslagkeuze verwijst naar IndexedDB; er is geen oudere reservekopie geopend.");
      return { kind: "localstorage" };
    }

    function backend() {
      if (backendPromise) return backendPromise;
      backendPromise = new Promise((resolve, reject) => {
        if (typeof factory?.open !== "function") { try { resolve(fallbackBackend()); } catch (error) { reject(error); } return; }
        let request, settled = false;
        const finish = (error, db) => {
          if (settled) { db?.close(); return; }
          settled = true;
          clearTimeout(timer);
          if (!error) { db.onversionchange = () => db.close(); resolve({ kind: "indexeddb", db }); }
          else if (unavailable(error)) { try { resolve(fallbackBackend()); } catch (failure) { reject(failure); } }
          else reject(fail("De Studio-browseropslag kon niet worden geopend. Er is geen oudere reservekopie geopend.", error));
        };
        const timer = setTimeout(() => finish(new Error("Openen niet bevestigd.")), 5000);
        try {
          request = factory.open(namespace, 1);
          request.onupgradeneeded = () => {
            try { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE); }
            catch (error) { try { request.transaction?.abort(); } catch {} finish(error); }
          };
          request.onsuccess = () => finish(null, request.result);
          request.onerror = () => finish(request.error || new Error("Openen mislukt."));
          request.onblocked = () => finish(new Error("Openen wordt door een ander tabblad geblokkeerd."));
        } catch (error) { finish(error); }
      });
      return backendPromise;
    }

    function transaction(db, mode, record) {
      return new Promise((resolve, reject) => {
        let tx, request, result, requestError, settled = false;
        const finish = error => {
          if (settled) return;
          settled = true; clearTimeout(timer);
          if (error) reject(fail(mode === "readwrite"
            ? "Het bewaren van de Studio-werkomgeving is niet bevestigd. De huidige gegevens blijven behouden; bewaar een JSON-kopie."
            : "De bewaarde Studio-werkomgeving kon niet worden gelezen. Er is geen oudere reservekopie geopend.", error));
          else resolve(result);
        };
        const timer = setTimeout(() => { try { tx?.abort(); } catch {} finish(new Error("Opslagbewerking niet bevestigd.")); }, 5000);
        try {
          tx = db.transaction(STORE, mode);
          tx.oncomplete = () => finish(requestError);
          tx.onerror = () => { requestError = tx.error || request?.error || new Error("Opslagbewerking mislukt."); };
          tx.onabort = () => finish(tx.error || requestError || new Error("Opslagbewerking afgebroken."));
          const store = tx.objectStore(STORE);
          request = mode === "readonly" ? store.get(KEY) : store.put(record, KEY);
          request.onsuccess = () => { result = request.result; };
          request.onerror = () => { requestError = request.error || new Error("Opslagverzoek mislukt."); };
        } catch (error) { try { tx?.abort(); } catch {} finish(error); }
      });
    }

    return {
      load() { return ordered(async () => {
        const active = await backend();
        if (active.kind === "localstorage") {
          // Another Studio instance may have switched to IndexedDB since this opened.
          fallbackBackend();
          const record = fallbackRecord();
          return { workspace: record === undefined ? null : readRecord(record), warning: FALLBACK_WARNING };
        }
        const record = await transaction(active.db, "readonly");
        if (record !== undefined) {
          const workspace = readRecord(record);
          mark("indexeddb");
          return { workspace };
        }
        const previous = authority();
        if (previous === "indexeddb") throw fail("De Studio-opslag verwijst naar IndexedDB, maar er is geen leesbare werkomgeving gevonden. De reservekopie is niet automatisch geopend.");
        // Recover only this namespace's committed fallback into an empty database.
        const fallback = storage ? fallbackRecord() : undefined;
        if (fallback === undefined) return { workspace: null };
        const workspace = readRecord(fallback);
        mark("indexeddb");
        await transaction(active.db, "readwrite", { schema: 1, workspace });
        return { workspace };
      }); },
      save(workspace) {
        let copy;
        try { copy = capture(workspace); }
        catch (error) { return Promise.reject(error); }
        return ordered(async () => {
          const active = await backend();
          const record = { schema: 1, workspace: copy };
          if (active.kind === "indexeddb") {
            // Mark authority before a commit; failure can never revive older fallback bytes.
            mark("indexeddb");
            await transaction(active.db, "readwrite", record);
            return {};
          }
          fallbackBackend();
          if (!storage) throw fail("Browseropslag is niet beschikbaar. Bewaar de Studio-werkomgeving als JSON-bestand.");
          try { storage.setItem(fallbackKey, JSON.stringify(record)); }
          catch (error) { throw fail("De beperkte browseropslag is vol of niet beschikbaar. Bewaar de Studio-werkomgeving als JSON-bestand.", error); }
          mark("localstorage");
          return { warning: FALLBACK_WARNING };
        });
      }
    };
  }
  return Object.freeze({ create });
})();
