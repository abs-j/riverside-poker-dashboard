import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { niceTicks, type CumulativeRuns, type PlayerTotal } from "@/lib/club-charts";
import { compactCurrency, formatDate, signedCurrency } from "@/views/shared";

// Plain-SVG charts (no chart library) so they add almost nothing to the page weight.

// Violet first (the brand), then amber, magenta and cyan. Green and red are kept for gains and losses.
export const SERIES_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];
const CONTEXT = "hsl(var(--muted-foreground) / 0.35)";
const GRID = "hsl(var(--foreground) / 0.08)";
const AXIS = "hsl(var(--foreground) / 0.25)";
const TEXT = "hsl(var(--muted-foreground))";
const STRONG = "hsl(var(--foreground))";
const POSITIVE = "hsl(var(--chart-1))";
const NEGATIVE = "hsl(var(--destructive))";
const SURFACE = "hsl(var(--card))";

function useElementWidth<T extends HTMLElement>(fallback = 640) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const update = () => setWidth(Math.max(240, Math.floor(node.clientWidth)));
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

type TipRow = { label: string; value: string; color?: string };
type Tip = { x: number; y: number; title: string; rows: TipRow[] };

function TooltipCard({ tip, width }: { tip: Tip | null; width: number }) {
  if (!tip) return null;
  const flip = tip.x > width * 0.6;
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 min-w-[160px] rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-lg"
      style={{ top: Math.max(0, tip.y - 12), left: flip ? undefined : tip.x + 14, right: flip ? width - tip.x + 14 : undefined }}
    >
      <p className="mb-1 font-mono text-[11px] text-muted-foreground">{tip.title}</p>
      {tip.rows.map((row) => (
        <p key={row.label} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2">
            {row.color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.color }} />}
            {row.label}
          </span>
          <strong className="font-mono">{row.value}</strong>
        </p>
      ))}
    </div>
  );
}

export type Highlight = { name: string; color: string };

type CumulativeLineChartProps = {
  runs: CumulativeRuns;
  highlight: Highlight[];
  /** Names drawn as faint lines behind the highlighted ones. */
  contextNames?: string[];
  height?: number;
  label?: string;
};

