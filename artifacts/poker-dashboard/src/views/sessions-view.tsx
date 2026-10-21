import { useMemo, useState } from "react";
import { type PerformanceScope, type DashboardSession as Session } from "@/lib/earnings-analytics";
import { ArrowDown, ChevronDown, Image as ImageIcon, Trophy } from "lucide-react";
import { RecapStudio } from "@/components/recap-studio";
import { usePoints } from "@/components/points-context";
import { buildCashRecap } from "@/lib/recaps";
import { quarterOf, seasonLabel } from "@/lib/points";
import { EmptyPanel, PageIntro, formatCurrency, formatDate, monthLabel, signedCurrency, slug } from "./shared";

type SessionsViewProps = {
  sessions: Session[];
  scope: PerformanceScope;
  selectedSession: number | null;
  onSelectSession: (number: number | null) => void;
  onOpenPlayer: (name: string) => void;
  /** Games supplies its own page heading. */
  hideIntro?: boolean;
};

function SummaryTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="soft-shadow rounded-2xl border border-border bg-card p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-mono text-xl font-semibold">{value}</p>
      {detail && <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>}
    </div>
  );
}

export function SessionsView({ sessions, scope, selectedSession, onSelectSession, onOpenPlayer, hideIntro = false }: SessionsViewProps) {
  const sorted = useMemo(
    () => sessions.slice().sort((a, b) => b.date.localeCompare(a.date) || b.sessionNumber - a.sessionNumber),
    [sessions],
  );

  const summary = useMemo(() => {
    if (!sessions.length) return null;
    const totalPot = sessions.reduce((sum, session) => sum + session.totalBuyIn, 0);
    const players = sessions.reduce((sum, session) => sum + session.playerCount, 0);
    const biggest = sessions.reduce((best, session) => (session.totalBuyIn > best.totalBuyIn ? session : best), sessions[0]);
    return {
      totalPot,
      averagePot: totalPot / sessions.length,
      averagePlayers: players / sessions.length,
      biggest,
    };
  }, [sessions]);

  return (
    <section data-testid="section-sessions" className="space-y-4">
      {!hideIntro && (
        <PageIntro
          eyebrow="Games"
          title="Every game, in context"
          description={scope === "cash" ? "The pot, winner and every player's result for each cash game." : "The pot, winner and every player's result for each cash game and tournament."}
          count={`${sessions.length} in view`}
        />
      )}

      {summary && (
        <div data-testid="summary-games" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryTile label="Games" value={String(sessions.length)} detail={`${formatCurrency(summary.totalPot)} in total buy-ins`} />
          <SummaryTile label="Average pot" value={formatCurrency(summary.averagePot)} detail="Buy-ins per game" />
          <SummaryTile label="At the table" value={summary.averagePlayers.toFixed(1)} detail="Players per game, on average" />
          <SummaryTile label="Biggest pot" value={formatCurrency(summary.biggest.totalBuyIn)} detail={formatDate(summary.biggest.date)} />
        </div>
      )}

      {sorted.length > 0 ? (
        <div data-testid="grid-session-cards" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((session, index) => (
            <div
              key={`${session.eventType ?? "cash"}-${session.sessionNumber}`}
              id={`game-${session.sessionNumber}`}
              className="stagger-item scroll-mt-24"
              style={{ "--i": Math.min(index, 14) } as React.CSSProperties}
            >
              <SessionCard
                session={session}
                expanded={selectedSession === session.sessionNumber}
                onToggle={() => onSelectSession(selectedSession === session.sessionNumber ? null : session.sessionNumber)}
                onOpenPlayer={onOpenPlayer}
              />
            </div>
          ))}
        </div>
      ) : (
        <EmptyPanel title="No games in this selection" description="Try another month or quarter, or switch the scope above." />
      )}
    </section>
  );
}

