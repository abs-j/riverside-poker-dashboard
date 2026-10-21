import { useMemo, useState } from "react";
import { ArrowLeft, Crown, Image as ImageIcon, Swords, Trophy } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { RecapStudio } from "@/components/recap-studio";
import { usePoints } from "@/components/points-context";
import type { TournamentEvent, TournamentResultRow } from "@/lib/earnings-analytics";
import { quarterOf, seasonLabel } from "@/lib/points";
import { tournamentRecapFromEvent } from "@/lib/recaps";
import { ordinal } from "@/lib/share-card";
import {
  dataCheckPasses,
  hasFullOrder,
  knockoutLeaders,
  nameKey,
  payoutRows,
  rulesSummary,
  tournamentLeaderboard,
  tournamentTotals,
} from "@/lib/tournaments";
import { EmptyPanel, formatCurrency, formatDate, signedCurrency, slug } from "./shared";

type TournamentsViewProps = {
  tournaments: TournamentEvent[];
  viewer: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onOpenPlayer: (name: string) => void;
};

function Tile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="soft-shadow rounded-2xl border border-border bg-card p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-mono text-xl font-semibold">{value}</p>
      {detail && <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>}
    </div>
  );
}

const PLACE_STYLE: Record<number, string> = {
  1: "bg-amber-400/90 text-amber-950",
  2: "bg-slate-300 text-slate-900",
  3: "bg-orange-400/90 text-orange-950",
};

