import assert from "node:assert/strict";
import test from "node:test";

import { checkMemberSession, landingPathForSessions } from "./member-session.ts";

const ok = (body) => ({ ok: true, status: 200, json: async () => body });
const status = (code) => ({ ok: false, status: code, json: async () => ({}) });

function deps(responses, { cancelAfter = Infinity } = {}) {
  let calls = 0;
  const waits = [];
  return {
    waits,
    get calls() { return calls; },
    fetchSession: async () => {
      const next = responses[Math.min(calls, responses.length - 1)];
      calls += 1;
      if (next instanceof Error) throw next;
      return next;
    },
    wait: async (ms) => { waits.push(ms); },
    isCancelled: () => calls >= cancelAfter,
  };
}

test("a signed-in member is returned straight away", async () => {
  const d = deps([ok({ authenticated: true, memberName: "Abhay" })]);
  assert.deepEqual(await checkMemberSession(d), { authenticated: true, memberName: "Abhay" });
  assert.equal(d.calls, 1);
});

test("a clear 'not signed in' answer is never retried", async () => {
  const d = deps([ok({ authenticated: false })]);
  assert.equal(await checkMemberSession(d), null);
  assert.equal(d.calls, 1);
  const unauthorised = deps([status(401)]);
  assert.equal(await checkMemberSession(unauthorised), null);
  assert.equal(unauthorised.calls, 1);
});

test("network errors and server errors are retried, then succeed", async () => {
  const d = deps([new TypeError("offline"), status(502), ok({ authenticated: true, memberName: "Ana" })]);
  assert.deepEqual(await checkMemberSession(d), { authenticated: true, memberName: "Ana" });
  assert.equal(d.calls, 3);
  assert.deepEqual(d.waits, [700, 1600]);
});

test("giving up reports unreachable, not signed out", async () => {
  const d = deps([new TypeError("offline")]);
  assert.equal(await checkMemberSession(d), "unreachable");
  assert.equal(d.calls, 4);
});

test("a cancelled check stops quietly", async () => {
  const d = deps([status(503)], { cancelAfter: 1 });
  assert.equal(await checkMemberSession(d), null);
  assert.equal(d.calls, 1);
});

test("signed-in members and admins land in the matching dashboard", () => {
  assert.equal(landingPathForSessions(true, false), "/dashboard");
  assert.equal(landingPathForSessions(false, true), "/admin");
  assert.equal(landingPathForSessions(false, false), null);
  assert.equal(landingPathForSessions(true, true), "/dashboard");
});
