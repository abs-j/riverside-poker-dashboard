// Club points: a season leaderboard that rewards turning up AND winning, scaled by how many
// people played that night. Pure functions, no React, so the rules can be tested and the
// "How points work" text can be generated from the same numbers.
import { isRealPlayer, normalizeName } from "./club-charts.ts";
import type { TournamentEvent } from "./earnings-analytics.ts";

export const POINTS_RULES = {
  /** Just for taking a seat. */
  turnUp: { cash: 6, tournament: 10 },
  /** Top of the placement scale; scaled by how many played. */
  placementMax: 24,
  /** A normal night is about 12 players; bigger tables count for more, smaller for less. */
  size: { reference: 12, min: 0.6, max: 1.4 },
  /** Winning (first place and in profit): a flat amount plus one per player. */
  win: { flat: 15, perPlayer: 1, minPlayers: 4 },
  podium: { second: 8, third: 4, minPlayers: 6 },
  inProfit: 4,
  perKnockout: 2,
  /** Nights with fewer real players than this are not scored. */
  minPlayersToCount: 4,
  /** Fewer nights than this and the player is shown as provisional. */
  provisionalBelowNights: 3,
} as const;

export type PointsRules = typeof POINTS_RULES;
export type NightKind = "cash" | "tournament";

const round1 = (value: number) => Math.round((value + Number.EPSILON) * 10) / 10;
const cents = (value: number) => Math.round(value * 100);

export function sizeFactor(players: number, rules: PointsRules = POINTS_RULES): number {
  const raw = Math.sqrt(players / rules.size.reference);
  return Math.max(rules.size.min, Math.min(rules.size.max, raw));
}

export type PointsParts = {
  turnUp: number;
  placement: number;
  win: number;
  podium: number;
  inProfit: number;
  knockouts: number;
};

export function scorePlacement(
  input: { kind: NightKind; players: number; rank: number; net: number; knockouts?: number },
  rules: PointsRules = POINTS_RULES,
): { points: number; parts: PointsParts } {
  const { kind, players, rank, net } = input;
  const placement =
    players > 1 ? rules.placementMax * ((players - rank) / (players - 1)) * sizeFactor(players, rules) : 0;
  const won = rank === 1 && net > 0 && players >= rules.win.minPlayers;
  const parts: PointsParts = {
    turnUp: rules.turnUp[kind],
    placement,
    win: won ? rules.win.flat + rules.win.perPlayer * players : 0,
    podium:
      players >= rules.podium.minPlayers
        ? rank === 2
          ? rules.podium.second
          : rank === 3
            ? rules.podium.third
            : 0
        : 0,
    inProfit: net > 0 ? rules.inProfit : 0,
    knockouts: kind === "tournament" ? rules.perKnockout * (input.knockouts ?? 0) : 0,
  };
  const points = Object.values(parts).reduce((sum, value) => sum + value, 0);
  return { points, parts };
}

// ------------------------------------------------------------------ inputs

export type PointsCashNight = {
  sessionNumber: number;
  date: string;
  eventType?: "cash" | "tournament";
  players: Array<{ player: string; net: number }>;
};

export type PlayerNight = {
  id: string;
  date: string;
  kind: NightKind;
  sessionNumber: number | null;
  tournamentId: string | null;
  players: number;
  rank: number;
  net: number;
  knockouts: number;
  points: number;
  parts: PointsParts;
};

export type PointsRow = {
  rank: number;
  key: string;
  name: string;
  points: number;
  nights: number;
  cashNights: number;
  tournaments: number;
  wins: number;
  podiums: number;
  net: number;
  pointsPerNight: number;
  bestNight: PlayerNight | null;
  /** Points from the last five nights, oldest first. */
  recent: number[];
  provisional: boolean;
  /** Newest first. */
  history: PlayerNight[];
};

/** Competition ranking by net profit: equal results share a place (1, 2, 2, 4). */
function rankByNet<T extends { net: number }>(rows: T[]): Array<T & { rank: number }> {
  const sorted = rows.slice().sort((a, b) => cents(b.net) - cents(a.net));
  let lastNet: number | null = null;
  let lastRank = 0;
  return sorted.map((row, index) => {
    if (lastNet === null || cents(row.net) !== lastNet) {
      lastRank = index + 1;
      lastNet = cents(row.net);
    }
    return { ...row, rank: lastRank };
  });
}

export function quarterOf(date: string): string {
  const month = Number(date.slice(5, 7));
  return `${date.slice(0, 4)}-Q${Math.floor((month - 1) / 3) + 1}`;
}

export type PointsOptions = {
  /** "ALL" or a calendar quarter such as "2026-Q4". */
  season?: string;
  /** Count only these kinds of night (e.g. cash only). Default: both. */
  kinds?: NightKind[];
  rules?: PointsRules;
};

type Entry = { key: string; name: string; night: PlayerNight };

