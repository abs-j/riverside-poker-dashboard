import { useMemo, useState } from "react";
import { HelpCircle, Image as ImageIcon } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { ChartCard } from "@/components/club-charts";
import { usePointsSeason } from "@/components/points-season-context";
import { usePoints } from "@/components/points-context";
import { RecapStudio } from "@/components/recap-studio";
import { POINTS_RULES, pointsExamples, seasonLabel, type PointsRow } from "@/lib/points";
import { buildStandingsRecap } from "@/lib/recaps";
import { EmptyPanel, formatDate, signedCurrency } from "./shared";

type PointsLeaderboardProps = {
  viewer: string;
  onOpenPlayer: (name: string) => void;
};

function Trend({ values }: { values: number[] }) {
  if (values.length === 0) return null;
  const max = Math.max(...values, 1);
  return (
    <span className="inline-flex h-5 items-end gap-0.5" role="img" aria-label={`Points over the last ${values.length} nights: ${values.join(", ")}`}>
      {values.map((value, index) => (
        <span key={index} className="w-1.5 rounded-sm bg-primary/70" style={{ height: `${Math.max(12, (value / max) * 100)}%` }} />
      ))}
    </span>
  );
}

function HowItWorks() {
  const examples = useMemo(() => pointsExamples(), []);
  const r = POINTS_RULES;
  return (
    <div data-testid="panel-points-rules" className="mt-4 space-y-4 rounded-xl border border-border bg-secondary/25 p-4 text-sm">
      <p className="leading-6">
        Every night you play earns points for <strong>turning up</strong> and for <strong>where you finished</strong>, and the
        bigger the table, the more a good finish is worth. Winning earns a big bonus. Money spent doesn&apos;t matter, only your
        finish, so rebuying more never earns more.
      </p>
      <ul className="grid gap-2 sm:grid-cols-2">
        <li><strong>Turn up:</strong> {r.turnUp.cash} points per cash night, {r.turnUp.tournament} per tournament.</li>
        <li><strong>Finish:</strong> up to {r.placementMax} points, from last place (0) to first (full), scaled to the table size.</li>
        <li><strong>Win:</strong> +{r.win.flat} plus 1 per player, for first place in profit ({r.win.minPlayers}+ players).</li>
        <li><strong>Podium:</strong> 2nd +{r.podium.second}, 3rd +{r.podium.third} ({r.podium.minPlayers}+ players).</li>
        <li><strong>In profit:</strong> +{r.inProfit}.</li>
        <li><strong>Tournament knockouts:</strong> +{r.perKnockout} each.</li>
      </ul>
      <p className="text-xs text-muted-foreground">
        A 12-player night counts as normal. Bigger nights count up to {r.size.max}× and smaller ones down to {r.size.min}×. Nights with
        fewer than {r.minPlayersToCount} players aren&apos;t scored. Ties share a place. Equal points are split by wins, then nights
        played, then net profit.
      </p>
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Examples</p>
        <ul className="divide-y divide-border/70">
          {examples.map((example) => (
            <li key={example.label} className="flex items-center justify-between gap-3 py-1.5">
              <span>{example.label}</span>
              <span className="font-mono font-semibold">{example.points}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Club points: the season table that rewards turning up and winning. */
export function PointsLeaderboard({ viewer, onOpenPlayer }: PointsLeaderboardProps) {
  const { season: active, seasons, rows, hasNights } = usePointsSeason();
  const { firstNight } = usePoints();
  const [showRules, setShowRules] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);

  const viewerKey = viewer.trim().toLocaleLowerCase();
  const visible = showAll ? rows : rows.slice(0, 15);
  const nightsCounted = useMemo(() => rows.reduce((max, row) => Math.max(max, row.nights), 0), [rows]);
  const sharePack = useMemo(
    () =>
      imageOpen
        ? buildStandingsRecap({
            id: `points-${active}`,
            eyebrow: "Club points",
            title: `${seasonLabel(active)} standings`,
            subtitle: `${rows.length} players · ${nightsCounted} nights counted`,
            dateLabel: seasonLabel(active),
            rows: rows.slice(0, 8).map((row) => ({
              name: row.name,
              value: `${Math.round(row.points)} pts`,
              sub: `${row.wins} ${row.wins === 1 ? "win" : "wins"} · ${row.nights} ${row.nights === 1 ? "night" : "nights"}`,
            })),
          })
        : null,
    [imageOpen, rows, active, nightsCounted],
  );

  if (!hasNights) {
    return <EmptyPanel title="No scored nights in this period" description="Club points count nights with at least four players. Choose another period or All time." />;
  }
  if (seasons.length === 0) {
    return <EmptyPanel title="No scored nights yet" description="Club points appear once a night with at least four players has been recorded." />;
  }

  return (
    <section data-testid="section-points-leaderboard" className="space-y-4">
      <ChartCard
        testId="card-points-header"
        eyebrow="Club points"
        title={`${seasonLabel(active)} points table`}
        description={`Points for turning up and for where you finished, scaled to how many played. ${rows.length} players have a scored night here${firstNight ? `, and scoring starts on ${formatDate(firstNight)}, so it lists fewer people than the profit table` : ""}.`}
        action={
          <button
            type="button"
            onClick={() => setImageOpen(true)}
            data-testid="button-share-points"
            className="inline-flex h-10 items-center gap-2 self-start rounded-lg border border-border bg-background px-3 text-xs font-semibold hover:bg-secondary"
          >
            <ImageIcon className="h-3.5 w-3.5" />
            Share
          </button>
        }
      >
        <button
          type="button"
          onClick={() => setShowRules((value) => !value)}
          aria-expanded={showRules}
          data-testid="button-points-how"
          className="inline-flex min-h-[44px] items-center gap-2 text-xs font-semibold text-primary hover:underline"
        >
          <HelpCircle className="h-4 w-4" aria-hidden="true" />
          How points work
        </button>
        {showRules && <HowItWorks />}
      </ChartCard>

      <div className="soft-shadow overflow-hidden rounded-2xl border border-border bg-card">
        <ol data-testid="list-points" className="divide-y divide-border/70">
          {visible.map((row: PointsRow) => {
            const isMe = row.key === viewerKey;
            return (
              <li key={row.key} className={`relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/40 ${isMe ? "bg-primary/[0.07]" : ""}`}>
                <span className="w-7 shrink-0 text-center font-mono text-xs text-muted-foreground">{row.rank}</span>
                <Avatar name={row.name} size={32} />
                <div className="min-w-0 flex-1">
                  <button type="button" onClick={() => onOpenPlayer(row.name)} className="block max-w-full truncate py-0.5 text-left text-sm font-semibold hover:text-primary hover:underline after:absolute after:inset-0 after:content-['']">
                    {row.name}
                    {isMe && <span className="ml-1.5 text-[11px] uppercase tracking-[0.08em] text-primary">you</span>}
                    {row.provisional && (
                      <span className="ml-2 rounded-md bg-secondary px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground" title="Fewer than 3 nights so far">
                        Provisional
                      </span>
                    )}
                  </button>
                  <p className="text-[11px] leading-4 text-muted-foreground">
                    {row.nights} {row.nights === 1 ? "night" : "nights"}
                    {row.tournaments > 0 ? ` (${row.tournaments} tournament${row.tournaments === 1 ? "" : "s"})` : ""}
                    {" · "}{row.wins} {row.wins === 1 ? "win" : "wins"} · {row.pointsPerNight} per night · net {signedCurrency(row.net)}
                  </p>
                </div>
                <span className="hidden sm:inline-flex"><Trend values={row.recent} /></span>
                <span className="w-16 shrink-0 text-right font-mono text-base font-semibold">{Math.round(row.points)}</span>
              </li>
            );
          })}
        </ol>
        {rows.length > 15 && (
          <div className="border-t border-border p-3 text-center">
            <button type="button" onClick={() => setShowAll((value) => !value)} className="rounded-lg px-4 py-2 text-xs font-semibold text-primary hover:bg-secondary">
              {showAll ? "Show top 15" : `Show all ${rows.length} players`}
            </button>
          </div>
        )}
      </div>

      <RecapStudio open={imageOpen} onOpenChange={setImageOpen} pack={sharePack} />
    </section>
  );
}
