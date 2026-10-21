import { createContext, useContext, useMemo, type ReactNode } from "react";
import { buildBadges, type Badge } from "@/lib/achievements";
import { buildCareers, type Career, type CareerHistoryPoint, type CareerPlayerRow } from "@/lib/career";
import type { ChartSession } from "@/lib/club-charts";

type Achievements = { badges: Map<string, Badge[]>; careers: Map<string, Career> };

const EMPTY: Achievements = { badges: new Map(), careers: new Map() };
const AchievementsContext = createContext<Achievements>(EMPTY);

/**
 * Works out everyone's career figures and badges once, from the whole record, so every
 * screen shows the same answer regardless of the Cash / Tournaments / period filters.
 */
export function AchievementsProvider({
  sessions,
  players,
  history,
  children,
}: {
  sessions: ChartSession[];
  players: CareerPlayerRow[];
  history: CareerHistoryPoint[];
  children: ReactNode;
}) {
  const value = useMemo<Achievements>(() => {
    const careers = buildCareers(players, history);
    return { careers, badges: buildBadges(sessions, careers) };
  }, [sessions, players, history]);
  return <AchievementsContext.Provider value={value}>{children}</AchievementsContext.Provider>;
}

export const useAchievements = () => useContext(AchievementsContext);
