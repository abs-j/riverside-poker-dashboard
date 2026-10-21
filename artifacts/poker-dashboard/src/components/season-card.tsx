import { lazy, Suspense, useMemo, useState } from "react";
import { Image as ImageIcon, Sparkles } from "lucide-react";
import { ChartCard } from "@/components/club-charts";
import { RecapStudio } from "@/components/recap-studio";
import { usePoints } from "@/components/points-context";
import { buildSeason, type Season } from "@/lib/achievements";
import type { ChartSession } from "@/lib/club-charts";
import { buildStandingsRecap } from "@/lib/recaps";
import { formatDate, signedCurrency } from "@/views/shared";

const SeasonRecapDialog = lazy(() => import("@/components/season-recap"));

function AwardTile({ label, name, detail, onOpen }: { label: string; name: string; detail: string; onOpen: (name: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(name)}
      className="min-w-0 rounded-xl bg-secondary/45 p-3 text-left transition-colors hover:bg-secondary"
    >
      <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      <p className="mt-1.5 truncate text-sm font-semibold">{name}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{detail}</p>
    </button>
  );
}

type SeasonCardProps = {
  sessions: ChartSession[];
  viewer: string;
  onOpenPlayer: (name: string) => void;
};

/**
 * Season highlights: the awards, the recap slides and the share image. The standings
 * themselves live in the two podiums above, so this card no longer repeats them.
 */
export function SeasonCard({ sessions, viewer, onOpenPlayer }: SeasonCardProps) {
  const season = useMemo<Season | null>(() => buildSeason(sessions), [sessions]);
  const { rowsFor } = usePoints();
  const [studioOpen, setStudioOpen] = useState(false);
  const [recapOpen, setRecapOpen] = useState(false);
  const pointsRows = useMemo(() => (season ? rowsFor(season.key) : []), [rowsFor, season]);

  const standingsPack = useMemo(() => {
    if (!season || !studioOpen) return null;
    const usePoints = pointsRows.length > 0;
    return buildStandingsRecap({
      id: `${season.key}-${usePoints ? "points" : "profit"}`,
      eyebrow: usePoints ? "Club points" : "Season standings",
      title: `${season.label} standings`,
      subtitle: `${season.games} ${season.games === 1 ? "game" : "games"} · ${formatDate(season.from, "d MMM")} to ${formatDate(season.to, "d MMM")}`,
      dateLabel: season.label,
      rows: usePoints
        ? pointsRows.slice(0, 8).map((row) => ({
            name: row.name,
            value: `${Math.round(row.points)} pts`,
            sub: `${row.wins} ${row.wins === 1 ? "win" : "wins"} · ${row.nights} ${row.nights === 1 ? "night" : "nights"}`,
          }))
        : season.standings.slice(0, 8).map((row) => ({
            name: row.name,
            value: signedCurrency(row.net),
            positive: row.net >= 0,
            sub: `${row.wins} ${row.wins === 1 ? "win" : "wins"} · ${row.games} ${row.games === 1 ? "game" : "games"}`,
          })),
    });
  }, [season, studioOpen, pointsRows]);

  if (!season || !season.leader) return null;

  return (
    <ChartCard
      testId="card-season"
      eyebrow={season.closed ? `${season.label} · final` : `${season.label} · so far`}
      title="Season highlights"
      description={`${season.games} ${season.games === 1 ? "game" : "games"} from ${formatDate(season.from, "d MMM")} to ${formatDate(season.to, "d MMM")}.`}
    >
      {(season.mostWins || season.mostGames) && (
        <div className="grid grid-cols-2 gap-3">
          {season.mostWins && (
            <AwardTile label="Most wins" name={season.mostWins.name} detail={`${season.mostWins.wins} ${season.mostWins.wins === 1 ? "game" : "games"} won`} onOpen={onOpenPlayer} />
          )}
          {season.mostGames && (
            <AwardTile label="Most games" name={season.mostGames.name} detail={`${season.mostGames.games} played`} onOpen={onOpenPlayer} />
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setRecapOpen(true)}
          data-testid="button-open-season-recap"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-90"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Season recap
        </button>
        <button
          type="button"
          onClick={() => setStudioOpen(true)}
          data-testid="button-share-season-image"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs font-semibold hover:bg-secondary"
        >
          <ImageIcon className="h-3.5 w-3.5" />
          Share standings
        </button>
      </div>

      <RecapStudio open={studioOpen} onOpenChange={setStudioOpen} pack={standingsPack} />
      {recapOpen && (
        <Suspense fallback={null}>
          <SeasonRecapDialog open={recapOpen} onOpenChange={setRecapOpen} sessions={sessions} viewer={viewer} />
        </Suspense>
      )}
    </ChartCard>
  );
}
