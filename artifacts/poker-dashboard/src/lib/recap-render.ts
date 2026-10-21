// Draws a recap slide to a PNG at an Instagram size. Browser only (canvas); the words come
// from `recaps.ts`. Everything is laid out from the format's size and safe areas, so the same
// slide works as a 4:5 feed post, a 9:16 story and a square.
import { RECAP_FORMATS, type RecapFormat, type RecapSlide } from "./recaps.ts";
import { SPADE_PATH, roundRect, toPng, wrapText } from "./share-card.ts";
import { CLUB_UPPER } from "./brand.ts";

const SANS = "Outfit, system-ui, sans-serif";
const MONO = "'DM Mono', ui-monospace, monospace";
const MARGIN = 72;

// Each slide in a pack gets a slightly different violet so a carousel feels like a sequence.
const PALETTES: Array<[string, string, string, string, string]> = [
  ["#3b1470", "#6b2a9f", "#2a1060", "rgba(236,140,255,0.42)", "rgba(120,90,255,0.45)"],
  ["#1f1470", "#4a2a9f", "#150a50", "rgba(140,170,255,0.38)", "rgba(190,90,255,0.40)"],
  ["#4a1260", "#8a2a9f", "#2a0a50", "rgba(255,140,220,0.40)", "rgba(120,90,255,0.40)"],
  ["#2a1470", "#5b2fb0", "#1c0a55", "rgba(160,140,255,0.42)", "rgba(236,120,200,0.38)"],
];

type Ctx = CanvasRenderingContext2D;

function setSpacing(ctx: Ctx, px: number) {
  if ("letterSpacing" in ctx) (ctx as Ctx & { letterSpacing: string }).letterSpacing = `${px}px`;
}

/** Largest font size (down to `min`) at which the text fits on one line. */
function fit(ctx: Ctx, text: string, maxWidth: number, start: number, min: number, weight: number, family: string): number {
  let size = start;
  while (size > min) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  ctx.font = `${weight} ${size}px ${family}`;
  return size;
}

function truncate(ctx: Ctx, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let value = text;
  while (value.length > 2 && ctx.measureText(`${value}…`).width > maxWidth) value = value.slice(0, -1);
  return `${value}…`;
}

