import assert from "node:assert/strict";
import test from "node:test";

import { buildShareCardModel, ordinal } from "./share-card.ts";

const base = {
  playerName: "Abhay",
  date: "10 Oct 2026",
  net: 24.5,
  buyIn: 20,
  cashOut: 44.5,
  tableRank: 4,
  tableSize: 15,
  isTournament: false,
  rank: 2,
  of: 64,
  movement: 12,
  streak: 0,
  bestGame: 148.75,
  allTimeNet: 269.51,
};

test("ordinals handle the teens and 1/2/3 endings", () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 111].map(ordinal), [
    "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "101st", "111th",
  ]);
});

test("a winning night reads as a win with the right figures", () => {
  const model = buildShareCardModel(base);
  assert.equal(model.positive, true);
  assert.equal(model.result, "+$24.50");
  assert.equal(model.eyebrow, "Game night");
  assert.match(model.detail, /Bought in \$20\.00 · cashed out \$44\.50 · 4th of 15 at the table/);
  assert.deepEqual(model.tiles[0], { label: "Leaderboard", value: "2nd of 64", note: "Up 12 places" });
  assert.equal(model.tiles[2].label, "All-time");
  assert.equal(model.tiles[2].value, "+$269.51");
});

test("a losing night and a losing streak are described plainly", () => {
  const model = buildShareCardModel({ ...base, net: -20, cashOut: 0, streak: -3, movement: -1, isTournament: true });
  assert.equal(model.positive, false);
  assert.equal(model.result, "−$20.00");
  assert.equal(model.eyebrow, "Tournament night");
  assert.deepEqual(model.tiles[1], { label: "Form", value: "3 losses", note: "in a row" });
  assert.equal(model.tiles[0].note, "Down 1 place");
});

test("missing all-time figure falls back to best game, unknown movement is neutral", () => {
  const model = buildShareCardModel({ ...base, allTimeNet: null, movement: null });
  assert.equal(model.tiles[2].label, "Best game");
  assert.equal(model.tiles[0].note, "Leaderboard");
});

import { buildNightCardModel, buildSeasonCardModel } from "./share-card.ts";

test("night card ranks the table and leaves the jackpot row out", () => {
  const model = buildNightCardModel({
    date: "10 Oct 2026",
    isTournament: false,
    totalBuyIn: 240,
    players: [
      { player: "Ana", net: -20 },
      { player: "Ben", net: 45 },
      { player: "Bad Beat Jackpot", net: 0 },
      { player: "Cy", net: 5 },
    ],
  });
  assert.equal(model.title, "10 Oct 2026");
  assert.deepEqual(model.rows.map((row) => row.name), ["Ben", "Cy", "Ana"]);
  assert.equal(model.rows[0].place, 1);
  assert.equal(model.subtitle, "Ben took the night");
  assert.deepEqual(model.stats.map((stat) => stat.label), ["Pot", "Players", "Best night"]);
  assert.equal(model.stats[1].value, "3");
  assert.equal(model.rows[2].positive, false);
});

test("season card shows the leader and the win leader", () => {
  const model = buildSeasonCardModel({
    label: "Q4 2026",
    games: 3,
    standings: [
      { name: "Ben", net: 45, games: 3, wins: 3 },
      { name: "Ana", net: -20, games: 3, wins: 0 },
    ],
    mostWins: { name: "Ben", wins: 3 },
  });
  assert.equal(model.title, "Q4 2026 standings");
  assert.equal(model.subtitle, "Ben leads the way");
  assert.equal(model.stats[2].value, "Ben · 3");
});

import { buildTournamentCardModel } from "./share-card.ts";

test("tournament card lists the top five with the pool and knockouts", () => {
  const model = buildTournamentCardModel({
    date: "11 Oct 2026",
    title: "Riverside Poker Tournament",
    players: 12,
    entries: 16,
    mainPrizePool: 210,
    knockouts: 15,
    winner: "Ranuka",
    results: Array.from({ length: 7 }, (_, i) => ({ player: `P${i + 1}`, netProfit: 100 - i * 30, totalReturn: 0, finishPlace: i + 1 })),
  });
  assert.equal(model.eyebrow, "Tournament night");
  assert.equal(model.subtitle, "Ranuka took it down");
  assert.equal(model.rows.length, 5);
  assert.equal(model.rows[0].value, "+$100.00");
  assert.equal(model.rows[4].positive, false);
  assert.deepEqual(model.stats.map((s) => s.label), ["Players", "Prize pool", "Knockouts"]);
  assert.equal(model.stats[0].value, "12 · 16 entries");
  assert.equal(model.stats[1].value, "$210.00");
});

import { buildPointsCardModel } from "./share-card.ts";

test("points card shows the top five in points with the win leader", () => {
  const model = buildPointsCardModel({
    label: "Q4 2026",
    nights: 9,
    rows: [
      { name: "Ranuka", points: 372.6, nights: 9, wins: 3 },
      { name: "Hayley", points: 216, nights: 7, wins: 1 },
      { name: "Abhay", points: 188.5, nights: 5, wins: 1 },
    ],
  });
  assert.equal(model.eyebrow, "Club points");
  assert.equal(model.title, "Q4 2026 standings");
  assert.equal(model.subtitle, "Ranuka leads on 373 points");
  assert.equal(model.rows[0].value, "373 pts");
  assert.equal(model.stats[2].value, "Ranuka · 3");
});
