import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BADGE_META, type Badge, type FormDot } from "@/lib/achievements";
import { formatDate, signedCurrency } from "@/views/shared";

const DOT_STYLE: Record<FormDot["result"], string> = {
  win: "bg-chart-1",
  loss: "bg-destructive",
  even: "bg-muted-foreground/50",
};

/** The last few games as small coloured dots: green win, red loss, grey even. */
export function FormDots({ dots, className = "" }: { dots: FormDot[]; className?: string }) {
  if (!dots.length) return null;
  const summary = dots.map((dot) => (dot.result === "win" ? "won" : dot.result === "loss" ? "lost" : "broke even")).join(", ");
  return (
    <span
      role="img"
      aria-label={`Last ${dots.length} games: ${summary}`}
      data-testid="form-dots"
      className={`inline-flex items-center gap-1 ${className}`}
    >
      {dots.map((dot) => (
        <span
          key={`${dot.sessionNumber}-${dot.date}`}
          title={`${formatDate(dot.date)}: ${signedCurrency(dot.net)}`}
          className={`h-2 w-2 rounded-full ${DOT_STYLE[dot.result]}`}
        />
      ))}
    </span>
  );
}

export const BADGE_EMOJI: Record<Badge["id"], string> = {
  heater: "🔥",
  "giant-killer": "🗡️",
  comeback: "↩︎",
  "iron-player": "🛡️",
  "big-night": "💥",
  "first-win": "⭐",
  veteran: "🎖️",
  "perfect-month": "🌙",
  "tournament-win": "🏆",
};

/** Badges most members have, left off crowded rows like the leaderboard. */
const COMMON: Array<Badge["id"]> = ["first-win", "veteran"];

/** Small pills for the badges a player has earned. `compact` shows just the icon. */
export function BadgeChips({
  badges,
  compact = false,
  hideCommon = false,
  className = "",
}: {
  badges: Badge[];
  compact?: boolean;
  hideCommon?: boolean;
  className?: string;
}) {
  const shown = hideCommon ? badges.filter((badge) => !COMMON.includes(badge.id)) : badges;
  if (!shown.length) return null;
  return (
    <span data-testid="badge-chips" className={`inline-flex flex-wrap items-center gap-1 ${className}`}>
      {shown.map((badge) => (
        <Popover key={badge.id}>
          <PopoverTrigger asChild>
            <button
              type="button"
              data-testid={`badge-${badge.id}`}
              aria-label={`${badge.label}: ${badge.reason}`}
              className="relative inline-flex min-h-[28px] items-center gap-1 rounded-full bg-primary/10 px-2 text-[11px] font-semibold text-primary before:absolute before:-inset-1.5 before:content-[''] hover:bg-primary/15"
            >
              <span aria-hidden="true">{BADGE_EMOJI[badge.id]}</span>
              {compact ? <span className="sr-only">{badge.label}</span> : badge.label}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3 text-sm" align="start">
            <p className="font-semibold">
              <span aria-hidden="true">{BADGE_EMOJI[badge.id]} </span>
              {badge.label}
            </p>
            <p className="mt-1 text-xs text-foreground">{badge.reason}</p>
            <p className="mt-2 text-xs text-muted-foreground">{BADGE_META[badge.id].blurb}</p>
          </PopoverContent>
        </Popover>
      ))}
    </span>
  );
}
