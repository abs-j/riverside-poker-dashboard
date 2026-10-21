// Pure helpers for showing tournaments: payouts, rules text, and a player's tournament record.
import type { TournamentEvent, TournamentResultRow } from "./earnings-analytics.ts";

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
export const nameKey = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase();

const money = (value: number) =>
  `$${value.toFixed(Number.isInteger(value) ? 0 : 2)}`;

/** One short line describing the rules this event was played under. */
export function rulesSummary(event: TournamentEvent): string {
  const parts = [`${money(event.buyIn)} buy-in`];
  if (event.topUp > 0) parts.push(`${money(event.topUp)} top-up`);
  if (event.bounty > 0) {
    parts.push(`${money(event.bounty)} bounty${event.bountyBasis ? ` ${event.bountyBasis.toLocaleLowerCase()}` : ""}`);
  }
  if (event.startingStack > 0) parts.push(`${event.startingStack.toLocaleString("en-AU")} starting chips`);
  return parts.join(" · ");
}

export type PayoutRow = { place: number; share: number; prize: number; player: string | null };

/** Who was paid what from the main prize pool, using the recorded places. */
export function payoutRows(event: TournamentEvent): PayoutRow[] {
  const byPlace = new Map<number, TournamentResultRow>();
  for (const result of event.results) {
    if (result.finishPlace !== null) byPlace.set(result.finishPlace, result);
  }
  const shares = [event.shares.first, event.shares.second, event.shares.third];
  return shares
    .map((share, index): PayoutRow => {
      const place = index + 1;
      const result = byPlace.get(place);
      return {
        place,
        share,
        prize: result ? result.mainPrize : round2((event.mainPrizePool * share) / 100),
        player: result?.player ?? [event.winner, event.runnerUp, event.thirdPlace][index] ?? null,
      };
    })
    .filter((row) => row.share > 0 || row.prize > 0);
}

/** True when every player has a recorded finishing position. */
export function hasFullOrder(event: TournamentEvent): boolean {
  return event.results.length > 0 && event.results.every((result) => result.finishPlace !== null);
}

export function knockoutLeaders(event: TournamentEvent, limit = 5): Array<{ player: string; knockouts: number; bounties: number }> {
  return event.results
    .filter((result) => result.knockouts > 0)
    .map((result) => ({ player: result.player, knockouts: result.knockouts, bounties: result.bountiesWon }))
    .sort((a, b) => b.knockouts - a.knockouts || b.bounties - a.bounties || a.player.localeCompare(b.player))
    .slice(0, limit);
}

/** The sheet marks a clean event "✓ OK"; anything else is shown to admins as a warning. */
export function dataCheckPasses(event: TournamentEvent): boolean {
  const check = (event.dataCheck ?? "").trim();
  return check === "" || /ok/i.test(check);
}

export type TournamentRecord = {
  player: string;
  played: number;
  entries: number;
  wins: number;
  top3: number;
  inTheMoney: number;
  knockouts: number;
  invested: number;
  returned: number;
  bounties: number;
  net: number;
  roi: number | null;
  bestFinish: number | null;
  /** Average of the finishes that were recorded; null when none were. */
  averageFinish: number | null;
  history: Array<{ id: string; date: string; title: string; fieldSize: number; result: TournamentResultRow }>;
};

/** A player's whole tournament record, newest event first in `history`. */
export function playerTournamentRecord(events: TournamentEvent[], playerName: string): TournamentRecord | null {
  const key = nameKey(playerName);
  const history: TournamentRecord["history"] = [];
  for (const event of events) {
    const result = event.results.find((row) => nameKey(row.player) === key);
    if (result) history.push({ id: event.id, date: event.date, title: event.title, fieldSize: event.players, result });
  }
  if (history.length === 0) return null;
  history.sort((a, b) => b.date.localeCompare(a.date));

  const finishes = history.map((h) => h.result.finishPlace).filter((p): p is number => p !== null);
  const invested = round2(history.reduce((sum, h) => sum + h.result.invested, 0));
  const returned = round2(history.reduce((sum, h) => sum + h.result.totalReturn, 0));
  return {
    player: history[0].result.player,
    played: history.length,
    entries: history.reduce((sum, h) => sum + h.result.entries, 0),
    wins: history.filter((h) => h.result.finishPlace === 1).length,
    top3: history.filter((h) => h.result.finishPlace !== null && h.result.finishPlace <= 3).length,
    inTheMoney: history.filter((h) => h.result.inTheMoney).length,
    knockouts: history.reduce((sum, h) => sum + h.result.knockouts, 0),
    invested,
    returned,
    bounties: round2(history.reduce((sum, h) => sum + h.result.bountiesWon, 0)),
    net: round2(returned - invested),
    roi: invested > 0 ? round2(((returned - invested) / invested) * 100) : null,
    bestFinish: finishes.length ? Math.min(...finishes) : null,
    averageFinish: finishes.length ? round2(finishes.reduce((a, b) => a + b, 0) / finishes.length) : null,
    history,
  };
}

/** Everyone's record, best net first. */
export function tournamentLeaderboard(events: TournamentEvent[]): TournamentRecord[] {
  const names = new Map<string, string>();
  for (const event of events) for (const result of event.results) names.set(nameKey(result.player), result.player);
  return [...names.values()]
    .map((name) => playerTournamentRecord(events, name))
    .filter((record): record is TournamentRecord => record !== null)
    .sort((a, b) => b.net - a.net || b.wins - a.wins || a.player.localeCompare(b.player));
}

export type TournamentTotals = {
  events: number;
  uniquePlayers: number;
  entries: number;
  prizePool: number;
  bountyPool: number;
  knockouts: number;
  biggestField: number;
};

export function tournamentTotals(events: TournamentEvent[]): TournamentTotals {
  const players = new Set<string>();
  for (const event of events) for (const result of event.results) players.add(nameKey(result.player));
  return {
    events: events.length,
    uniquePlayers: players.size,
    entries: events.reduce((sum, event) => sum + event.entries, 0),
    prizePool: round2(events.reduce((sum, event) => sum + event.mainPrizePool, 0)),
    bountyPool: round2(events.reduce((sum, event) => sum + event.bountyPool, 0)),
    knockouts: events.reduce((sum, event) => sum + event.knockouts, 0),
    biggestField: events.reduce((max, event) => Math.max(max, event.players), 0),
  };
}
