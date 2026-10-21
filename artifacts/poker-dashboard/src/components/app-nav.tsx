import { useLayoutEffect, useRef, useState } from "react";
import { BookOpen, CalendarDays, CircleDollarSign, House, Users, type LucideIcon } from "lucide-react";

export type DashboardView =
  | "overview"
  | "sessions"
  | "live"
  | "months"
  | "head-to-head"
  | "players"
  | "guidelines"
  | "account";

export type Section = {
  /** The view opened when this section is chosen. */
  id: DashboardView;
  label: string;
  icon: LucideIcon;
  /** Every view that belongs to the section, so the tab stays highlighted inside it. */
  views: DashboardView[];
};

// Five sections. Section ids are the existing view ids, so usage tracking is unchanged.
export const SECTIONS: Section[] = [
  { id: "overview", label: "Home", icon: House, views: ["overview"] },
  { id: "sessions", label: "Games", icon: CalendarDays, views: ["sessions"] },
  { id: "live", label: "Live", icon: CircleDollarSign, views: ["live"] },
  { id: "months", label: "Players", icon: Users, views: ["months", "players", "head-to-head"] },
  { id: "guidelines", label: "Club", icon: BookOpen, views: ["guidelines"] },
];

export const isActiveSection = (section: Section, view: DashboardView) => section.views.includes(view);

type NavProps = {
  active: DashboardView;
  onNavigate: (view: DashboardView) => void;
  /** A live session is open right now. */
  liveOpen: boolean;
};

function LiveDot() {
  return (
    <span className="relative flex h-2 w-2" aria-label="A game is in progress">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-chart-1 opacity-60" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-chart-1" />
    </span>
  );
}

/** Desktop tabs under the header. A pill slides to whichever tab is active. */
export function TopTabs({ active, onNavigate, liveOpen }: NavProps) {
  const buttons = useRef<Record<string, HTMLButtonElement | null>>({});
  const track = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const current = SECTIONS.find((section) => isActiveSection(section, active));
      const node = current ? buttons.current[current.id] : null;
      setPill(node ? { left: node.offsetLeft, width: node.offsetWidth } : null);
    };
    measure();
    // Tab widths change when the web font arrives or the window resizes, so measure again then.
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    if (track.current) observer?.observe(track.current);
    Object.values(buttons.current).forEach((node) => node && observer?.observe(node));
    void document.fonts?.ready.then(measure);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [active, liveOpen]);

  return (
    <nav data-testid="nav-product-tabs" aria-label="Dashboard sections" className="mt-4 hidden overflow-x-auto pb-2 lg:block">
      <div ref={track} className="relative flex w-max gap-1">
        {pill && (
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 rounded-lg bg-primary/10 transition-[transform,width] duration-300 ease-out"
            style={{ width: pill.width, transform: `translateX(${pill.left}px)` }}
          />
        )}
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          const current = isActiveSection(section, active);
          return (
            <button
              key={section.id}
              ref={(node) => { buttons.current[section.id] = node; }}
              type="button"
              onClick={() => onNavigate(section.id)}
              aria-current={current ? "page" : undefined}
              data-testid={`nav-${section.id}`}
              className={`relative z-10 inline-flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
                current ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {section.label}
              {section.id === "live" && liveOpen && <LiveDot />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/** Phone tab bar pinned to the bottom of the screen. */
export function BottomTabBar({ active, onNavigate, liveOpen }: NavProps) {
  return (
    <nav
      aria-label="Dashboard sections"
      data-testid="nav-bottom-tabs"
      className="print-hidden fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto grid max-w-xl grid-cols-5">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          const current = isActiveSection(section, active);
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onNavigate(section.id)}
              aria-current={current ? "page" : undefined}
              data-testid={`tab-${section.id}`}
              className={`relative flex min-h-[56px] flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors ${
                current ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <span className="relative">
                <Icon className="h-5 w-5" />
                {section.id === "live" && liveOpen && (
                  <span className="absolute -right-1.5 -top-1"><LiveDot /></span>
                )}
              </span>
              {section.label}
              {current && <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-primary" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

const PLAYER_VIEWS: Array<{ id: DashboardView; label: string }> = [
  { id: "months", label: "Leaderboard" },
  { id: "players", label: "Profile" },
  { id: "head-to-head", label: "Compare" },
];

/** Switches between the three player views inside the Players section. */
export function PlayersSubnav({ active, onChange }: { active: DashboardView; onChange: (view: DashboardView) => void }) {
  return (
    <div role="tablist" aria-label="Player views" data-testid="subnav-players" className="mt-4 inline-flex gap-1 rounded-xl bg-secondary/55 p-1">
      {PLAYER_VIEWS.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={active === item.id}
          onClick={() => onChange(item.id)}
          data-testid={`subnav-${item.id}`}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            active === item.id ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