export function CumulativeLineChart({ runs, highlight, contextNames = [], height = 320, label }: CumulativeLineChartProps) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const [tip, setTip] = useState<{ index: number; x: number; y: number } | null>(null);
  const { games, series, results } = runs;

  const layout = useMemo(() => {
    const margin = { top: 12, right: width < 480 ? 16 : 96, bottom: 28, left: 52 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    const names = [...new Set([...contextNames, ...highlight.map((item) => item.name)])];
    let lo = 0;
    let hi = 0;
    for (const name of names) for (const value of series.get(name) ?? []) {
      lo = Math.min(lo, value);
      hi = Math.max(hi, value);
    }
    const ticks = niceTicks(lo, hi, 5);
    const y0 = ticks[0];
    const y1 = ticks[ticks.length - 1];
    const times = games.map((game) => new Date(game.date).getTime());
    const t0 = times[0];
    const t1 = times[times.length - 1];
    const xs = times.map((time) => (t1 === t0 ? innerW / 2 : ((time - t0) / (t1 - t0)) * innerW));
    const y = (value: number) => innerH - ((value - y0) / (y1 - y0 || 1)) * innerH;
    return { margin, innerW, innerH, names, ticks, xs, y };
  }, [width, height, contextNames, highlight, series, games]);

  if (!games.length) {
    return <p className="rounded-xl border border-dashed border-border px-5 py-16 text-center text-sm text-muted-foreground">No games in this range.</p>;
  }

  const { margin, innerW, innerH, ticks, xs, y } = layout;
  const pathFor = (name: string) =>
    (series.get(name) ?? []).map((value, i) => `${i ? "L" : "M"}${xs[i].toFixed(1)},${y(value).toFixed(1)}`).join("");
  const highlighted = new Set(highlight.map((item) => item.name));

  // Month labels along the bottom: first game of each month, thinned so they never collide.
  const monthTicks: Array<{ x: number; text: string }> = [];
  let lastMonth = "";
  let lastX = -Infinity;
  games.forEach((game, i) => {
    const month = game.date.slice(0, 7);
    if (month === lastMonth) return;
    lastMonth = month;
    if (xs[i] - lastX < 44) return;
    lastX = xs[i];
    monthTicks.push({ x: xs[i], text: new Intl.DateTimeFormat("en-AU", { month: "short", timeZone: "UTC" }).format(new Date(game.date)) });
  });

  const endLabels = highlight
    .map((item) => {
      const values = series.get(item.name) ?? [];
      const last = values[values.length - 1] ?? 0;
      return { ...item, last, y: y(last) };
    })
    .sort((a, b) => a.y - b.y);

  const showAt = (index: number, clientX: number, clientY: number) => {
    const box = wrapRef.current?.getBoundingClientRect();
    setTip({ index, x: clientX - (box?.left ?? 0), y: clientY - (box?.top ?? 0) });
  };
  const nearest = (px: number) => {
    let best = 0;
    for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - px) <= Math.abs(xs[best] - px)) best = i;
    return best;
  };

  const active = tip ? games[tip.index] : null;
  const tipData: Tip | null = tip && active
    ? {
        x: tip.x,
        y: tip.y,
        title: `${formatDate(active.date)} · ${active.eventType === "tournament" ? "Tournament" : "Cash game"} · ${active.playerCount} players`,
        rows: highlight
          .map((item) => {
            const total = series.get(item.name)?.[tip.index] ?? 0;
            const delta = results.get(item.name)?.[tip.index];
            return {
              total,
              row: {
                label: item.name,
                color: item.color,
                value: `${signedCurrency(total)} ${delta == null ? "(sat out)" : `(${signedCurrency(delta)})`}`,
              },
            };
          })
          .sort((a, b) => b.total - a.total)
          .map((item) => item.row),
      }
    : null;

  return (
    <div ref={wrapRef} className="relative w-full" data-testid="chart-cumulative-profit">
      <svg width={width} height={height} role="img" aria-label={label ?? "Cumulative net profit over time"} className="block overflow-visible">
        <g transform={`translate(${margin.left},${margin.top})`}>
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={0} x2={innerW} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? AXIS : GRID} strokeWidth={tick === 0 ? 1.25 : 1} />
              <text x={-8} y={y(tick) + 4} textAnchor="end" fontSize={11} fill={TEXT}>{compactCurrency(tick)}</text>
            </g>
          ))}
          {monthTicks.map((tick) => (
            <text key={tick.x} x={tick.x} y={innerH + 18} textAnchor="middle" fontSize={11} fill={TEXT}>{tick.text}</text>
          ))}
          {layout.names.filter((name) => !highlighted.has(name)).map((name) => (
            <path key={name} d={pathFor(name)} fill="none" stroke={CONTEXT} strokeWidth={1} strokeLinejoin="round" className="fade-in" />
          ))}
          {highlight.map((item) => {
            const values = series.get(item.name) ?? [];
            const last = values[values.length - 1] ?? 0;
            return (
              <g key={item.name}>
                <path d={pathFor(item.name)} pathLength={1} fill="none" stroke={item.color} strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" className="draw-line" />
                <circle cx={xs[xs.length - 1]} cy={y(last)} r={4} fill={item.color} stroke={SURFACE} strokeWidth={2} />
              </g>
            );
          })}
          {margin.right > 40 && endLabels.map((item, i) => {
            const clearAbove = i === 0 || item.y - endLabels[i - 1].y >= 28;
            const clearBelow = i === endLabels.length - 1 || endLabels[i + 1].y - item.y >= 28;
            if (!clearAbove || !clearBelow) return null;
            return (
              <g key={item.name}>
                <text x={innerW + 10} y={item.y - 2} fontSize={12} fill={TEXT}>{item.name}</text>
                <text x={innerW + 10} y={item.y + 12} fontSize={12} fontWeight={600} fill={STRONG}>{signedCurrency(item.last)}</text>
              </g>
            );
          })}
          {tip && (
            <g pointerEvents="none">
              <line x1={xs[tip.index]} x2={xs[tip.index]} y1={0} y2={innerH} stroke={AXIS} strokeDasharray="3 3" />
              {highlight.map((item) => (
                <circle key={item.name} cx={xs[tip.index]} cy={y(series.get(item.name)?.[tip.index] ?? 0)} r={4} fill={item.color} stroke={SURFACE} strokeWidth={2} />
              ))}
            </g>
          )}
          <rect
            x={0}
            y={0}
            width={innerW}
            height={innerH}
            fill="transparent"
            tabIndex={0}
            aria-label="Chart crosshair. Use the left and right arrow keys to move between games."
            onPointerMove={(event) => {
              const left = event.currentTarget.getBoundingClientRect().left;
              showAt(nearest(event.clientX - left), event.clientX, event.clientY);
            }}
            onPointerLeave={() => setTip(null)}
            onBlur={() => setTip(null)}
            onKeyDown={(event) => {
              if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
              event.preventDefault();
              const current = tip?.index ?? games.length - 1;
              const next = Math.min(games.length - 1, Math.max(0, current + (event.key === "ArrowLeft" ? -1 : 1)));
              const box = event.currentTarget.getBoundingClientRect();
              showAt(next, box.left + xs[next], box.top + y(series.get(highlight[0]?.name ?? "")?.[next] ?? 0));
            }}
          />
        </g>
      </svg>
      <TooltipCard tip={tipData} width={width} />
    </div>
  );
}

