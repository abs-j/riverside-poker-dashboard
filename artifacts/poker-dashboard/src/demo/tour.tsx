// Guided walkthrough for the public demo. A small card steps through the main sections,
// switching the page underneath and ringing the control it is talking about.
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Compass, X } from "lucide-react";
import type { DashboardView } from "@/components/app-nav";

type Step = {
  view: DashboardView;
  title: string;
  body: string;
  /** data-testid values to ring, first visible one wins (desktop and phone layouts differ). */
  targets?: string[];
};

const STEPS: Step[] = [
  {
    view: "overview",
    title: "Welcome to Riverside Poker Club",
    body: "This is a demo of a dashboard I built for a real low-stakes home poker group. The club, players and results here are all made up. Follow along for a two-minute tour, or close this and explore freely.",
  },
  {
    view: "overview",
    title: "Home: the season at a glance",
    body: "Headline totals, your last night, season standings and club highlights, built from every game logged. Scroll down for the Club Buzz feed and achievement badges.",
    targets: ["text-dashboard-title"],
  },
  {
    view: "overview",
    title: "Running totals chart",
    body: "Open this to see everyone's cumulative profit game by game, with you highlighted. Tap a legend name to isolate one player.",
    targets: ["button-show-history-chart"],
  },
  {
    view: "sessions",
    title: "Games: every night on record",
    body: "Cash games and tournaments each get their own history. Select a night to see who bought in, who cashed out and how the table balanced. Tournaments add finishing order, knockouts and payouts.",
    targets: ["nav-sessions"],
  },
  {
    view: "live",
    title: "Live ledger: track tonight",
    body: "A session is already running. Add a buy-in or cash-out, edit an entry (an audit note is required), then close the ledger to check that the table balances. Changes only last until you refresh.",
    targets: ["nav-live"],
  },
  {
    view: "months",
    title: "Players: leaderboards and points",
    body: "Rankings by month or quarter, a club points table with seasons, and podium cards. Switch the filters at the top to change the period.",
    targets: ["nav-months"],
  },
  {
    view: "head-to-head",
    title: "Head to head",
    body: "Pick any two players to compare profit, win rate and results on the nights they both played.",
  },
  {
    view: "players",
    title: "Player profiles",
    body: "A career page for each player: stats, trophy shelf, form over recent games, tournament record and achievements.",
  },
  {
    view: "guidelines",
    title: "Club: rules and tournament setup",
    body: "House rules, fair-play guidelines and the tournament blind schedule, kept alongside the numbers so everyone plays by the same page.",
    targets: ["nav-guidelines"],
  },
  {
    view: "account",
    title: "Your account",
    body: "Choose a profile picture, switch between dark and light theme and see your own stats. Members normally sign in with a club access code; here any password works.",
    targets: ["button-open-account"],
  },
  {
    view: "overview",
    title: "That's the tour",
    body: "The real version reads results from a Google Sheet and stores the live ledger in a database. This demo swaps both for generated data so it runs anywhere. Reopen the tour any time from the button in the corner.",
  },
];

const SEEN_KEY = "riverside-demo-tour-seen";

function visibleTarget(ids: string[] | undefined): HTMLElement | null {
  for (const id of ids ?? []) {
    for (const node of document.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`)) {
      const box = node.getBoundingClientRect();
      if (box.width > 0 && box.height > 0) return node;
    }
  }
  return null;
}

export function DemoTour({ activeView, onNavigate }: { activeView: DashboardView; onNavigate: (view: DashboardView) => void }) {
  const [open, setOpen] = useState(() => {
    try {
      return window.sessionStorage.getItem(SEEN_KEY) !== "1";
    } catch {
      return true;
    }
  });
  const [index, setIndex] = useState(0);
  const [ring, setRing] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const step = STEPS[index];

  const close = useCallback(() => {
    setOpen(false);
    try {
      window.sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      // The tour simply offers itself again on the next visit.
    }
  }, []);

  const go = (next: number) => {
    const target = Math.min(Math.max(next, 0), STEPS.length - 1);
    setIndex(target);
    if (STEPS[target].view !== activeView) onNavigate(STEPS[target].view);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Ring the control this step is about. It is measured again after the new view has rendered.
  useLayoutEffect(() => {
    if (!open) {
      setRing(null);
      return;
    }
    const measure = () => {
      const node = visibleTarget(step.targets);
      if (!node) return setRing(null);
      const box = node.getBoundingClientRect();
      setRing({ top: box.top - 6, left: box.left - 6, width: box.width + 12, height: box.height + 12 });
    };
    const timer = window.setTimeout(measure, 350);
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, step, activeView]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => { setIndex(0); setOpen(true); }}
        data-testid="button-demo-tour"
        className="print-hidden fixed bottom-20 right-4 z-50 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-lg transition-transform hover:-translate-y-0.5 lg:bottom-6 lg:right-6"
      >
        <Compass className="h-4 w-4" />
        Take the tour
      </button>
    );
  }

  const last = index === STEPS.length - 1;
  return (
    <>
      {ring && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-50 rounded-xl ring-2 ring-primary transition-all duration-300"
          style={{ top: ring.top, left: ring.left, width: ring.width, height: ring.height, boxShadow: "0 0 0 6px hsl(var(--primary) / 0.18)" }}
        />
      )}
      <aside
        role="dialog"
        aria-label="Guided tour"
        data-testid="demo-tour"
        className="print-hidden fixed inset-x-3 bottom-20 z-50 rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-2xl sm:left-auto sm:right-4 sm:w-[380px] lg:bottom-6 lg:right-6"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="section-label text-primary">Tour · {index + 1} of {STEPS.length}</p>
          <button type="button" onClick={close} aria-label="Close tour" data-testid="button-demo-tour-close" className="-m-2 flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <h2 className="mt-2 text-base font-semibold tracking-tight">{step.title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.body}</p>
        <div className="mt-3 flex gap-1" aria-hidden="true">
          {STEPS.map((_, dot) => <span key={dot} className={`h-1 flex-1 rounded-full ${dot <= index ? "bg-primary" : "bg-secondary"}`} />)}
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button type="button" onClick={() => go(index - 1)} disabled={index === 0} className="inline-flex h-10 items-center gap-1 rounded-lg px-3 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-40">
            <ChevronLeft className="h-4 w-4" />Back
          </button>
          {last ? (
            <button type="button" onClick={close} data-testid="button-demo-tour-done" className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground">Explore on my own</button>
          ) : (
            <button type="button" onClick={() => go(index + 1)} data-testid="button-demo-tour-next" className="inline-flex h-10 items-center gap-1 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground">
              {index === 0 ? "Start tour" : "Next"}<ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
