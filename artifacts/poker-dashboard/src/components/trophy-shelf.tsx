import { useMemo } from "react";
import { Lock } from "lucide-react";
import { BADGE_EMOJI } from "@/components/form-dots";
import { buildTrophyShelf, type Badge } from "@/lib/achievements";
import type { ChartSession } from "@/lib/club-charts";

type TrophyShelfProps = {
  sessions: ChartSession[];
  playerName: string;
  badgeMap: Map<string, Badge[]>;
  /** Games over the whole record, for the Veteran progress bar. */
  careerGames?: number;
};

/** Every badge on one profile: earned ones lit, the rest greyed with how to get them. */
export function TrophyShelf({ sessions, playerName, badgeMap, careerGames }: TrophyShelfProps) {
  const trophies = useMemo(
    () => buildTrophyShelf(sessions, playerName, badgeMap, careerGames),
    [sessions, playerName, badgeMap, careerGames],
  );
  const earned = trophies.filter((trophy) => trophy.earned).length;

  return (
    <section data-testid="card-trophy-shelf" className="soft-shadow rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="section-label text-primary">Achievements</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">Trophy shelf</h2>
        </div>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground" data-testid="text-trophy-count">
          {earned} of {trophies.length} earned
        </span>
      </div>
      <ul className="stagger mt-4 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
        {trophies.map((trophy, index) => (
          <li
            key={trophy.id}
            data-testid={`trophy-${trophy.id}`}
            data-earned={trophy.earned ? "true" : "false"}
            className={`stagger-item flex min-w-0 items-start gap-2.5 rounded-xl border p-2.5 sm:gap-3 sm:p-3 ${
              trophy.earned ? "border-primary/30 bg-primary/[0.06]" : "border-border bg-secondary/30"
            }`}
            style={{ "--i": index } as React.CSSProperties}
          >
            <span
              aria-hidden="true"
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl ${
                trophy.earned ? "bg-primary/15 shadow-[0_0_0_3px_hsl(var(--primary)/0.18)]" : "bg-muted text-muted-foreground grayscale"
              }`}
            >
              {trophy.earned ? BADGE_EMOJI[trophy.id] : <Lock className="h-4 w-4" />}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">
                {trophy.label}
                <span className="sr-only">{trophy.earned ? " (earned)" : " (locked)"}</span>
              </span>
              <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                {trophy.earned ? trophy.reason : trophy.blurb}
              </span>
              {trophy.progress && (
                <span className="mt-2 block">
                  <span className="block h-1.5 overflow-hidden rounded-full bg-border">
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{ width: `${(trophy.progress.current / trophy.progress.target) * 100}%` }}
                    />
                  </span>
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    {trophy.progress.current} of {trophy.progress.target}
                  </span>
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