export function SessionCard({ session, expanded, onToggle, onOpenPlayer }: { session: Session; expanded: boolean; onToggle: () => void; onOpenPlayer: (name: string) => void }) {
  const isTournament = session.eventType === "tournament";
  const [imageOpen, setImageOpen] = useState(false);
  const { afterNight } = usePoints();
  const recapPack = useMemo(
    () =>
      expanded || imageOpen
        ? buildCashRecap({
            date: session.date,
            sessionNumber: session.sessionNumber,
            totalBuyIn: session.totalBuyIn,
            players: session.players.map((player) => ({ player: player.player, buyIn: player.buyIn, cashOut: player.cashOut, net: player.net })),
            pointsAfter: afterNight({ date: session.date, sessionNumber: session.sessionNumber }),
            seasonName: seasonLabel(quarterOf(session.date)),
          })
        : null,
    [expanded, imageOpen, session, afterNight],
  );
  return <article data-testid={`card-session-${session.sessionNumber}`} className={`group soft-shadow overflow-hidden rounded-2xl border bg-card transition-all duration-200 hover:-translate-y-1 hover:shadow-xl ${expanded ? "border-primary/60" : "border-border hover:border-primary/35"}`}>
    <button onClick={onToggle} aria-expanded={expanded} data-testid={`button-expand-session-${session.sessionNumber}`} className="w-full text-left">
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 rounded-md bg-accent/25 px-1.5 py-1 font-mono text-[11px] font-semibold text-accent-foreground">{monthLabel(session.month)}</span>
          {isTournament && <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-1 text-[11px] font-semibold text-primary">Tournament</span>}
          <span className="truncate text-sm font-semibold">{formatDate(session.date)}</span>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-sm font-semibold">{formatCurrency(session.totalBuyIn)}</p>
          <p className="text-[11px] text-muted-foreground">{session.playerCount} players · {isTournament ? "invested" : "pot"}</p>
        </div>
      </div>
      {isTournament && <div data-testid={`session-tournament-summary-${session.sessionNumber}`} className="flex items-center justify-between gap-3 border-b border-border/70 bg-secondary/15 px-4 py-2.5 text-xs">
        <span className="text-muted-foreground">Returned <strong className="ml-1 font-mono font-semibold text-foreground">{formatCurrency(session.totalCashOut)}</strong></span>
        <span className="text-muted-foreground">Field net <strong className={`ml-1 font-mono font-semibold ${session.totalNet >= 0 ? "text-chart-1" : "text-destructive"}`}>{signedCurrency(session.totalNet)}</strong></span>
      </div>}
      <div className="grid grid-cols-2 divide-x divide-border/70 px-4 py-4">
        <div className="min-w-0 pr-4" data-testid={`session-winner-${session.sessionNumber}`}>
          <p className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] ${isTournament ? "text-primary" : "text-chart-1"}`}><Trophy className="h-3.5 w-3.5" />{isTournament ? "Top net" : "Winner"}</p>
          <p className="mt-2 truncate text-sm font-semibold">{session.winner ?? "—"}</p>
          <p className={`mt-1 font-mono text-sm font-semibold ${session.winnerProfit >= 0 ? "text-chart-1" : "text-destructive"}`}>{session.winner ? signedCurrency(session.winnerProfit) : "—"}</p>
        </div>
        <div className="min-w-0 pl-4" data-testid={`session-low-${session.sessionNumber}`}>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary"><ArrowDown className="h-3.5 w-3.5" />{isTournament ? "Lowest net" : "Low"}</p>
          <p className="mt-2 truncate text-sm font-semibold">{session.lowPlayer ?? "—"}</p>
          <p className={`mt-1 font-mono text-sm font-semibold ${session.lowProfit >= 0 ? "text-chart-1" : "text-destructive"}`}>{session.lowPlayer ? signedCurrency(session.lowProfit) : "—"}</p>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-border/70 bg-secondary/20 px-4 py-3 text-xs">
        <span className="text-muted-foreground">{isTournament ? "Tournament" : `Game #${session.sessionNumber}`}</span>
        <span className="inline-flex items-center gap-1 font-semibold text-muted-foreground">Player results<ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} /></span>
      </div>
    </button>
    {expanded && (
      <div data-testid={`panel-session-details-${session.sessionNumber}`} className="border-t border-border px-4 py-3">
        <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          <span>Player</span>
          <span>{isTournament ? "Buy-in · payout · net" : "Buy-in · net"}</span>
        </div>
        <div className="max-h-64 space-y-1 overflow-auto">
          {session.players.slice().sort((a, b) => b.net - a.net).map((player) => (
            <div key={player.player} data-testid={`row-session-player-${session.sessionNumber}-${slug(player.player)}`} className="flex items-center gap-2 border-t border-border/50 py-2 text-xs">
              <button type="button" onClick={() => onOpenPlayer(player.player)} className="min-w-0 flex-1 truncate text-left font-medium hover:text-primary hover:underline">{player.player}</button>
              <span className="font-mono text-muted-foreground">{formatCurrency(player.buyIn)}</span>
              {isTournament && <span className="font-mono text-muted-foreground">{formatCurrency(player.cashOut)}</span>}
              <span className={`w-16 text-right font-mono ${player.net >= 0 ? "text-chart-1" : "text-destructive"}`}>{signedCurrency(player.net)}</span>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setImageOpen(true)}
          data-testid={`button-share-night-${session.sessionNumber}`}
          className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-border bg-background text-xs font-semibold hover:bg-secondary"
        >
          <ImageIcon className="h-3.5 w-3.5" />
          Instagram recap
        </button>
      </div>
    )}
    {recapPack && <RecapStudio open={imageOpen} onOpenChange={setImageOpen} pack={recapPack} />}
  </article>;
}
