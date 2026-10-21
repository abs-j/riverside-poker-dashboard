import { useMemo, useState } from "react";
import { ChartCard } from "@/components/club-charts";
import { usePoints } from "@/components/points-context";
import { ordinal } from "@/lib/share-card";
import { pointsFor, seasonLabel } from "@/lib/points";
import { formatDate, signedCurrency } from "@/views/shared";

const PART_LABELS: Array<[keyof import("@/lib/points").PointsParts, string]> = [
  ["turnUp", "Turned up"],
  ["placement", "Finish"],
  ["win", "Win"],
  ["podium", "Podium"],
  ["inProfit", "In profit"],
  ["knockouts", "Knockouts"],
];

/** Where a player's club points came from, night by night. */
export function PointsBreakdownCard({ playerName, previewNights }: { playerName: string; previewNights?: number }) {
  const [showAll, setShowAll] = useState(false);
  const { currentSeason, rowsFor } = usePoints();
  const season = currentSeason ?? "ALL";
  const row = useMemo(() => pointsFor(rowsFor(season), playerName), [rowsFor, season, playerName]);
  if (!row) return null;

  return (
    <ChartCard
      testId="card-points-breakdown"
      eyebrow="Club points"
      title={`${Math.round(row.points)} points · #${row.rank} in ${seasonLabel(season)}`}
      description={`${row.nights} ${row.nights === 1 ? "night" : "nights"} counted, ${row.wins} ${row.wins === 1 ? "win" : "wins"}, ${row.pointsPerNight} points a night.`}
    >
      <ul className="divide-y divide-border/70" data-testid="list-points-nights">
        {(previewNights && !showAll ? row.history.slice(0, previewNights) : row.history).map((night) => {
          const parts = PART_LABELS.filter(([key]) => night.parts[key] > 0.05)
            .map(([key, label]) => `${label} ${Math.round(night.parts[key] * 10) / 10}`)
            .join(" · ");
          return (
            <li key={night.id} className="flex items-center gap-3 py-2.5 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">
                  {formatDate(night.date)}
                  {night.kind === "tournament" && (
                    <span className="ml-2 rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">Tournament</span>
                  )}
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  {ordinal(night.rank)} of {night.players} · {signedCurrency(night.net)}
                </span>
                <span className="block text-[11px] text-muted-foreground/80">{parts}</span>
              </span>
              <span className="font-mono text-base font-semibold">+{Math.round(night.points * 10) / 10}</span>
            </li>
          );
        })}
      </ul>
      {previewNights && row.history.length > previewNights && (
        <button
          type="button"
          onClick={() => setShowAll((value) => !value)}
          data-testid="button-points-breakdown-toggle"
          className="mt-2 inline-flex min-h-[44px] items-center text-xs font-semibold text-primary hover:underline"
        >
          {showAll ? "Show fewer nights" : `Show all ${row.history.length} nights`}
        </button>
      )}
    </ChartCard>
  );
}
