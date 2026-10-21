// What each Instagram recap slide says. Pure data (no canvas), so the wording and the numbers
// can be tested; `recap-render.ts` turns a slide into a picture.
import { ordinal } from "./share-card.ts";
import type { PointsAfterNight } from "./points.ts";
import { CLUB_HASHTAG, CLUB_NAME } from "./brand.ts";

export type RecapFormat = "feed" | "story" | "square";

export const RECAP_FORMATS: Record<RecapFormat, { width: number; height: number; label: string; hint: string; safeTop: number; safeBottom: number }> = {
  feed: { width: 1080, height: 1350, label: "Feed post", hint: "4:5, the best size for a feed post or carousel", safeTop: 70, safeBottom: 60 },
  story: { width: 1080, height: 1920, label: "Story", hint: "9:16, keeps clear of Instagram's top and bottom bars", safeTop: 230, safeBottom: 280 },
  square: { width: 1080, height: 1080, label: "Square", hint: "1:1, works anywhere", safeTop: 60, safeBottom: 56 },
};

export type RecapRow = {
  place: number;
  name: string;
  value: string;
  sub?: string;
  positive?: boolean;
};

export type RecapTile = {
  label: string;
  /** The big text: usually a name. */
  value: string;
  /** A figure under it. */
  detail?: string;
  tone?: "good" | "bad" | "neutral";
};

export type RecapSlide =
  | {
      kind: "cover";
      eyebrow: string;
      title: string;
      headline: string;
      value: string;
      positive: boolean;
      chips: string[];
    }
  | { kind: "ranking"; eyebrow: string; title: string; subtitle?: string; rows: RecapRow[] }
  | { kind: "tiles"; eyebrow: string; title: string; tiles: RecapTile[] }
  | {
      kind: "podium";
      eyebrow: string;
      title: string;
      places: Array<{ place: 1 | 2 | 3; name: string; value: string; sub?: string }>;
      note?: string;
    };

export type RecapPack = {
  id: string;
  /** e.g. "Game night · 10 Oct 2026" */
  title: string;
  dateLabel: string;
  slides: RecapSlide[];
  /** A caption ready to paste next to the images. */
  caption: string;
};

const money = (value: number) => `$${Math.abs(value).toFixed(Number.isInteger(Math.abs(value)) ? 0 : 2)}`;
const exact = (value: number) => `$${Math.abs(value).toFixed(2)}`;
const signed = (value: number) => `${value >= 0 ? "+" : "−"}${exact(value)}`;
const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "2026-10-10" -> { long: "Saturday 10 Oct", full: "10 Oct 2026" } without timezone surprises. */
export function describeDate(iso: string): { long: string; full: string } {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return { long: iso, full: iso };
  const [, year, month, day] = match;
  const weekday = DAYS[new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).getUTCDay()];
  const short = `${Number(day)} ${MONTHS[Number(month) - 1]}`;
  return { long: `${weekday} ${short}`, full: `${short} ${year}` };
}

const isJackpot = (name: string) => name.trim().toLocaleLowerCase() === "bad beat jackpot";

function pointsSlide(after: PointsAfterNight | null, seasonName: string): RecapSlide | null {
  if (!after || after.rows.length < 3) return null;
  return {
    kind: "ranking",
    eyebrow: "Club points",
    title: `${seasonName} standings`,
    subtitle: "After this night",
    rows: after.rows.slice(0, 8).map((row) => ({
      place: row.rank,
      name: row.name,
      value: `${Math.round(row.points)} pts`,
      sub: row.earned > 0 ? `+${row.earned} tonight` : undefined,
      positive: true,
    })),
  };
}

const tidy = (lines: string[]) =>
  lines.filter((line, index, all) => line !== "" || (index > 0 && all[index - 1] !== "")).join("\n");

export type CashRecapInput = {
  date: string;
  sessionNumber: number;
  players: Array<{ player: string; buyIn: number; cashOut: number; net: number }>;
  totalBuyIn: number;
  pointsAfter?: PointsAfterNight | null;
  seasonName?: string;
};

