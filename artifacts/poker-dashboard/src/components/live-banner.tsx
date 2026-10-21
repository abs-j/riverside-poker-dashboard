import { ArrowRight } from "lucide-react";
import { formatCurrency } from "@/views/shared";

type LiveBannerProps = {
  startedBy: string | null;
  buyIns: number;
  playerCount: number;
  onOpen: () => void;
};

/** Shown on Home while a game is open, so members can jump straight into the ledger. */
export function LiveBanner({ startedBy, buyIns, playerCount, onOpen }: LiveBannerProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid="banner-live-game"
      className="live-banner group mb-4 flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-chart-1/40 bg-chart-1/[0.08] px-4 py-3 text-left"
    >
      <span className="relative flex h-3 w-3 shrink-0" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-chart-1 opacity-60 motion-reduce:animate-none" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-chart-1" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">A game is in progress</span>
        <span className="block text-xs leading-5 text-muted-foreground">
          {startedBy ? `Started by ${startedBy} · ` : ""}
          {playerCount > 0 ? `${playerCount} ${playerCount === 1 ? "player" : "players"} · ${formatCurrency(buyIns)} in the pot` : "No buy-ins yet"}
        </span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-chart-1">
        Open the ledger
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </button>
  );
}
