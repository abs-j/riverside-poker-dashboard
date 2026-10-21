import { createContext, useContext, useMemo, type ReactNode } from "react";
import { usePoints } from "@/components/points-context";
import type { NightKind, PointsRow } from "@/lib/points";

type SeasonValue = {
  /** The season being shown: a quarter such as "2026-Q4", or "ALL". */
  season: string;
  /** False when the chosen period has no scored nights at all. */
  hasNights: boolean;
  seasons: string[];
  rows: PointsRow[];
};

const SeasonContext = createContext<SeasonValue | null>(null);

/**
 * The leaderboard page has one filter bar. This applies it to club points as well: the period
 * becomes a season and Cash / Tournaments limits the kinds of night, so the profit and points
 * tables always describe the same slice of games.
 */
export function PointsSeasonProvider({
  season,
  kinds,
  children,
}: {
  /** From the filter bar; null when the period has no scored nights. */
  season: string | null;
  kinds?: NightKind[];
  children: ReactNode;
}) {
  const { seasons, rowsWith } = usePoints();
  const value = useMemo<SeasonValue>(
    () => ({
      season: season ?? "ALL",
      hasNights: season !== null,
      seasons,
      rows: season === null ? [] : rowsWith({ season, kinds }),
    }),
    [season, kinds, seasons, rowsWith],
  );
  return <SeasonContext.Provider value={value}>{children}</SeasonContext.Provider>;
}

export function usePointsSeason(): SeasonValue {
  const value = useContext(SeasonContext);
  const { seasons, currentSeason, rowsFor } = usePoints();
  // Outside the leaderboard (e.g. Home) fall back to the current season.
  return (
    value ?? {
      season: currentSeason ?? "ALL",
      hasNights: true,
      seasons,
      rows: rowsFor(currentSeason ?? "ALL"),
    }
  );
}