/** The recap for one cash night: cover, results, highlights and (when scored) club points. */
export function buildCashRecap(input: CashRecapInput): RecapPack {
  const when = describeDate(input.date);
  const real = input.players.filter((player) => !isJackpot(player.player));
  const ranked = real.slice().sort((a, b) => b.net - a.net || a.player.localeCompare(b.player));
  const winner = ranked[0];
  const loser = ranked[ranked.length - 1];
  const inProfit = ranked.filter((player) => player.net > 0).length;
  const mostIn = real.slice().sort((a, b) => b.buyIn - a.buyIn || a.player.localeCompare(b.player))[0];
  const pot = input.totalBuyIn || real.reduce((sum, player) => sum + player.buyIn, 0);

  const slides: RecapSlide[] = [
    {
      kind: "cover",
      eyebrow: "Game night",
      title: when.long,
      headline: winner && winner.net > 0 ? `${winner.player} took the night` : "Everyone played it safe",
      value: winner ? signed(winner.net) : "—",
      positive: !winner || winner.net >= 0,
      chips: [plural(real.length, "player"), `${money(pot)} in the pot`],
    },
    {
      kind: "ranking",
      eyebrow: "Results",
      title: "How the night finished",
      subtitle: `${plural(real.length, "player")} · ${when.full}`,
      rows: ranked.map((player, index) => ({
        place: index + 1,
        name: player.player,
        value: signed(player.net),
        sub: `${exact(player.buyIn)} in · ${exact(player.cashOut)} out`,
        positive: player.net >= 0,
      })),
    },
  ];

  const tiles: RecapTile[] = [];
  if (winner) tiles.push({ label: "Biggest win", value: winner.player, detail: signed(winner.net), tone: "good" });
  if (loser && loser !== winner) tiles.push({ label: "Roughest night", value: loser.player, detail: signed(loser.net), tone: loser.net < 0 ? "bad" : "neutral" });
  if (mostIn) tiles.push({ label: "Most bought in", value: mostIn.player, detail: `${exact(mostIn.buyIn)} in`, tone: "neutral" });
  tiles.push({ label: "Finished in profit", value: `${inProfit} of ${real.length}`, detail: `${money(pot)} pot`, tone: "neutral" });
  if (tiles.length >= 3) slides.push({ kind: "tiles", eyebrow: "Highlights", title: "The night in four numbers", tiles: tiles.slice(0, 4) });

  const points = pointsSlide(input.pointsAfter ?? null, input.seasonName ?? "Season");
  if (points) slides.push(points);

  const runnersUp = ranked.slice(1, 3).filter((player) => player.net > 0);
  const caption = tidy([
    `♠ ${CLUB_NAME} · ${when.long}`,
    winner && winner.net > 0 ? `🏆 ${winner.player} took the night, ${signed(winner.net)}` : "",
    runnersUp.length ? `🥈 ${runnersUp.map((player) => `${player.player} ${signed(player.net)}`).join(" · ")}` : "",
    `${plural(real.length, "player")} · ${money(pot)} in the pot`,
    "",
    "Full results and club points on the club site.",
    `${CLUB_HASHTAG} #pokernight`,
  ]);

  return { id: `cash-${input.sessionNumber}`, title: `Game night · ${when.full}`, dateLabel: when.full, slides, caption };
}

export type TournamentRecapInput = {
  id: string;
  date: string;
  title: string;
  players: number;
  entries: number;
  rebuys: number;
  topUps: number;
  knockouts: number;
  mainPrizePool: number;
  bountyPool: number;
  winner: string | null;
  winnerPrize: number;
  topBountyHunter: string | null;
  mostKnockouts: number;
  results: Array<{
    player: string;
    finishPlace: number | null;
    knockouts: number;
    mainPrize: number;
    bountiesWon: number;
    netProfit: number;
  }>;
  pointsAfter?: PointsAfterNight | null;
  seasonName?: string;
};

