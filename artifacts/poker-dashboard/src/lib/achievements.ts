// Badges, form dots, the season award and the "club buzz" lines, all worked out from the
// game results the site already has. No React in here so it can be unit tested.

import type { Career } from "./career.ts";
import {
  buildPlayerTotals,
  isRealPlayer,
  normalizeName,
  sortSessions,
  type ChartSession,
} from "./club-charts.ts";

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/** One player's net for every game they sat in, oldest first. Names are matched loosely. */
function perPlayerResults(sessions: ChartSession[]) {
  const ordered = sortSessions(sessions);
  const results = new Map<string, Array<{ session: ChartSession; net: number }>>();
  const display = new Map<string, string>();
  for (const session of ordered) {
    const nets = new Map<string, number>();
    for (const record of session.players) {
      if (!isRealPlayer(record.player)) continue;
      const key = normalizeName(record.player);
      display.set(key, display.get(key) ?? record.player.trim());
      nets.set(key, round2((nets.get(key) ?? 0) + record.net));
    }
    for (const [key, net] of nets) {
      const list = results.get(key) ?? [];
      list.push({ session, net });
      results.set(key, list);
    }
  }
  return { ordered, results, display };
}

// ---------------------------------------------------------------- form dots

export type FormDot = { result: "win" | "loss" | "even"; net: number; date: string; sessionNumber: number };

/** The player's last few games, oldest first, for the little coloured dots. */
export function buildFormDots(sessions: ChartSession[], playerName: string, count = 5): FormDot[] {
  const { results } = perPlayerResults(sessions);
  const list = results.get(normalizeName(playerName)) ?? [];
  return list.slice(-count).map(({ session, net }) => ({
    result: net > 0 ? "win" : net < 0 ? "loss" : "even",
    net,
    date: session.date,
    sessionNumber: session.sessionNumber,
  }));
}

// ------------------------------------------------------------------- badges

export type BadgeId =
  | "heater"
  | "giant-killer"
  | "comeback"
  | "iron-player"
  | "big-night"
  | "first-win"
  | "veteran"
  | "perfect-month"
  | "tournament-win";

export type Badge = {
  id: BadgeId;
  label: string;
  /** One plain sentence saying why the player has it. */
  reason: string;
};

export const BADGE_META: Record<BadgeId, { label: string; blurb: string }> = {
  heater: { label: "On a heater", blurb: "Won three or more games in a row and still going." },
  "giant-killer": { label: "Giant killer", blurb: "Won one of the last three games while the all-time leader lost money." },
  comeback: { label: "Comeback", blurb: "The biggest turnaround from a losing game to a winning one." },
  "iron-player": { label: "Iron player", blurb: "Has sat in the most games." },
  "big-night": { label: "Big night", blurb: "Holds the biggest single-game win on record." },
  "first-win": { label: "First win", blurb: "Finish a game in profit." },
  veteran: { label: "Veteran", blurb: "Play ten games." },
  "perfect-month": { label: "Perfect month", blurb: "Win every game you play in a calendar month (at least two)." },
  "tournament-win": { label: "Tournament winner", blurb: "Finish a tournament with the biggest result." },
};

/** Shown in this order on the trophy shelf. */
export const BADGE_ORDER: BadgeId[] = [
  "first-win",
  "veteran",
  "perfect-month",
  "tournament-win",
  "heater",
  "comeback",
  "giant-killer",
  "iron-player",
  "big-night",
];

export const VETERAN_GAMES = 10;
const MIN_PERFECT_MONTH_GAMES = 2;

const MIN_HEATER = 3;
const MIN_IRON_GAMES = 3;
/** Giant killer only counts the latest few club games so it stays a recent, rare badge. */
const GIANT_KILLER_WINDOW = 3;