function backdrop(ctx: Ctx, width: number, height: number, index: number) {
  const [a, b, c, glowA, glowB] = PALETTES[index % PALETTES.length];
  const base = ctx.createLinearGradient(0, 0, width, height);
  base.addColorStop(0, a);
  base.addColorStop(0.55, b);
  base.addColorStop(1, c);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  const radius = Math.max(width, height) * 0.62;
  const g1 = ctx.createRadialGradient(width * 0.85, height * 0.1, 20, width * 0.85, height * 0.1, radius);
  g1.addColorStop(0, glowA);
  g1.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, width, height);
  const g2 = ctx.createRadialGradient(width * 0.1, height * 0.95, 20, width * 0.1, height * 0.95, radius * 0.9);
  g2.addColorStop(0, glowB);
  g2.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(255,255,255,0.09)";
  ctx.lineWidth = 2;
  for (const r of [300, 420, 540]) {
    ctx.beginPath();
    ctx.arc(width * 0.92, height * 0.92, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function chrome(ctx: Ctx, width: number, height: number, safeTop: number, safeBottom: number, dateLabel: string, index: number, total: number) {
  ctx.save();
  ctx.translate(MARGIN, safeTop + 6);
  ctx.scale(0.13, 0.13);
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fill(new Path2D(SPADE_PATH));
  ctx.restore();
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.font = `500 24px ${MONO}`;
  setSpacing(ctx, 5);
  ctx.fillText(CLUB_UPPER, MARGIN + 74, safeTop + 50);

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = `500 22px ${MONO}`;
  setSpacing(ctx, 3);
  const y = height - safeBottom + 14;
  ctx.fillText(dateLabel.toUpperCase(), MARGIN, y);
  if (total > 1) {
    ctx.textAlign = "right";
    ctx.fillText(`${index + 1} / ${total}`, width - MARGIN, y);
    ctx.textAlign = "left";
  }
  setSpacing(ctx, 0);
}

const eyebrow = (ctx: Ctx, text: string, y: number) => {
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = `500 28px ${MONO}`;
  setSpacing(ctx, 5);
  ctx.fillText(text.toUpperCase(), MARGIN, y);
  setSpacing(ctx, 0);
};

function drawCover(ctx: Ctx, slide: Extract<RecapSlide, { kind: "cover" }>, width: number, top: number, bottom: number) {
  const inner = width - MARGIN * 2;
  const blockHeight = bottom - top;
  const story = blockHeight > 1100;

  // Work out the headline and value sizes first so the whole block can be centred.
  const headlineSize = story ? 50 : 44;
  ctx.font = `400 ${headlineSize}px ${SANS}`;
  const headlineLines = wrapText(ctx, slide.headline, inner).slice(0, 2);
  const titleSize = fit(ctx, slide.title, inner, story ? 112 : 100, 58, 600, SANS);
  const valueSize = fit(ctx, slide.value, inner, story ? 220 : 190, 90, 500, MONO);
  const eyebrowGap = story ? 110 : 96;
  const titleGap = story ? 96 : 80;
  const lineHeight = story ? 64 : 56;
  const valueGap = story ? 90 : 56;
  const chipGap = story ? 70 : 50;
  const contentHeight =
    28 + eyebrowGap + titleSize * 0.2 + titleGap + headlineLines.length * lineHeight + valueGap + valueSize + chipGap + 64;
  let y = top + Math.max(0, Math.round((blockHeight - contentHeight) / 2.2)) + 28;

  eyebrow(ctx, slide.eyebrow, y);
  y += eyebrowGap;

  ctx.fillStyle = "#ffffff";
  ctx.font = `600 ${titleSize}px ${SANS}`;
  ctx.fillText(slide.title, MARGIN, y);
  y += titleGap;

  ctx.fillStyle = "rgba(255,255,255,0.86)";
  ctx.font = `400 ${headlineSize}px ${SANS}`;
  for (const line of headlineLines) {
    ctx.fillText(line, MARGIN, y);
    y += lineHeight;
  }

  y += valueGap;
  ctx.save();
  ctx.shadowColor = slide.positive ? "rgba(110,231,183,0.55)" : "rgba(253,164,175,0.5)";
  ctx.shadowBlur = 60;
  ctx.fillStyle = slide.positive ? "#86efc0" : "#fda4af";
  ctx.font = `500 ${valueSize}px ${MONO}`;
  ctx.fillText(slide.value, MARGIN - 6, y + valueSize * 0.72);
  ctx.restore();
  y += valueSize + chipGap;

  // Pills
  let x = MARGIN;
  ctx.font = `500 30px ${SANS}`;
  for (const chip of slide.chips) {
    const w = ctx.measureText(chip).width + 56;
    if (x + w > width - MARGIN && x > MARGIN) {
      x = MARGIN;
      y += 84;
    }
    roundRect(ctx, x, y, w, 64, 32);
    ctx.fillStyle = "rgba(255,255,255,0.13)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(chip, x + 28, y + 43);
    x += w + 16;
  }
}

function drawRanking(ctx: Ctx, slide: Extract<RecapSlide, { kind: "ranking" }>, width: number, top: number, bottom: number) {
  const inner = width - MARGIN * 2;
  let y = top + 40;
  eyebrow(ctx, slide.eyebrow, y);
  y += 78;
  ctx.fillStyle = "#ffffff";
  fit(ctx, slide.title, inner, 76, 48, 600, SANS);
  ctx.fillText(slide.title, MARGIN, y);
  if (slide.subtitle) {
    y += 52;
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = `400 32px ${SANS}`;
    ctx.fillText(slide.subtitle, MARGIN, y);
  }
  y += 44;

  const gap = 14;
  const available = bottom - y;
  let rowHeight = 108;
  let count = Math.min(slide.rows.length, Math.floor((available + gap) / (rowHeight + gap)));
  // Shrink rows a little before cutting anyone off.
  while (count < slide.rows.length && rowHeight > 78) {
    rowHeight -= 6;
    count = Math.min(slide.rows.length, Math.floor((available + gap) / (rowHeight + gap)));
  }
  const hidden = slide.rows.length - count;
  const reserve = hidden > 0 ? 54 : 0;
  while (count > 1 && count * (rowHeight + gap) - gap + reserve > available) count -= 1;
  const medal = ["#f6c945", "#d6dbe6", "#d99157"];

  slide.rows.slice(0, count).forEach((row, index) => {
    const rowY = y + index * (rowHeight + gap);
    roundRect(ctx, MARGIN, rowY, inner, rowHeight, 26);
    ctx.fillStyle = index === 0 ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.10)";
    ctx.fill();
    ctx.strokeStyle = index === 0 ? "rgba(246,201,69,0.55)" : "rgba(255,255,255,0.15)";
    ctx.lineWidth = 2;
    ctx.stroke();

    const cy = rowY + rowHeight / 2;
    ctx.beginPath();
    ctx.arc(MARGIN + 58, cy, 28, 0, Math.PI * 2);
    ctx.fillStyle = medal[row.place - 1] ?? "#c9b7ff";
    ctx.fill();
    ctx.fillStyle = "#2a1060";
    ctx.font = `700 30px ${SANS}`;
    ctx.textAlign = "center";
    ctx.fillText(String(row.place), MARGIN + 58, cy + 11);
    ctx.textAlign = "left";

    const valueFont = `500 ${rowHeight > 96 ? 42 : 36}px ${MONO}`;
    ctx.font = valueFont;
    const valueWidth = ctx.measureText(row.value).width;
    ctx.textAlign = "right";
    ctx.fillStyle = row.positive === false ? "#fda4af" : "#86efc0";
    ctx.fillText(row.value, width - MARGIN - 30, row.sub ? cy + 4 : cy + 14);
    ctx.textAlign = "left";

    const nameX = MARGIN + 112;
    const nameMax = width - MARGIN - 30 - valueWidth - nameX - 24;
    ctx.fillStyle = "#ffffff";
    ctx.font = `600 ${rowHeight > 96 ? 40 : 34}px ${SANS}`;
    ctx.fillText(truncate(ctx, row.name, nameMax), nameX, row.sub ? cy - 2 : cy + 13);
    if (row.sub) {
      ctx.fillStyle = "rgba(255,255,255,0.62)";
      ctx.font = `400 25px ${SANS}`;
      ctx.fillText(truncate(ctx, row.sub, width - MARGIN - 30 - nameX), nameX, cy + 32);
    }
  });

  if (hidden > 0) {
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.font = `500 26px ${MONO}`;
    ctx.fillText(`+ ${hidden} more on the club site`, MARGIN, y + count * (rowHeight + gap) + 30);
  }
}

function drawTiles(ctx: Ctx, slide: Extract<RecapSlide, { kind: "tiles" }>, width: number, top: number, bottom: number) {
  const inner = width - MARGIN * 2;
  let y = top + 40;
  eyebrow(ctx, slide.eyebrow, y);
  y += 78;
  ctx.fillStyle = "#ffffff";
  fit(ctx, slide.title, inner, 70, 46, 600, SANS);
  ctx.fillText(slide.title, MARGIN, y);
  y += 50;

  const gap = 24;
  const tileWidth = (inner - gap) / 2;
  const rows = Math.ceil(slide.tiles.length / 2);
  const tileHeight = Math.min(360, (bottom - y - gap * (rows - 1)) / rows);
  slide.tiles.forEach((tile, index) => {
    const x = MARGIN + (index % 2) * (tileWidth + gap);
    const ty = y + Math.floor(index / 2) * (tileHeight + gap);
    roundRect(ctx, x, ty, tileWidth, tileHeight, 32);
    ctx.fillStyle = "rgba(255,255,255,0.11)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.font = `500 23px ${MONO}`;
    setSpacing(ctx, 3);
    ctx.fillText(tile.label.toUpperCase(), x + 30, ty + 56);
    setSpacing(ctx, 0);

    ctx.fillStyle = "#ffffff";
    const size = fit(ctx, tile.value, tileWidth - 60, 62, 30, 600, SANS);
    ctx.fillText(tile.value, x + 30, ty + tileHeight / 2 + size * 0.2);
    if (tile.detail) {
      ctx.fillStyle = tile.tone === "bad" ? "#fda4af" : tile.tone === "good" ? "#86efc0" : "rgba(255,255,255,0.78)";
      fit(ctx, tile.detail, tileWidth - 60, size > 50 ? 38 : 32, 20, 500, MONO);
      ctx.fillText(tile.detail, x + 30, ty + tileHeight - 44);
    }
  });
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function drawPodium(ctx: Ctx, slide: Extract<RecapSlide, { kind: "podium" }>, width: number, top: number, bottom: number) {
  const inner = width - MARGIN * 2;
  let y = top + 40;
  eyebrow(ctx, slide.eyebrow, y);
  y += 78;
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 76px ${SANS}`;
  ctx.fillText(slide.title, MARGIN, y);

  const byPlace = new Map(slide.places.map((place) => [place.place, place]));
  const order: Array<1 | 2 | 3> = [2, 1, 3];
  const colWidth = (inner - 32) / 3;
  const floor = bottom - (slide.note ? 70 : 20);
  const maxBlock = Math.min(520, floor - (y + 330));
  const heights: Record<number, number> = { 1: maxBlock, 2: maxBlock * 0.74, 3: maxBlock * 0.56 };
  const colors: Record<number, [string, string, string]> = {
    1: ["rgba(246,201,69,0.95)", "rgba(214,160,30,0.55)", "#f6c945"],
    2: ["rgba(214,219,230,0.9)", "rgba(150,160,180,0.5)", "#d6dbe6"],
    3: ["rgba(217,145,87,0.9)", "rgba(170,100,55,0.5)", "#d99157"],
  };

  order.forEach((place, index) => {
    const entry = byPlace.get(place);
    if (!entry) return;
    const x = MARGIN + index * (colWidth + 16);
    const h = heights[place];
    const blockTop = floor - h;
    const grad = ctx.createLinearGradient(0, blockTop, 0, floor);
    grad.addColorStop(0, colors[place][0]);
    grad.addColorStop(1, colors[place][1]);
    roundRect(ctx, x, blockTop, colWidth, h, 26);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.fillStyle = "rgba(42,16,96,0.9)";
    ctx.font = `700 ${place === 1 ? 110 : 92}px ${SANS}`;
    ctx.textAlign = "center";
    ctx.fillText(String(place), x + colWidth / 2, blockTop + (place === 1 ? 128 : 112));

    // Avatar circle with initials above the block
    const r = place === 1 ? 74 : 62;
    const cx = x + colWidth / 2;
    const cy = blockTop - r - 18;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
    ctx.fillStyle = colors[place][2];
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = "#4a2a9f";
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = `600 ${Math.round(r * 0.78)}px ${SANS}`;
    ctx.fillText(initialsOf(entry.name), cx, cy + r * 0.27);

    ctx.fillStyle = "#ffffff";
    fit(ctx, entry.name, colWidth - 8, 38, 24, 600, SANS);
    ctx.fillText(entry.name, cx, cy - r - 22);
    ctx.fillStyle = "#2a1060";
    ctx.font = `600 34px ${MONO}`;
    ctx.fillText(entry.value, cx, blockTop + h - (entry.sub ? 96 : 40));
    if (entry.sub) {
      ctx.fillStyle = "rgba(42,16,96,0.78)";
      ctx.font = `500 25px ${SANS}`;
      const lines = wrapText(ctx, entry.sub, colWidth - 24).slice(0, 2);
      lines.forEach((line, lineIndex) => ctx.fillText(line, cx, blockTop + h - 52 + lineIndex * 30));
    }
    ctx.textAlign = "left";
  });

  if (slide.note) {
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = `500 28px ${MONO}`;
    ctx.fillText(slide.note, MARGIN, floor + 52);
  }
}

export type RenderedRecap = { blob: Blob; width: number; height: number };

/** Renders one slide at the chosen Instagram size. */
export async function renderRecapSlide(
  slide: RecapSlide,
  format: RecapFormat,
  meta: { dateLabel: string; index: number; total: number },
): Promise<RenderedRecap> {
  const { width, height, safeTop, safeBottom } = RECAP_FORMATS[format];
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  try {
    await Promise.all([document.fonts.load(`600 64px Outfit`), document.fonts.load(`500 64px 'DM Mono'`), document.fonts.load(`400 32px Outfit`)]);
  } catch {
    // Falls back to system fonts.
  }

  backdrop(ctx, width, height, meta.index);
  chrome(ctx, width, height, safeTop, safeBottom, meta.dateLabel, meta.index, meta.total);

  const top = safeTop + 70;
  const bottom = height - safeBottom - 24;
  if (slide.kind === "cover") drawCover(ctx, slide, width, top, bottom);
  else if (slide.kind === "ranking") drawRanking(ctx, slide, width, top, bottom);
  else if (slide.kind === "tiles") drawTiles(ctx, slide, width, top, bottom);
  else drawPodium(ctx, slide, width, top, bottom);

  return { blob: await toPng(canvas), width, height };
}