export function scoreNights(
  cashNights: PointsCashNight[],
  tournaments: TournamentEvent[],
  rules: PointsRules = POINTS_RULES,
): Entry[] {
  const entries: Entry[] = [];

  for (const night of cashNights) {
    if (night.eventType === "tournament") continue;
    const real = night.players.filter((player) => isRealPlayer(player.player));
    if (real.length < rules.minPlayersToCount) continue;
    for (const row of rankByNet(real)) {
      const { points, parts } = scorePlacement({ kind: "cash", players: real.length, rank: row.rank, net: row.net }, rules);
      entries.push({
        key: normalizeName(row.player),
        name: row.player.trim(),
        night: {
          id: `cash-${night.sessionNumber}`,
          date: night.date,
          kind: "cash",
          sessionNumber: night.sessionNumber,
          tournamentId: null,
          players: real.length,
          rank: row.rank,
          net: row.net,
          knockouts: 0,
          points,
          parts,
        },
      });
    }
  }

  for (const event of tournaments) {
    const real = event.results.filter((result) => isRealPlayer(result.player));
    if (real.length < rules.minPlayersToCount) continue;
    // Recorded places are used as they are. Anyone without one is ranked after them by result.
    const known = real.filter((result) => result.finishPlace !== null);
    const unknown = rankByNet(real.filter((result) => result.finishPlace === null).map((r) => ({ ...r, net: r.netProfit })));
    const offset = known.reduce((max, result) => Math.max(max, result.finishPlace ?? 0), 0);
    const ranked: Array<{ result: (typeof real)[number]; rank: number }> = [
      ...known.map((result) => ({ result, rank: result.finishPlace as number })),
      ...unknown.map((row) => ({ result: row as (typeof real)[number], rank: offset + row.rank })),
    ];
    for (const { result, rank } of ranked) {
      const { points, parts } = scorePlacement(
        { kind: "tournament", players: real.length, rank, net: result.netProfit, knockouts: result.knockouts },
        rules,
      );
      entries.push({
        key: normalizeName(result.player),
        name: result.player.trim(),
        night: {
          id: `tournament-${event.id}`,
          date: event.date,
          kind: "tournament",
          sessionNumber: null,
          tournamentId: event.id,
          players: real.length,
          rank,
          net: result.netProfit,
          knockouts: result.knockouts,
          points,
          parts,
        },
      });
    }
  }
  return entries;
}

export function buildPointsLeaderboard(
  cashNights: PointsCashNight[],
  tournaments: TournamentEvent[],
  options: PointsOptions = {},
): PointsRow[] {
  const rules = options.rules ?? POINTS_RULES;
  const season = options.season ?? "ALL";
  const kinds = options.kinds;
  const entries = scoreNights(cashNights, tournaments, rules).filter(
    (entry) =>
      (season === "ALL" || quarterOf(entry.night.date) === season) &&
      (!kinds || kinds.includes(entry.night.kind)),
  );

  const byPlayer = new Map<string, { name: string; nights: PlayerNight[] }>();
  for (const entry of entries) {
    const current = byPlayer.get(entry.key) ?? { name: entry.name, nights: [] };
    current.nights.push(entry.night);
    byPlayer.set(entry.key, current);
  }

  const rows = [...byPlayer.entries()].map(([key, { name, nights }]) => {
    const ordered = nights.slice().sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    const points = round1(ordered.reduce((sum, night) => sum + night.points, 0));
    const best = ordered.reduce<PlayerNight | null>((top, night) => (!top || night.points > top.points ? night : top), null);
    return {
      rank: 0,
      key,
      name,
      points,
      nights: ordered.length,
      cashNights: ordered.filter((night) => night.kind === "cash").length,
      tournaments: ordered.filter((night) => night.kind === "tournament").length,
      wins: ordered.filter((night) => night.rank === 1 && night.net > 0).length,
      podiums: ordered.filter((night) => night.rank <= 3 && night.players >= rules.podium.minPlayers).length,
      net: round1(ordered.reduce((sum, night) => sum + night.net, 0) * 100) / 100,
      pointsPerNight: round1(points / ordered.length),
      bestNight: best,
      recent: ordered.slice(-5).map((night) => round1(night.points)),
      provisional: ordered.length < rules.provisionalBelowNights,
      history: ordered.slice().reverse(),
    } satisfies PointsRow;
  });

  rows.sort(
    (a, b) =>
      b.points - a.points || b.wins - a.wins || b.nights - a.nights || b.net - a.net || a.name.localeCompare(b.name),
  );
  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}

/** Seasons that have at least one scored night, newest first. */
export function pointsSeasons(cashNights: PointsCashNight[], tournaments: TournamentEvent[], rules: PointsRules = POINTS_RULES): string[] {
  const keys = new Set(scoreNights(cashNights, tournaments, rules).map((entry) => quarterOf(entry.night.date)));
  return [...keys].sort().reverse();
}

export function seasonLabel(season: string): string {
  return season === "ALL" ? "All time" : `${season.slice(5)} ${season.slice(0, 4)}`;
}

