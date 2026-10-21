import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCumulativeRuns,
  buildPlayerTotals,
  buildRegularOpponents,
  buildResultsByGame,
  niceTicks,
  trimLeaderboard,
} from "./club-charts.ts";

const record = (player, net, status = "done") => ({
  player,
  buyIn: 10,
  cashOut: 10 + net,
  net,
  status,
});

const session = (sessionNumber, date, players) => ({
  sessionNumber,
  date,
  totalBuyIn: players.length * 10,
  playerCount: players.length,
  winner: null,
  winnerProfit: 0,
  players,
});

const sessions = [
  // Deliberately out of order: the builders must sort by date.
  session(2, "2026-04-10", [record("Ana", -5), record("Ben", 5, null)]),
  session(1, "2026-03-13", [record("Ana", 20), record("Ben", -10), record("Cy", -10, null)]),
  session(3, "2026-05-01", [record("Ana", 10), record("Cy", -10), record("Bad Beat Jackpot", 0, null)]),
];

test("cumulative runs stay flat across games a player sat out", () => {
  const runs = buildCumulativeRuns(sessions, ["Ana", "Cy"]);
  assert.deepEqual(runs.games.map((game) => game.sessionNumber), [1, 2, 3]);
  assert.deepEqual(runs.series.get("Ana"), [20, 15, 25]);
  assert.deepEqual(runs.series.get("Cy"), [-10, -10, -20]);
  assert.deepEqual(runs.results.get("Cy"), [-10, null, -10]);
});

test("player names match regardless of case and spacing", () => {
  const runs = buildCumulativeRuns(
    [session(1, "2026-01-01", [record("  ana  ", 7)])],
    ["Ana"],
  );
  assert.deepEqual(runs.series.get("Ana"), [7]);
});

test("player totals exclude the jackpot row and sort by net", () => {
  const totals = buildPlayerTotals(sessions);
  assert.deepEqual(totals.map((row) => row.name), ["Ana", "Ben", "Cy"]);
  assert.equal(totals[0].net, 25);
  assert.equal(totals[0].games, 3);
  assert.ok(!totals.some((row) => row.name === "Bad Beat Jackpot"));
});

test("results by game are ordered by date", () => {
  const results = buildResultsByGame(sessions, "ana");
  assert.deepEqual(results.map((row) => row.net), [20, -5, 10]);
});

test("regular opponents count shared games and who finished ahead", () => {
  const opponents = buildRegularOpponents(sessions, "Ana");
  const ben = opponents.find((row) => row.name === "Ben");
  const cy = opponents.find((row) => row.name === "Cy");
  assert.deepEqual(opponents.map((row) => row.name), ["Ben", "Cy"]);
  assert.deepEqual([ben.sharedGames, ben.finishedAhead, ben.finishedBehind], [2, 1, 1]);
  assert.deepEqual([cy.sharedGames, cy.finishedAhead, cy.finishedBehind], [2, 2, 0]);
});

test("leaderboard shows everyone up to twenty, then top and bottom ten", () => {
  const rows = Array.from({ length: 25 }, (_, index) => index);
  assert.equal(trimLeaderboard(rows.slice(0, 20), false).rows.length, 20);
  const trimmed = trimLeaderboard(rows, false);
  assert.equal(trimmed.rows.length, 20);
  assert.equal(trimmed.hidden, 5);
  assert.equal(trimmed.gapAfter, 9);
  assert.equal(trimLeaderboard(rows, true).rows.length, 25);
});

test("axis ticks cover the data and include zero when it crosses", () => {
  const ticks = niceTicks(-37, 112, 5);
  assert.ok(ticks[0] <= -37);
  assert.ok(ticks[ticks.length - 1] >= 112);
  assert.ok(ticks.includes(0));
  assert.deepEqual(niceTicks(0, 0).length > 1, true);
});

import { buildMyNight } from "./club-charts.ts";

test("my night summarises the latest game, streak and standing", () => {
  const night = buildMyNight(sessions, "ana");
  assert.equal(night.playerName, "Ana");
  assert.equal(night.last.sessionNumber, 3);
  assert.equal(night.last.net, 10);
  assert.equal(night.last.tableRank, 1);
  assert.equal(night.last.playerCount, 2);
  assert.deepEqual(night.season, { net: 25, games: 3, positiveGames: 2 });
  assert.equal(night.streak, 1);
  assert.equal(night.bestGame, 20);
  assert.equal(night.standing.rank, 1);
  assert.equal(night.standing.of, 3);
});

test("my night reports rank movement over the latest club game", () => {
  // Before game 3: Ana 15, Ben -5, Cy -10 → Cy ranks last. After: Cy -20, still last.
  const cy = buildMyNight(sessions, "Cy");
  assert.equal(cy.standing.rank, 3);
  assert.equal(cy.standing.movement, 0);
  assert.equal(cy.streak, -2);
});

test("my night is null for someone with no games", () => {
  assert.equal(buildMyNight(sessions, "Nobody"), null);
});
