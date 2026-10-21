import assert from "node:assert/strict";
import test from "node:test";

import { buildCareers, careerFor, resultsFromHistory } from "./career.ts";

const history = [
  { sessionNumber: 2, player: "Ana", cumulativeProfit: 5 },
  { sessionNumber: 1, player: "Ana", cumulativeProfit: 10 },
  { sessionNumber: 3, player: "Ana", cumulativeProfit: 15 },
  { sessionNumber: 4, player: "Ana", cumulativeProfit: 25.5 },
  { sessionNumber: 5, player: "Ana", cumulativeProfit: 20 },
  { sessionNumber: 1, player: "Ben", cumulativeProfit: -4 },
];

test("results are the steps between running totals, in game order", () => {
  assert.deepEqual(resultsFromHistory(history, "ana"), [10, -5, 10, 10.5, -5.5]);
  assert.deepEqual(resultsFromHistory(history, "Nobody"), []);
});

test("careers carry leaderboard totals and streaks from the history", () => {
  const careers = buildCareers(
    [
      { name: "Ana", profitTotal: 120, gamesPlayed: 51, positiveSessionPct: 40, maxWin: 68, maxLoss: -50 },
      { name: "Ben", profitTotal: -4, gamesPlayed: 1, positiveSessionPct: 0, maxWin: 0, maxLoss: -4 },
    ],
    history,
  );
  const ana = careerFor(careers, " ANA ");
  assert.equal(ana.games, 51);
  assert.equal(ana.net, 120);
  assert.equal(ana.longestWinStreak, 2);
  assert.equal(ana.currentStreak, -1);
  assert.equal(careerFor(careers, "ben").currentStreak, -1);
  assert.equal(careerFor(careers, "nobody"), null);
});