function PlaceBadge({ place }: { place: number | null }) {
  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold ${
        place !== null && PLACE_STYLE[place] ? PLACE_STYLE[place] : "bg-secondary text-muted-foreground"
      }`}
    >
      {place ?? "–"}
    </span>
  );
}

function resultDetail(result: TournamentResultRow): string {
  const parts = [`${result.entries} ${result.entries === 1 ? "entry" : "entries"}`];
  if (result.knockouts > 0) parts.push(`${result.knockouts} ${result.knockouts === 1 ? "knockout" : "knockouts"}`);
  if (result.mainPrize > 0) parts.push(`prize ${formatCurrency(result.mainPrize)}`);
  if (result.bountiesWon > 0) parts.push(`bounties ${formatCurrency(result.bountiesWon)}`);
  if (result.eliminatedBy) parts.push(`out to ${result.eliminatedBy}`);
  return parts.join(" · ");
}

function ResultsList({ event, viewer, onOpenPlayer }: { event: TournamentEvent; viewer: string; onOpenPlayer: (name: string) => void }) {
  const viewerKey = nameKey(viewer);
  return (
    <ol data-testid="list-tournament-results" className="divide-y divide-border/70">
      {event.results.map((result, index) => {
        const isMe = nameKey(result.player) === viewerKey;
        return (
          <li key={`${result.player}-${index}`} className={`flex items-center gap-3 py-2.5 ${isMe ? "-mx-2 rounded-xl bg-primary/[0.07] px-2" : ""}`}>
            <PlaceBadge place={result.finishPlace} />
            <Avatar name={result.player} size={30} />
            <div className="min-w-0 flex-1">
              <button type="button" onClick={() => onOpenPlayer(result.player)} className="block max-w-full truncate py-0.5 text-left text-sm font-semibold hover:text-primary hover:underline">
                {result.player}
                {isMe && <span className="ml-1.5 text-[11px] uppercase tracking-[0.08em] text-primary">you</span>}
              </button>
              <p className="truncate text-[11px] text-muted-foreground">{resultDetail(result)}</p>
            </div>
            <span className={`shrink-0 font-mono text-sm font-semibold ${result.netProfit >= 0 ? "text-chart-1" : "text-destructive"}`}>
              {signedCurrency(result.netProfit)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function TournamentDetail({ event, viewer, onBack, onOpenPlayer }: { event: TournamentEvent; viewer: string; onBack: () => void; onOpenPlayer: (name: string) => void }) {
  const [imageOpen, setImageOpen] = useState(false);
  const payouts = useMemo(() => payoutRows(event), [event]);
  const hunters = useMemo(() => knockoutLeaders(event), [event]);
  const fullOrder = hasFullOrder(event);
  const { afterNight } = usePoints();
  const recapPack = useMemo(
    () =>
      tournamentRecapFromEvent(event, {
        pointsAfter: afterNight({ date: event.date, tournamentId: event.id }),
        seasonName: seasonLabel(quarterOf(event.date)),
      }),
    [event, afterNight],
  );

  return (
    <section data-testid="section-tournament-detail" className="space-y-4">
      <button type="button" onClick={onBack} className="inline-flex min-h-[44px] items-center gap-2 text-xs font-semibold text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        All tournaments
      </button>

      <div className="soft-shadow rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="section-label text-primary">Tournament</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">{formatDate(event.date)}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{event.title}{event.format ? ` · ${event.format}` : ""}{event.startTime ? ` · ${event.startTime}` : ""}</p>
            <p className="mt-2 text-xs text-muted-foreground">{rulesSummary(event)}</p>
          </div>
          <button
            type="button"
            onClick={() => setImageOpen(true)}
            data-testid="button-share-tournament"
            className="inline-flex h-10 shrink-0 items-center gap-2 self-start rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:opacity-90"
          >
            <ImageIcon className="h-3.5 w-3.5" />
            Instagram recap
          </button>
        </div>
        {!dataCheckPasses(event) && (
          <p role="status" className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
            The sheet flagged this event: {event.dataCheck}. Some figures may not add up yet.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile label="Players" value={String(event.players)} detail={`${event.entries} entries`} />
        <Tile label="Prize pool" value={formatCurrency(event.mainPrizePool)} detail="Main prizes" />
        <Tile label="Bounties" value={formatCurrency(event.bountyPool)} detail={event.bountyBasis ? event.bountyBasis : "Bounty pool"} />
        <Tile label="Knockouts" value={String(event.knockouts)} detail={event.topBountyHunter ? `Most: ${event.topBountyHunter} (${event.mostKnockouts})` : undefined} />
        <Tile label="Collected" value={formatCurrency(event.totalCollected)} detail={`${event.rebuys} rebuys · ${event.topUps} top-ups`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="soft-shadow rounded-2xl border border-border bg-card p-5 sm:p-6">
          <p className="section-label text-primary">Results</p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight">How everyone finished</h3>
          {!fullOrder && (
            <p className="mt-1 text-xs text-muted-foreground">
              The finishing order was only recorded for the places that were paid. Everyone else is listed by result.
            </p>
          )}
          <div className="mt-3">
            <ResultsList event={event} viewer={viewer} onOpenPlayer={onOpenPlayer} />
          </div>
        </div>

        <div className="space-y-4">
          <div className="soft-shadow rounded-2xl border border-border bg-card p-5 sm:p-6" data-testid="card-tournament-payouts">
            <p className="section-label text-primary">Prizes</p>
            <h3 className="mt-1 flex items-center gap-2 text-lg font-semibold tracking-tight"><Trophy className="h-4 w-4 text-amber-500" aria-hidden="true" />Payouts</h3>
            <ul className="mt-3 divide-y divide-border/70">
              {payouts.map((row) => (
                <li key={row.place} className="flex items-center gap-3 py-2.5 text-sm">
                  <PlaceBadge place={row.place} />
                  <span className="min-w-0 flex-1 truncate font-medium">{row.player ?? "—"}</span>
                  <span className="text-[11px] text-muted-foreground">{row.share.toFixed(1)}%</span>
                  <span className="w-20 text-right font-mono font-semibold">{formatCurrency(row.prize)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-muted-foreground">Main prize pool {formatCurrency(event.mainPrizePool)}. Bounties are paid separately.</p>
          </div>

          {hunters.length > 0 && (
            <div className="soft-shadow rounded-2xl border border-border bg-card p-5 sm:p-6" data-testid="card-tournament-hunters">
              <p className="section-label text-primary">Knockouts</p>
              <h3 className="mt-1 flex items-center gap-2 text-lg font-semibold tracking-tight"><Swords className="h-4 w-4 text-primary" aria-hidden="true" />Bounty hunters</h3>
              <ul className="mt-3 space-y-2">
                {hunters.map((hunter) => (
                  <li key={hunter.player} className="flex items-center gap-3 text-sm">
                    <Avatar name={hunter.player} size={26} />
                    <span className="min-w-0 flex-1 truncate font-medium">{hunter.player}</span>
                    <span className="font-mono text-xs text-muted-foreground">{formatCurrency(hunter.bounties)}</span>
                    <span className="w-8 text-right font-mono font-semibold">{hunter.knockouts}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {event.notes && (
            <p className="rounded-2xl border border-dashed border-border px-4 py-3 text-xs leading-5 text-muted-foreground">{event.notes}</p>
          )}
        </div>
      </div>

      <RecapStudio open={imageOpen} onOpenChange={setImageOpen} pack={recapPack} />
    </section>
  );
}

export function TournamentCard({ event, viewer, onOpen }: { event: TournamentEvent; viewer: string; onOpen: () => void }) {
  const mine = event.results.find((result) => nameKey(result.player) === nameKey(viewer));
  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid={`card-tournament-${slug(event.id)}`}
      className="group soft-shadow w-full overflow-hidden rounded-2xl border border-border bg-card text-left transition-all duration-200 hover:-translate-y-1 hover:border-primary/35 hover:shadow-xl"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{formatDate(event.date)}</p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{event.format || event.title}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-sm font-semibold">{formatCurrency(event.mainPrizePool)}</p>
          <p className="text-[11px] text-muted-foreground">{event.players} players · {event.entries} entries</p>
        </div>
      </div>
      <ol className="space-y-1.5 px-4 py-3">
        {[
          { place: 1, name: event.winner },
          { place: 2, name: event.runnerUp },
          { place: 3, name: event.thirdPlace },
        ]
          .filter((row) => row.name)
          .map((row) => (
            <li key={row.place} className="flex items-center gap-2.5 text-sm">
              <PlaceBadge place={row.place} />
              <Avatar name={row.name!} size={24} />
              <span className="min-w-0 flex-1 truncate font-medium">{row.name}</span>
              {row.place === 1 && <Crown className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />}
            </li>
          ))}
      </ol>
      <div className="flex items-center justify-between gap-3 border-t border-border/70 bg-secondary/20 px-4 py-2.5 text-xs">
        <span className="text-muted-foreground">
          {event.knockouts} knockouts{event.topBountyHunter ? ` · top: ${event.topBountyHunter}` : ""}
        </span>
        {mine ? (
          <span className={`font-mono font-semibold ${mine.netProfit >= 0 ? "text-chart-1" : "text-destructive"}`}>
            You {mine.finishPlace ? `${ordinal(mine.finishPlace)} · ` : ""}
            {signedCurrency(mine.netProfit)}
          </span>
        ) : (
          <span className="font-semibold text-primary">Open →</span>
        )}
      </div>
    </button>
  );
}

export function TournamentsView({ tournaments, viewer, selectedId, onSelect, onOpenPlayer }: TournamentsViewProps) {
  const totals = useMemo(() => tournamentTotals(tournaments), [tournaments]);
  const board = useMemo(() => tournamentLeaderboard(tournaments).slice(0, 10), [tournaments]);
  const selected = selectedId ? tournaments.find((event) => event.id === selectedId) ?? null : null;

  if (selected) {
    return <TournamentDetail event={selected} viewer={viewer} onBack={() => onSelect(null)} onOpenPlayer={onOpenPlayer} />;
  }
  if (tournaments.length === 0) {
    return <EmptyPanel title="No tournaments in this selection" description="Try another month or quarter, or choose All time." />;
  }

  return (
    <section data-testid="section-tournaments" className="space-y-4">
      <div data-testid="summary-tournaments" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Tournaments" value={String(totals.events)} detail={`${totals.uniquePlayers} different players`} />
        <Tile label="Prize pools" value={formatCurrency(totals.prizePool)} detail={`Plus ${formatCurrency(totals.bountyPool)} in bounties`} />
        <Tile label="Entries" value={String(totals.entries)} detail="Including rebuys and top-ups" />
        <Tile label="Knockouts" value={String(totals.knockouts)} detail={`Biggest field: ${totals.biggestField}`} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tournaments.map((event) => (
          <TournamentCard key={event.id} event={event} viewer={viewer} onOpen={() => onSelect(event.id)} />
        ))}
      </div>

      {board.length > 0 && (
        <div className="soft-shadow rounded-2xl border border-border bg-card p-5 sm:p-6" data-testid="card-tournament-leaderboard">
          <p className="section-label text-primary">All tournaments</p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight">Tournament table</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">Player</th>
                  <th className="px-3 py-2">Played</th>
                  <th className="px-3 py-2">Wins</th>
                  <th className="px-3 py-2">In the money</th>
                  <th className="px-3 py-2">Knockouts</th>
                  <th className="px-3 py-2">ROI</th>
                  <th className="py-2 pl-3 text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {board.map((record) => (
                  <tr key={record.player} className="border-t border-border/70">
                    <td className="py-2 pr-3">
                      <button type="button" onClick={() => onOpenPlayer(record.player)} className="flex items-center gap-2 font-semibold hover:text-primary hover:underline">
                        <Avatar name={record.player} size={24} />
                        {record.player}
                      </button>
                    </td>
                    <td className="px-3 py-2 font-mono">{record.played}</td>
                    <td className="px-3 py-2 font-mono">{record.wins}</td>
                    <td className="px-3 py-2 font-mono">{record.inTheMoney}</td>
                    <td className="px-3 py-2 font-mono">{record.knockouts}</td>
                    <td className="px-3 py-2 font-mono">{record.roi === null ? "—" : `${Math.round(record.roi)}%`}</td>
                    <td className={`py-2 pl-3 text-right font-mono font-semibold ${record.net >= 0 ? "text-chart-1" : "text-destructive"}`}>{signedCurrency(record.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