/** Badges keyed by normalised player name. Players with none are left out. */
export function buildBadges(sessions: ChartSession[], careers?: Map<string, Career>): Map<string, Badge[]> {
  const { ordered, results } = perPlayerResults(sessions);
  const badges = new Map<string, Badge[]>();
  const give = (key: string, badge: Badge) => {
    const list = badges.get(key) ?? [];
    list.push(badge);
    badges.set(key, list);
  };

  // On a heater: the current run of winning games.
  for (const [key, list] of results) {
    let run = 0;
    for (let i = list.length - 1; i >= 0 && list[i].net > 0; i--) run += 1;
    if (run >= MIN_HEATER) {
      give(key, { id: "heater", label: BADGE_META.heater.label, reason: `${run} wins in a row` });
    }
  }

  // Giant killer: won a game while the leader going in was at the table and finished behind.
  const killers = new Map<string, number>();
  const before: ChartSession[] = [];
  const recentFrom = Math.max(0, ordered.length - GIANT_KILLER_WINDOW);
  for (const [position, session] of ordered.entries()) {
    const totals = buildPlayerTotals(before);
    const leader = totals[0];
    if (leader && before.length >= 2 && position >= recentFrom) {
      const leaderKey = normalizeName(leader.name);
      const real = session.players.filter((record) => isRealPlayer(record.player));
      const leaderRecord = real.find((record) => normalizeName(record.player) === leaderKey);
      if (leaderRecord) {
        const best = real.reduce((top, record) => (record.net > top.net ? record : top), real[0]);
        const bestKey = normalizeName(best.player);
        if (best.net > 0 && bestKey !== leaderKey && leaderRecord.net < 0) {
          killers.set(bestKey, (killers.get(bestKey) ?? 0) + 1);
        }
      }
    }
    before.push(session);
  }
  for (const [key, count] of killers) {
    give(key, {
      id: "giant-killer",
      label: BADGE_META["giant-killer"].label,
      reason: count === 1 ? "Won a recent game while the leader lost" : `Won ${count} recent games while the leader lost`,
    });
  }

  // Comeback: the largest jump from a losing game straight to a winning one (one player holds it).
  let comeback: { key: string; swing: number } | null = null;
  for (const [key, list] of results) {
    for (let i = 1; i < list.length; i++) {
      if (list[i - 1].net < 0 && list[i].net > 0) {
        const swing = round2(list[i].net - list[i - 1].net);
        if (!comeback || swing > comeback.swing) comeback = { key, swing };
      }
    }
  }
  if (comeback) {
    give(comeback.key, {
      id: "comeback",
      label: BADGE_META.comeback.label,
      reason: `A ${money(comeback.swing)} swing in one game`,
    });
  }

  // Iron player: most games (ties share it).
  const mostGames = Math.max(0, ...[...results.values()].map((list) => list.length));
  if (mostGames >= MIN_IRON_GAMES) {
    for (const [key, list] of results) {
      if (list.length === mostGames) {
        give(key, { id: "iron-player", label: BADGE_META["iron-player"].label, reason: `${mostGames} games played` });
      }
    }
  }

  // Big night: the single biggest win on record.
  let big: { key: string; net: number } | null = null;
  for (const [key, list] of results) {
    for (const { net } of list) if (net > 0 && (!big || net > big.net)) big = { key, net };
  }
  if (big) {
    give(big.key, { id: "big-night", label: BADGE_META["big-night"].label, reason: `${money(big.net)} in one game` });
  }

  // Badges that, once earned, are kept: first win, ten games, a perfect month, a tournament win.
  for (const [key, list] of results) {
    const firstWin = list.find((entry) => entry.net > 0);
    if (firstWin) {
      give(key, { id: "first-win", label: BADGE_META["first-win"].label, reason: `In profit on ${prettyDate(firstWin.session.date)}` });
    }

    if (list.length >= VETERAN_GAMES) {
      give(key, { id: "veteran", label: BADGE_META.veteran.label, reason: `${list.length} games played` });
    }

    const byMonth = new Map<string, number[]>();
    for (const entry of list) {
      const month = entry.session.date.slice(0, 7);
      byMonth.set(month, [...(byMonth.get(month) ?? []), entry.net]);
    }
    const perfect = [...byMonth.entries()]
      .filter(([, nets]) => nets.length >= MIN_PERFECT_MONTH_GAMES && nets.every((net) => net > 0))
      .sort((a, b) => b[1].length - a[1].length || b[0].localeCompare(a[0]))[0];
    if (perfect) {
      give(key, {
        id: "perfect-month",
        label: BADGE_META["perfect-month"].label,
        reason: `Won all ${perfect[1].length} games in ${monthName(perfect[0])}`,
      });
    }
  }

  for (const session of ordered) {
    if (session.eventType !== "tournament") continue;
    const real = session.players.filter((record) => isRealPlayer(record.player));
    if (!real.length) continue;
    // The recorded winner is who finished first, which is not always who made the most
    // profit once bounties are counted. Fall back to the biggest result when it is missing.
    const recorded = session.winner ? real.find((record) => normalizeName(record.player) === normalizeName(session.winner!)) : undefined;
    const winners = recorded
      ? [recorded]
      : (() => {
          const top = Math.max(...real.map((record) => record.net));
          return top > 0 ? real.filter((record) => record.net === top) : [];
        })();
    for (const record of winners) {
      give(normalizeName(record.player), {
        id: "tournament-win",
        label: BADGE_META["tournament-win"].label,
        reason: `Won the tournament on ${prettyDate(session.date)}`,
      });
    }
  }

  if (careers && careers.size) applyCareerBadges(badges, careers);
  return badges;
}