/** The recap for one tournament: cover, podium, results, highlights and club points. */
export function buildTournamentRecap(input: TournamentRecapInput): RecapPack {
  const when = describeDate(input.date);
  const results = input.results.filter((result) => !isJackpot(result.player));
  const podium = results
    .filter((result) => result.finishPlace !== null && result.finishPlace <= 3)
    .sort((a, b) => (a.finishPlace ?? 0) - (b.finishPlace ?? 0));
  const winner = input.winner ?? podium[0]?.player ?? null;

  const slides: RecapSlide[] = [
    {
      kind: "cover",
      eyebrow: "Tournament night",
      title: when.long,
      headline: winner ? `${winner} took it down` : "Tournament results",
      value: winner ? exact(input.winnerPrize) : "—",
      positive: true,
      chips: [`${plural(input.players, "player")} · ${plural(input.entries, "entry", "entries")}`, `${money(input.mainPrizePool)} in prizes`],
    },
  ];

  if (podium.length >= 2) {
    slides.push({
      kind: "podium",
      eyebrow: "The podium",
      title: "Top three",
      places: podium.slice(0, 3).map((result) => ({
        place: (result.finishPlace ?? 1) as 1 | 2 | 3,
        name: result.player,
        value: exact(result.mainPrize),
        sub: `${signed(result.netProfit)} net${result.knockouts > 0 ? ` · ${plural(result.knockouts, "knockout")}` : ""}`,
      })),
      note: input.bountyPool > 0 ? `Plus ${money(input.bountyPool)} in bounties` : undefined,
    });
  }

  const ordered = results.slice().sort((a, b) => {
    if (a.finishPlace !== null && b.finishPlace !== null) return a.finishPlace - b.finishPlace;
    if (a.finishPlace !== null) return -1;
    if (b.finishPlace !== null) return 1;
    return b.netProfit - a.netProfit || a.player.localeCompare(b.player);
  });
  slides.push({
    kind: "ranking",
    eyebrow: "Results",
    title: "How everyone finished",
    subtitle: `${plural(input.players, "player")} · ${when.full}`,
    rows: ordered.map((result, index) => ({
      place: result.finishPlace ?? index + 1,
      name: result.player,
      value: signed(result.netProfit),
      sub:
        [result.mainPrize > 0 ? `prize ${exact(result.mainPrize)}` : "", result.knockouts > 0 ? plural(result.knockouts, "knockout") : ""]
          .filter(Boolean)
          .join(" · ") || undefined,
      positive: result.netProfit >= 0,
    })),
  });

  const tiles: RecapTile[] = [];
  if (input.topBountyHunter) tiles.push({ label: "Top bounty hunter", value: input.topBountyHunter, detail: plural(input.mostKnockouts, "knockout"), tone: "good" });
  tiles.push({ label: "Prize pool", value: money(input.mainPrizePool), detail: input.bountyPool > 0 ? `+ ${money(input.bountyPool)} bounties` : undefined, tone: "neutral" });
  tiles.push({ label: "Entries", value: String(input.entries), detail: `${input.rebuys} rebuys · ${input.topUps} top-ups`, tone: "neutral" });
  tiles.push({ label: "Knockouts", value: String(input.knockouts), detail: plural(input.players, "player"), tone: "neutral" });
  slides.push({ kind: "tiles", eyebrow: "Highlights", title: "The night in four numbers", tiles: tiles.slice(0, 4) });

  const points = pointsSlide(input.pointsAfter ?? null, input.seasonName ?? "Season");
  if (points) slides.push(points);

  const caption = tidy([
    `♠ ${CLUB_NAME} · Tournament · ${when.long}`,
    winner ? `🏆 ${winner} took it down, ${exact(input.winnerPrize)}` : "",
    podium.length > 1 ? `🥈 ${podium.slice(1, 3).map((result) => `${result.player} ${ordinal(result.finishPlace ?? 0)}`).join(" · ")}` : "",
    `${plural(input.players, "player")} · ${money(input.mainPrizePool)} in prizes · ${plural(input.knockouts, "knockout")}`,
    input.topBountyHunter ? `🎯 Top bounty hunter: ${input.topBountyHunter} (${input.mostKnockouts})` : "",
    "",
    "Full results on the club site.",
    `${CLUB_HASHTAG} #pokertournament`,
  ]);

  return { id: `tournament-${input.id}`, title: `Tournament · ${when.full}`, dateLabel: when.full, slides, caption };
}

