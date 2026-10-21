import assert from "node:assert/strict";
import test from "node:test";

import {
  POINTS_RULES,
  buildPointsLeaderboard,
  nightPointsFor,
  pointsExamples,
  pointsSeasons,
  quarterOf,
  scorePlacement,
  sizeFactor,
} from "./points.ts";

const night = (sessionNumber, date, nets) => ({
  sessionNumber,
  date,
  players: Object.entries(nets).map(([player, net]) => ({ player, net })),
});
const tResult = (player, finishPlace, netProfit, knockouts = 0) => ({
  player, entries: 1, rebuys: 0, topUp: false, freeEntry: false, finishPlace, knockouts, eliminatedBy: null,
  invested: 10, bountiesWon: 0, mainPrize: 0, totalReturn: 10 + netProfit, netProfit, inTheMoney: netProfit > 0,
});
const tEvent = (id, date, results) => ({ id, date, title: "T", results });

test("the size factor grows with the table and is capped", () => {
  assert.equal(sizeFactor(12), 1);
  assert.ok(sizeFactor(18) > 1.2 && sizeFactor(18) < 1.25);
  assert.equal(sizeFactor(2), POINTS_RULES.size.min);
  assert.equal(sizeFactor(40), POINTS_RULES.size.max);
});

test("worked examples match the rules", () => {
  const win15 = scorePlacement({ kind: "cash", players: 15, rank: 1, net: 50 });
  assert.equal(Math.round(win15.points * 10) / 10, 66.8);
  assert.equal(win15.parts.win, 30);
  const last = scorePlacement({ kind: "cash", players: 15, rank: 15, net: -40 });
  assert.equal(last.points, 6);
  const t = scorePlacement({ kind: "tournament", players: 12, rank: 1, net: 97.5, knockouts: 4 });
  assert.equal(Math.round(t.points * 10) / 10, 73);
  assert.equal(pointsExamples().length, 6);
});

test("a bigger night is worth more than a smaller one for the same finish", () => {
  const small = scorePlacement({ kind: "cash", players: 8, rank: 1, net: 20 }).points;
  const large = scorePlacement({ kind: "cash", players: 18, rank: 1, net: 20 }).points;
  assert.ok(large > small + 15);
});

test("winning needs a profit and a real table", () => {
  assert.equal(scorePlacement({ kind: "cash", players: 10, rank: 1, net: 0 }).parts.win, 0);
  assert.equal(scorePlacement({ kind: "cash", players: 3, rank: 1, net: 10 }).parts.win, 0);
  assert.equal(scorePlacement({ kind: "cash", players: 5, rank: 2, net: 10 }).parts.podium, 0);
});

test("the jackpot row and tiny nights are not scored", () => {
  const rows = buildPointsLeaderboard(
    [
      night(1, "2026-10-02", { Ana: 30, Ben: 10, Cy: -10, Di: -30 }),
      night(2, "2026-10-03", { "Bad Beat Jackpot": -7.25 }),
      night(3, "2026-10-04", { Ana: 5, Ben: -5 }),
    ],
    [],
  );
  assert.equal(rows.length, 4);
  assert.ok(!rows.some((row) => row.name === "Bad Beat Jackpot"));
  assert.equal(rows.find((row) => row.name === "Ana").nights, 1);
});

test("ties share a place and the same points", () => {
  const rows = buildPointsLeaderboard([night(1, "2026-10-02", { Ana: 20, Ben: 20, Cy: 0, Di: -40 })], []);
  const ana = rows.find((row) => row.name === "Ana");
  const ben = rows.find((row) => row.name === "Ben");
  assert.equal(ana.points, ben.points);
  assert.equal(ana.history[0].rank, 1);
  assert.equal(rows.find((row) => row.name === "Cy").history[0].rank, 3);
});

test("a steady regular outscores a two-night winner, and a win still outscores a night out", () => {
  const nights = [];
  for (let i = 1; i <= 6; i++) {
    // Star only plays the first two nights and wins both; Regular finishes third every night.
    nights.push(night(i, `2026-10-0${i}`, i <= 2
      ? { Star: 60, B: 20, Regular: 5, C: -10, D: -25, E: -30 }
      : { A: 40, B: 20, Regular: 5, C: -10, D: -25, E: -30 }));
  }
  const rows = buildPointsLeaderboard(nights, []);
  const star = rows.find((row) => row.name === "Star");
  const regular = rows.find((row) => row.name === "Regular");
  assert.equal(star.wins, 2);
  assert.equal(regular.nights, 6);
  assert.ok(regular.points > star.points, "six solid nights beat two wins");
  // But one win in a single night is worth far more than just turning up once.
  const oneNightWin = scorePlacement({ kind: "cash", players: 12, rank: 1, net: 60 }).points;
  const oneNightMid = scorePlacement({ kind: "cash", players: 12, rank: 6, net: -5 }).points;
  assert.ok(oneNightWin > 3 * oneNightMid);
  assert.equal(star.provisional, true);
  assert.equal(regular.provisional, false);
  assert.deepEqual(rows.map((row) => row.rank), rows.map((_, i) => i + 1));
});

