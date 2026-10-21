import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar } from "@/components/avatar";
import { AnimatedNumber } from "@/components/animated-number";
import { buildSeasonRecap } from "@/lib/achievements";
import type { ChartSession } from "@/lib/club-charts";
import { ordinal } from "@/lib/share-card";
import { formatCurrency, formatDate, signedCurrency } from "@/views/shared";

type SeasonRecapDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessions: ChartSession[];
  viewer: string;
};

/** A small line of the viewer's rank after each game; rank 1 is at the top. */
function RankJourney({ ranks, of }: { ranks: Array<number | null>; of: number }) {
  const points = ranks
    .map((rank, index) => ({ rank, index }))
    .filter((point): point is { rank: number; index: number } => point.rank !== null);
  if (points.length < 2) return null;
  const width = 280;
  const height = 90;
  const step = ranks.length > 1 ? width / (ranks.length - 1) : width;
  const y = (rank: number) => 8 + ((rank - 1) / Math.max(1, of - 1)) * (height - 16);
  const path = points.map((point, i) => `${i ? "L" : "M"}${(point.index * step).toFixed(1)} ${y(point.rank).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  return (
    <svg viewBox={`-8 0 ${width + 16} ${height}`} role="img" aria-label="Your rank after each game" className="mt-4 w-full max-w-xs">
      <path d={path} fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="draw-line" />
      <circle cx={last.index * step} cy={y(last.rank)} r="5" fill="#fff" />
    </svg>
  );
}

export default function SeasonRecapDialog({ open, onOpenChange, sessions, viewer }: SeasonRecapDialogProps) {
  const recap = useMemo(() => buildSeasonRecap(sessions, viewer), [sessions, viewer]);
  const [index, setIndex] = useState(0);
  const touchStart = useRef<number | null>(null);
  if (!recap) return null;

  const { season, viewer: me } = recap;
  const slides: Array<{ key: string; tone: string; body: React.ReactNode }> = [
    {
      key: "intro",
      tone: "from-violet-700 to-fuchsia-700",
      body: (
        <>
          <p className="recap-eyebrow">{season.label}</p>
          <p className="recap-big"><AnimatedNumber value={season.games} format={(value) => String(Math.round(value))} /></p>
          <p className="recap-line">{season.games === 1 ? "game" : "games"} played by {recap.players} {recap.players === 1 ? "player" : "players"}</p>
          <p className="recap-sub">${Math.round(recap.totalPot).toLocaleString("en-AU")} in buy-ins across the table</p>
        </>
      ),
    },
    {
      key: "leader",
      tone: "from-indigo-700 to-violet-700",
      body: season.leader ? (
        <>
          <p className="recap-eyebrow">{season.closed ? "Player of the season" : "Leading the season"}</p>
          <Avatar name={season.leader.name} size={92} ring="hsl(43 96% 56%)" className="mt-5" />
          <p className="recap-name">{season.leader.name}</p>
          <p className="recap-line font-mono">{signedCurrency(season.leader.net)}</p>
          <p className="recap-sub">
            {season.leader.wins} {season.leader.wins === 1 ? "win" : "wins"} in {season.leader.games} games
            {season.lead !== null && season.lead > 0 ? ` · ahead by ${formatCurrency(season.lead)}` : ""}
          </p>
        </>
      ) : null,
    },
  ];
  if (recap.bestNight) {
    slides.push({
      key: "best-night",
      tone: "from-fuchsia-700 to-purple-800",
      body: (
        <>
          <p className="recap-eyebrow">Biggest night</p>
          <p className="recap-big font-mono">{signedCurrency(recap.bestNight.net)}</p>
          <p className="recap-line">{recap.bestNight.name}</p>
          <p className="recap-sub">{formatDate(recap.bestNight.date)}</p>
        </>
      ),
    });
  }
  if (me) {
    slides.push({
      key: "you",
      tone: "from-purple-800 to-indigo-800",
      body: (
        <>
          <p className="recap-eyebrow">Your {season.label}</p>
          <p className="recap-big font-mono"><AnimatedNumber value={me.net} format={signedCurrency} /></p>
          <p className="recap-line">{ordinal(me.rank)} of {me.of} this season</p>
          <p className="recap-sub">
            {me.games} {me.games === 1 ? "game" : "games"} · {me.wins} won · best night {signedCurrency(me.bestGame)}
            {Math.abs(me.streak) >= 2 ? ` · ${Math.abs(me.streak)} ${me.streak > 0 ? "wins" : "losses"} in a row` : ""}
          </p>
          <RankJourney ranks={me.rankJourney} of={me.of} />
        </>
      ),
    });
  } else {
    slides.push({
      key: "join",
      tone: "from-purple-800 to-indigo-800",
      body: (
        <>
          <p className="recap-eyebrow">Your {season.label}</p>
          <p className="recap-line">You haven&apos;t played this season yet.</p>
          <p className="recap-sub">Sit in the next game and you&apos;ll show up here.</p>
        </>
      ),
    });
  }
  const live = slides.filter((slide) => slide.body);
  const current = Math.min(index, live.length - 1);
  const go = (next: number) => setIndex(Math.max(0, Math.min(live.length - 1, next)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-season-recap" className="max-w-md">
        <DialogHeader>
          <DialogTitle>{season.label} recap</DialogTitle>
          <DialogDescription>Swipe, tap the arrows or use the dots.</DialogDescription>
        </DialogHeader>
        <div
          className="relative overflow-hidden rounded-2xl"
          onTouchStart={(event) => { touchStart.current = event.touches[0].clientX; }}
          onTouchEnd={(event) => {
            if (touchStart.current === null) return;
            const delta = event.changedTouches[0].clientX - touchStart.current;
            touchStart.current = null;
            if (Math.abs(delta) > 40) go(current + (delta < 0 ? 1 : -1));
          }}
        >
          <div
            className="flex transition-transform duration-500 ease-out motion-reduce:transition-none"
            style={{ transform: `translateX(-${current * 100}%)` }}
          >
            {live.map((slide, slideIndex) => (
              <div
                key={slide.key}
                aria-hidden={slideIndex !== current}
                data-testid={`recap-slide-${slide.key}`}
                className={`recap-slide flex aspect-[4/5] w-full shrink-0 flex-col items-center justify-center bg-gradient-to-br ${slide.tone} p-8 text-center text-white`}
              >
                {slideIndex === current && slide.body}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => go(current - 1)}
            disabled={current === 0}
            aria-label="Previous slide"
            className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/25 text-white disabled:opacity-0"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => go(current + 1)}
            disabled={current === live.length - 1}
            aria-label="Next slide"
            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/25 text-white disabled:opacity-0"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <div className="flex justify-center gap-2" role="tablist" aria-label="Recap slides">
          {live.map((slide, slideIndex) => (
            <button
              key={slide.key}
              type="button"
              role="tab"
              aria-selected={slideIndex === current}
              aria-label={`Slide ${slideIndex + 1}`}
              onClick={() => go(slideIndex)}
              className={`h-2 rounded-full transition-all ${slideIndex === current ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30"}`}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
