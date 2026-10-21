import { useMemo } from "react";
import { Avatar } from "@/components/avatar";
import { ChartCard } from "@/components/club-charts";
import { Podium } from "@/components/podium";
import { usePoints } from "@/components/points-context";
import { usePointsSeason } from "@/components/points-season-context";
import { seasonLabel, type PointsRow } from "@/lib/points";

type PointsPodiumCardProps = {
  viewer: string;
  onOpenPlayer: (name: string) => void;
  /** Show the season picker (the leaderboard page). Home always shows the current season. */
  selectable?: boolean;
  /** Fixed season, ignoring the shared choice. Used on Home. */
  season?: string;
  eyebrow?: string;
  onSeeAll?: () => void;
  /** Also list places 4 and 5 and the viewer beneath the podium, like the profit podium. */
  withRunnersUp?: boolean;
  testId?: string;
};

/** The club points podium: sits straight after the net profit podium. */
export function PointsPodiumCard({
  viewer,
  onOpenPlayer,
  selectable = false,
  season: fixedSeason,
  eyebrow = "Club points",
  onSeeAll,
  withRunnersUp = false,
  testId = "card-points-podium",
}: PointsPodiumCardProps) {
  const shared = usePointsSeason();
  const { rowsFor } = usePoints();
  const season = fixedSeason ?? shared.season;
  const rows = useMemo(() => (fixedSeason ? rowsFor(fixedSeason) : shared.rows), [fixedSeason, rowsFor, shared.rows]);
  const noNights = !fixedSeason && !shared.hasNights;
  const viewerKey = viewer.trim().toLocaleLowerCase();
  const podiumSource = useMemo(
    () => rows.slice(0, 3).map((row) => ({ name: row.name, profitTotal: row.points, gamesPlayed: row.nights, rank: row.rank })),
    [rows],
  );
  if (noNights) {
    return (
      <ChartCard testId={testId} eyebrow={eyebrow} title="The club points podium" description="No scored nights in this period. Points start from the first night with four or more players.">
        <p className="py-6 text-center text-sm text-muted-foreground">Choose another period or All time.</p>
      </ChartCard>
    );
  }
  if (rows.length < 3) return null;

  const rest = rows.slice(3, 5);
  const mine: PointsRow | undefined = rows.find((row) => row.key === viewerKey);

  return (
    <ChartCard
      testId={testId}
      eyebrow={`${eyebrow} · ${seasonLabel(season)}`}
      title="The club points podium"
      description={selectable ? "Follows the filters above. Tap the podium for the table, or a name for their profile." : undefined}
      action={
        <div className="flex flex-wrap items-center gap-2">
          {onSeeAll && (
            <button type="button" onClick={onSeeAll} className="inline-flex min-h-[44px] items-center self-start whitespace-nowrap text-xs font-semibold text-primary hover:underline sm:self-auto">
              Full points table →
            </button>
          )}
        </div>
      }
    >
      <Podium
        players={podiumSource}
        viewer={viewer}
        onOpenPlayer={onOpenPlayer}
        formatValue={(value) => `${Math.round(value)} pts`}
        // Home links to the points table page; on the leaderboard page the table is just below.
        onOpenBoard={onSeeAll ?? (() => document.getElementById("club-points")?.scrollIntoView({ behavior: "smooth", block: "start" }))}
      />
      {withRunnersUp && (
        <ul className="mt-5 divide-y divide-border/60">
          {rest.map((row) => (
            <li key={row.key}>
              <button type="button" onClick={() => onOpenPlayer(row.name)} className="flex w-full items-center gap-3 px-1 py-2.5 text-left text-sm hover:bg-secondary/40">
                <span className="w-6 text-center font-mono text-xs text-muted-foreground">{row.rank}</span>
                <Avatar name={row.name} size={26} />
                <span className="min-w-0 flex-1 truncate font-semibold">
                  {row.name}
                  {row.key === viewerKey && <span className="ml-1.5 text-[11px] uppercase tracking-[0.08em] text-primary">you</span>}
                </span>
                <span className="font-mono text-xs font-semibold">{Math.round(row.points)} pts</span>
              </button>
            </li>
          ))}
          {mine && mine.rank > 5 && (
            <li>
              <button type="button" onClick={() => onOpenPlayer(mine.name)} className="flex w-full items-center gap-3 rounded-lg bg-primary/[0.07] px-1 py-2.5 text-left text-sm">
                <span className="w-6 text-center font-mono text-xs text-muted-foreground">{mine.rank}</span>
                <Avatar name={mine.name} size={26} />
                <span className="min-w-0 flex-1 truncate font-semibold">{mine.name}<span className="ml-1.5 text-[11px] uppercase tracking-[0.08em] text-primary">you</span></span>
                <span className="font-mono text-xs font-semibold">{Math.round(mine.points)} pts</span>
              </button>
            </li>
          )}
        </ul>
      )}
    </ChartCard>
  );
}
