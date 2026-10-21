import { useCallback, useMemo, useState } from "react";
import { ChartCard, CumulativeLineChart, SERIES_COLORS } from "@/components/club-charts";
import {
  buildCumulativeRuns,
  buildPlayerTotals,
  normalizeName,
  sortSessions,
  type ChartSession,
} from "@/lib/club-charts";
import { formatDate } from "./shared";

const MAX_COMPARE = SERIES_COLORS.length;

/** "8 cash games and 1 tournament", used in chart captions. */
export function describeGames(sessions: ChartSession[]) {
  const tournaments = sessions.filter((session) => session.eventType === "tournament").length;
  const cash = sessions.length - tournaments;
  const cashText = `${cash} cash ${cash === 1 ? "game" : "games"}`;
  return tournaments ? `${cashText} and ${tournaments} ${tournaments === 1 ? "tournament" : "tournaments"}` : cashText;
}

type CumulativeProfitCardProps = {
  sessions: ChartSession[];
  viewer: string;
};

/** Running total per player, with you and the leaders highlighted and everyone else faint. */
export function CumulativeProfitCard({ sessions, viewer }: CumulativeProfitCardProps) {
  const totals = useMemo(() => buildPlayerTotals(sessions), [sessions]);
  const ordered = useMemo(() => sortSessions(sessions), [sessions]);
  const [compare, setCompare] = useState<string[] | null>(null);

  // Default to the viewer first, then the leaders, so the chart is never empty.
  const defaults = useMemo(() => {
    const viewerRow = totals.find((row) => normalizeName(row.name) === normalizeName(viewer));
    const picks = viewerRow ? [viewerRow.name] : [];
    for (const row of totals) {
      if (picks.length >= 3) break;
      if (!picks.includes(row.name)) picks.push(row.name);
    }
    return picks;
  }, [totals, viewer]);

  const known = useMemo(() => new Set(totals.map((row) => row.name)), [totals]);
  const selected = useMemo(
    () => (compare ?? defaults).filter((name) => known.has(name)).slice(0, MAX_COMPARE),
    [compare, defaults, known],
  );

  const toggle = useCallback(
    (name: string) => {
      const current = (compare ?? defaults).filter((item) => known.has(item));
      if (current.includes(name)) setCompare(current.filter((item) => item !== name));
      else setCompare([...current, name].slice(-MAX_COMPARE));
    },
    [compare, defaults, known],
  );

  const allNames = useMemo(() => totals.map((row) => row.name), [totals]);
  const runs = useMemo(() => buildCumulativeRuns(ordered, allNames), [ordered, allNames]);
  const highlight = useMemo(
    () => selected.map((name, index) => ({ name, color: SERIES_COLORS[index] })),
    [selected],
  );

  if (!sessions.length) return null;
  const since = formatDate(ordered[0].date, "d MMM");
  const unselected = allNames.filter((name) => !selected.includes(name));

  return (
    <ChartCard
      testId="card-cumulative-profit"
      eyebrow="Over time"
      title="Cumulative net profit"
      description={`Running total across the ${describeGames(ordered)} on record since ${since}. Add players to compare; everyone else is shown as faint lines.`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        {highlight.map((item) => (
          <span key={item.name} className="inline-flex items-center gap-2">
            <span className="h-0.5 w-5 rounded-full" style={{ backgroundColor: item.color }} />
            {item.name}
            <button
              type="button"
              onClick={() => toggle(item.name)}
              aria-label={`Remove ${item.name} from the chart`}
              className="-my-2 inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              ×
            </button>
          </span>
        ))}
        <span className="inline-flex items-center gap-2 text-muted-foreground">
          <span className="h-0.5 w-5 rounded-full bg-muted-foreground/40" />
          Everyone else
        </span>
        {selected.length < MAX_COMPARE && unselected.length > 0 && (
          <select
            aria-label="Add a player to the chart"
            value=""
            onChange={(event) => event.target.value && toggle(event.target.value)}
            className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
          >
            <option value="">+ Add player</option>
            {unselected.slice().sort((a, b) => a.localeCompare(b)).map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        )}
        {compare !== null && (
          <button type="button" onClick={() => setCompare(null)} className="text-muted-foreground underline underline-offset-2 hover:text-foreground">
            Reset
          </button>
        )}
      </div>
      <CumulativeLineChart runs={runs} highlight={highlight} contextNames={allNames} />
    </ChartCard>
  );
}
