import { type PerformanceScope, type DashboardPlayer as Player, type DashboardSession as Session } from "@/lib/earnings-analytics";
import { ChevronDown } from "lucide-react";
import { ChartCard, LeaderboardBars } from "@/components/club-charts";
import { Podium } from "@/components/podium";
import { trimLeaderboard } from "@/lib/club-charts";
import { badgesFor, buildFormDots } from "@/lib/achievements";
import { useAchievements } from "@/components/achievements-context";
import { BadgeChips, FormDots } from "@/components/form-dots";
import { Avatar } from "@/components/avatar";
import { useMemo, useState, type ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { ContributorBadge, EmptyPanel, MiniStat, MonthFilter, QuarterFilter, RankMovementIndicator, buildRankMovementMap, buildScopedPlayers, formatCurrency, monthLabel, normalizePlayerName, signedCurrency, slug } from "./shared";

export function PeriodLeaderboards({ players, sessions, allSessions, activePeriod, scope, viewer, onSelectPlayer, afterPodium, afterOverview }: { players: Player[]; sessions: Session[]; allSessions: Session[]; activePeriod: MonthFilter | QuarterFilter; scope: PerformanceScope; viewer: string; onSelectPlayer: (name: string) => void; /** Shown straight after the profit podium. */ afterPodium?: ReactNode; /** Shown after the profit bars, before the detailed stats table. */ afterOverview?: ReactNode }) {
  const leaderboard = activePeriod === "ALL" ? players : buildScopedPlayers(players, sessions);
  const rankMovements = buildRankMovementMap(leaderboard, sessions);
  const scopeLabel = activePeriod === "ALL" ? "All-time" : activePeriod.startsWith("Q") ? activePeriod : monthLabel(activePeriod);
  const earningsScopeLabel = scope === "all" ? "All earnings" : scope === "cash" ? "Cash games" : "Tournaments";
  const returnLabel = scope === "cash" ? "Cash-out" : scope === "tournaments" ? "Payout" : "Returned";
  const activityLabel = scope === "tournaments" ? "Events" : "Games";
  const profitRateLabel = scope === "tournaments" ? "Profit per event" : "Profit per game";
  const buyInRateLabel = scope === "tournaments" ? "Buy-in per event" : "Buy-in per game";
  const [sortValue, setSortValue] = useState("rank:asc");
  const [showAll, setShowAll] = useState(false);
  const sortedLeaderboard = useMemo(() => {
    const [sortKey, sortDirection] = sortValue.split(":") as [LeaderboardSortKey, "asc" | "desc"];
    return leaderboard.slice().sort((left, right) => {
      const leftValue = left[sortKey];
      const rightValue = right[sortKey];
      const comparison = typeof leftValue === "string" && typeof rightValue === "string"
        ? leftValue.localeCompare(rightValue)
        : Number(leftValue) - Number(rightValue);
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [leaderboard, sortValue]);
  const isMobile = useIsMobile();
  const { badges: badgeMap } = useAchievements();
  const ROW_LIMIT = isMobile ? 10 : 25;
  const barRows = useMemo(
    () =>
      leaderboard
        .map((player) => ({ name: player.name, net: player.profitTotal, games: player.gamesPlayed }))
        .sort((left, right) => right.net - left.net),
    [leaderboard],
  );
  const bars = trimLeaderboard(barRows, false);
  const visibleRows = showAll ? sortedLeaderboard : sortedLeaderboard.slice(0, ROW_LIMIT);
  return (
    <section data-testid="section-period-leaderboards" className="mt-4 space-y-4">
      <h1 className="sr-only">Leaderboard</h1>
      {leaderboard.length >= 3 && (
        <ChartCard
          testId="card-podium"
          eyebrow={`Net profit · ${scopeLabel}`}
          title="The net profit podium"
          description="Tap the podium for the table, or a name for their profile."
        >
          <Podium
            players={leaderboard}
            viewer={viewer}
            onOpenPlayer={onSelectPlayer}
            onOpenBoard={() => document.getElementById("profit-table")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          />
        </ChartCard>
      )}
      {afterPodium}
      {barRows.length > 0 && (
        <ChartCard
          testId="card-leaderboard-bars"
          eyebrow={`${scopeLabel} · ${earningsScopeLabel}`}
          title="Net profit at a glance"
          description={barRows.length > 20 ? "The ten biggest winners and ten biggest losers. Click a name to open their profile." : "Everyone's net profit. Click a name to open their profile."}
        >
          <LeaderboardBars
            rows={bars.rows}
            gapAfter={bars.gapAfter}
            hidden={bars.hidden}
            viewer={viewer}
            colorFor={() => null}
            onToggle={onSelectPlayer}
            actionLabel="open their profile"
          />
        </ChartCard>
      )}
      {afterOverview}
      <div id="profit-table" className="soft-shadow scroll-mt-4 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
          <div><p className="section-label">Leaderboards</p><h2 className="mt-1 text-lg font-semibold">{scopeLabel} · {earningsScopeLabel}</h2><p className="mt-1 text-xs text-muted-foreground">Player rankings and stats use the selected earnings scope and period.</p></div>
          <label className="relative flex items-center gap-2 text-xs">
            <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Sort by</span>
            <select value={sortValue} onChange={(event) => setSortValue(event.target.value)} data-testid="select-leaderboard-sort" className="h-9 appearance-none rounded-lg border border-border bg-background px-3 pr-8 text-xs font-medium outline-none focus:border-primary">
              <option value="rank:asc">Rank · current</option>
              <option value="name:asc">Player · A–Z</option>
              <option value="profitTotal:desc">Profit · highest</option>
              <option value="positiveSessionPct:desc">Games in profit · highest</option>
              <option value="netPct:desc">Return on buy-ins · highest</option>
              <option value="gamesPlayed:desc">Games · most</option>
              <option value="profitPerSession:desc">Profit per game · highest</option>
              <option value="buyInTotal:desc">Buy-ins · highest</option>
              <option value="cashOutTotal:desc">Returned · most</option>
              <option value="buyInPerGame:asc">Buy-in per game · lowest</option>
              <option value="maxWin:desc">Best game · highest</option>
              <option value="maxLoss:desc">Worst game · highest</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-muted-foreground" />
          </label>
        </div>
        {leaderboard.length ? <>
          <div className="space-y-2 p-3 sm:hidden">
            {visibleRows.map((player) => <details key={player.name} data-testid={`row-period-leaderboard-mobile-${activePeriod}-${slug(player.name)}`} className="group rounded-xl border border-border/80 bg-secondary/20">
              <summary className="flex cursor-pointer list-none items-center gap-3 p-3">
                <span className="w-8 shrink-0 font-mono text-xs text-muted-foreground">#{player.rank}</span>
                <Avatar name={player.name} size={26} />
                <span className="min-w-0 flex-1">
                  <button type="button" onClick={(event) => { event.preventDefault(); onSelectPlayer(player.name); }} className="block min-h-[36px] max-w-full truncate py-1.5 text-left text-sm font-semibold hover:text-primary hover:underline">{player.name}</button>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {player.isClubContributor && <ContributorBadge name={player.name} />}
                    <RankMovementIndicator movement={rankMovements.get(normalizePlayerName(player.name))} />
                    <FormDots dots={buildFormDots(allSessions, player.name)} />
                    <BadgeChips badges={badgesFor(badgeMap, player.name)} compact hideCommon />
                  </span>
                </span>
                <span className={`shrink-0 font-mono text-sm font-semibold ${player.profitTotal >= 0 ? "text-chart-1" : "text-destructive"}`}>{signedCurrency(player.profitTotal)}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="grid grid-cols-3 gap-2 border-t border-border/70 p-3"><MiniStat label="In profit" value={`${player.positiveSessionPct.toFixed(1)}%`} /><MiniStat label="Return" value={`${player.netPct.toFixed(1)}%`} /><MiniStat label={activityLabel} value={String(player.gamesPlayed)} /><MiniStat label={profitRateLabel} value={signedCurrency(player.profitPerSession)} /><MiniStat label="Buy-ins" value={formatCurrency(player.buyInTotal)} /><MiniStat label={returnLabel} value={formatCurrency(player.cashOutTotal)} /><MiniStat label={buyInRateLabel} value={formatCurrency(player.buyInPerGame)} /><MiniStat label="Best / worst" value={`${signedCurrency(player.maxWin)} / ${signedCurrency(player.maxLoss)}`} /></div>
            </details>)}
          </div>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-secondary/35 text-[11px] uppercase tracking-[0.12em] text-muted-foreground"><tr><th className="px-4 py-3">Player</th><th className="px-4 py-3">Profit</th><th className="px-4 py-3">In profit</th><th className="px-4 py-3">Return</th><th className="px-4 py-3">{activityLabel}</th><th className="px-4 py-3">{profitRateLabel}</th><th className="px-4 py-3">Buy-ins</th><th className="px-4 py-3">{returnLabel}</th><th className="px-4 py-3">{buyInRateLabel}</th><th className="px-4 py-3">Best / worst</th></tr></thead>
              <tbody>{visibleRows.map((player) => <tr key={player.name} data-testid={`row-period-leaderboard-${activePeriod}-${slug(player.name)}`} className="border-t border-border/70 transition-colors hover:bg-secondary/25"><td className="px-4 py-3"><span className="flex items-center gap-2 font-semibold"><span className="w-6 font-mono text-xs text-muted-foreground">#{player.rank}</span><Avatar name={player.name} size={28} /><button type="button" onClick={() => onSelectPlayer(player.name)} className="text-left hover:text-primary hover:underline">{player.name}</button>{player.isClubContributor && <ContributorBadge name={player.name} />}<RankMovementIndicator movement={rankMovements.get(normalizePlayerName(player.name))} /><FormDots dots={buildFormDots(allSessions, player.name)} className="ml-1" /><BadgeChips badges={badgesFor(badgeMap, player.name)} compact hideCommon /></span></td><td className={`px-4 py-3 font-mono font-semibold ${player.profitTotal >= 0 ? "text-chart-1" : "text-destructive"}`}>{signedCurrency(player.profitTotal)}</td><td className="px-4 py-3 font-mono">{player.positiveSessionPct.toFixed(1)}%</td><td className="px-4 py-3 font-mono">{player.netPct.toFixed(1)}%</td><td className="px-4 py-3 font-mono">{player.gamesPlayed}</td><td className={`px-4 py-3 font-mono ${player.profitPerSession >= 0 ? "text-chart-1" : "text-destructive"}`}>{signedCurrency(player.profitPerSession)}</td><td className="px-4 py-3 font-mono">{formatCurrency(player.buyInTotal)}</td><td className="px-4 py-3 font-mono">{formatCurrency(player.cashOutTotal)}</td><td className="px-4 py-3 font-mono">{formatCurrency(player.buyInPerGame)}</td><td className="px-4 py-3 whitespace-nowrap font-mono text-xs"><span className="text-chart-1">{signedCurrency(player.maxWin)}</span> <span className="text-muted-foreground">/</span> <span className="text-destructive">{signedCurrency(player.maxLoss)}</span></td></tr>)}</tbody>
            </table>
          </div>
          {sortedLeaderboard.length > ROW_LIMIT && (
            <div className="border-t border-border p-3 text-center">
              <button type="button" onClick={() => setShowAll((value) => !value)} data-testid="button-toggle-all-players" className="rounded-lg px-4 py-2 text-xs font-semibold text-primary hover:bg-secondary">
                {showAll ? `Show top ${ROW_LIMIT}` : `Show all ${sortedLeaderboard.length} players`}
              </button>
            </div>
          )}
        </> : <EmptyPanel title={`No ${earningsScopeLabel.toLowerCase()} results for ${scopeLabel}`} description="This leaderboard will populate when results are available in the selected earnings scope." />}
      </div>
    </section>
  );
}

type LeaderboardSortKey = "rank" | "name" | "profitTotal" | "positiveSessionPct" | "netPct" | "gamesPlayed" | "profitPerSession" | "buyInTotal" | "cashOutTotal" | "buyInPerGame" | "maxWin" | "maxLoss";