const CAREER_BADGES: BadgeId[] = ["first-win", "veteran", "heater", "comeback", "iron-player", "big-night"];

/**
 * The session log only has dated nights since the season started, so badges that depend on a
 * member's whole record are worked out from their career totals and game-by-game history.
 */
function applyCareerBadges(badges: Map<string, Badge[]>, careers: Map<string, Career>) {
  for (const [key, list] of badges) {
    const kept = list.filter((badge) => !CAREER_BADGES.includes(badge.id));
    if (kept.length) badges.set(key, kept);
    else badges.delete(key);
  }
  const give = (key: string, badge: Badge) => badges.set(key, [...(badges.get(key) ?? []), badge]);

  let comeback: { key: string; swing: number } | null = null;
  let mostGames = 0;
  let bestWin: { key: string; net: number } | null = null;
  for (const [key, career] of careers) {
    if (career.bestGame > 0) {
      give(key, { id: "first-win", label: BADGE_META["first-win"].label, reason: "Has finished a game in profit" });
      if (!bestWin || career.bestGame > bestWin.net) bestWin = { key, net: career.bestGame };
    }
    if (career.games >= VETERAN_GAMES) {
      give(key, { id: "veteran", label: BADGE_META.veteran.label, reason: `${career.games} games played` });
    }
    if (career.currentStreak >= MIN_HEATER) {
      give(key, { id: "heater", label: BADGE_META.heater.label, reason: `${career.currentStreak} wins in a row` });
    }
    for (let i = 1; i < career.results.length; i++) {
      if (career.results[i - 1] < 0 && career.results[i] > 0) {
        const swing = round2(career.results[i] - career.results[i - 1]);
        if (!comeback || swing > comeback.swing) comeback = { key, swing };
      }
    }
    mostGames = Math.max(mostGames, career.games);
  }
  if (comeback) {
    give(comeback.key, { id: "comeback", label: BADGE_META.comeback.label, reason: `A ${money(comeback.swing)} swing in one game` });
  }
  if (mostGames >= MIN_IRON_GAMES) {
    for (const [key, career] of careers) {
      if (career.games === mostGames) {
        give(key, { id: "iron-player", label: BADGE_META["iron-player"].label, reason: `${mostGames} games played` });
      }
    }
  }
  if (bestWin) {
    give(bestWin.key, { id: "big-night", label: BADGE_META["big-night"].label, reason: `${money(bestWin.net)} in one game` });
  }
}

/** "2026-10-02" -> "2 Oct 2026"; anything unparseable is returned as is. */
function prettyDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  return `${Number(match[3])} ${MONTHS[Number(match[2]) - 1].slice(0, 3)} ${match[1]}`;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function monthName(yearMonth: string) {
  const [year, month] = yearMonth.split("-");
  return `${MONTHS[Number(month) - 1] ?? month} ${year}`;
}

function money(value: number) {
  return `$${Math.abs(value).toFixed(value % 1 === 0 ? 0 : 2)}`;
}

export function badgesFor(map: Map<string, Badge[]>, playerName: string): Badge[] {
  return map.get(normalizeName(playerName)) ?? [];
}

// ------------------------------------------------------------ season award

export type SeasonStanding = { name: string; net: number; games: number; wins: number };

export type Season = {
  /** e.g. "Q4 2026" */
  label: string;
  /** Calendar quarter, e.g. "2026-Q4" */
  key: string;
  from: string;
  to: string;
  games: number;
  standings: SeasonStanding[];
  /** The leader. Null when nobody has played in the quarter. */
  leader: SeasonStanding | null;
  mostWins: SeasonStanding | null;
  mostGames: SeasonStanding | null;
  /** Gap to second place, for "leads by $x" lines. */
  lead: number | null;
  /** True once the quarter has ended (the latest game is in a later quarter). */
  closed: boolean;
};

