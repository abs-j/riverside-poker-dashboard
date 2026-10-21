import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { type DashboardPlayer as Player, type DashboardSession as Session, type SessionPlayerRecord as SessionPlayer } from "@/lib/earnings-analytics";
import { ArrowDown, ArrowUp, BarChart3, Minus, Star } from "lucide-react";
import { type ReactNode } from "react";

export type MonthFilter = "ALL" | string;

export type QuarterFilter = "ALL" | string;

export type RankMovement = {
  direction: "up" | "down" | "same" | "new";
  places: number;
};

export function normalizePlayerName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function buildScopedPlayers(players: Player[], sessions: Session[]): Player[] {
  const aggregates = new Map<string, { buyIn: number; cashOut: number; net: number; records: SessionPlayer[] }>();
  sessions.forEach((session) => {
    session.players.forEach((record) => {
      const key = normalizePlayerName(record.player);
      const aggregate = aggregates.get(key) ?? { buyIn: 0, cashOut: 0, net: 0, records: [] };
      aggregate.buyIn += record.buyIn;
      aggregate.cashOut += record.cashOut;
      aggregate.net += record.net;
      aggregate.records.push(record);
      aggregates.set(key, aggregate);
    });
  });

  return players
    .filter((player) => aggregates.has(normalizePlayerName(player.name)))
    .map((player) => {
      const aggregate = aggregates.get(normalizePlayerName(player.name))!;
      const gamesPlayed = aggregate.records.length;
      const positiveRecords = aggregate.records.filter((record) => record.net > 0).length;
      const maxWin = Math.max(...aggregate.records.map((record) => record.net), 0);
      const maxLoss = Math.min(...aggregate.records.map((record) => record.net), 0);
      return {
        ...player,
        buyInTotal: aggregate.buyIn,
        cashOutTotal: aggregate.cashOut,
        profitTotal: aggregate.net,
        gamesPlayed,
        profitPerSession: gamesPlayed ? aggregate.net / gamesPlayed : 0,
        positiveSessionPct: gamesPlayed ? positiveRecords / gamesPlayed * 100 : 0,
        netPct: aggregate.buyIn ? aggregate.net / aggregate.buyIn * 100 : 0,
        buyInPerGame: gamesPlayed ? aggregate.buyIn / gamesPlayed : 0,
        maxWin,
        maxLoss,
      };
    })
    .sort((left, right) => right.profitTotal - left.profitTotal || right.positiveSessionPct - left.positiveSessionPct || left.name.localeCompare(right.name))
    .map((player, index) => ({ ...player, rank: index + 1 }));
}

export function buildPreviousLeaderboardRanks(players: Player[], sessions: Session[]): Map<string, number> | null {
  if (sessions.length < 2) return null;
  const orderedSessions = sessions.slice().sort((left, right) => left.sessionNumber - right.sessionNumber);
  const latestSessionNumber = orderedSessions[orderedSessions.length - 1].sessionNumber;
  const previousLeaderboard = buildScopedPlayers(
    players,
    orderedSessions.filter((session) => session.sessionNumber < latestSessionNumber),
  );
  return new Map(
    previousLeaderboard.map((player) => [normalizePlayerName(player.name), player.rank]),
  );
}

// Movement compares like with like: the standing built from the recorded games before the
// latest game against the standing built from all recorded games. (The official all-time
// rank also includes results from before the log, so it is not comparable.)
export function buildRankMovementMap(players: Player[], sessions: Session[]): Map<string, RankMovement> {
  const previousRanks = buildPreviousLeaderboardRanks(players, sessions);
  if (!previousRanks) return new Map();
  const currentRanks = new Map(
    buildScopedPlayers(players, sessions).map((player) => [normalizePlayerName(player.name), player.rank]),
  );

  const movements = new Map<string, RankMovement>();
  for (const player of players) {
    const key = normalizePlayerName(player.name);
    const currentRank = currentRanks.get(key);
    if (currentRank === undefined) continue;
    const previousRank = previousRanks.get(key);
    if (previousRank === undefined) {
      movements.set(key, { direction: "new", places: 0 });
      continue;
    }
    const places = previousRank - currentRank;
    movements.set(key, {
      direction: places > 0 ? "up" : places < 0 ? "down" : "same",
      places: Math.abs(places),
    });
  }
  return movements;
}

