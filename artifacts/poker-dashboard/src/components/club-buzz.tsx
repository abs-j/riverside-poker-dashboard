import { useMemo } from "react";
import { ArrowUpRight, Info, Swords } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { ChartCard } from "@/components/club-charts";
import { buildBuzz, buildRivalry, type BuzzItem } from "@/lib/achievements";
import type { ChartSession } from "@/lib/club-charts";
import { signedCurrency } from "@/views/shared";

const TONE: Record<BuzzItem["tone"], { icon: typeof Info; color: string }> = {
  up: { icon: ArrowUpRight, color: "bg-chart-1/15 text-chart-1" },
  info: { icon: Info, color: "bg-primary/10 text-primary" },
};

type ClubBuzzProps = {
  sessions: ChartSession[];
  viewer: string;
  onOpenPlayer: (name: string) => void;
  onCompare: (name: string) => void;
};

/** What changed lately in plain sentences, plus the viewer's closest rival. */
export function ClubBuzz({ sessions, viewer, onOpenPlayer, onCompare }: ClubBuzzProps) {
  const items = useMemo(() => buildBuzz(sessions, 4), [sessions]);
  const rivalry = useMemo(() => buildRivalry(sessions, viewer), [sessions, viewer]);
  if (!items.length && !rivalry) return null;

  return (
    <ChartCard testId="card-club-buzz" eyebrow="Club buzz" title="What's happening" description="Automatically written from the latest results.">
      {items.length > 0 && (
        <ul className="stagger space-y-2.5">
          {items.map((item, index) => {
            const tone = TONE[item.tone];
            const Icon = tone.icon;
            return (
              <li key={item.id} className="stagger-item flex items-start gap-3 text-sm" style={{ "--i": index } as React.CSSProperties}>
                <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${tone.color}`}>
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <span className="leading-6">{item.text}</span>
              </li>
            );
          })}
        </ul>
      )}
      {rivalry && (
        <div data-testid="card-rivalry" className="mt-5 rounded-xl border border-primary/25 bg-primary/[0.06] p-4">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
            <Swords className="h-3.5 w-3.5" aria-hidden="true" />
            Your closest rival
          </p>
          <div className="mt-3 flex items-center gap-3">
            <Avatar name={rivalry.name} size={40} />
            <div className="min-w-0 flex-1">
              <button type="button" onClick={() => onOpenPlayer(rivalry.name)} className="-my-2 block max-w-full truncate py-2 text-left text-sm font-semibold hover:text-primary hover:underline">
                {rivalry.name}
              </button>
              <p className="text-xs text-muted-foreground">
                You&apos;re {rivalry.wins}–{rivalry.losses} across {rivalry.sharedGames} shared games
                {rivalry.netDifference !== 0 && (
                  <>
                    {" "}and{" "}
                    <span className={rivalry.netDifference > 0 ? "text-chart-1" : "text-destructive"}>
                      {signedCurrency(rivalry.netDifference)}
                    </span>{" "}
                    {rivalry.netDifference > 0 ? "ahead" : "behind"}
                  </>
                )}
                .
              </p>
            </div>
            <button
              type="button"
              onClick={() => onCompare(rivalry.name)}
              className="inline-flex min-h-[44px] shrink-0 items-center rounded-lg border border-border bg-background px-3 text-xs font-semibold hover:bg-secondary"
            >
              Compare
            </button>
          </div>
        </div>
      )}
    </ChartCard>
  );
}
