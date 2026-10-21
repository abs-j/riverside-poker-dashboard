import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");

// Runs sw.js against in-memory stand-ins for the service worker globals.
function createWorker({ online = true } = {}) {
  const listeners = {};
  const store = new Map();
  const cacheApi = {
    open: async () => ({
      match: async (key) => store.get(typeof key === "string" ? key : key.url),
      put: async (key, response) => store.set(typeof key === "string" ? key : key.url, response),
    }),
    match: async (key) => store.get(key),
    keys: async () => ["poker-static-v0", "poker-static-v1", "other-app"],
    delete: async (name) => deleted.push(name),
  };
  const deleted = [];
  const fetched = [];
  const makeResponse = (body, type = "text/css") => ({
    ok: true,
    body,
    headers: { get: () => type },
    clone() { return this; },
  });
  const self = {
    location: { origin: "https://club.test" },
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
    addEventListener: (type, fn) => { listeners[type] = fn; },
  };
  vm.runInNewContext(source, {
    self,
    caches: cacheApi,
    URL,
    Promise,
    fetch: async (request) => {
      fetched.push(request.url);
      if (!online) throw new Error("offline");
      const isPage = request.mode === "navigate";
      return makeResponse(`net:${request.url}`, isPage ? "text/html; charset=utf-8" : "text/javascript");
    },
  });

  const request = (path, { method = "GET", mode = "cors", origin = "https://club.test" } = {}) => ({
    url: `${origin}${path}`,
    method,
    mode,
  });
  const dispatch = async (req) => {
    let handled;
    listeners.fetch({ request: req, respondWith: (promise) => { handled = promise; } });
    return handled === undefined ? undefined : await handled;
  };
  return { listeners, dispatch, request, store, deleted, fetched };
}

test("never intercepts API calls, non-GET requests or other origins", async () => {
  const worker = createWorker();
  assert.equal(await worker.dispatch(worker.request("/api/poker/dashboard")), undefined);
  assert.equal(await worker.dispatch(worker.request("/assets/app.js", { method: "POST" })), undefined);
  assert.equal(await worker.dispatch(worker.request("/assets/app.js", { origin: "https://fonts.gstatic.com" })), undefined);
  assert.equal(worker.store.size, 0);
});

test("caches hashed assets and serves them without the network afterwards", async () => {
  const worker = createWorker();
  const first = await worker.dispatch(worker.request("/assets/index-abc.js"));
  assert.equal(first.body, "net:https://club.test/assets/index-abc.js");
  assert.equal(worker.fetched.length, 1);
  const second = await worker.dispatch(worker.request("/assets/index-abc.js"));
  assert.equal(second.body, first.body);
  assert.equal(worker.fetched.length, 1);
});

test("navigations try the network first and fall back to the cached shell offline", async () => {
  const online = createWorker();
  const page = await online.dispatch(online.request("/dashboard", { mode: "navigate" }));
  assert.match(page.body, /net:/);
  assert.ok(online.store.has("/index.html"));

  const offline = createWorker({ online: false });
  offline.store.set("/index.html", { ok: true, body: "cached-shell" });
  const fallback = await offline.dispatch(offline.request("/dashboard", { mode: "navigate" }));
  assert.equal(fallback.body, "cached-shell");
});

test("an offline first visit with nothing cached fails instead of inventing a page", async () => {
  const worker = createWorker({ online: false });
  await assert.rejects(() => worker.dispatch(worker.request("/", { mode: "navigate" })), /Offline/);
});

test("activation clears old poker caches only", async () => {
  const worker = createWorker();
  let waited;
  worker.listeners.activate({ waitUntil: (promise) => { waited = promise; } });
  await waited;
  assert.deepEqual(worker.deleted, ["poker-static-v0"]);
});