export function quarterKey(date: string) {
  const year = date.slice(0, 4);
  const month = Number(date.slice(5, 7));
  return `${year}-Q${Math.floor((month - 1) / 3) + 1}`;
}

const quarterLabel = (key: string) => `${key.slice(5)} ${key.slice(0, 4)}`;

/**
 * The season is the calendar quarter of the latest game, so "Player of the Season" always
 * has someone to show. `quarter` picks a different one.
 */
export function buildSeason(sessions: ChartSession[], quarter?: string): Season | null {
  const ordered = sortSessions(sessions);
  if (!ordered.length) return null;
  const key = quarter ?? quarterKey(ordered[ordered.length - 1].date);
  const inQuarter = ordered.filter((session) => quarterKey(session.date) === key);
  if (!inQuarter.length) return null;

  const wins = new Map<string, number>();
  for (const session of inQuarter) {
    const real = session.players.filter((record) => isRealPlayer(record.player));
    if (!real.length) continue;
    const top = Math.max(...real.map((record) => record.net));
    if (top <= 0) continue;
    for (const record of real) {
      if (record.net === top) {
        const k = normalizeName(record.player);
        wins.set(k, (wins.get(k) ?? 0) + 1);
      }
    }
  }

  const standings = buildPlayerTotals(inQuarter).map((row) => ({
    name: row.name,
    net: row.net,
    games: row.games,
    wins: wins.get(normalizeName(row.name)) ?? 0,
  }));
  const best = (pick: (row: SeasonStanding) => number) => {
    const top = Math.max(...standings.map(pick));
    if (top <= 0) return null;
    return standings.find((row) => pick(row) === top) ?? null;
  };
  const latestKey = quarterKey(ordered[ordered.length - 1].date);
  return {
    label: quarterLabel(key),
    key,
    from: inQuarter[0].date,
    to: inQuarter[inQuarter.length - 1].date,
    games: inQuarter.length,
    standings,
    leader: standings[0] ?? null,
    mostWins: best((row) => row.wins),
    mostGames: best((row) => row.games),
    lead: standings.length > 1 ? round2(standings[0].net - standings[1].net) : null,
    closed: key < latestKey,
  };
}

// ------------------------------------------------------------- club buzz

export type BuzzItem = { id: string; text: string; tone: "up" | "info" };

/** A handful of plain one-liners about what changed lately. Newest news first. */
export function buildBuzz(sessions: ChartSession[], limit = 4): BuzzItem[] {
  const ordered = sortSessions(sessions);
  if (!ordered.length) return [];
  const items: BuzzItem[] = [];
  const latest = ordered[ordered.length - 1];
  const { results, display } = perPlayerResults(ordered);

  // Who took the latest game.
  const real = latest.players.filter((record) => isRealPlayer(record.player));
  if (real.length) {
    const top = real.reduce((best, record) => (record.net > best.net ? record : best), real[0]);
    if (top.net > 0) {
      items.push({
        id: "latest-winner",
        tone: "up",
        text: `${top.player.trim()} won the latest game, ${money(top.net)} up on the night.`,
      });
    }
  }

  // Rank changes over the latest game.
  if (ordered.length > 1) {
    const now = buildPlayerTotals(ordered);
    const prev = buildPlayerTotals(ordered.slice(0, -1));
    const prevRank = new Map(prev.map((row, index) => [normalizeName(row.name), index]));
    const moves = now
      .map((row, index) => {
        const was = prevRank.get(normalizeName(row.name));
        return was === undefined ? null : { name: row.name, from: was, to: index, delta: was - index };
      })
      .filter((row): row is { name: string; from: number; to: number; delta: number } => Boolean(row) && row!.delta > 0)
      .sort((a, b) => b.delta - a.delta || a.to - b.to);
    const climber = moves[0];
    if (climber) {
      const passed = prev[climber.to]?.name;
      items.push({
        id: "climber",
        tone: "up",
        text:
          climber.to === 0
            ? `${climber.name} took the lead on the leaderboard.`
            : `${climber.name} climbed ${climber.delta} ${climber.delta === 1 ? "place" : "places"} to ${ordinalLabel(climber.to + 1)}${passed ? `, past ${passed}` : ""}.`,
      });
    }
  }

  // Hot hands only: the buzz celebrates people, it never calls anyone out for losing.
  const streaks: Array<{ key: string; run: number }> = [];
  for (const [key, list] of results) {
    let run = 0;
    for (let i = list.length - 1; i >= 0 && list[i].net > 0; i--) run += 1;
    if (run >= 3) streaks.push({ key, run });
  }
  streaks.sort((a, b) => b.run - a.run);
  for (const streak of streaks.slice(0, 2)) {
    const who = display.get(streak.key) ?? streak.key;
    items.push({ id: `hot-${streak.key}`, tone: "up", text: `${who} has won ${streak.run} games in a row.` });
  }

  // Biggest pot of the record.
  const biggest = ordered.reduce((best, session) => (session.totalBuyIn > best.totalBuyIn ? session : best), ordered[0]);
  if (biggest.totalBuyIn > 0) {
    items.push({
      id: "biggest-pot",
      tone: "info",
      text: biggest === latest
        ? `The latest game was the biggest pot on record: ${money(biggest.totalBuyIn)}.`
        : `Biggest pot on record: ${money(biggest.totalBuyIn)}.`,
    });
  }
  return items.slice(0, limit);
}

