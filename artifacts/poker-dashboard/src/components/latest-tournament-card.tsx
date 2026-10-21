import { useMemo, useState } from "react";
import { Crown, Images, Swords } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { ChartCard } from "@/components/club-charts";
import type { TournamentEvent } from "@/lib/earnings-analytics";
import { RecapStudio } from "@/components/recap-studio";
import { usePoints } from "@/components/points-context";
import { quarterOf, seasonLabel } from "@/lib/points";
import { tournamentRecapFromEvent } from "@/lib/recaps";
import { ordinal } from "@/lib/share-card";
import { nameKey, rulesSummary } from "@/lib/tournaments";
import { formatCurrency, formatDate, signedCurrency } from "@/views/shared";

type LatestTournamentCardProps = {
  event: TournamentEvent;
  viewer: string;
  totalEvents: number;
  onOpen: () => void;
  onSeeAll: () => void;
};

/** Home: the most recent tournament at a glance, with the viewer's own result. */
export function LatestTournamentCard({ event, viewer, totalEvents, onOpen, onSeeAll }: LatestTournamentCardProps) {
  const mine = event.results.find((result) => nameKey(result.player) === nameKey(viewer));
  const { afterNight } = usePoints();
  const [recapOpen, setRecapOpen] = useState(false);
  const recapPack = useMemo(
    () =>
      recapOpen
        ? tournamentRecapFromEvent(event, {
            pointsAfter: afterNight({ date: event.date, tournamentId: event.id }),
            seasonName: seasonLabel(quarterOf(event.date)),
          })
        : null,
    [recapOpen, event, afterNight],
  );
  const podium = [
    { place: 1, name: event.winner, prize: event.winnerPrize },
    { place: 2, name: event.runnerUp, prize: event.results.find((r) => r.finishPlace === 2)?.mainPrize ?? 0 },
    { place: 3, name: event.thirdPlace, prize: event.results.find((r) => r.finishPlace === 3)?.mainPrize ?? 0 },
  ].filter((row): row is { place: number; name: string; prize: number } => Boolean(row.name));

  return (
    <ChartCard
      testId="card-latest-tournament"
      eyebrow={`Latest tournament · ${formatDate(event.date)}`}
      title={`${event.winner ?? "Tournament"} took it down`}
      description={`${event.players} players, ${event.entries} entries, ${formatCurrency(event.mainPrizePool)} in prizes. ${rulesSummary(event)}.`}
      action={
        totalEvents > 1 ? (
          <button type="button" onClick={onSeeAll} className="inline-flex min-h-[44px] items-center self-start whitespace-nowrap text-xs font-semibold text-primary hover:underline sm:self-auto">
            All {totalEvents} tournaments →
          </button>
        ) : undefined
      }
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <ol className="space-y-2">
          {podium.map((row) => (
            <li key={row.place} className="flex items-center gap-3 rounded-xl bg-secondary/40 px-3 py-2.5">
              <span className="w-5 text-center font-mono text-xs text-muted-foreground">{row.place}</span>
              <Avatar name={row.name} size={32} />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{row.name}</span>
              {row.place === 1 && <Crown className="h-4 w-4 text-amber-500" aria-hidden="true" />}
              <span className="font-mono text-sm font-semibold">{formatCurrency(row.prize)}</span>
            </li>
          ))}
        </ol>
        <div className="flex flex-col justify-between gap-3 rounded-xl border border-border p-4">
          {mine ? (
            <div data-testid="text-latest-tournament-mine">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Your result</p>
              <p className={`mt-1.5 font-mono text-xl font-semibold ${mine.netProfit >= 0 ? "text-chart-1" : "text-destructive"}`}>{signedCurrency(mine.netProfit)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {mine.finishPlace ? `${ordinal(mine.finishPlace)} of ${event.players}` : "Finish not recorded"}
                {mine.knockouts > 0 ? ` · ${mine.knockouts} ${mine.knockouts === 1 ? "knockout" : "knockouts"}` : ""}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Your result</p>
              <p className="mt-1.5 text-sm text-muted-foreground">You didn&apos;t play this one.</p>
            </div>
          )}
          {event.topBountyHunter && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Swords className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              Top bounty hunter: <strong className="text-foreground">{event.topBountyHunter}</strong> ({event.mostKnockouts})
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onOpen}
              data-testid="button-open-latest-tournament"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:opacity-90"
            >
              Full results
            </button>
            <button
              type="button"
              onClick={() => setRecapOpen(true)}
              data-testid="button-recap-latest-tournament"
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-semibold hover:bg-secondary"
            >
              <Images className="h-3.5 w-3.5" aria-hidden="true" />
              Recap
            </button>
          </div>
        </div>
      </div>
      {recapPack && <RecapStudio open={recapOpen} onOpenChange={setRecapOpen} pack={recapPack} />}
    </ChartCard>
  );
}
