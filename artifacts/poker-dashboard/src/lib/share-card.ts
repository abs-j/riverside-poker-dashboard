// Content and drawing for the "my night" share image.
import { CLUB_NAME, CLUB_UPPER } from "./brand.ts";
// Kept free of React so the wording logic can be unit tested.

export type ShareCardInput = {
  playerName: string;
  /** Already formatted, e.g. "10 Oct 2026". */
  date: string;
  net: number;
  buyIn: number;
  cashOut: number;
  tableRank: number;
  tableSize: number;
  isTournament: boolean;
  rank: number;
  of: number;
  /** Places gained (+) or lost (-) over the latest game, if known. */
  movement: number | null;
  streak: number;
  bestGame: number;
  allTimeNet: number | null;
};

export type ShareCardModel = {
  eyebrow: string;
  playerName: string;
  date: string;
  result: string;
  positive: boolean;
  detail: string;
  tiles: Array<{ label: string; value: string; note: string }>;
  footer: string;
};

const money = (value: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 2 }).format(Math.abs(value));
const signed = (value: number) => `${value >= 0 ? "+" : "−"}${money(value)}`;

export function ordinal(n: number) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10 > 3 ? 0 : n % 10] ?? "th"}`;
}

function movementNote(movement: number | null) {
  if (movement === null) return "Leaderboard";
  if (movement === 0) return "No change this game";
  return `${movement > 0 ? "Up" : "Down"} ${Math.abs(movement)} ${Math.abs(movement) === 1 ? "place" : "places"}`;
}

export function buildShareCardModel(input: ShareCardInput): ShareCardModel {
  const streakCount = Math.abs(input.streak);
  const form =
    streakCount >= 2
      ? { value: `${streakCount} ${input.streak > 0 ? "wins" : "losses"}`, note: "in a row" }
      : { value: "No streak", note: "Keeping it steady" };

  return {
    eyebrow: input.isTournament ? "Tournament night" : "Game night",
    playerName: input.playerName,
    date: input.date,
    result: signed(input.net),
    positive: input.net >= 0,
    detail: `Bought in ${money(input.buyIn)} · cashed out ${money(input.cashOut)} · ${ordinal(input.tableRank)} of ${input.tableSize} at the table`,
    tiles: [
      { label: "Leaderboard", value: `${ordinal(input.rank)} of ${input.of}`, note: movementNote(input.movement) },
      { label: "Form", value: form.value, note: form.note },
      input.allTimeNet === null
        ? { label: "Best game", value: signed(input.bestGame), note: "So far" }
        : { label: "All-time", value: signed(input.allTimeNet), note: `Best game ${signed(input.bestGame)}` },
    ],
    footer: CLUB_NAME,
  };
}

export type GroupCardRow = { place: number; name: string; value: string; positive: boolean };

/** A shareable image for the whole table: one night, or a season. */
export type GroupCardModel = {
  eyebrow: string;
  title: string;
  subtitle: string;
  rows: GroupCardRow[];
  stats: Array<{ label: string; value: string }>;
  footer: string;
};

type NightInput = {
  /** Already formatted, e.g. "10 Oct 2026". */
  date: string;
  isTournament: boolean;
  totalBuyIn: number;
  players: Array<{ player: string; net: number }>;
};

/** Top five results of one game plus the pot and the table size. */
export function buildNightCardModel(input: NightInput): GroupCardModel {
  const ranked = input.players
    .filter((player) => player.player.trim().toLowerCase() !== "bad beat jackpot")
    .slice()
    .sort((a, b) => b.net - a.net || a.player.localeCompare(b.player));
  const winner = ranked[0];
  return {
    eyebrow: input.isTournament ? "Tournament night" : "Game night",
    title: input.date,
    subtitle: winner && winner.net > 0 ? `${winner.player} took the night` : "Everyone played it safe",
    rows: ranked.slice(0, 5).map((player, index) => ({
      place: index + 1,
      name: player.player,
      value: signed(player.net),
      positive: player.net >= 0,
    })),
    stats: [
      { label: input.isTournament ? "Invested" : "Pot", value: money(input.totalBuyIn) },
      { label: "Players", value: String(ranked.length) },
      winner ? { label: "Best night", value: signed(winner.net) } : { label: "Best night", value: "—" },
    ],
    footer: CLUB_NAME,
  };
}

type TournamentCardInput = {
  /** Already formatted, e.g. "11 Oct 2026". */
  date: string;
  title: string;
  players: number;
  entries: number;
  mainPrizePool: number;
  knockouts: number;
  /** In finishing order where known, otherwise best result first. */
  results: Array<{ player: string; netProfit: number; totalReturn: number; finishPlace: number | null }>;
  winner: string | null;
};

/** Top five of a tournament with the prize pool, field size and knockouts. */
export function buildTournamentCardModel(input: TournamentCardInput): GroupCardModel {
  const rows = input.results.slice(0, 5).map((result, index) => ({
    place: result.finishPlace ?? index + 1,
    name: result.player,
    value: signed(result.netProfit),
    positive: result.netProfit >= 0,
  }));
  return {
    eyebrow: "Tournament night",
    title: input.date,
    subtitle: input.winner ? `${input.winner} took it down` : input.title,
    rows,
    stats: [
      { label: "Players", value: `${input.players} · ${input.entries} entries` },
      { label: "Prize pool", value: money(input.mainPrizePool) },
      { label: "Knockouts", value: String(input.knockouts) },
    ],
    footer: CLUB_NAME,
  };
}

type PointsCardInput = {
  /** e.g. "Q4 2026" or "All time". */
  label: string;
  rows: Array<{ name: string; points: number; nights: number; wins: number }>;
  nights: number;
};

/** The top five on club points, with the number of nights counted and the win leader. */
export function buildPointsCardModel(input: PointsCardInput): GroupCardModel {
  const leader = input.rows[0];
  const mostWins = input.rows.reduce<PointsCardInput["rows"][number] | null>(
    (top, row) => (row.wins > 0 && (!top || row.wins > top.wins) ? row : top),
    null,
  );
  return {
    eyebrow: "Club points",
    title: `${input.label} standings`,
    subtitle: leader ? `${leader.name} leads on ${Math.round(leader.points)} points` : "No nights scored yet",
    rows: input.rows.slice(0, 5).map((row, index) => ({
      place: index + 1,
      name: row.name,
      value: `${Math.round(row.points)} pts`,
      positive: true,
    })),
    stats: [
      { label: "Nights", value: String(input.nights) },
      { label: "Players", value: String(input.rows.length) },
      { label: "Most wins", value: mostWins ? `${mostWins.name} · ${mostWins.wins}` : "—" },
    ],
    footer: CLUB_NAME,
  };
}

type SeasonInput = {
  label: string;
  games: number;
  standings: Array<{ name: string; net: number; games: number; wins: number }>;
  mostWins: { name: string; wins: number } | null;
};

/** The season's top five by net profit, with games played and the win leader. */
export function buildSeasonCardModel(input: SeasonInput): GroupCardModel {
  const leader = input.standings[0];
  return {
    eyebrow: "Player of the season",
    title: `${input.label} standings`,
    subtitle: leader ? `${leader.name} leads the way` : "Season under way",
    rows: input.standings.slice(0, 5).map((row, index) => ({
      place: index + 1,
      name: row.name,
      value: signed(row.net),
      positive: row.net >= 0,
    })),
    stats: [
      { label: "Games", value: String(input.games) },
      { label: "Players", value: String(input.standings.length) },
      input.mostWins
        ? { label: "Most wins", value: `${input.mostWins.name} · ${input.mostWins.wins}` }
        : { label: "Most wins", value: "—" },
    ],
    footer: CLUB_NAME,
  };
}

export const SPADE_PATH =
  "M256 96C200 170 120 215 120 290c0 50 40 82 85 82 23 0 39-10 47-22-2 45-14 70-47 90h102c-33-20-45-45-47-90 8 12 24 22 47 22 45 0 85-32 85-82 0-75-80-120-136-194z";

export const SHARE_CARD_SIZE = { width: 1080, height: 1350 } as const;

export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

type Paint = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  sans: string;
  mono: string;
  spaced: (px: number) => void;
};

/** Canvas with the violet backdrop and the club mark already painted. Browser only. */
async function prepareCanvas(): Promise<Paint> {
  const { width, height } = SHARE_CARD_SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");

  try {
    await Promise.all([
      document.fonts.load("600 64px Outfit"),
      document.fonts.load("500 64px 'DM Mono'"),
    ]);
  } catch {
    // Fall back to system fonts.
  }
  const sans = "Outfit, system-ui, sans-serif";
  const mono = "'DM Mono', ui-monospace, monospace";
  const spaced = (px: number) => {
    if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${px}px`;
  };

  // Background
  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, "#3b1470");
  background.addColorStop(0.55, "#6b2a9f");
  background.addColorStop(1, "#2a1060");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width * 0.85, height * 0.12, 20, width * 0.85, height * 0.12, 620);
  glow.addColorStop(0, "rgba(236, 140, 255, 0.42)");
  glow.addColorStop(1, "rgba(236, 140, 255, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  const glow2 = ctx.createRadialGradient(width * 0.1, height * 0.95, 20, width * 0.1, height * 0.95, 560);
  glow2.addColorStop(0, "rgba(120, 90, 255, 0.45)");
  glow2.addColorStop(1, "rgba(120, 90, 255, 0)");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 2;
  for (const radius of [300, 420, 540]) {
    ctx.beginPath();
    ctx.arc(width * 0.92, height * 0.9, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Brand
  ctx.save();
  ctx.translate(72, 70);
  ctx.scale(0.16, 0.16);
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fill(new Path2D(SPADE_PATH));
  ctx.restore();
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.font = `500 26px ${mono}`;
  spaced(5);
  ctx.textBaseline = "alphabetic";
  ctx.fillText(CLUB_UPPER, 168, 128);
  spaced(0);

  return { canvas, ctx, sans, mono, spaced };
}

function paintFooter({ ctx, mono, spaced }: Paint, text: string) {
  const { height } = SHARE_CARD_SIZE;
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = `500 24px ${mono}`;
  spaced(4);
  ctx.fillText(text.toUpperCase(), 72, height - 62);
  spaced(0);
}

export function toPng(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not create the image."))), "image/png");
  });
}