function ordinalLabel(n: number) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10 > 3 ? 0 : n % 10] ?? "th"}`;
}

// ---------------------------------------------------------------- rivalry

export type Rivalry = {
  name: string;
  sharedGames: number;
  wins: number;
  losses: number;
  /** Net difference over shared games: positive means the viewer is ahead. */
  netDifference: number;
};

/**
 * The player the viewer has shared the most close games with, measured by how
 * evenly they split results. Needs at least three shared games.
 */
export function buildRivalry(sessions: ChartSession[], viewerName: string): Rivalry | null {
  const key = normalizeName(viewerName);
  const { results, display } = perPlayerResults(sessions);
  const mine = results.get(key);
  if (!mine) return null;
  const mineBySession = new Map(mine.map((entry) => [entry.session, entry.net]));
  let best: (Rivalry & { score: number }) | null = null;
  for (const [otherKey, list] of results) {
    if (otherKey === key) continue;
    let shared = 0;
    let wins = 0;
    let losses = 0;
    let diff = 0;
    for (const { session, net } of list) {
      const myNet = mineBySession.get(session);
      if (myNet === undefined) continue;
      shared += 1;
      if (myNet > net) wins += 1;
      else if (myNet < net) losses += 1;
      diff += myNet - net;
    }
    if (shared < 3) continue;
    // Prefer many shared games and an even split.
    const score = shared - Math.abs(wins - losses) * 1.5;
    if (!best || score > best.score) {
      best = { name: display.get(otherKey) ?? otherKey, sharedGames: shared, wins, losses, netDifference: round2(diff), score };
    }
  }
  if (!best) return null;
  const { score: _score, ...rivalry } = best;
  return rivalry;
}

// ------------------------------------------------------------ season recap

export type SeasonRecap = {
  season: Season;
  totalPot: number;
  players: number;
  bestNight: { name: string; net: number; date: string } | null;
  viewer: {
    name: string;
    rank: number;
    of: number;
    net: number;
    games: number;
    wins: number;
    bestGame: number;
    /** Positive = winning games in a row at the end of the season so far, negative = losing. */
    streak: number;
    /** Rank within the season after each game the club played (null before first appearance). */
    rankJourney: Array<number | null>;
  } | null;
};

/** Everything the "season recap" slides need, for one member. */
export function buildSeasonRecap(sessions: ChartSession[], viewerName: string, quarter?: string): SeasonRecap | null {
  const season = buildSeason(sessions, quarter);
  if (!season) return null;
  const inQuarter = sortSessions(sessions).filter((session) => quarterKey(session.date) === season.key);

  let bestNight: SeasonRecap["bestNight"] = null;
  for (const session of inQuarter) {
    for (const record of session.players) {
      if (!isRealPlayer(record.player)) continue;
      if (record.net > 0 && (!bestNight || record.net > bestNight.net)) {
        bestNight = { name: record.player.trim(), net: record.net, date: session.date };
      }
    }
  }

  const key = normalizeName(viewerName);
  const row = season.standings.find((standing) => normalizeName(standing.name) === key);
  let viewer: SeasonRecap["viewer"] = null;
  if (row) {
    const { results } = perPlayerResults(inQuarter);
    const mine = results.get(key) ?? [];
    const nets = mine.map((entry) => entry.net);
    const lastSign = Math.sign(nets[nets.length - 1] ?? 0);
    let streak = 0;
    if (lastSign !== 0) for (let i = nets.length - 1; i >= 0 && Math.sign(nets[i]) === lastSign; i--) streak += lastSign;

    const rankJourney: Array<number | null> = [];
    for (let i = 1; i <= inQuarter.length; i++) {
      const totals = buildPlayerTotals(inQuarter.slice(0, i));
      const index = totals.findIndex((total) => normalizeName(total.name) === key);
      rankJourney.push(index >= 0 ? index + 1 : null);
    }
    viewer = {
      name: row.name,
      rank: season.standings.indexOf(row) + 1,
      of: season.standings.length,
      net: row.net,
      games: row.games,
      wins: row.wins,
      bestGame: nets.length ? Math.max(...nets) : 0,
      streak,
      rankJourney,
    };
  }

  return {
    season,
    totalPot: round2(inQuarter.reduce((sum, session) => sum + session.totalBuyIn, 0)),
    players: season.standings.length,
    bestNight,
    viewer,
  };
}

// ------------------------------------------------------------ trophy shelf

export type Trophy = {
  id: BadgeId;
  label: string;
  /** How to earn it. */
  blurb: string;
  earned: boolean;
  /** Why the player has it, when earned. */
  reason: string | null;
  /** Progress toward a count-based badge, when locked. */
  progress: { current: number; target: number } | null;
};

/** Every badge, earned or locked, in a fixed order, for one player's profile. */
export function buildTrophyShelf(
  sessions: ChartSession[],
  playerName: string,
  badgeMap?: Map<string, Badge[]>,
  careerGames?: number,
): Trophy[] {
  const map = badgeMap ?? buildBadges(sessions);
  const earned = new Map(badgesFor(map, playerName).map((badge) => [badge.id, badge]));
  const games = careerGames ?? perPlayerResults(sessions).results.get(normalizeName(playerName))?.length ?? 0;
  return BADGE_ORDER.map((id) => {
    const badge = earned.get(id);
    return {
      id,
      label: BADGE_META[id].label,
      blurb: BADGE_META[id].blurb,
      earned: Boolean(badge),
      reason: badge?.reason ?? null,
      progress: !badge && id === "veteran" ? { current: Math.min(games, VETERAN_GAMES), target: VETERAN_GAMES } : null,
    };
  });
}

/**
 * Badge ids earned now that are not in `seen`. Standing badges can move between players, so
 * the caller stores everything it has shown and only announces what is new.
 */
export function newlyEarned(current: Badge[], seen: readonly string[]): Badge[] {
  const known = new Set(seen);
  return current.filter((badge) => !known.has(badge.id));
}

// ---------------------------------------------------------- account stats

export type AccountStats = {
  playerName: string;
  games: number;
  gamesInProfit: number;
  net: number;
  bestGame: number;
  worstGame: number;
  /** Date of the first recorded game, or null with no games. */
  firstDate: string | null;
  longestWinStreak: number;
  /** The last five games, newest first. */
  recent: Array<{ date: string; net: number; sessionNumber: number; isTournament: boolean }>;
};

/** Personal totals for the account page. Null when the member has no recorded games. */
export function buildAccountStats(sessions: ChartSession[], playerName: string): AccountStats | null {
  const { results, display } = perPlayerResults(sessions);
  const key = normalizeName(playerName);
  const list = results.get(key);
  if (!list?.length) return null;

  let longest = 0;
  let run = 0;
  for (const entry of list) {
    run = entry.net > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  const nets = list.map((entry) => entry.net);
  return {
    playerName: display.get(key) ?? playerName,
    games: list.length,
    gamesInProfit: nets.filter((net) => net > 0).length,
    net: round2(nets.reduce((sum, net) => sum + net, 0)),
    bestGame: Math.max(...nets),
    worstGame: Math.min(...nets),
    firstDate: list[0].session.date,
    longestWinStreak: longest,
    recent: list
      .slice(-5)
      .reverse()
      .map((entry) => ({
        date: entry.session.date,
        net: entry.net,
        sessionNumber: entry.session.sessionNumber,
        isTournament: entry.session.eventType === "tournament",
      })),
  };
}