type LeaderboardBarsProps = {
  rows: PlayerTotal[];
  /** Index after which a "more players" gap row is drawn, or -1. */
  gapAfter: number;
  hidden: number;
  rankOffset?: (name: string) => number;
  colorFor: (name: string) => string | null;
  viewer?: string;
  onToggle: (name: string) => void;
  /** When set, rows act as links (e.g. "open their profile") instead of chart toggles. */
  actionLabel?: string;
};

export function LeaderboardBars({ rows, gapAfter, hidden, colorFor, viewer, rankOffset, onToggle, actionLabel }: LeaderboardBarsProps) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>(480);
  const [tip, setTip] = useState<Tip | null>(null);
  if (!rows.length) return <p className="py-10 text-center text-sm text-muted-foreground">No players in this range.</p>;

  const rowH = 36;
  const gapH = gapAfter >= 0 ? 24 : 0;
  const nameW = Math.min(128, Math.max(88, width * 0.28));
  const labelW = 72;
  const height = rows.length * rowH + gapH + 4;
  const lo = Math.min(0, ...rows.map((row) => row.net));
  const hi = Math.max(0, ...rows.map((row) => row.net));
  const plotL = nameW + (lo < 0 ? labelW : 8);
  const plotR = width - (hi > 0 ? labelW : 8);
  const x = (value: number) => plotL + ((value - lo) / (hi - lo || 1)) * Math.max(40, plotR - plotL);
  const zero = x(0);
  const viewerKey = viewer?.trim().toLowerCase();

  return (
    <div ref={wrapRef} className="relative w-full" data-testid="chart-leaderboard-bars">
      <svg width={width} height={height} role="list" aria-label="Net profit by player" className="block overflow-visible">
        <line x1={zero} x2={zero} y1={0} y2={height} stroke={AXIS} />
        {rows.map((row, i) => {
          const top = i * rowH + (gapAfter >= 0 && i > gapAfter ? gapH : 0);
          const color = colorFor(row.name);
          const isViewer = viewerKey !== undefined && row.name.trim().toLowerCase() === viewerKey;
          const barW = Math.abs(x(row.net) - zero);
          const positive = row.net >= 0;
          const rank = rankOffset ? rankOffset(row.name) : i + 1;
          const tipRows: TipRow[] = [
            { label: "Net", value: signedCurrency(row.net) },
            { label: "Games", value: String(row.games) },
          ];
          return (
            <g
              key={row.name}
              role="button"
              tabIndex={0}
              aria-pressed={actionLabel ? undefined : Boolean(color)}
              aria-label={`${row.name}: ${signedCurrency(row.net)} over ${row.games} games. Press to ${actionLabel ?? (color ? "remove from the chart" : "add to the chart")}.`}
              className="cursor-pointer outline-none focus-visible:[&>rect:first-child]:fill-[hsl(var(--foreground)/0.06)] hover:[&>rect:first-child]:fill-[hsl(var(--foreground)/0.04)]"
              onClick={() => onToggle(row.name)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onToggle(row.name);
                }
              }}
              onPointerMove={(event) => {
                const box = wrapRef.current?.getBoundingClientRect();
                setTip({ x: event.clientX - (box?.left ?? 0), y: event.clientY - (box?.top ?? 0), title: `#${rank} ${row.name}`, rows: tipRows });
              }}
              onPointerLeave={() => setTip(null)}
            >
              <rect x={0} y={top} width={width} height={rowH} rx={4} fill="transparent" />
              {color && <circle cx={6} cy={top + rowH / 2} r={4} fill={color} />}
              <text x={16} y={top + rowH / 2 + 4} fontSize={12} fill={isViewer ? STRONG : TEXT} fontWeight={isViewer ? 600 : 400}>
                {(isViewer ? `${row.name} (you)` : row.name).slice(0, 18)}
              </text>
              {barW > 0.5 && (
                <rect
                  x={positive ? zero : zero - barW}
                  y={top + (rowH - 14) / 2}
                  width={barW}
                  height={14}
                  rx={3}
                  fill={positive ? POSITIVE : NEGATIVE}
                  className={`bar-x ${positive ? "right" : "left"}`}
                  style={{ "--i": i } as CSSProperties}
                />
              )}
              <text
                x={positive ? zero + barW + 6 : zero - barW - 6}
                y={top + rowH / 2 + 4}
                fontSize={12}
                fontWeight={600}
                fill={STRONG}
                textAnchor={positive ? "start" : "end"}
              >
                {signedCurrency(row.net)}
              </text>
            </g>
          );
        })}
        {gapAfter >= 0 && (
          <text x={16} y={(gapAfter + 1) * rowH + gapH / 2 + 4} fontSize={12} fill={TEXT}>
            ⋯ {hidden} more players
          </text>
        )}
      </svg>
      <TooltipCard tip={tip} width={width} />
    </div>
  );
}

