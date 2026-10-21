import assert from "node:assert/strict";
import test from "node:test";

import { dataCheckPasses, hasFullOrder, knockoutLeaders, payoutRows, playerTournamentRecord, rulesSummary, tournamentLeaderboard, tournamentTotals } from "./tournaments.ts";

const row = (player, o = {}) => ({
  player, entries: 1, rebuys: 0, topUp: false, freeEntry: false, finishPlace: null, knockouts: 0, eliminatedBy: null,
  invested: 10, bountiesWon: 0, mainPrize: 0, totalReturn: 0, netProfit: -10, inTheMoney: false, ...o,
});
const event = (id, date, results, o = {}) => ({
  id, date, title: "Riverside Poker Tournament", status: "Completed", format: "", startTime: null, venue: null,
  buyIn: 10, topUp: 10, bounty: 2.5, bountyBasis: "Per entry", startingStack: 10000, topUpStack: 10000,
  shares: { first: 50, second: 33.3, third: 16.7 }, players: results.length, entries: results.length, rebuys: 0,
  topUps: 0, freeEntries: 0, knockouts: 5, totalCollected: 100, bountyPool: 10, mainPrizePool: 90, winner: "Ana",
  runnerUp: "Ben", thirdPlace: "Cy", winnerPrize: 45, topBountyHunter: "Ana", mostKnockouts: 3, notes: null,
  dataCheck: "✓ OK", results, ...o,
});

const first = event("a", "2026-10-04", [
  row("Ana", { finishPlace: 1, knockouts: 3, bountiesWon: 7.5, mainPrize: 45, totalReturn: 52.5, netProfit: 42.5, inTheMoney: true }),
  row("Ben", { finishPlace: 2, knockouts: 1, bountiesWon: 2.5, mainPrize: 30, totalReturn: 32.5, netProfit: 22.5, inTheMoney: true }),
  row("Cy", { finishPlace: 3, mainPrize: 15, totalReturn: 15, netProfit: 5, inTheMoney: true }),
  row("Di"),
]);
const second = event("b", "2026-10-11", [
  row("Ana", { finishPlace: 4, invested: 20, netProfit: -20 }),
  row("Ben", { finishPlace: 1, knockouts: 4, invested: 20, bountiesWon: 10, mainPrize: 60, totalReturn: 70, netProfit: 50, inTheMoney: true }),
], { winner: "Ben", runnerUp: null, thirdPlace: null });

test("rules read as one line", () => {
  assert.equal(rulesSummary(first), "$10 buy-in · $10 top-up · $2.50 bounty per entry · 10,000 starting chips");
  assert.equal(rulesSummary(event("x", "2026-01-01", [row("Z")], { topUp: 0, bounty: 0, startingStack: 0 })), "$10 buy-in");
});

test("payouts use the recorded places and the sheet's shares", () => {
  const rows = payoutRows(first);
  assert.deepEqual(rows.map((r) => [r.place, r.player, r.prize]), [[1, "Ana", 45], [2, "Ben", 30], [3, "Cy", 15]]);
  assert.equal(hasFullOrder(first), false);
  assert.equal(hasFullOrder(second), true);
});

test("knockout leaders are ranked and capped", () => {
  assert.deepEqual(knockoutLeaders(first).map((r) => [r.player, r.knockouts]), [["Ana", 3], ["Ben", 1]]);
  assert.equal(knockoutLeaders(first, 1).length, 1);
});

test("data check only complains when the sheet does", () => {
  assert.equal(dataCheckPasses(first), true);
  assert.equal(dataCheckPasses(event("c", "2026-01-01", [row("Z")], { dataCheck: "Prizes do not add up" })), false);
  assert.equal(dataCheckPasses(event("d", "2026-01-01", [row("Z")], { dataCheck: null })), true);
});

test("a player's record spans events and ignores missing finishes", () => {
  const ana = playerTournamentRecord([second, first], " ANA ");
  assert.equal(ana.played, 2);
  assert.equal(ana.wins, 1);
  assert.equal(ana.net, 22.5);
  assert.equal(ana.invested, 30);
  assert.equal(ana.bestFinish, 1);
  assert.equal(ana.averageFinish, 2.5);
  assert.equal(ana.history[0].id, "b");
  const di = playerTournamentRecord([first, second], "Di");
  assert.equal(di.bestFinish, null);
  assert.equal(di.averageFinish, null);
  assert.equal(playerTournamentRecord([first], "Nobody"), null);
});

test("the leaderboard is ordered by net profit", () => {
  const board = tournamentLeaderboard([first, second]);
  assert.deepEqual(board.map((r) => r.player), ["Ben", "Ana", "Cy", "Di"]);
  assert.equal(board[0].roi, 241.67);
});

test("totals add events up", () => {
  const totals = tournamentTotals([first, second]);
  assert.equal(totals.events, 2);
  assert.equal(totals.uniquePlayers, 4);
  assert.equal(totals.prizePool, 180);
  assert.equal(totals.knockouts, 10);
  assert.equal(totals.biggestField, 4);
});
