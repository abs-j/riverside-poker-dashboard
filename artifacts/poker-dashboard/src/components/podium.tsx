import { useMemo } from "react";
import { Avatar } from "@/components/avatar";
import { buildPodium, type PodiumPlace, type PodiumSource } from "@/lib/podium";
import { formatCurrency } from "@/views/shared";

const MEDALS: Record<PodiumPlace, { ring: string; block: string; label: string; height: number; avatar: number }> = {
  1: {
    ring: "hsl(43 96% 56%)",
    block: "linear-gradient(180deg, hsl(43 96% 62% / 0.95), hsl(36 90% 46% / 0.55))",
    label: "1st",
    height: 128,
    avatar: 76,
  },
  2: {
    ring: "hsl(220 16% 76%)",
    block: "linear-gradient(180deg, hsl(220 16% 82% / 0.9), hsl(224 12% 56% / 0.5))",
    label: "2nd",
    height: 92,
    avatar: 60,
  },
  3: {
    ring: "hsl(27 72% 54%)",
    block: "linear-gradient(180deg, hsl(27 76% 60% / 0.9), hsl(20 66% 40% / 0.5))",
    label: "3rd",
    height: 68,
    avatar: 56,
  },
};

function Crown() {
  return (
    <svg viewBox="0 0 48 32" aria-hidden="true" className="podium-crown h-7 w-9">
      <path
        d="M4 26 L8 8 L18 18 L24 4 L30 18 L40 8 L44 26 Z"
        fill="hsl(43 96% 56%)"
        stroke="hsl(36 90% 40%)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="2.6" fill="hsl(43 100% 78%)" />
      <circle cx="24" cy="4" r="2.6" fill="hsl(43 100% 78%)" />
      <circle cx="40" cy="8" r="2.6" fill="hsl(43 100% 78%)" />
    </svg>
  );
}

type PodiumProps = {
  players: Array<PodiumSource & { name: string }>;
  viewer?: string;
  onOpenPlayer: (name: string) => void;
  /** Shows a custom value (e.g. points) instead of a signed money amount. */
  formatValue?: (value: number) => string;
  /**
   * Tapping the podium itself opens the full leaderboard; tapping a name still opens that
   * player. Without this, every tap opens the player's profile.
   */
  onOpenBoard?: () => void;
};

/** Top three as a podium. First place stands in the middle and wears a crown. */
export function Podium({ players, viewer, onOpenPlayer, formatValue, onOpenBoard }: PodiumProps) {
  const slots = useMemo(() => buildPodium(players), [players]);
  if (slots.length === 0) return null;
  const viewerKey = viewer?.trim().toLowerCase();

  return (
    <div data-testid="podium" className="relative flex items-end justify-center gap-3 px-2 pt-6 sm:gap-6">
      <div aria-hidden="true" className="podium-glow pointer-events-none absolute left-1/2 top-4 h-40 w-72 rounded-full" />
      {slots.map((slot, index) => {
        const medal = MEDALS[slot.place];
        const isViewer = viewerKey !== undefined && slot.name.trim().toLowerCase() === viewerKey;
        const valueText = formatValue ? formatValue(slot.net) : `${slot.net >= 0 ? "+" : "−"}${formatCurrency(Math.abs(slot.net))}`;
        const openBoard = onOpenBoard ?? (() => onOpenPlayer(slot.name));
        const boardLabel = onOpenBoard ? "Open the full leaderboard" : `Open ${slot.name}'s profile`;
        return (
          <div
            key={slot.place}
            data-testid={`podium-place-${slot.place}`}
            className="group relative flex w-[31%] max-w-[200px] flex-col items-center text-center"
          >
            <button
              type="button"
              onClick={openBoard}
              data-testid={`podium-avatar-${slot.place}`}
              aria-label={`${medal.label} place, ${slot.name}, ${valueText}. ${boardLabel}.`}
              className="flex flex-col items-center outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
            >
              {slot.place === 1 && <span className="mb-1"><Crown /></span>}
              <span className="podium-avatar" style={{ "--i": index } as React.CSSProperties}>
                <Avatar name={slot.name} size={medal.avatar} ring={medal.ring} className="transition-transform duration-200 group-hover:scale-105 group-focus-visible:scale-105" />
              </span>
            </button>
            <button
              type="button"
              onClick={() => onOpenPlayer(slot.name)}
              data-testid={`podium-name-${slot.place}`}
              aria-label={`Open ${slot.name}'s profile`}
              className="mt-1 flex min-h-[40px] max-w-full items-center truncate rounded-md px-1.5 text-sm font-semibold outline-none hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary"
            >
              {slot.name}
              {isViewer && <span className="ml-1.5 align-middle font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-primary">you</span>}
            </button>
            <button
              type="button"
              onClick={openBoard}
              tabIndex={-1}
              aria-hidden="true"
              className="flex w-full flex-col items-center outline-none"
            >
              <span className={`font-mono text-xs font-semibold ${formatValue || slot.net >= 0 ? "text-chart-1" : "text-destructive"}`}>{valueText}</span>
              <span
                className="bar-y up mt-3 flex w-full items-start justify-center rounded-t-xl pt-2 font-mono text-lg font-semibold text-white/95 shadow-sm"
                style={{ height: medal.height, backgroundImage: medal.block, "--i": index * 3 + 2 } as React.CSSProperties}
              >
                {slot.place}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