/** Draws a personal night card, or a group card, to a PNG. Browser only. */
export async function renderShareCard(model: ShareCardModel | GroupCardModel): Promise<Blob> {
  if ("rows" in model) return renderGroupCard(model);
  const paint = await prepareCanvas();
  const { ctx, canvas, sans, mono, spaced } = paint;
  const { width, height } = SHARE_CARD_SIZE;

  // Player and date
  spaced(0);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = `500 28px ${mono}`;
  spaced(4);
  ctx.fillText(model.eyebrow.toUpperCase(), 72, 300);
  spaced(0);
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 84px ${sans}`;
  ctx.fillText(model.playerName, 72, 396);
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = `400 36px ${sans}`;
  ctx.fillText(model.date, 72, 452);

  // Result
  ctx.shadowColor = model.positive ? "rgba(110, 231, 183, 0.55)" : "rgba(253, 164, 175, 0.5)";
  ctx.shadowBlur = 60;
  ctx.fillStyle = model.positive ? "#86efc0" : "#fda4af";
  ctx.font = `500 188px ${mono}`;
  ctx.fillText(model.result, 60, 690);
  ctx.shadowBlur = 0;

  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.font = `400 34px ${sans}`;
  const lines = wrapText(ctx, model.detail, width - 144);
  lines.forEach((line, index) => ctx.fillText(line, 72, 770 + index * 48));

  // Tiles
  const tileTop = 930;
  const gap = 24;
  const tileWidth = (width - 144 - gap * 2) / 3;
  model.tiles.forEach((tile, index) => {
    const x = 72 + index * (tileWidth + gap);
    roundRect(ctx, x, tileTop, tileWidth, 250, 28);
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.62)";
    ctx.font = `500 22px ${mono}`;
    spaced(3);
    ctx.fillText(tile.label.toUpperCase(), x + 28, tileTop + 56);
    spaced(0);
    ctx.fillStyle = "#ffffff";
    ctx.font = `600 ${tile.value.length > 9 ? 40 : 48}px ${sans}`;
    ctx.fillText(tile.value, x + 28, tileTop + 130);
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = `400 26px ${sans}`;
    const noteLines = wrapText(ctx, tile.note, tileWidth - 56);
    noteLines.slice(0, 2).forEach((line, lineIndex) => ctx.fillText(line, x + 28, tileTop + 182 + lineIndex * 34));
  });

  paintFooter(paint, model.footer);
  return toPng(canvas);
}

/** The group image: a title, up to five ranked rows and up to three stat tiles. */
async function renderGroupCard(model: GroupCardModel): Promise<Blob> {
  const paint = await prepareCanvas();
  const { ctx, canvas, sans, mono, spaced } = paint;
  const { width } = SHARE_CARD_SIZE;

  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = `500 28px ${mono}`;
  spaced(4);
  ctx.fillText(model.eyebrow.toUpperCase(), 72, 280);
  spaced(0);
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 76px ${sans}`;
  const titleLines = wrapText(ctx, model.title, width - 144).slice(0, 2);
  titleLines.forEach((line, index) => ctx.fillText(line, 72, 372 + index * 84));
  const afterTitle = 372 + (titleLines.length - 1) * 84;
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = `400 34px ${sans}`;
  ctx.fillText(model.subtitle, 72, afterTitle + 62);

  const medal = ["#f6c945", "#d6dbe6", "#d99157", "#c9b7ff", "#c9b7ff"];
  const rowTop = afterTitle + 112;
  const rowHeight = 100;
  model.rows.slice(0, 5).forEach((row, index) => {
    const y = rowTop + index * (rowHeight + 14);
    roundRect(ctx, 72, y, width - 144, rowHeight, 28);
    ctx.fillStyle = index === 0 ? "rgba(255,255,255,0.17)" : "rgba(255,255,255,0.10)";
    ctx.fill();
    ctx.strokeStyle = index === 0 ? "rgba(246,201,69,0.55)" : "rgba(255,255,255,0.16)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(72 + 58, y + rowHeight / 2, 30, 0, Math.PI * 2);
    ctx.fillStyle = medal[index] ?? "#c9b7ff";
    ctx.fill();
    ctx.fillStyle = "#2a1060";
    ctx.font = `700 32px ${sans}`;
    ctx.textAlign = "center";
    ctx.fillText(String(row.place), 72 + 58, y + rowHeight / 2 + 11);
    ctx.textAlign = "left";

    ctx.fillStyle = "#ffffff";
    ctx.font = `600 42px ${sans}`;
    let name = row.name;
    while (name.length > 3 && ctx.measureText(name).width > 520) name = name.slice(0, -1);
    ctx.fillText(name === row.name ? name : `${name}…`, 72 + 118, y + rowHeight / 2 + 15);

    ctx.textAlign = "right";
    ctx.fillStyle = row.positive ? "#86efc0" : "#fda4af";
    ctx.font = `500 44px ${mono}`;
    ctx.fillText(row.value, width - 72 - 32, y + rowHeight / 2 + 15);
    ctx.textAlign = "left";
  });

  const stats = model.stats.slice(0, 3);
  if (stats.length) {
    const tileTop = 1100;
    const gap = 24;
    const tileWidth = (width - 144 - gap * (stats.length - 1)) / stats.length;
    stats.forEach((stat, index) => {
      const x = 72 + index * (tileWidth + gap);
      roundRect(ctx, x, tileTop, tileWidth, 150, 26);
      ctx.fillStyle = "rgba(255,255,255,0.10)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.16)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.62)";
      ctx.font = `500 21px ${mono}`;
      spaced(3);
      ctx.fillText(stat.label.toUpperCase(), x + 26, tileTop + 48);
      spaced(0);
      ctx.fillStyle = "#ffffff";
      ctx.font = `600 ${stat.value.length > 10 ? 36 : 44}px ${sans}`;
      ctx.fillText(stat.value, x + 26, tileTop + 108);
    });
  }

  paintFooter(paint, model.footer);
  return toPng(canvas);
}