test("tournaments use recorded places, then net profit for the rest, and count knockouts", () => {
  const event = tEvent("t1", "2026-10-04", [
    tResult("Ana", 1, 100, 3),
    tResult("Ben", 2, 40, 1),
    tResult("Cy", null, -10),
    tResult("Di", null, -30),
    tResult("Ed", null, -30),
  ]);
  const rows = buildPointsLeaderboard([], [event]);
  const byName = Object.fromEntries(rows.map((row) => [row.name, row.history[0]]));
  assert.equal(byName.Ana.rank, 1);
  assert.equal(byName.Cy.rank, 3);
  assert.equal(byName.Di.rank, 4);
  assert.equal(byName.Ed.rank, 4); // tied on result
  assert.equal(byName.Ana.parts.knockouts, 6);
  assert.equal(byName.Ana.kind, "tournament");
});

test("seasons filter by calendar quarter and are listed newest first", () => {
  const nights = [
    night(1, "2026-08-10", { A: 10, B: 0, C: -5, D: -5 }),
    night(2, "2026-10-10", { A: 10, B: 0, C: -5, D: -5 }),
  ];
  assert.equal(quarterOf("2026-10-10"), "2026-Q4");
  assert.deepEqual(pointsSeasons(nights, []), ["2026-Q4", "2026-Q3"]);
  assert.equal(buildPointsLeaderboard(nights, [], { season: "2026-Q4" })[0].nights, 1);
  assert.equal(buildPointsLeaderboard(nights, [], { season: "ALL" })[0].nights, 2);
});

test("a player's points for one night can be looked up", () => {
  const rows = buildPointsLeaderboard([night(7, "2026-10-10", { Ana: 30, Ben: 10, Cy: -10, Di: -30 })], []);
  const found = nightPointsFor(rows, " ANA ", { sessionNumber: 7 });
  assert.equal(found.rank, 1);
  assert.equal(nightPointsFor(rows, "Ana", { sessionNumber: 99 }), null);
});

test("a tournament night is found by date when only the date is known", () => {
  const event = tEvent("t9", "2026-10-11", [tResult("Ana", 1, 80, 2), tResult("Ben", 2, 10), tResult("Cy", 3, -10), tResult("Di", 4, -20)]);
  const rows = buildPointsLeaderboard([], [event]);
  assert.equal(nightPointsFor(rows, "Ana", { kind: "tournament", date: "2026-10-11" }).rank, 1);
  assert.equal(nightPointsFor(rows, "Ana", { kind: "tournament", date: "2026-10-12" }), null);
  assert.equal(nightPointsFor(rows, "Ana", { kind: "cash", sessionNumber: 3 }), null);
});

import { firstScoredDate, seasonForPeriod } from "./points.ts";

test("the leaderboard's period filter picks the matching points season", () => {
  const seasons = ["2026-Q4", "2026-Q3"];
  assert.equal(seasonForPeriod("ALL", "quarters", seasons), "ALL");
  assert.equal(seasonForPeriod("Q4", "quarters", seasons), "2026-Q4");
  assert.equal(seasonForPeriod("Q3", "quarters", seasons), "2026-Q3");
  assert.equal(seasonForPeriod("Q1", "quarters", seasons), null);
  assert.equal(seasonForPeriod("10", "months", seasons), "2026-Q4");
  assert.equal(seasonForPeriod("09", "months", seasons), "2026-Q3");
  assert.equal(seasonForPeriod("02", "months", seasons), null);
});

test("points can be limited to cash nights or to tournaments", () => {
  const cash = [{ sessionNumber: 1, date: "2026-10-02", players: [{ player: "Ana", net: 30 }, { player: "Ben", net: 10 }, { player: "Cy", net: -10 }, { player: "Di", net: -30 }] }];
  const events = [tEvent("t1", "2026-10-04", [tResult("Ana", 1, 80), tResult("Ben", 2, 10), tResult("Cy", 3, -20), tResult("Di", 4, -30)])];
  const both = buildPointsLeaderboard(cash, events);
  const onlyCash = buildPointsLeaderboard(cash, events, { kinds: ["cash"] });
  const onlyTournaments = buildPointsLeaderboard(cash, events, { kinds: ["tournament"] });
  assert.equal(both.find((r) => r.name === "Ana").nights, 2);
  assert.equal(onlyCash.find((r) => r.name === "Ana").nights, 1);
  assert.equal(onlyTournaments.find((r) => r.name === "Ana").tournaments, 1);
  assert.equal(firstScoredDate(cash, events), "2026-10-02");
  assert.equal(firstScoredDate([], []), null);
});
