import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { TournamentEvent } from "@/lib/earnings-analytics";
import {
  buildPointsLeaderboard,
  firstScoredDate,
  pointsAfterNight,
  pointsSeasons,
  type PointsAfterNight,
  type NightKind,
  type PointsCashNight,
  type PointsRow,
} from "@/lib/points";

type PointsValue = {
  /** Every season with a scored night, newest first. */
  seasons: string[];
  /** The newest season, or null when nothing is scored yet. */
  currentSeason: string | null;
  rowsFor: (season: string) => PointsRow[];
  /** Rows for a season limited to some kinds of night (the leaderboard's Cash / Tournaments filter). */
  rowsWith: (options: { season: string; kinds?: NightKind[] }) => PointsRow[];
  /** First night that scored, e.g. for "scored nights start on". */
  firstNight: string | null;
  tournaments: TournamentEvent[];
  /** The season table as it stood after one night, for recaps. */
  afterNight: (night: { date: string; sessionNumber?: number; tournamentId?: string }) => PointsAfterNight;
};

const EMPTY: PointsValue = {
  seasons: [],
  currentSeason: null,
  rowsFor: () => [],
  rowsWith: () => [],
  firstNight: null,
  tournaments: [],
  afterNight: (night) => ({ season: night.date.slice(0, 4), rows: [], earnedTonight: [] }),
};
const PointsContext = createContext<PointsValue>(EMPTY);

/** Computes club points once from the nights already loaded, for every screen to share. */
export function PointsProvider({
  cashNights,
  tournaments,
  children,
}: {
  cashNights: PointsCashNight[];
  tournaments: TournamentEvent[];
  children: ReactNode;
}) {
  const value = useMemo<PointsValue>(() => {
    const seasons = pointsSeasons(cashNights, tournaments);
    const cache = new Map<string, PointsRow[]>();
    return {
      seasons,
      currentSeason: seasons[0] ?? null,
      rowsFor: (season) => {
        const cached = cache.get(season);
        if (cached) return cached;
        const rows = buildPointsLeaderboard(cashNights, tournaments, { season });
        cache.set(season, rows);
        return rows;
      },
      rowsWith: ({ season, kinds }) => {
        const cacheKey = `${season}|${(kinds ?? []).join(",")}`;
        const cached = cache.get(cacheKey);
        if (cached) return cached;
        const rows = buildPointsLeaderboard(cashNights, tournaments, { season, kinds });
        cache.set(cacheKey, rows);
        return rows;
      },
      firstNight: firstScoredDate(cashNights, tournaments),
      tournaments,
      afterNight: (night) => pointsAfterNight(cashNights, tournaments, night),
    };
  }, [cashNights, tournaments]);
  return <PointsContext.Provider value={value}>{children}</PointsContext.Provider>;
}

export const usePoints = () => useContext(PointsContext);