export function RankMovementIndicator({ movement }: { movement?: RankMovement }) {
  if (!movement) return null;
  if (movement.direction === "new") {
    return <span data-testid="indicator-rank-new" title="New to the leaderboard" className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-primary">New</span>;
  }

  const isUp = movement.direction === "up";
  const isDown = movement.direction === "down";
  const Icon = isUp ? ArrowUp : isDown ? ArrowDown : Minus;
  const label = isUp
    ? `Moved up ${movement.places} ${movement.places === 1 ? "place" : "places"} since the previous leaderboard position`
    : isDown
      ? `Moved down ${movement.places} ${movement.places === 1 ? "place" : "places"} since the previous leaderboard position`
      : "No rank change since the previous leaderboard position";

  return <span data-testid={`indicator-rank-${movement.direction}`} title={label} aria-label={label} className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold ${isUp ? "bg-chart-1/10 text-chart-1" : isDown ? "bg-destructive/10 text-destructive" : "bg-secondary text-muted-foreground"}`}><Icon className="h-3 w-3" aria-hidden="true" />{movement.places > 0 ? movement.places : "—"}</span>;
}

export function MetricCard({ label, value, detail, tone = "neutral", icon, testId }: { label: string; value: string; detail?: string; tone?: "positive" | "negative" | "neutral"; icon: ReactNode; testId: string }) {
  return <div data-testid={testId} className="group rise-in soft-shadow rounded-xl border border-border bg-card p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg sm:p-4"><div className="flex items-center justify-between gap-2 text-muted-foreground"><span className="section-label">{label}</span><span className="text-primary transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-6 [&>svg]:h-4 [&>svg]:w-4">{icon}</span></div><p data-testid={`${testId}-value`} className={`mt-3 font-mono text-xl font-medium tracking-tight sm:text-2xl ${tone === "positive" ? "text-chart-1" : tone === "negative" ? "text-destructive" : "text-foreground"}`}>{value}</p><p className="mt-1 text-[11px] leading-4 text-muted-foreground transition-colors group-hover:text-foreground">{detail ?? "—"}</p></div>;
}

export function PageIntro({ eyebrow, title, description, count, compactOnMobile = false }: { eyebrow: string; title: string; description: string; count: string; compactOnMobile?: boolean }) {
  return <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="section-label text-primary">{eyebrow}</p><h1 data-testid={`text-page-title-${slug(title)}`} className={`mt-2 font-semibold tracking-[-0.045em] ${compactOnMobile ? "text-2xl sm:text-4xl" : "text-3xl sm:text-4xl"}`}>{title}</h1><p className={`${compactOnMobile ? "hidden sm:block " : ""}mt-2 max-w-2xl text-sm leading-6 text-muted-foreground`}>{description}</p></div><span data-testid={`text-page-count-${slug(title)}`} className="shrink-0 rounded-full border border-border bg-card px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">{count}</span></div>;
}

export function MiniStat({ label, value }: { label: string; value: string }) { return <div><p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">{label}</p><p className="mt-1 font-mono text-xs font-medium">{value}</p></div>; }

export function ContributorBadge({ name }: { name?: string }) {
  const contributorName = name ?? "This player";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span data-testid="badge-club-contributor" role="img" aria-label={`${contributorName} has contributed to the development of our home games`} className="inline-flex shrink-0 cursor-help items-center text-accent">
          <Star className="h-3.5 w-3.5 fill-current" />
        </span>
      </TooltipTrigger>
      <TooltipContent>{contributorName} has contributed to the development of our home games.</TooltipContent>
    </Tooltip>
  );
}

export function ChartEmpty({ label, dark = false }: { label: string; dark?: boolean }) { return <div data-testid="empty-chart" className={`flex h-[220px] items-center justify-center rounded-xl border border-dashed ${dark ? "border-primary-foreground/20 text-primary-foreground/60" : "border-border text-muted-foreground"} px-5 text-center text-sm`}>{label}</div>; }

export function EmptyPanel({ title, description }: { title: string; description: string }) { return <div data-testid="empty-panel" className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center"><div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-secondary"><BarChart3 className="h-5 w-5 text-muted-foreground" /></div><h3 className="mt-4 font-semibold">{title}</h3><p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{description}</p></div>; }

export function DataTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name?: string; value?: number; color?: string }>; label?: string | number }) { if (!active || !payload?.length) return null; return <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-lg"><p className="mb-1 font-mono text-[11px] text-muted-foreground">{label}</p>{payload.map((item) => <p key={item.name} className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />{item.name}: <strong className="font-mono">{typeof item.value === "number" && Math.abs(item.value) > 20 ? signedCurrency(item.value) : item.value}</strong></p>)}</div>; }

export function HeadMetric({ label, value, positive }: { label: string; value: string; positive?: boolean }) { return <div className="rounded-xl bg-secondary/45 p-3"><p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">{label}</p><p className={`mt-2 font-mono text-sm font-semibold ${positive === true ? "text-chart-1" : positive === false ? "text-destructive" : ""}`}>{value}</p></div>; }

export function formatCurrency(value: number) { return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 2 }).format(value || 0); }

export function signedCurrency(value: number) { return `${value >= 0 ? "+" : "−"}${formatCurrency(Math.abs(value))}`; }

export function compactCurrency(value: number) { if (Math.abs(value) >= 1000) return `${value < 0 ? "−" : ""}$${(Math.abs(value) / 1000).toFixed(1)}k`; return `${value < 0 ? "−" : ""}$${Math.abs(value).toFixed(0)}`; }

export function formatDate(value: string, pattern = "d MMM yyyy") { const date = new Date(value); if (Number.isNaN(date.getTime())) return value; return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: pattern.includes("yyyy") ? "numeric" : undefined }).format(date); }

export function slug(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }

export const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function monthLabel(value: string) { const index = Number(value) - 1; return monthNames[index] ?? value; }
