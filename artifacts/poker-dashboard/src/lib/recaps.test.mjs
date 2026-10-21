import assert from "node:assert/strict";
import test from "node:test";

import { buildCashRecap, buildTournamentRecap, describeDate, RECAP_FORMATS } from "./recaps.ts";
import { buildPointsLeaderboard, pointsAfterNight } from "./points.ts";

const p = (player, buyIn, cashOut) => ({ player, buyIn, cashOut, net: cashOut - buyIn });

test("dates read naturally and ignore the time zone", () => {
  assert.deepEqual(describeDate("2026-10-10"), { long: "Saturday 10 Oct", full: "10 Oct 2026" });
  assert.deepEqual(describeDate("2026-10-11"), { long: "Sunday 11 Oct", full: "11 Oct 2026" });
  assert.equal(describeDate("nonsense").full, "nonsense");
});

test("all three Instagram formats exist with sensible safe areas", () => {
  assert.deepEqual(Object.keys(RECAP_FORMATS).sort(), ["feed", "square", "story"]);
  assert.equal(RECAP_FORMATS.story.height, 1920);
  assert.ok(RECAP_FORMATS.story.safeTop > RECAP_FORMATS.feed.safeTop);
});

test("a cash night recap has a cover, results, highlights and a caption", () => {
  const pack = buildCashRecap({
    date: "2026-10-10",
    sessionNumber: 8,
    totalBuyIn: 300,
    players: [p("Ranuka", 20, 55.75), p("Abhay", 20, 44.5), p("Ben", 40, 5), p("Bad Beat Jackpot", 7.25, 0)],
  });
  assert.deepEqual(pack.slides.map((s) => s.kind), ["cover", "ranking", "tiles"]);
  const [cover, ranking, tiles] = pack.slides;
  assert.equal(cover.headline, "Ranuka took the night");
  assert.equal(cover.value, "+$35.75");
  assert.deepEqual(cover.chips, ["3 players", "$300 in the pot"]);
  assert.equal(ranking.rows.length, 3);
  assert.ok(!ranking.rows.some((r) => /jackpot/i.test(r.name)));
  assert.equal(ranking.rows[2].value, "−$35.00");
  assert.equal(tiles.tiles.find((t) => t.label === "Roughest night").value, "Ben");
  assert.equal(tiles.tiles.find((t) => t.label === "Finished in profit").value, "2 of 3");
  assert.match(pack.caption, /Saturday 10 Oct/);
  assert.match(pack.caption, /Ranuka took the night, \+\$35\.75/);
  assert.match(pack.caption, /#riversidepoker/);
  assert.equal(pack.id, "cash-8");
});

test("a night nobody won says so", () => {
  const pack = buildCashRecap({ date: "2026-10-10", sessionNumber: 1, totalBuyIn: 40, players: [p("A", 10, 10), p("B", 10, 10), p("C", 10, 10), p("D", 10, 10)] });
  assert.equal(pack.slides[0].headline, "Everyone played it safe");
});

test("club points slide uses the table as it stood on that night", () => {
  const nights = [
    { sessionNumber: 1, date: "2026-10-02", players: [{ player: "Ana", net: 30 }, { player: "Ben", net: 10 }, { player: "Cy", net: -10 }, { player: "Di", net: -30 }] },
    { sessionNumber: 2, date: "2026-10-09", players: [{ player: "Ben", net: 40 }, { player: "Ana", net: 5 }, { player: "Cy", net: -15 }, { player: "Di", net: -30 }] },
    { sessionNumber: 3, date: "2026-10-16", players: [{ player: "Cy", net: 50 }, { player: "Ana", net: 0 }, { player: "Ben", net: -20 }, { player: "Di", net: -30 }] },
  ];
  const after = pointsAfterNight(nights, [], { date: "2026-10-09", sessionNumber: 2 });
  assert.equal(after.season, "2026-Q4");
  const full = buildPointsLeaderboard(nights.slice(0, 2), [], { season: "2026-Q4" });
  // The 16 Oct night must not leak into a recap of 9 Oct.
  assert.deepEqual(after.rows.map((r) => [r.name, r.points]), full.map((r) => [r.name, Math.round(r.points * 10) / 10]));
  assert.ok(after.earnedTonight[0].earned > 0);
  assert.equal(after.rows.find((r) => r.name === after.earnedTonight[0].name).earned, after.earnedTonight[0].earned);
  const pack = buildCashRecap({
    date: "2026-10-09", sessionNumber: 2, totalBuyIn: 100,
    players: nights[1].players.map((x) => ({ player: x.player, buyIn: 20, cashOut: 20 + x.net, net: x.net })),
    pointsAfter: after, seasonName: "Q4 2026",
  });
  const last = pack.slides[pack.slides.length - 1];
  assert.equal(last.kind, "ranking");
  assert.equal(last.title, "Q4 2026 standings");
  assert.match(last.rows[0].sub, /tonight/);
});

test("a tournament recap has a podium, results, highlights and a caption", () => {
  const pack = buildTournamentRecap({
    id: "20261011-1", date: "2026-10-11", title: "Riverside Poker Tournament", players: 12, entries: 16, rebuys: 4, topUps: 9,
    knockouts: 15, mainPrizePool: 210, bountyPool: 40, winner: "Ranuka", winnerPrize: 105, topBountyHunter: "Ranuka", mostKnockouts: 4,
    results: [
      { player: "Ranuka", finishPlace: 1, knockouts: 4, mainPrize: 105, bountiesWon: 12.5, netProfit: 97.5 },
      { player: "Vivan", finishPlace: 2, knockouts: 3, mainPrize: 70, bountiesWon: 7.5, netProfit: 57.5 },
      { player: "Jason", finishPlace: 3, knockouts: 2, mainPrize: 35, bountiesWon: 5, netProfit: 20 },
      { player: "Abhay", finishPlace: 4, knockouts: 1, mainPrize: 0, bountiesWon: 2.5, netProfit: -17.5 },
    ],
  });
  assert.deepEqual(pack.slides.map((s) => s.kind), ["cover", "podium", "ranking", "tiles"]);
  assert.equal(pack.slides[0].value, "$105.00");
  assert.deepEqual(pack.slides[1].places.map((x) => x.name), ["Ranuka", "Vivan", "Jason"]);
  assert.equal(pack.slides[1].note, "Plus $40 in bounties");
  assert.equal(pack.slides[2].rows[3].value, "−$17.50");
  assert.match(pack.caption, /Ranuka took it down, \$105\.00/);
  assert.match(pack.caption, /Top bounty hunter: Ranuka \(4\)/);
  assert.equal(pack.id, "tournament-20261011-1");
});

test("a tournament without recorded places still produces a recap", () => {
  const pack = buildTournamentRecap({
    id: "x", date: "2026-10-04", title: "T", players: 4, entries: 5, rebuys: 1, topUps: 0, knockouts: 3, mainPrizePool: 40, bountyPool: 0,
    winner: "Ana", winnerPrize: 20, topBountyHunter: null, mostKnockouts: 0,
    results: [
      { player: "Ana", finishPlace: 1, knockouts: 2, mainPrize: 20, bountiesWon: 0, netProfit: 10 },
      { player: "Ben", finishPlace: null, knockouts: 1, mainPrize: 0, bountiesWon: 0, netProfit: -5 },
      { player: "Cy", finishPlace: null, knockouts: 0, mainPrize: 0, bountiesWon: 0, netProfit: -10 },
    ],
  });
  assert.deepEqual(pack.slides.map((s) => s.kind), ["cover", "ranking", "tiles"]);
  assert.deepEqual(pack.slides[1].rows.map((r) => r.name), ["Ana", "Ben", "Cy"]);
});

import { buildPersonalRecap, buildStandingsRecap } from "./recaps.ts";

test("any ranked table becomes a one-slide recap with a caption", () => {
  const pack = buildStandingsRecap({
    id: "points-2026-Q4", eyebrow: "Club points", title: "Q4 2026 standings", subtitle: "After 8 nights", dateLabel: "Q4 2026",
    rows: [{ name: "Ranuka", value: "317 pts" }, { name: "Hayley", value: "204 pts", sub: "+37 tonight" }, { name: "Abhay", value: "189 pts" }],
  });
  assert.equal(pack.slides.length, 1);
  assert.equal(pack.slides[0].kind, "ranking");
  assert.deepEqual(pack.slides[0].rows.map((r) => r.place), [1, 2, 3]);
  assert.match(pack.caption, /🥇 Ranuka 317 pts/);
  assert.equal(pack.id, "points-2026-Q4");
});

test("a personal recap leads with the result and finish in the member's words", () => {
  const pack = buildPersonalRecap({
    id: "me-1", name: "Abhay", date: "2026-10-11", net: -17.5, buyIn: 20, cashOut: 2.5, kind: "tournament", finishText: "4th of 12",
    tiles: [
      { label: "Leaderboard move", value: "Held your place", detail: "Now 3rd of 59" },
      { label: "Form", value: "No streak" },
      { label: "Best game", value: "+$148.75", tone: "good" },
    ],
  });
  assert.deepEqual(pack.slides.map((s) => s.kind), ["cover", "tiles"]);
  assert.equal(pack.slides[0].eyebrow, "Tournament night");
  assert.equal(pack.slides[0].value, "−$17.50");
  assert.equal(pack.slides[0].positive, false);
  assert.match(pack.slides[0].headline, /Sunday 11 Oct · 4th of 12/);
  assert.match(pack.caption, /Abhay: −\$17\.50 \(4th of 12\)/);
});
