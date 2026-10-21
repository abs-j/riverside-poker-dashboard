import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCombinedLeaderboard,
  buildPlayerProfitHistory,
  buildTournamentLeaderboard,
  buildTournamentSession,
} from "./earnings-analytics.ts";

const cashPlayer = {
  rank: 1,
  name: "Avery Smith",
  isClubContributor: true,
  buyInTotal: 100,
  cashOutTotal: 140,
  profitTotal: 40,
  gamesPlayed: 4,
  profitPerSession: 10,
  positiveSessionPct: 50,
  netPct: 40,
  buyInPerGame: 25,
  maxWin: 35,
  maxLoss: -20,
};

const snapshot = {
  available: true,
  eventDate: "2026-10-04",
  totalPlayers: 2,
  totalInvested: 30,
  totalReturned: 40,
  totalNetProfit: 10,
  players: [
    { player: "  avery   smith ", buyIn: 20, returned: 40, netProfit: 20 },
    { player: "Tournament Only", buyIn: 10, returned: 0, netProfit: -10 },
  ],
};

test("tournament events keep the dated event and each player's net separate", () => {
  const session = buildTournamentSession(snapshot, [
    { sessionNumber: 42 },
  ]);

  assert.equal(session.eventType, "tournament");
  assert.equal(session.sessionNumber, 43);
  assert.equal(session.month, "10");
  assert.equal(session.totalBuyIn, 30);
  assert.equal(session.totalCashOut, 40);
  assert.equal(session.totalNet, 10);
  assert.deepEqual(session.players[0], {
    player: "  avery   smith ",
    buyIn: 20,
    cashOut: 40,
    net: 20,
    status: null,
  });
  assert.equal(buildTournamentSession({ ...snapshot, eventDate: null }, []), null);
});

test("tournament standings use Net Profit and include tournament-only players", () => {
  const standings = buildTournamentLeaderboard(snapshot);
  assert.deepEqual(
    standings.map(({ name, profitTotal, cashOutTotal, rank }) => ({
      name,
      profitTotal,
      cashOutTotal,
      rank,
    })),
    [
      { name: "  avery   smith ", profitTotal: 20, cashOutTotal: 40, rank: 1 },
      { name: "Tournament Only", profitTotal: -10, cashOutTotal: 0, rank: 2 },
    ],
  );
});

test("combined standings merge only exact normalized full names", () => {
  const combined = buildCombinedLeaderboard([cashPlayer], snapshot);

  assert.equal(combined.length, 1);
  assert.equal(combined[0].name, "Avery Smith");
  assert.equal(combined[0].profitTotal, 60);
  assert.equal(combined[0].buyInTotal, 120);
  assert.equal(combined[0].cashOutTotal, 180);
  assert.equal(combined[0].gamesPlayed, 5);
  assert.equal(combined[0].isClubContributor, true);

  const nearMatch = buildCombinedLeaderboard([cashPlayer], {
    ...snapshot,
    players: [{ player: "Avery Smith Jr", buyIn: 20, returned: 40, netProfit: 20 }],
  });
  assert.equal(nearMatch[0].profitTotal, 40);
});

test("dated profit history appends tournament net after cash sessions", () => {
  const tournament = buildTournamentSession(snapshot, [
    {
      sessionNumber: 42,
      eventType: "cash",
      date: "2026-10-03",
      month: "10",
      totalBuyIn: 20,
      totalCashOut: 20,
      totalNet: 0,
      playerCount: 1,
      winner: null,
      winnerProfit: 0,
      lowPlayer: null,
      lowProfit: 0,
      players: [
        { player: "Avery Smith", buyIn: 20, cashOut: 30, net: 10, status: null },
      ],
    },
  ]);

  assert.deepEqual(
    buildPlayerProfitHistory([
      {
        sessionNumber: 42,
        eventType: "cash",
        date: "2026-10-03",
        month: "10",
        totalBuyIn: 20,
        totalCashOut: 30,
        totalNet: 10,
        playerCount: 1,
        winner: "Avery Smith",
        winnerProfit: 10,
        lowPlayer: "Avery Smith",
        lowProfit: 10,
        players: [
          { player: "Avery Smith", buyIn: 20, cashOut: 30, net: 10, status: null },
        ],
      },
      tournament,
    ]).map(({ sessionNumber, cumulativeProfit }) => ({
      sessionNumber,
      cumulativeProfit,
    })),
    [
      { sessionNumber: 42, cumulativeProfit: 10 },
      { sessionNumber: 43, cumulativeProfit: 30 },
      { sessionNumber: 43, cumulativeProfit: -10 },
    ],
  );
});

