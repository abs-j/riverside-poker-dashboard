// Pure data builders for the club charts (cumulative profit, leaderboard bars, pot size,
// outstanding transfers, per-player results and regular opponents). No React in here so
// everything can be unit tested.

export type ChartSessionPlayer = {
  player: string;
  buyIn: number;
  cashOut: number;
  net: number;
  status: string | null;
};

export type ChartSession = {
  sessionNumber: number;
  date: string;
  eventType?: "cash" | "tournament";
  totalBuyIn: number;
  playerCount: number;
  winner: string | null;
  winnerProfit: number;
  players: ChartSessionPlayer[];
};

// Rows that are part of the ledger but are not people.
const NON_PLAYERS = new Set(["bad beat jackpot"]);

export const normalizeName = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLocaleLowerCase();

export const isRealPlayer = (name: string) => !NON_PLAYERS.has(normalizeName(name));

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function sortSessions<T extends { date: string; sessionNumber: number }>(sessions: T[]): T[] {
  return sessions
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.sessionNumber - b.sessionNumber);
}

export type GameMeta = {
  sessionNumber: number;
  date: string;
  eventType: "cash" | "tournament";
  playerCount: number;
};

export type CumulativeRuns = {
  games: GameMeta[];
  /** Running total after each game, flat across games a player sat out. */
  series: Map<string, number[]>;
  /** What the player made in each game, or null when they sat out. */
  results: Map<string, Array<number | null>>;
};

export function buildCumulativeRuns(sessions: ChartSession[], names: string[]): CumulativeRuns {
  const ordered = sortSessions(sessions);
  const keyToName = new Map(names.map((name) => [normalizeName(name), name]));
  const running = new Map(names.map((name) => [name, 0]));
  const series = new Map<string, number[]>(names.map((name) => [name, []]));
  const results = new Map<string, Array<number | null>>(names.map((name) => [name, []]));

  const games: GameMeta[] = ordered.map((session) => {
    const played = new Map<string, number>();
    for (const record of session.players) {
      const name = keyToName.get(normalizeName(record.player));
      if (name) played.set(name, (played.get(name) ?? 0) + record.net);
    }
    for (const name of names) {
      const delta = played.get(name);
      if (delta !== undefined) running.set(name, round2((running.get(name) ?? 0) + delta));
      series.get(name)!.push(running.get(name) ?? 0);
      results.get(name)!.push(delta === undefined ? null : round2(delta));
    }
    return {
      sessionNumber: session.sessionNumber,
      date: session.date,
      eventType: session.eventType ?? "cash",
      playerCount: session.playerCount,
    };
  });

  return { games, series, results };
}

export type PlayerTotal = { name: string; net: number; games: number };

export function buildPlayerTotals(sessions: ChartSession[]): PlayerTotal[] {
  const totals = new Map<string, PlayerTotal>();
  for (const session of sessions) {
    for (const record of session.players) {
      if (!isRealPlayer(record.player)) continue;
      const key = normalizeName(record.player);
      const entry = totals.get(key) ?? { name: record.player.trim(), net: 0, games: 0 };
      entry.net = round2(entry.net + record.net);
      entry.games += 1;
      totals.set(key, entry);
    }
  }
  return [...totals.values()].sort((a, b) => b.net - a.net || a.name.localeCompare(b.name));
}

/** Top and bottom ten when there are more than twenty players, otherwise everyone. */
export function trimLeaderboard<T>(rows: T[], showAll: boolean): { rows: T[]; hidden: number; gapAfter: number } {
  if (showAll || rows.length <= 20) return { rows, hidden: 0, gapAfter: -1 };
  return { rows: [...rows.slice(0, 10), ...rows.slice(-10)], hidden: rows.length - 20, gapAfter: 9 };
}

export type GameResult = { sessionNumber: number; date: string; net: number; playerCount: number };

export function buildResultsByGame(sessions: ChartSession[], playerName: string): GameResult[] {
  const key = normalizeName(playerName);
  const out: GameResult[] = [];
  for (const session of sortSessions(sessions)) {
    const records = session.players.filter((record) => normalizeName(record.player) === key);
    if (!records.length) continue;
    out.push({
      sessionNumber: session.sessionNumber,
      date: session.date,
      net: round2(records.reduce((sum, record) => sum + record.net, 0)),
      playerCount: session.playerCount,
    });
  }
  return out;
}

export type Opponent = {
  name: string;
  sharedGames: number;
  finishedAhead: number;
  finishedBehind: number;
};