/** The fields of a tournament event the recap needs, so callers can pass an event as it is. */
export type RecapEventLike = Omit<TournamentRecapInput, "pointsAfter" | "seasonName">;

export function tournamentRecapFromEvent(
  event: RecapEventLike,
  extras: { pointsAfter?: PointsAfterNight | null; seasonName?: string } = {},
): RecapPack {
  return buildTournamentRecap({
    id: event.id,
    date: event.date,
    title: event.title,
    players: event.players,
    entries: event.entries,
    rebuys: event.rebuys,
    topUps: event.topUps,
    knockouts: event.knockouts,
    mainPrizePool: event.mainPrizePool,
    bountyPool: event.bountyPool,
    winner: event.winner,
    winnerPrize: event.winnerPrize,
    topBountyHunter: event.topBountyHunter,
    mostKnockouts: event.mostKnockouts,
    results: event.results,
    pointsAfter: extras.pointsAfter ?? null,
    seasonName: extras.seasonName,
  });
}

export type StandingsRecapInput = {
  /** Stable id used in file names, e.g. "points-2026-Q4". */
  id: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  dateLabel: string;
  rows: Array<{ name: string; value: string; sub?: string; positive?: boolean }>;
  hashtag?: string;
};

/** A one-slide recap of any ranked table (club points, season standings). */
export function buildStandingsRecap(input: StandingsRecapInput): RecapPack {
  const slide: RecapSlide = {
    kind: "ranking",
    eyebrow: input.eyebrow,
    title: input.title,
    subtitle: input.subtitle,
    rows: input.rows.map((row, index) => ({
      place: index + 1,
      name: row.name,
      value: row.value,
      sub: row.sub,
      positive: row.positive ?? true,
    })),
  };
  const top = input.rows.slice(0, 3).map((row, index) => `${["🥇", "🥈", "🥉"][index]} ${row.name} ${row.value}`);
  return {
    id: input.id,
    title: input.title,
    dateLabel: input.dateLabel,
    slides: [slide],
    caption: tidy([
      `♠ ${CLUB_NAME} · ${input.title}`,
      ...top,
      "",
      "Full table on the club site.",
      input.hashtag ?? CLUB_HASHTAG,
    ]),
  };
}

export type PersonalRecapInput = {
  id: string;
  name: string;
  date: string;
  net: number;
  buyIn: number;
  cashOut: number;
  kind: "cash" | "tournament";
  /** How the night finished, in the member's own words, e.g. "4th of 12" or "4th of 15 by result". */
  finishText: string;
  tiles: RecapTile[];
};

/** "Your night" as a pack: a cover with the result, then the personal numbers. */
export function buildPersonalRecap(input: PersonalRecapInput): RecapPack {
  const when = describeDate(input.date);
  const slides: RecapSlide[] = [
    {
      kind: "cover",
      eyebrow: input.kind === "tournament" ? "Tournament night" : "Game night",
      title: input.name,
      headline: `${when.long} · ${input.finishText}`,
      value: signed(input.net),
      positive: input.net >= 0,
      chips: [`In ${exact(input.buyIn)}`, `Out ${exact(input.cashOut)}`],
    },
  ];
  if (input.tiles.length >= 2) {
    slides.push({ kind: "tiles", eyebrow: "My night", title: "The numbers behind it", tiles: input.tiles.slice(0, 4) });
  }
  return {
    id: input.id,
    title: `${input.name} · ${when.full}`,
    dateLabel: when.full,
    slides,
    caption: tidy([
      `♠ ${CLUB_NAME} · ${when.long}`,
      `${input.name}: ${signed(input.net)} (${input.finishText})`,
      `In ${exact(input.buyIn)}, out ${exact(input.cashOut)}`,
      "",
      `${CLUB_HASHTAG} #pokernight`,
    ]),
  };
}