import { buildCombinedLeaderboard as combine, buildTournamentLeaderboard as tLeaderboard, buildTournamentSessions } from "./earnings-analytics.ts";

const tResult = (player, invested, totalReturn, finishPlace = null) => ({
  player, entries: 1, rebuys: 0, topUp: false, freeEntry: false, finishPlace, knockouts: 0, eliminatedBy: null,
  invested, bountiesWon: 0, mainPrize: 0, totalReturn, netProfit: totalReturn - invested, inTheMoney: totalReturn > invested,
});
const tEvent = (id, date, winner, results) => ({
  id, date, title: "T", status: "Completed", format: "", startTime: null, venue: null, buyIn: 10, topUp: 0, bounty: 0,
  bountyBasis: null, startingStack: 0, topUpStack: 0, shares: { first: 50, second: 30, third: 20 }, players: results.length,
  entries: results.length, rebuys: 0, topUps: 0, freeEntries: 0, knockouts: 0, totalCollected: 0, bountyPool: 0,
  mainPrizePool: 0, winner, runnerUp: null, thirdPlace: null, winnerPrize: 0, topBountyHunter: null, mostKnockouts: 0,
  notes: null, dataCheck: "OK", results,
});

test("each tournament becomes its own session, numbered after the cash games", () => {
  const events = [
    tEvent("b", "2026-10-11", "Ben", [tResult("Ben", 20, 50), tResult("Ana", 20, 0)]),
    tEvent("a", "2026-10-04", "Ana", [tResult("Ana", 10, 40), tResult("Ben", 10, 0)]),
  ];
  const cash = [{ sessionNumber: 7 }];
  const sessions = buildTournamentSessions(events, undefined, cash);
  assert.deepEqual(sessions.map((s) => [s.tournamentId, s.sessionNumber, s.winner]), [["a", 8, "Ana"], ["b", 9, "Ben"]]);
  assert.equal(sessions[1].totalBuyIn, 40);
  assert.equal(sessions[0].eventType, "tournament");
});

test("with no tournament tabs the old single snapshot still produces one session", () => {
  const snapshot = { available: true, eventDate: "2026-10-04", totalPlayers: 2, totalInvested: 20, totalReturned: 20, totalNetProfit: 0,
    players: [{ player: "Ana", buyIn: 10, returned: 20, netProfit: 10 }, { player: "Ben", buyIn: 10, returned: 0, netProfit: -10 }] };
  const sessions = buildTournamentSessions([], snapshot, []);
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].winner, "Ana");
});

test("combined leaderboard counts every tournament a player entered", () => {
  const cash = [{ rank: 1, name: "Ana", isClubContributor: false, buyInTotal: 100, cashOutTotal: 120, profitTotal: 20, gamesPlayed: 4,
    profitPerSession: 5, positiveSessionPct: 50, netPct: 20, buyInPerGame: 25, maxWin: 30, maxLoss: -10 }];
  const snapshot = { available: true, eventDate: "2026-10-11", totalPlayers: 1, totalInvested: 40, totalReturned: 90, totalNetProfit: 0,
    players: [{ player: "Ana", buyIn: 40, returned: 90, netProfit: 50, tournaments: 2, profitableTournaments: 1, bestResult: 60, worstResult: -10 }] };
  const [ana] = combine(cash, snapshot);
  assert.equal(ana.gamesPlayed, 6);
  assert.equal(ana.profitTotal, 70);
  assert.equal(ana.positiveSessionPct, ((0.5 * 4 + 1) / 6) * 100);
  assert.equal(ana.maxWin, 60);
  assert.equal(ana.maxLoss, -10);
  const [only] = tLeaderboard(snapshot);
  assert.equal(only.gamesPlayed, 2);
  assert.equal(only.profitPerSession, 25);
});