export type Column = {
  key: string;
  value: number;
  title: string;
  /** Short axis label, e.g. "13 Mar". */
  axis: string;
  rows: TipRow[];
};

type ColumnChartProps = {
  columns: Column[];
  /** Colour columns by sign and draw a zero line. */
  diverging?: boolean;
  height?: number;
  label: string;
  format?: (value: number) => string;
  onSelect?: (key: string) => void;
  testId?: string;
};

export function ColumnChart({ columns, diverging = false, height = 240, label, format = compactCurrency, onSelect, testId }: ColumnChartProps) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const [tip, setTip] = useState<Tip | null>(null);
  if (!columns.length) return <p className="rounded-xl border border-dashed border-border px-5 py-14 text-center text-sm text-muted-foreground">No games in this range.</p>;

  const margin = { top: 10, right: 8, bottom: 30, left: 52 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const values = columns.map((column) => column.value);
  const lo = diverging ? Math.min(0, ...values) : 0;
  const hi = Math.max(0, ...values);
  const ticks = niceTicks(lo, hi, 5);
  const y0 = ticks[0];
  const y1 = ticks[ticks.length - 1];
  const y = (value: number) => innerH - ((value - y0) / (y1 - y0 || 1)) * innerH;
  const band = innerW / columns.length;
  const barW = Math.max(2, Math.min(36, band * 0.7));
  const every = Math.max(1, Math.ceil(44 / band));

  return (
    <div ref={wrapRef} className="relative w-full" data-testid={testId}>
      <svg width={width} height={height} role="img" aria-label={label} className="block overflow-visible">
        <g transform={`translate(${margin.left},${margin.top})`}>
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={0} x2={innerW} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? AXIS : GRID} strokeWidth={tick === 0 ? 1.25 : 1} />
              <text x={-8} y={y(tick) + 4} textAnchor="end" fontSize={11} fill={TEXT}>{format(tick)}</text>
            </g>
          ))}
          {columns.map((column, i) => {
            const cx = band * i + band / 2;
            const top = Math.min(y(column.value), y(0));
            const barHeight = Math.max(1, Math.abs(y(column.value) - y(0)));
            const fill = diverging ? (column.value >= 0 ? POSITIVE : NEGATIVE) : "hsl(var(--primary))";
            const interactive = Boolean(onSelect);
            return (
              <g
                key={column.key}
                role={interactive ? "button" : undefined}
                tabIndex={interactive ? 0 : undefined}
                aria-label={interactive ? `${column.title}: ${format(column.value)}. Press to open.` : undefined}
                className={interactive ? "cursor-pointer outline-none" : undefined}
                onClick={interactive ? () => onSelect?.(column.key) : undefined}
                onKeyDown={interactive ? (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect?.(column.key);
                  }
                } : undefined}
                onPointerMove={(event) => {
                  const box = wrapRef.current?.getBoundingClientRect();
                  setTip({ x: event.clientX - (box?.left ?? 0), y: event.clientY - (box?.top ?? 0), title: column.title, rows: column.rows });
                }}
                onPointerLeave={() => setTip(null)}
              >
                <rect x={band * i} y={0} width={band} height={innerH} fill="transparent" />
                <rect x={cx - barW / 2} y={top} width={barW} height={barHeight} rx={2} fill={fill} className={`bar-y ${column.value >= 0 ? "up" : "down"}`} style={{ "--i": i } as CSSProperties} />
                {i % every === 0 && (
                  <text x={cx} y={innerH + 18} textAnchor="middle" fontSize={11} fill={TEXT}>{column.axis}</text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      <TooltipCard tip={tip} width={width} />
    </div>
  );
}

export function ChartCard({
  testId,
  eyebrow,
  title,
  description,
  action,
  children,
}: {
  testId: string;
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section data-testid={testId} className="soft-shadow min-w-0 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {eyebrow && <p className="section-label text-primary">{eyebrow}</p>}
          <h2 className="mt-1 text-lg font-semibold tracking-tight">{title}</h2>
          {description && <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}
