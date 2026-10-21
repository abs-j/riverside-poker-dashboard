// The demo has no server. This answers the site's /api requests inside the browser, using the
// fictional data in ./data.ts. Anything a visitor changes (live ledger entries, profile
// picture) lives in memory and is gone on refresh.
import { buildDemoDashboard, buildPublicSummary, DEMO_VIEWER } from "./data";

const SESSION_KEY = "riverside-demo-signed-in";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const isSignedIn = () => {
  try {
    return window.localStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
};
const setSignedIn = (value: boolean) => {
  try {
    if (value) window.localStorage.setItem(SESSION_KEY, "1");
    else window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // Without storage the visitor just signs in again on refresh.
  }
};

type Action = "buy_in" | "cash_out";
type Entry = {
  eventId: string; sessionKey: string; sessionDate: string; memberName: string; action: Action; amount: number;
  comment: string | null; auditComments: { action: "entry" | "edit" | "delete"; comment: string; createdBy: string; createdAt: string }[];
  occurredAt: string; createdBy: string; createdAt: string; updatedBy: string; updatedAt: string; deleted: boolean; revision: number;
};
type LiveSession = {
  sessionKey: string; sessionDate: string; startedBy: string; startedAt: string;
  endedBy: string | null; endedAt: string | null; entries: Entry[];
};

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const today = () => new Date().toISOString().slice(0, 10);
let counter = 0;
const nextId = () => `demo-${Date.now().toString(36)}-${(counter += 1)}`;

function entry(session: Pick<LiveSession, "sessionKey" | "sessionDate">, player: string, action: Action, amount: number, ago: number, by: string, comment: string | null = null): Entry {
  const at = minutesAgo(ago);
  return {
    eventId: nextId(), sessionKey: session.sessionKey, sessionDate: session.sessionDate, memberName: player, action, amount, comment,
    auditComments: comment ? [{ action: "entry", comment, createdBy: by, createdAt: at }] : [],
    occurredAt: at, createdBy: by, createdAt: at, updatedBy: by, updatedAt: at, deleted: false, revision: 1,
  };
}

function seedLedger(key: string, date: string, startedBy: string, startedAgo: number, rows: [string, Action, number, number, string?][], closed: boolean): LiveSession {
  const session: LiveSession = {
    sessionKey: key, sessionDate: date, startedBy, startedAt: minutesAgo(startedAgo),
    endedBy: closed ? startedBy : null, endedAt: closed ? minutesAgo(startedAgo - 200) : null, entries: [],
  };
  session.entries = rows.map(([player, action, amount, ago, comment]) => entry(session, player, action, amount, ago, startedBy, comment ?? null));
  return session;
}

const dayOffset = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

function createState() {
  const dashboard = buildDemoDashboard();
  const history: LiveSession[] = [
    seedLedger("demo-history-3", dayOffset(21), "Maya Brooks", 21 * 1440, [
      ["Maya Brooks", "buy_in", 20, 21 * 1440 - 5], ["Sam Carter", "buy_in", 20, 21 * 1440 - 8], ["Leo Fernandez", "buy_in", 20, 21 * 1440 - 9],
      ["Nina Okafor", "buy_in", 20, 21 * 1440 - 10], ["Leo Fernandez", "buy_in", 10, 21 * 1440 - 80, "Rebuy"],
      ["Maya Brooks", "cash_out", 42, 21 * 1440 - 200], ["Sam Carter", "cash_out", 22, 21 * 1440 - 201], ["Nina Okafor", "cash_out", 16, 21 * 1440 - 202], ["Leo Fernandez", "cash_out", 10, 21 * 1440 - 203],
    ], true),
    seedLedger("demo-history-2", dayOffset(14), "Sam Carter", 14 * 1440, [
      ["Sam Carter", "buy_in", 20, 14 * 1440 - 3], ["Theo Larsen", "buy_in", 20, 14 * 1440 - 4], ["Ivy Chen", "buy_in", 20, 14 * 1440 - 6],
      ["Sam Carter", "cash_out", 35, 14 * 1440 - 190], ["Theo Larsen", "cash_out", 15, 14 * 1440 - 191], ["Ivy Chen", "cash_out", 10, 14 * 1440 - 192],
    ], true),
  ];
  // Tonight: one session already running so the Live page has something to show.
  const current = seedLedger(`demo-live-${today()}`, today(), "Maya Brooks", 95, [
    ["Maya Brooks", "buy_in", 20, 92], ["Sam Carter", "buy_in", 20, 91], ["Nina Okafor", "buy_in", 20, 90], ["Theo Larsen", "buy_in", 20, 90],
    ["Hana Sato", "buy_in", 20, 88], ["Marcus Webb", "buy_in", 20, 87], ["Marcus Webb", "buy_in", 10, 41, "Rebuy after a bad beat"],
    ["Hana Sato", "cash_out", 5, 12, "Left early"],
  ], false);
  return {
    dashboard,
    publicSummary: buildPublicSummary(dashboard),
    live: current as LiveSession | null,
    history,
    avatars: new Map<string, { key: string; name: string; kind: "preset" | "upload"; preset: string | null; version: number }>(),
  };
}

const avatarKey = (name: string) => name.trim().replace(/\s+/g, " ").toLocaleLowerCase();

function summaries(entries: Entry[]) {
  const byPlayer = new Map<string, { playerName: string; buyIns: number; cashOuts: number }>();
  for (const e of entries) {
    const row = byPlayer.get(e.memberName) ?? { playerName: e.memberName, buyIns: 0, cashOuts: 0 };
    if (e.action === "buy_in") row.buyIns = round2(row.buyIns + e.amount);
    else row.cashOuts = round2(row.cashOuts + e.amount);
    byPlayer.set(e.memberName, row);
  }
  return [...byPlayer.values()];
}
const totalsOf = (entries: Entry[]) => {
  const buyIns = round2(entries.filter((e) => e.action === "buy_in").reduce((s, e) => s + e.amount, 0));
  const cashOuts = round2(entries.filter((e) => e.action === "cash_out").reduce((s, e) => s + e.amount, 0));
  return { buyIns, cashOuts, net: round2(cashOuts - buyIns) };
};

export function installDemoApi() {
  const state = createState();

  const snapshot = () => {
    const session = state.live;
    if (!session) {
      return {
        sessionKey: "", sessionDate: today(), entries: [], hasRecordedActivity: false, playerSummaries: [],
        totals: { buyIns: 0, cashOuts: 0, net: 0 }, syncStatus: "synced", syncMessage: null, lastSyncedAt: new Date().toISOString(),
        sessionStatus: "not_started", startedBy: null, startedAt: null, endedBy: null, endedAt: null, closeSummary: null,
      };
    }
    const totals = totalsOf(session.entries);
    const ended = Boolean(session.endedAt);
    return {
      sessionKey: session.sessionKey, sessionDate: session.sessionDate, entries: session.entries,
      hasRecordedActivity: session.entries.length > 0, playerSummaries: summaries(session.entries), totals,
      syncStatus: "synced", syncMessage: null, lastSyncedAt: new Date().toISOString(),
      sessionStatus: ended ? "ended" : "open", startedBy: session.startedBy, startedAt: session.startedAt,
      endedBy: session.endedBy, endedAt: session.endedAt,
      closeSummary: ended
        ? { buyIns: totals.buyIns, cashOuts: totals.cashOuts, difference: round2(totals.buyIns - totals.cashOuts), balanceStatus: Math.abs(totals.buyIns - totals.cashOuts) < 0.01 ? "balanced" : "unbalanced", closedAt: session.endedAt }
        : null,
    };
  };

  const historyRecord = (session: LiveSession) => {
    const totals = totalsOf(session.entries);
    const difference = round2(totals.buyIns - totals.cashOuts);
    return {
      sessionKey: session.sessionKey, sessionDate: session.sessionDate, startedAt: session.startedAt,
      endedAt: session.endedAt ?? new Date().toISOString(), endedBy: session.endedBy,
      totals: { buyIns: totals.buyIns, cashOuts: totals.cashOuts, difference },
      balanceStatus: Math.abs(difference) < 0.01 ? "balanced" : "unbalanced",
      playerSummaries: summaries(session.entries), entries: session.entries,
    };
  };

  const route = async (method: string, path: string, body: any): Promise<Response> => {
    if (path === "/api/auth/member/session") return json(isSignedIn() ? { authenticated: true, memberName: DEMO_VIEWER } : { authenticated: false });
    if (path === "/api/auth/admin/session") return json({ authenticated: false });
    if (path === "/api/auth/member/login" && method === "POST") {
      // The demo accepts any password, so a visitor is never locked out.
      setSignedIn(true);
      return json({ authenticated: true, memberName: DEMO_VIEWER });
    }
    if (path === "/api/auth/member/logout") {
      setSignedIn(false);
      return new Response(null, { status: 204 });
    }
    if (path.startsWith("/api/auth/admin") || path.startsWith("/api/admin")) return json({ error: "The committee area is not part of the demo." }, 401);
    if (!isSignedIn() && path !== "/api/poker/public-summary" && path !== "/api/healthz") return json({ error: "Member authentication required." }, 401);

    if (path === "/api/healthz") return json({ status: "ok" });
    if (path === "/api/poker/public-summary") return json(state.publicSummary);
    if (path === "/api/poker/dashboard") return json({ ...state.dashboard, lastUpdated: new Date().toISOString() });
    if (path === "/api/poker/usage") return json({ accepted: true }, 202);

    if (path === "/api/poker/avatars") return json({ avatars: [...state.avatars.values()] });
    if (path.startsWith("/api/poker/avatars/image/")) return json({ error: "No picture." }, 404);
    if (path === "/api/poker/avatars/me") {
      const key = avatarKey(DEMO_VIEWER);
      if (method === "DELETE") {
        state.avatars.delete(key);
        return new Response(null, { status: 204 });
      }
      if (method === "PUT" && body?.kind === "preset") {
        const next = { key, name: DEMO_VIEWER, kind: "preset" as const, preset: String(body.preset), version: (state.avatars.get(key)?.version ?? 0) + 1 };
        state.avatars.set(key, next);
        return json(next);
      }
      return json({ error: "Photo uploads are turned off in the demo. Pick one of the built-in pictures." }, 400);
    }

    if (path === "/api/poker/live-activity/history") return json({ sessions: [...state.history].reverse().map(historyRecord) });
    if (path === "/api/poker/live-activity/sync") return json(snapshot());
    if (path === "/api/poker/live-session/start") {
      if (!state.live || state.live.endedAt) {
        const startedAt = new Date().toISOString();
        state.live = { sessionKey: `demo-live-${nextId()}`, sessionDate: today(), startedBy: DEMO_VIEWER, startedAt, endedBy: null, endedAt: null, entries: [] };
      }
      return json(snapshot(), 201);
    }
    if (path === "/api/poker/live-session/end") {
      if (!state.live) return json({ error: "No live session to close." }, 400);
      if (state.live.endedAt) return json({ outcome: "already_closed", snapshot: snapshot() });
      if (state.live.entries.length === 0) {
        state.live = null;
        return json({ outcome: "discarded", snapshot: snapshot() });
      }
      state.live.endedAt = new Date().toISOString();
      state.live.endedBy = DEMO_VIEWER;
      state.history.push(state.live);
      return json({ outcome: "closed", snapshot: snapshot() });
    }

    if (path === "/api/poker/live-activity") {
      if (method === "GET") return json(snapshot());
      if (method === "POST") {
        if (!state.live || state.live.endedAt) return json({ error: "Start a session before adding activity." }, 400);
        const amount = Number(body?.amount);
        if (!(amount > 0) || (body?.action !== "buy_in" && body?.action !== "cash_out")) return json({ error: "Enter an amount above zero." }, 400);
        const player = String(body?.attributedPlayer || DEMO_VIEWER).trim();
        const comment = body?.comment ? String(body.comment) : null;
        const created = entry(state.live, player, body.action, round2(amount), 0, DEMO_VIEWER, comment);
        if (body?.eventId) created.eventId = String(body.eventId);
        state.live.entries.push(created);
        return json(snapshot(), 201);
      }
    }
    const match = path.match(/^\/api\/poker\/live-activity\/([^/]+)$/);
    if (match && state.live) {
      const id = decodeURIComponent(match[1]);
      const found = state.live.entries.find((e) => e.eventId === id);
      if (!found) return json({ error: "Activity entry not found." }, 404);
      const now = new Date().toISOString();
      if (method === "PATCH") {
        found.action = body.action;
        found.amount = round2(Number(body.amount));
        if (body.attributedPlayer) found.memberName = String(body.attributedPlayer);
        found.auditComments.push({ action: "edit", comment: String(body.comment ?? ""), createdBy: DEMO_VIEWER, createdAt: now });
        found.updatedAt = now;
        found.updatedBy = DEMO_VIEWER;
        found.revision += 1;
        return json(snapshot());
      }
      if (method === "DELETE") {
        state.live.entries = state.live.entries.filter((e) => e.eventId !== id);
        return json(snapshot());
      }
    }
    return json({ error: "Not available in the demo." }, 404);
  };

  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : null;
    const raw = request ? request.url : String(input);
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin || !url.pathname.startsWith("/api/")) return realFetch(input, init);
    const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
    let body: unknown = undefined;
    try {
      const text = typeof init?.body === "string" ? init.body : request ? await request.clone().text() : "";
      body = text ? JSON.parse(text) : undefined;
    } catch {
      body = undefined;
    }
    // A short delay so loading states are visible, as they would be on a real connection.
    await new Promise((resolve) => window.setTimeout(resolve, 120));
    return route(method, url.pathname, body);
  };
}