export function pointsFor(rows: PointsRow[], playerName: string): PointsRow | null {
  const key = normalizeName(playerName);
  return rows.find((row) => row.key === key) ?? null;
}

/**
 * The points a player earned on one specific night, if it was scored. Cash nights are matched
 * by session number; tournaments by their id, or by date when only the date is known.
 */
export function nightPointsFor(
  rows: PointsRow[],
  playerName: string,
  match: { sessionNumber?: number; tournamentId?: string; date?: string; kind?: NightKind },
): PlayerNight | null {
  const row = pointsFor(rows, playerName);
  if (!row) return null;
  return (
    row.history.find((night) => {
      if (match.kind === "tournament") {
        return night.kind === "tournament" && (match.tournamentId ? night.tournamentId === match.tournamentId : night.date === match.date);
      }
      if (match.tournamentId !== undefined && night.tournamentId === match.tournamentId) return true;
      return match.sessionNumber !== undefined && night.kind === "cash" && night.sessionNumber === match.sessionNumber;
    }) ?? null
  );
}

/** Worked examples shown in "How points work", computed from the live rules. */
export function pointsExamples(rules: PointsRules = POINTS_RULES) {
  const cases: Array<{ label: string; input: Parameters<typeof scorePlacement>[0] }> = [
    { label: "Win a cash night, 8 players", input: { kind: "cash", players: 8, rank: 1, net: 30 } },
    { label: "Win a cash night, 15 players", input: { kind: "cash", players: 15, rank: 1, net: 50 } },
    { label: "Second of 15, in profit", input: { kind: "cash", players: 15, rank: 2, net: 25 } },
    { label: "Mid-table of 15, small loss", input: { kind: "cash", players: 15, rank: 8, net: -5 } },
    { label: "Last of 15", input: { kind: "cash", players: 15, rank: 15, net: -40 } },
    { label: "Win a tournament, 12 players, 4 knockouts", input: { kind: "tournament", players: 12, rank: 1, net: 97.5, knockouts: 4 } },
  ];
  return cases.map(({ label, input }) => ({ label, points: round1(scorePlacement(input, rules).points) }));
}

export type PointsAfterNight = {
  /** Calendar quarter the night belongs to, e.g. "2026-Q4". */
  season: string;
  /** The table as it stood once this night was counted, best first. */
  rows: Array<{ name: string; points: number; earned: number; rank: number }>;
  /** Everyone who scored on the night, best first. */
  earnedTonight: Array<{ name: string; earned: number }>;
};

/**
 * The season table as of a given night, with the points each player earned on it. Used for the
 * "club points after this night" recap slide.
 */
export function pointsAfterNight(
  cashNights: PointsCashNight[],
  tournaments: TournamentEvent[],
  night: { date: string; sessionNumber?: number; tournamentId?: string },
  rules: PointsRules = POINTS_RULES,
): PointsAfterNight {
  const season = quarterOf(night.date);
  const upTo = (date: string) => date <= night.date;
  const rows = buildPointsLeaderboard(
    cashNights.filter((entry) => upTo(entry.date)),
    tournaments.filter((entry) => upTo(entry.date)),
    { season, rules },
  );
  const id = night.tournamentId !== undefined ? `tournament-${night.tournamentId}` : `cash-${night.sessionNumber}`;
  const earned = new Map(
    scoreNights(cashNights, tournaments, rules)
      .filter((entry) => entry.night.id === id)
      .map((entry) => [entry.key, round1(entry.night.points)] as const),
  );
  return {
    season,
    rows: rows.map((row) => ({ name: row.name, points: round1(row.points), earned: earned.get(row.key) ?? 0, rank: row.rank })),
    earnedTonight: [...earned.entries()]
      .map(([key, value]) => ({ name: rows.find((row) => row.key === key)?.name ?? key, earned: value }))
      .sort((a, b) => b.earned - a.earned),
  };
}

/**
 * Turns the leaderboard's own period filter into the points season it implies, so one filter
 * bar drives both tables. A month maps to its calendar quarter. Returns "ALL" for all time, and
 * null when that quarter has no scored night (so the page can say so instead of guessing).
 */
export function seasonForPeriod(
  period: string,
  breakdown: "months" | "quarters",
  seasons: string[],
): string | null {
  if (period === "ALL") return "ALL";
  const quarter =
    breakdown === "quarters"
      ? Number(period.replace(/\D/g, ""))
      : Math.floor((Number(period) - 1) / 3) + 1;
  if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) return null;
  return seasons.find((key) => key.endsWith(`-Q${quarter}`)) ?? null;
}

/** The first night that scored, for "scored nights start on…" notes. */
export function firstScoredDate(
  cashNights: PointsCashNight[],
  tournaments: TournamentEvent[],
  rules: PointsRules = POINTS_RULES,
): string | null {
  const dates = scoreNights(cashNights, tournaments, rules).map((entry) => entry.night.date).sort();
  return dates[0] ?? null;
}