/** Everyone the player has shared a game with, most games first. */
export function buildRegularOpponents(sessions: ChartSession[], playerName: string): Opponent[] {
  const key = normalizeName(playerName);
  const opponents = new Map<string, Opponent>();
  for (const session of sessions) {
    const mine = session.players.filter((record) => normalizeName(record.player) === key);
    if (!mine.length) continue;
    const myNet = mine.reduce((sum, record) => sum + record.net, 0);
    for (const record of session.players) {
      const otherKey = normalizeName(record.player);
      if (otherKey === key || !isRealPlayer(record.player)) continue;
      const entry = opponents.get(otherKey) ?? {
        name: record.player.trim(),
        sharedGames: 0,
        finishedAhead: 0,
        finishedBehind: 0,
      };
      entry.sharedGames += 1;
      if (myNet > record.net) entry.finishedAhead += 1;
      else if (myNet < record.net) entry.finishedBehind += 1;
      opponents.set(otherKey, entry);
    }
  }
  return [...opponents.values()].sort(
    (a, b) => b.sharedGames - a.sharedGames || a.name.localeCompare(b.name),
  );
}

/** Round axis ticks that always include zero when the data crosses it. */
export function niceTicks(lo: number, hi: number, count = 5): number[] {
  if (lo === hi) {
    const pad = lo === 0 ? 1 : Math.abs(lo) * 0.1;
    lo -= pad;
    hi += pad;
  }
  const span = hi - lo;
  const rawStep = span / Math.max(1, count - 1);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let value = start; value <= end + step / 2; value += step) {
    ticks.push(Math.round(value * 1e6) / 1e6);
  }
  return ticks;
}

export type MyNight = {
  playerName: string;
  /** The most recent game this player sat in. */
  last: {
    sessionNumber: number;
    date: string;
    net: number;
    buyIn: number;
    cashOut: number;
    /** 1 = best result at that table. */
    tableRank: number;
    playerCount: number;
    isTournament: boolean;
  };
  season: { net: number; games: number; positiveGames: number };
  /** Overall standing now and how it moved over the latest club game. */
  standing: { rank: number; of: number; movement: number | null };
  /** Positive = consecutive winning games, negative = consecutive losing games. */
  streak: number;
  bestGame: number;
};

/** A short personal summary for one member, or null if they have no games. */
export function buildMyNight(sessions: ChartSession[], viewerName: string): MyNight | null {
  const key = normalizeName(viewerName);
  const ordered = sortSessions(sessions);
  const mine = ordered
    .map((session) => ({
      session,
      records: session.players.filter((record) => normalizeName(record.player) === key),
    }))
    .filter((entry) => entry.records.length > 0);
  if (!mine.length) return null;

  const latest = mine[mine.length - 1];
  const net = round2(latest.records.reduce((sum, record) => sum + record.net, 0));
  const buyIn = round2(latest.records.reduce((sum, record) => sum + record.buyIn, 0));
  const cashOut = round2(latest.records.reduce((sum, record) => sum + record.cashOut, 0));
  const tableNets = latest.session.players.filter((record) => isRealPlayer(record.player)).map((record) => record.net);
  const tableRank = 1 + tableNets.filter((value) => value > net).length;

  const results = mine.map((entry) => round2(entry.records.reduce((sum, record) => sum + record.net, 0)));
  const lastSign = Math.sign(results[results.length - 1]);
  let streak = 0;
  if (lastSign !== 0) {
    for (let i = results.length - 1; i >= 0 && Math.sign(results[i]) === lastSign; i--) streak += lastSign;
  }

  const totalsNow = buildPlayerTotals(ordered);
  const indexNow = totalsNow.findIndex((row) => normalizeName(row.name) === key);
  const latestClubSession = ordered[ordered.length - 1];
  const totalsBefore = buildPlayerTotals(ordered.filter((session) => session !== latestClubSession));
  const indexBefore = totalsBefore.findIndex((row) => normalizeName(row.name) === key);
  const movement =
    indexBefore >= 0 && indexNow >= 0 && ordered.length > 1 ? indexBefore - indexNow : null;

  return {
    playerName: mine[0].records[0].player.trim(),
    last: {
      sessionNumber: latest.session.sessionNumber,
      date: latest.session.date,
      net,
      buyIn,
      cashOut,
      tableRank,
      playerCount: tableNets.length,
      isTournament: latest.session.eventType === "tournament",
    },
    season: {
      net: round2(results.reduce((sum, value) => sum + value, 0)),
      games: results.length,
      positiveGames: results.filter((value) => value > 0).length,
    },
    standing: { rank: indexNow + 1, of: totalsNow.length, movement },
    streak,
    bestGame: Math.max(...results),
  };
}
