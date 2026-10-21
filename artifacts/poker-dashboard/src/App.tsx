import { CLUB_NAME, IS_DEMO } from "@/lib/brand";
import { Suspense, lazy, useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getPokerDashboard, getGetPokerLiveActivityQueryKey, useGetPokerDashboard, useGetPokerLiveActivity, useGetPublicPokerSummary } from "@workspace/api-client-react";
import { ErrorBoundary } from "@/components/error-boundary";
import { HomeOverview } from "@/components/home-overview";
import { BottomTabBar, PlayersSubnav, TopTabs } from "@/components/app-nav";
import { FilterBar } from "@/components/filter-bar";
import { MyNightCard } from "@/components/my-night-card";
import { LiveBanner } from "@/components/live-banner";
import { InstallCard } from "@/components/install-card";
import { LatestTournamentCard } from "@/components/latest-tournament-card";
import { InstallHelpDialog } from "@/components/install-help-dialog";
import { ClubBuzz } from "@/components/club-buzz";
import { SeasonCard } from "@/components/season-card";
import { PointsPodiumCard } from "@/components/points-podium-card";
import { pointsSeasons, seasonForPeriod, type NightKind } from "@/lib/points";
import { PointsSeasonProvider } from "@/components/points-season-context";
import { NewBadgeNotice } from "@/components/new-badge-notice";
import { AchievementsProvider } from "@/components/achievements-context";
import { PointsProvider } from "@/components/points-context";
import { Avatar, AvatarProvider } from "@/components/avatar";
import { useMemberAvatars } from "@/lib/avatars";
import { MemberLogin } from "./views/member-login";
import type { GamesMode } from "./views/games-view";
import { browserSessionDeps, checkMemberSession, landingPathForSessions, type MemberAuthSession } from "@/lib/member-session";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { dashboardSearchForView, getInitialDashboardView } from "@/lib/live-ledger-links";
import { formatVisibleDuration } from "@/lib/member-usage";

import { useMemberUsageTracking } from "@/hooks/use-member-usage";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { buildCombinedLeaderboard, buildTournamentLeaderboard, buildTournamentSessions } from "@/lib/earnings-analytics";
import type { DashboardPlayer as Player, DashboardSession as Session, PerformanceScope, ProfitPoint, TournamentEvent, TournamentSnapshot } from "@/lib/earnings-analytics";
import NotFound from "@/pages/not-found";
import { DemoTour } from "@/demo/tour";

// Heavy, rarely-used pieces are fetched on demand instead of shipping in the first load.
const LiveSessionView = lazy(() => import("./views/live-view").then((m) => ({ default: m.LiveSessionView })));
const CumulativeProfitCard = lazy(() => import("./views/trends-section").then((m) => ({ default: m.CumulativeProfitCard })));
const PublicGamesGrowthChart = lazy(() => import("@/components/public-games-growth-chart"));
const AdminPage = () => null;
const AccountView = lazy(() => import("./views/account-view").then((m) => ({ default: m.AccountView })));
const GuidelinesView = lazy(() => import("./views/guidelines-view").then((m) => ({ default: m.GuidelinesView })));
const GamesView = lazy(() => import("./views/games-view").then((m) => ({ default: m.GamesView })));
const PointsLeaderboard = lazy(() => import("./views/points-leaderboard").then((m) => ({ default: m.PointsLeaderboard })));
const PeriodLeaderboards = lazy(() => import("./views/period-leaderboards").then((m) => ({ default: m.PeriodLeaderboards })));
const HeadToHeadView = lazy(() => import("./views/head-to-head-view").then((m) => ({ default: m.HeadToHeadView })));
const PlayersView = lazy(() => import("./views/players-view").then((m) => ({ default: m.PlayersView })));
import { ArrowDown, ArrowUp, Activity, BarChart3, CalendarDays, Check, ChevronDown, ChevronRight, CircleDollarSign, Copy, Download, ExternalLink, FileSpreadsheet, Eye, EyeOff, LayoutDashboard, LockKeyhole, LogOut, Menu, MoreHorizontal, Moon, Pencil, Printer, QrCode, Plus, RefreshCw, ShieldCheck, Sun, Trash2, Users, X } from "lucide-react";

import { Route, Router as WouterRouter, Switch } from "wouter";
import { EmptyPanel, MetricCard, MonthFilter, PageIntro, QuarterFilter, buildRankMovementMap, buildScopedPlayers, compactCurrency, formatCurrency, formatDate, monthLabel, normalizePlayerName, signedCurrency, slug } from "./views/shared";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false } },
});


type MonthlySummary = {
  month: string;
  label: string;
  range: string;
  sessionCount: number;
  recordCount: number;
  totalBuyIn: number;
  totalCashOut: number;
  totalNet: number;
  avgPot: number;
  uniquePlayers: number;
  topWinner: string | null;
  topWinnerProfit: number;
  positiveSessions: number;
  negativeSessions: number;
};
type QuarterlySummary = Omit<MonthlySummary, "month"> & { quarter: string };
type PeriodSummary = {
  key: string;
  label: string;
  range: string;
  sessionCount: number;
  recordCount: number;
  totalBuyIn: number;
  totalCashOut: number;
  totalNet: number;
  avgPot: number;
  uniquePlayers: number;
  topWinner: string | null;
  topWinnerProfit: number;
  positiveSessions: number;
  negativeSessions: number;
};
type View = "overview" | "sessions" | "live" | "months" | "head-to-head" | "players" | "guidelines" | "account";
type BreakdownMode = "months" | "quarters";

function buildScopePeriods(
  basePeriods: PeriodSummary[],
  scope: PerformanceScope,
  tournamentSessions: Session[],
  breakdown: BreakdownMode,
  cashSessions: Session[],
): PeriodSummary[] {
  if (scope === "cash") return basePeriods;
  if (tournamentSessions.length === 0) return scope === "tournaments" ? [] : basePeriods;

  const keyOf = (session: Session) =>
    breakdown === "months" ? session.month : quarterForMonth(session.month);
  const byKey = new Map<string, Session[]>();
  for (const session of tournamentSessions) {
    const key = keyOf(session);
    byKey.set(key, [...(byKey.get(key) ?? []), session]);
  }

  const eventPeriod = (key: string, events: Session[]): PeriodSummary => {
    const year = events[0].date.slice(0, 4);
    const totalBuyIn = events.reduce((sum, event) => sum + event.totalBuyIn, 0);
    const totalCashOut = events.reduce((sum, event) => sum + event.totalCashOut, 0);
    const top = events
      .flatMap((event) => event.players)
      .sort((left, right) => right.net - left.net || left.player.localeCompare(right.player))[0];
    return {
      key,
      label: breakdown === "months" ? monthLabel(events[0].month) : `${key} ${year}`,
      range: breakdown === "months"
        ? (events.length === 1 ? formatDate(events[0].date) : monthLabel(events[0].month))
        : `${key} ${year}`,
      sessionCount: events.length,
      recordCount: events.reduce((sum, event) => sum + event.playerCount, 0),
      totalBuyIn,
      totalCashOut,
      totalNet: totalCashOut - totalBuyIn,
      avgPot: totalBuyIn / events.length,
      uniquePlayers: new Set(events.flatMap((event) => event.players.map((p) => normalizePlayerName(p.player)))).size,
      topWinner: top?.player ?? null,
      topWinnerProfit: top?.net ?? 0,
      positiveSessions: events.filter((event) => event.totalNet > 0).length,
      negativeSessions: events.filter((event) => event.totalNet < 0).length,
    };
  };

  if (scope === "tournaments") {
    return [...byKey.entries()]
      .map(([key, events]) => {
        const existing = basePeriods.find((period) => period.key === key);
        const period = eventPeriod(key, events);
        return existing ? { ...existing, ...period } : period;
      })
      .sort((left, right) => left.key.localeCompare(right.key));
  }

  const merged = basePeriods.map((period) => {
    const events = byKey.get(period.key);
    if (!events) return period;
    const added = eventPeriod(period.key, events);
    const sessionCount = period.sessionCount + added.sessionCount;
    const totalBuyIn = period.totalBuyIn + added.totalBuyIn;
    const cashNames = cashSessions
      .filter((session) => keyOf(session) === period.key)
      .flatMap((session) => session.players.map((player) => normalizePlayerName(player.player)));
    const eventNames = events.flatMap((event) => event.players.map((p) => normalizePlayerName(p.player)));
    const tournamentTopIsHigher = Boolean(added.topWinner) && (!period.topWinner || added.topWinnerProfit > period.topWinnerProfit);
    return {
      ...period,
      sessionCount,
      recordCount: period.recordCount + added.recordCount,
      totalBuyIn,
      totalCashOut: period.totalCashOut + added.totalCashOut,
      totalNet: period.totalNet + added.totalNet,
      avgPot: totalBuyIn / sessionCount,
      uniquePlayers: new Set([...cashNames, ...eventNames]).size,
      positiveSessions: period.positiveSessions + added.positiveSessions,
      negativeSessions: period.negativeSessions + added.negativeSessions,
      topWinner: tournamentTopIsHigher ? added.topWinner : period.topWinner,
      topWinnerProfit: tournamentTopIsHigher ? added.topWinnerProfit : period.topWinnerProfit,
    };
  });
  const missing = [...byKey.entries()]
    .filter(([key]) => !basePeriods.some((period) => period.key === key))
    .map(([key, events]) => eventPeriod(key, events));
  return [...merged, ...missing].sort((left, right) => left.key.localeCompare(right.key));
}

function Home() {
  const [memberSession, setMemberSession] = useState<MemberAuthSession | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [unreachable, setUnreachable] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setAuthLoading(true);
    setUnreachable(false);
    void checkMemberSession(browserSessionDeps(() => cancelled)).then((result) => {
      if (cancelled) return;
      if (result === "unreachable") setUnreachable(true);
      else setMemberSession(result);
      setAuthLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // Coming back online, or returning to the tab, tries again on its own.
  useEffect(() => {
    if (!unreachable) return;
    const retry = () => setAttempt((value) => value + 1);
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [unreachable]);

  const handleLogout = async () => {
    await fetch("/api/auth/member/logout", { method: "POST", credentials: "include" });
    queryClient.clear();
    setMemberSession(null);
  };

  if (authLoading) return <AuthLoadingState />;
  if (unreachable) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-background px-6 text-foreground">
        <div data-testid="state-auth-unreachable" className="max-w-sm text-center">
          <h1 className="text-lg font-semibold">Can&apos;t reach the club site</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You&apos;re still signed in. Check your connection and try again.
          </p>
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
            className="mt-5 inline-flex h-10 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }
  if (!memberSession) return <MemberLogin onAuthenticated={setMemberSession} />;
  return <DashboardHome memberName={memberSession.memberName ?? "Member"} onLogout={handleLogout} />;
}

function RootLandingPage() {
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const fetchSession = (path: string) =>
        fetch(path, {
          credentials: "include",
          cache: "no-store",
        }).catch(() => null);
      const [memberResponse, adminResponse] = await Promise.all([
        fetchSession("/api/auth/member/session"),
        fetchSession("/api/auth/admin/session"),
      ]);
      const isAuthenticated = async (response: Response | null) => {
        if (!response?.ok) return false;
        try {
          return Boolean(((await response.json()) as { authenticated?: boolean }).authenticated);
        } catch {
          return false;
        }
      };
      const [memberAuthenticated, adminAuthenticated] = await Promise.all([
        isAuthenticated(memberResponse),
        isAuthenticated(adminResponse),
      ]);
      const landingPath = landingPathForSessions(memberAuthenticated, adminAuthenticated);
      if (landingPath) {
        window.location.replace(landingPath);
        return;
      }
      if (!cancelled) setCheckingSession(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (checkingSession) return <AuthLoadingState />;
  return <PublicSnapshotPage />;
}

function PublicSnapshotPage() {
  const { data: summary, isLoading, isError, refetch } = useGetPublicPokerSummary();

  if (isLoading) return <PublicSnapshotLoading />;
  if (isError || !summary) return <PublicSnapshotError onRetry={() => void refetch()} />;

  const latestActivity = summary.latestGameDate ? formatDate(summary.latestGameDate) : "No sessions recorded yet";
  const visibleMonths = summary.monthlyGames.filter((month) => month.gameCount > 0);
  let cumulativeGames = 0;
  const gamesGrowth = [
    ...visibleMonths.map((month) => {
      cumulativeGames += month.gameCount;
      return {
        month: month.month,
        label: month.label,
        cumulativeGames,
      };
    }),
  ];

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <main className="mx-auto max-w-[1100px] px-5 py-6 sm:px-8 lg:px-10 lg:py-10">
        <header className="flex flex-col gap-6 border-b border-border pb-7 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl brand-mark bg-primary text-primary-foreground shadow-[0_3px_0_hsl(262_80%_40%)]"><CalendarDays className="h-5 w-5" /></div>
            <div>
              <p className="text-lg font-semibold tracking-tight">{CLUB_NAME}</p>
               <p className="mt-1 text-xs text-muted-foreground">Public snapshot</p>
            </div>
          </div>
          <a href="/dashboard" data-testid="link-public-member-login" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5">{IS_DEMO ? "Enter the demo" : "Member sign in"}<ChevronRight className="h-4 w-4" /></a>
        </header>

        <section className="max-w-2xl py-10 sm:py-14">
          <p className="section-label text-primary">Poker, at a glance</p>
           <h1 data-testid="text-public-snapshot-title" className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">See the club’s season at a glance.</h1>
          <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">This public snapshot shows high-level activity from the {CLUB_NAME}. {IS_DEMO ? "This is a portfolio demo with fictional players and generated results. Sign in with any password to explore the full dashboard." : "Member sign-in unlocks the complete private dashboard with detailed standings and session history."}</p>
        </section>

        <section data-testid="section-public-summary-metrics" className="grid gap-3 sm:grid-cols-3">
          <PublicSnapshotMetric label="Recorded sessions" value={String(summary.totalSessions)} detail="Poker nights logged" icon={<CalendarDays />} />
          <PublicSnapshotMetric label="Total players" value={String(summary.totalPlayers)} detail="Players with recorded games" icon={<Users />} />
          <PublicSnapshotMetric label="Latest activity" value={latestActivity} detail={summary.isStale ? "Last successful update" : "Most recent recorded night"} icon={<BarChart3 />} />
        </section>

        <section data-testid="section-public-games-growth" className="mt-5 rounded-2xl border border-border bg-card p-5 soft-shadow sm:p-7">
          <div className="flex flex-col gap-2 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="section-label text-primary">Growth over time</p><h2 className="mt-1 text-xl font-semibold tracking-tight">Total individual games played</h2></div>
            <p className="text-xs text-muted-foreground">Cumulative player game records · no player or money details</p>
          </div>
          <div className="mt-6 h-[260px]" data-testid="chart-public-games-growth">
            <Suspense fallback={<div className="h-full skeleton rounded-xl" />}>
              <PublicGamesGrowthChart data={gamesGrowth} />
            </Suspense>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Each point adds the individual games recorded during that month.</p>
        </section>

        <section className="mt-5 flex flex-col gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div><p className="text-sm font-semibold">Want the full picture?</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Members can sign in to view the complete private dashboard and club guidelines.</p></div>
          <a href="/dashboard" data-testid="link-public-member-login-secondary" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-primary/30 bg-background px-4 py-2.5 text-xs font-semibold text-primary hover:bg-primary/10">{IS_DEMO ? "Open the demo dashboard" : "Open member dashboard"}<ChevronRight className="h-4 w-4" /></a>
        </section>

        <footer className="mt-8 border-t border-border pt-5 text-xs text-muted-foreground">
          <span>High-level activity sourced from the club session log.</span>
          <span className="ml-2">Updated {formatSyncTime(summary.lastUpdated)}.</span>
        </footer>
      </main>
    </div>
  );
}

function PublicSnapshotMetric({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: ReactNode }) {
  return <article className="rounded-2xl border border-border bg-card p-5 soft-shadow"><div className="flex items-start justify-between gap-3"><div><p className="section-label">{label}</p><p className="mt-3 font-mono text-2xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</span></div></article>;
}

function PublicSnapshotLoading() {
  return <div data-testid="state-public-snapshot-loading" className="flex min-h-[100dvh] items-center justify-center bg-background px-5 text-foreground"><div className="text-center"><div className="mx-auto flex h-11 w-11 animate-pulse items-center justify-center rounded-xl bg-primary/15 text-primary"><CalendarDays className="h-5 w-5" /></div><p className="mt-4 text-sm font-semibold">Loading club snapshot…</p></div></div>;
}

function PublicSnapshotError({ onRetry }: { onRetry: () => void }) {
  return <div data-testid="state-public-snapshot-error" className="flex min-h-[100dvh] items-center justify-center bg-background px-5 text-foreground"><div className="w-full max-w-md rounded-2xl border border-border bg-card p-7 text-center soft-shadow"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Activity className="h-5 w-5" /></div><h1 className="mt-4 text-xl font-semibold">The public snapshot is unavailable</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">The club activity summary could not be loaded right now.</p><div className="mt-5 flex justify-center gap-2"><button onClick={onRetry} data-testid="button-retry-public-snapshot" className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Try again</button><a href="/dashboard" className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold">Member sign in</a></div></div></div>;
}

function DemoAdminNotice() {
  return <div className="flex min-h-[100dvh] items-center justify-center bg-background px-5 text-foreground"><div className="max-w-md rounded-2xl border border-border bg-card p-7 text-center soft-shadow"><h1 className="text-xl font-semibold">Committee tools aren&apos;t in the demo</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">The real site has a password-protected admin area for managing ledgers, profile pictures and member activity. It is left out here.</p><a href="/dashboard" className="mt-5 inline-flex rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Back to the dashboard</a></div></div>;
}

function AuthLoadingState() {
  return <div data-testid="state-auth-loading" className="flex min-h-[100dvh] items-center justify-center bg-background px-5 text-foreground"><div className="text-center"><div className="mx-auto flex h-11 w-11 animate-pulse items-center justify-center rounded-xl bg-primary/15 text-primary"><LockKeyhole className="h-5 w-5" /></div><p className="mt-4 text-sm font-semibold">Checking member access…</p></div></div>;
}

function SessionExpiredState({ onSignIn }: { onSignIn: () => void }) {
  return <div className="flex min-h-[100dvh] items-center justify-center bg-background px-5 text-foreground"><div className="max-w-md rounded-2xl border border-border bg-card p-7 text-center soft-shadow"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><LockKeyhole className="h-5 w-5" /></div><h1 className="mt-4 text-xl font-semibold">Your session has expired</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Sign in again to continue viewing the club dashboard.</p><button onClick={onSignIn} data-testid="button-session-sign-in" className="mt-5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Sign in again</button></div></div>;
}

function DashboardHome({ memberName, onLogout }: { memberName: string; onLogout: () => Promise<void> }) {
  const { canInstall, oneTap, platform, install, helpOpen, setHelpOpen } = useInstallPrompt();
  const dashboardQuery = useGetPokerDashboard();
  const { data: dashboard, isLoading, isError, error } = dashboardQuery;
  // Dark is the default. Only an explicit choice of light is remembered.
  const [isDark, setIsDark] = useState(() => {
    try {
      return window.localStorage.getItem("poker-theme") !== "light";
    } catch {
      return true;
    }
  });
  const [activeView, setActiveView] = useState<View>(() => getInitialDashboardView(window.location.search));
  const [breakdown, setBreakdown] = useState<BreakdownMode>("quarters");
  const [performanceScope, setPerformanceScope] = useState<PerformanceScope>("all");
  const [monthFilter, setMonthFilter] = useState<MonthFilter | null>("ALL");
  const [quarterFilter, setQuarterFilter] = useState<QuarterFilter>("ALL");
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSession, setSelectedSession] = useState<number | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [headA, setHeadA] = useState("");
  const [headB, setHeadB] = useState("");
  const [refreshError, setRefreshError] = useState(false);
  const [visualizerSearch, setVisualizerSearch] = useState("");

  useMemberUsageTracking(activeView);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    // Keep the browser's address bar / status bar colour in step with the page.
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", isDark ? "#100a19" : "#f8f6fc");
  }, [isDark]);
  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    try {
      window.localStorage.setItem("poker-theme", next ? "dark" : "light");
    } catch {
      // The choice still applies for this visit.
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setRefreshError(false);
    try {
      const fresh = await getPokerDashboard({ headers: { "Cache-Control": "no-cache" } });
      queryClient.setQueryData(dashboardQuery.queryKey, fresh);
    } catch {
      setRefreshError(true);
    } finally {
      window.setTimeout(() => setRefreshing(false), 650);
    }
  };

  const players = (dashboard?.leaderboard ?? []) as Player[];
  const sessions = (dashboard?.sessions ?? []) as Session[];
  const months = (dashboard?.months ?? []) as MonthlySummary[];
  const quarters = (dashboard?.quarters ?? []) as QuarterlySummary[];
  const history = (dashboard?.playerProfitHistory ?? []) as ProfitPoint[];
  const tournamentSnapshot = dashboard?.tournamentSnapshot as TournamentSnapshot | undefined;
  const tournaments = useMemo(
    () => ((dashboard?.tournaments ?? []) as TournamentEvent[]),
    [dashboard?.tournaments],
  );
  const tournamentSessions = useMemo(
    () => buildTournamentSessions(tournaments, tournamentSnapshot, sessions),
    [tournaments, tournamentSnapshot, sessions],
  );
  const scopePlayers = useMemo(() => {
    if (performanceScope === "cash" || !tournamentSnapshot) return players;
    return performanceScope === "tournaments"
      ? buildTournamentLeaderboard(tournamentSnapshot)
      : buildCombinedLeaderboard(players, tournamentSnapshot);
  }, [performanceScope, players, tournamentSnapshot]);
  const hasNumbers =
    players.length > 0 ||
    sessions.length > 0 ||
    history.length > 0 ||
    (dashboard?.tournamentSnapshot.players.length ?? 0) > 0;
  const availablePlayers = useMemo(() => players.map((player) => player.name), [players]);
  const currentSeasonMonth = useMemo<MonthFilter>(() => {
    const latestSession = sessions.slice().sort((left, right) => right.sessionNumber - left.sessionNumber)[0];
    return latestSession?.month ?? months.find((month) => month.sessionCount > 0)?.month ?? "ALL";
  }, [months, sessions]);
  const currentSeasonQuarter = useMemo<QuarterFilter>(() => {
    const latestSession = sessions.slice().sort((left, right) => right.sessionNumber - left.sessionNumber)[0];
    return latestSession ? quarterForMonth(latestSession.month) : quarters[quarters.length - 1]?.quarter ?? "ALL";
  }, [quarters, sessions]);
  const activeMonthFilter = monthFilter ?? currentSeasonMonth;
  const activeQuarterFilter = quarterFilter ?? currentSeasonQuarter;
  const activePeriodFilter = breakdown === "months" ? activeMonthFilter : activeQuarterFilter;
  const selectedPeriodKey = activePeriodFilter === "ALL" ? null : activePeriodFilter;
  const periods = useMemo<PeriodSummary[]>(() => {
    const basePeriods = breakdown === "months"
      ? months.map(({ month, ...summary }) => ({ key: month, ...summary }))
      : quarters.map(({ quarter, ...summary }) => ({ key: quarter, ...summary }));
    return buildScopePeriods(
      basePeriods,
      performanceScope,
      tournamentSessions,
      breakdown,
      sessions,
    );
  }, [breakdown, months, performanceScope, quarters, sessions, tournamentSessions]);
  const periodFilterOrder = useMemo(
    () => ["ALL", ...periods.map((period) => period.key)],
    [periods],
  );
  // One filter bar drives both leaderboards: the period picks the points season and the
  // Cash / Tournaments choice limits which nights are scored.
  const pointsSeasonKey = useMemo(
    () => seasonForPeriod(activePeriodFilter, breakdown, pointsSeasons(sessions, tournaments)),
    [activePeriodFilter, breakdown, sessions, tournaments],
  );
  const pointsKinds = useMemo<NightKind[] | undefined>(
    () => (performanceScope === "cash" ? ["cash"] : performanceScope === "tournaments" ? ["tournament"] : undefined),
    [performanceScope],
  );
  const fullScopeSessions = useMemo(() => {
    const cash = performanceScope === "tournaments" ? [] : sessions;
    const tournament = performanceScope !== "cash" ? tournamentSessions : [];
    return [...cash, ...tournament].sort(
      (left, right) =>
        left.date.localeCompare(right.date) ||
        left.sessionNumber - right.sessionNumber,
    );
  }, [performanceScope, sessions, tournamentSessions]);
  const scopeSessions = useMemo(
    () => selectedPeriodKey
      ? fullScopeSessions.filter((session) =>
        breakdown === "months"
          ? session.month === selectedPeriodKey
          : quarterForMonth(session.month) === selectedPeriodKey,
      )
      : fullScopeSessions,
    [breakdown, fullScopeSessions, selectedPeriodKey],
  );
  // Games has its own Cash / Tournaments switch, so these ignore the shared scope filter.
  const inSelectedPeriod = (date: string, month: string) =>
    !selectedPeriodKey ||
    (breakdown === "months" ? month === selectedPeriodKey : quarterForMonth(month) === selectedPeriodKey);
  const cashGamesInView = useMemo(
    () => sessions.filter((session) => inSelectedPeriod(session.date, session.month))
      .sort((left, right) => right.date.localeCompare(left.date) || right.sessionNumber - left.sessionNumber),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessions, selectedPeriodKey, breakdown],
  );
  const tournamentsInView = useMemo(
    () => tournaments.filter((event) => inSelectedPeriod(event.date, event.date.slice(5, 7))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tournaments, selectedPeriodKey, breakdown],
  );
  const seasonPlayers = useMemo(
    () => buildScopedPlayers(scopePlayers, scopeSessions),
    [scopePlayers, scopeSessions],
  );
  const visibleSessions = useMemo(() => {
    const needle = visualizerSearch.trim().toLocaleLowerCase();
    return scopeSessions.filter((session) => {
      if (!needle) return true;
      return [
        session.date,
        session.winner ?? "",
        session.lowPlayer ?? "",
        ...session.players.map((player) => player.player),
      ].some((value) => value.toLocaleLowerCase().includes(needle));
    });
  }, [scopeSessions, visualizerSearch]);
  const visiblePeriod = selectedPeriodKey
    ? periods.find((period) => period.key === selectedPeriodKey) ?? null
    : null;
  const updatedLabel = dashboard?.isStale
    ? `Last successful sync ${formatSyncTime(dashboard.lastUpdated)}`
    : `Synced ${formatSyncTime(dashboard?.lastUpdated ?? "")}`;
  const navigate = (view: View) => {
    setActiveView(view);
    const search = dashboardSearchForView(window.location.search, view);
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${search}${window.location.hash}`,
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const changePerformanceScope = (scope: PerformanceScope) => {
    setPerformanceScope(scope);
    setMonthFilter("ALL");
    setQuarterFilter("ALL");
    setVisualizerSearch("");
  };

  // Home always shows all earnings, whatever scope the Games/Players filters are set to.
  const homePlayers = useMemo(
    () => (tournamentSnapshot ? buildCombinedLeaderboard(players, tournamentSnapshot) : players),
    [players, tournamentSnapshot],
  );
  const homeSessions = useMemo(
    () =>
      [...sessions, ...tournamentSessions].sort(
        (left, right) => left.date.localeCompare(right.date) || left.sessionNumber - right.sessionNumber,
      ),
    [sessions, tournamentSessions],
  );
  const myStanding = useMemo(() => {
    const key = normalizePlayerName(memberName);
    const row = homePlayers.find((player) => normalizePlayerName(player.name) === key);
    if (!row) return undefined;
    const move = buildRankMovementMap(homePlayers, homeSessions).get(key);
    const movement = !move || move.direction === "new" ? null : move.direction === "up" ? move.places : move.direction === "down" ? -move.places : 0;
    return { rank: row.rank, of: homePlayers.length, movement, net: row.profitTotal };
  }, [homePlayers, homeSessions, memberName]);

  // A light status check so the Live tab can show when a game is in progress.
  const liveStatusQuery = useGetPokerLiveActivity({
    query: { queryKey: getGetPokerLiveActivityQueryKey(), refetchInterval: 30_000, staleTime: 15_000 },
  });
  const liveOpen = liveStatusQuery.data?.sessionStatus === "open";
  const memberAvatars = useMemberAvatars();
  const [showHistoryChart, setShowHistoryChart] = useState(false);
  const [gamesMode, setGamesMode] = useState<GamesMode>("all");
  const [selectedTournament, setSelectedTournament] = useState<string | null>(null);
  const isPlayersView = activeView === "months" || activeView === "players" || activeView === "head-to-head";
  const showFilters = activeView === "sessions" || isPlayersView;

  const openPlayer = (name: string) => {
    setSelectedPlayer(name);
    navigate("players");
  };
  const compareWith = (name: string) => {
    setHeadA(name);
    navigate("head-to-head");
  };
  const openGame = (sessionNumber: number) => {
    // Tournament sessions open the tournament; cash games open their card.
    const tournamentSession = tournamentSessions.find((session) => session.sessionNumber === sessionNumber);
    if (tournamentSession?.tournamentId) {
      openTournament(tournamentSession.tournamentId);
      return;
    }
    setGamesMode("all");
    setSelectedSession(sessionNumber);
    navigate("sessions");
  };
  const openTournament = (id: string | null) => {
    setGamesMode("tournaments");
    setSelectedTournament(id);
    navigate("sessions");
  };

  useEffect(() => {
    if (!headA && availablePlayers[0]) setHeadA(availablePlayers[0]);
    if (!headB && availablePlayers[1]) setHeadB(availablePlayers[1]);
  }, [availablePlayers, headA, headB]);

  if (isLoading) return <DashboardSkeleton />;
  if (isError && (error as { status?: number } | null)?.status === 401) return <SessionExpiredState onSignIn={() => void onLogout()} />;
  if (isError) return <ErrorState refreshing={refreshing} onRetry={handleRefresh} />;
  if (!dashboard) return <EmptyDashboard />;
  if (!hasNumbers && activeView !== "live") return <EmptyDashboard />;
  const totals = dashboard.totals;
  const allScopeSessionCount =
    (performanceScope === "tournaments" ? 0 : sessions.length) +
    (performanceScope !== "cash" ? tournamentSessions.length : 0);
  const allScopeBuyIns =
    performanceScope === "cash"
      ? totals.totalBuyIn
      : performanceScope === "tournaments"
        ? tournamentSnapshot?.totalInvested ?? 0
        : totals.totalBuyIn + tournamentSessions.reduce((sum, session) => sum + session.totalBuyIn, 0);

  return (
    <AvatarProvider avatars={memberAvatars}>
    <AchievementsProvider sessions={homeSessions} players={homePlayers} history={history}>
    <PointsProvider cashNights={sessions} tournaments={tournaments}>
    <NewBadgeNotice viewer={memberName} />
    <InstallHelpDialog open={helpOpen} onOpenChange={setHelpOpen} platform={platform} />
    <div className="min-h-[100dvh] bg-background text-foreground">
      <main className="min-h-[100dvh]">
        <div className="mx-auto max-w-[1450px] px-4 pb-24 pt-4 sm:px-7 lg:px-10 lg:pb-6 lg:pt-6">
          <header className="rise-in border-b border-border">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <button onClick={() => navigate("overview")} data-testid="button-brand-home" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl brand-mark bg-primary text-primary-foreground shadow-[0_3px_0_hsl(262_80%_40%)]" aria-label="Open overview"><CalendarDays className="h-5 w-5" /></button>
                <div className="flex min-w-0 items-baseline gap-2">
                  <p data-testid="text-dashboard-title" className="min-w-0 truncate text-lg font-semibold tracking-[-0.03em] sm:text-xl">{dashboard.title || "Poker Session Log & Months"}</p>
                  <a href="https://abhayjhade.com" target="_blank" rel="noreferrer" data-testid="link-creator-top" className="hidden shrink-0 text-[11px] font-medium text-muted-foreground transition-colors hover:text-primary hover:underline sm:inline">By Abhay Jhade</a>
                </div>
              </div>
              <div className="hidden flex-wrap items-center gap-2 print-hidden lg:flex">
                <button onClick={() => navigate("account")} data-testid="button-open-account" aria-label="Open my account" className={`inline-flex h-9 items-center gap-2 rounded-lg border bg-card pl-1.5 pr-3 text-xs font-semibold transition-transform hover:-translate-y-0.5 ${activeView === "account" ? "border-primary text-primary" : "border-border"}`}><Avatar name={memberName} size={24} />{memberName}</button>
                <button onClick={() => void onLogout()} data-testid="button-member-logout" className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-semibold transition-transform hover:-translate-y-0.5"><LogOut className="h-4 w-4" />Sign out</button>
                <button onClick={handleRefresh} disabled={refreshing} data-testid="button-refresh-dashboard" className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-semibold transition-transform hover:-translate-y-0.5 disabled:opacity-60"><Activity className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />{refreshing ? "Checking" : "Refresh"}</button>
                {!IS_DEMO && <a href={dashboard.spreadsheetUrl} target="_blank" rel="noreferrer" data-testid="link-open-spreadsheet" className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"><FileSpreadsheet className="h-4 w-4" />Open sheet<ExternalLink className="h-3 w-3 opacity-60" /></a>}
                {canInstall && <button onClick={() => void install()} data-testid="button-install-app" className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-semibold transition-transform hover:-translate-y-0.5"><Download className="h-4 w-4" />Install app</button>}
                <button onClick={toggleTheme} data-testid="button-toggle-theme" className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground" aria-label="Toggle dark mode">{isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
              </div>
              <div className="print-hidden lg:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" data-testid="button-mobile-dashboard-menu" aria-label="Open dashboard menu" className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-foreground">
                      <Menu className="h-5 w-5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel className="truncate text-xs text-muted-foreground">Signed in as {memberName}</DropdownMenuLabel>
                    <DropdownMenuItem onSelect={() => navigate("account")} data-testid="menu-open-account">
                      <Avatar name={memberName} size={20} />My account
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => void handleRefresh()} disabled={refreshing} data-testid="menu-refresh-dashboard">
                      <Activity className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />{refreshing ? "Refreshing…" : "Refresh dashboard"}
                    </DropdownMenuItem>
                    {!IS_DEMO && (
                    <DropdownMenuItem asChild>
                      <a href={dashboard.spreadsheetUrl} target="_blank" rel="noreferrer" data-testid="menu-open-spreadsheet">
                        <FileSpreadsheet className="h-4 w-4" />Open spreadsheet
                      </a>
                    </DropdownMenuItem>
                    )}
                    {canInstall && (
                      <DropdownMenuItem onSelect={() => void install()} data-testid="menu-install-app">
                        <Download className="h-4 w-4" />Install app
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onSelect={toggleTheme} data-testid="menu-toggle-theme">
                      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                      Switch to {isDark ? "light" : "dark"} mode
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => void onLogout()} data-testid="menu-member-logout" className="text-destructive focus:text-destructive">
                      <LogOut className="h-4 w-4" />Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <TopTabs active={activeView} onNavigate={navigate} liveOpen={liveOpen} />
            {(dashboard.isStale || refreshError) && <div data-testid={refreshError ? "status-refresh-error" : "status-stale-sync"} className="mb-3 inline-flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300"><Activity className="h-3.5 w-3.5" />{refreshError ? "Refresh failed. Showing the current dashboard data." : `Showing the last successful sync · ${updatedLabel}`}</div>}
          </header>

          <div key={activeView} className="view-enter">
              {isPlayersView && <PlayersSubnav active={activeView} onChange={navigate} />}
              {showFilters && (
                <FilterBar
                  showScope={activeView !== "sessions"}
                  scope={performanceScope}
                  onScope={changePerformanceScope}
                  breakdown={breakdown}
                  onBreakdown={(next) => {
                    setBreakdown(next);
                    if (next === "months") setQuarterFilter("ALL"); else setMonthFilter("ALL");
                    setVisualizerSearch("");
                  }}
                  period={activePeriodFilter}
                  onPeriod={(value) => {
                    if (breakdown === "months") setMonthFilter(value); else setQuarterFilter(value);
                    setVisualizerSearch("");
                  }}
                  periods={periodFilterOrder.map((value) => {
                    const period = periods.find((item) => item.key === value);
                    return value === "ALL"
                      ? { value, label: "All time", summary: `${allScopeSessionCount} games · ${compactCurrency(allScopeBuyIns)}` }
                      : { value, label: period?.label ?? value, summary: period ? `${period.sessionCount} games · ${compactCurrency(period.totalBuyIn)}` : "No games" };
                  })}
                />
              )}

            {activeView === "overview" && (
              <div className="mt-4">
                {canInstall && <InstallCard oneTap={oneTap} onInstall={() => void install()} />}
                {liveOpen && (
                  <LiveBanner
                    startedBy={liveStatusQuery.data?.startedBy ?? null}
                    buyIns={liveStatusQuery.data?.totals.buyIns ?? 0}
                    playerCount={liveStatusQuery.data?.playerSummaries.length ?? 0}
                    onOpen={() => navigate("live")}
                  />
                )}
                <HomeOverview
                  afterHero={<MyNightCard sessions={homeSessions} viewer={memberName} standing={myStanding} />}
                  memberName={memberName}
                  standings={homePlayers}
                  cashPlayers={players}
                  tournament={tournamentSnapshot}
                  tournamentCount={tournamentSessions.length}
                  sessions={homeSessions}
                  latestDate={dashboard.totals.latestGameDate ?? null}
                  onOpenSession={openGame}
                  onSeeGames={() => navigate("sessions")}
                  onSeePlayers={() => navigate("months")}
                  onOpenPlayer={openPlayer}
                  onOpenAccount={() => navigate("account")}
                  onSeePoints={() => {
                    navigate("months");
                    // The points table sits under the profit podium; bring it into view.
                    window.setTimeout(() => document.getElementById("club-points")?.scrollIntoView({ behavior: "smooth", block: "start" }), 350);
                  }}
                />
                {tournaments[0] && (
                  <div className="mt-4">
                    <LatestTournamentCard
                      event={tournaments[0]}
                      viewer={memberName}
                      totalEvents={tournaments.length}
                      onOpen={() => openTournament(tournaments[0].id)}
                      onSeeAll={() => openTournament(null)}
                    />
                  </div>
                )}
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <SeasonCard sessions={homeSessions} viewer={memberName} onOpenPlayer={openPlayer} />
                  <ClubBuzz sessions={homeSessions} viewer={memberName} onOpenPlayer={openPlayer} onCompare={compareWith} />
                </div>
                <div className="mt-4">
                  {showHistoryChart ? (
                    <Suspense fallback={<div className="h-72 skeleton rounded-2xl" />}>
                      <CumulativeProfitCard sessions={homeSessions} viewer={memberName} />
                    </Suspense>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowHistoryChart(true)}
                      data-testid="button-show-history-chart"
                      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-dashed border-border bg-card px-5 py-4 text-left transition-colors hover:border-primary/50 hover:bg-secondary/40"
                    >
                      <span>
                        <span className="block text-sm font-semibold">Show everyone&apos;s running totals</span>
                        <span className="block text-xs text-muted-foreground">A line chart of net profit game by game, with you highlighted.</span>
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            )}

          <div className="mt-4">
            <Suspense fallback={<div data-testid="state-view-loading" className="h-64 skeleton rounded-2xl" />}>
            {activeView === "sessions" && <GamesView mode={gamesMode} onMode={(mode) => { setGamesMode(mode); setSelectedTournament(null); }} cashSessions={cashGamesInView} tournaments={tournamentsInView} viewer={memberName} selectedSession={selectedSession} onSelectSession={setSelectedSession} selectedTournament={selectedTournament} onSelectTournament={setSelectedTournament} onOpenPlayer={openPlayer} />}
              {activeView === "live" && (
                <>
                  <button type="button" onClick={() => navigate("guidelines")} data-testid="link-live-rules" className="mb-1 inline-flex min-h-[44px] items-center text-xs font-semibold text-primary hover:underline">Blind schedule &amp; rules →</button>
                  <LiveSessionView memberName={memberName} availablePlayers={availablePlayers} />
                </>
              )}
             {activeView === "months" && (
              <PointsSeasonProvider season={pointsSeasonKey} kinds={pointsKinds}>
                <PeriodLeaderboards players={selectedPeriodKey ? seasonPlayers : scopePlayers} sessions={scopeSessions} allSessions={homeSessions} activePeriod={activePeriodFilter} scope={performanceScope} viewer={memberName} onSelectPlayer={openPlayer}
                afterPodium={<PointsPodiumCard viewer={memberName} onOpenPlayer={openPlayer} selectable />}
                afterOverview={
                  <div id="club-points" className="scroll-mt-4">
                    <PointsLeaderboard viewer={memberName} onOpenPlayer={openPlayer} />
                  </div>
                }
              />
              </PointsSeasonProvider>
            )}
            {activeView === "head-to-head" && <HeadToHeadView players={selectedPeriodKey ? seasonPlayers : scopePlayers} sessions={scopeSessions} scope={performanceScope} initialPlayer={null} headA={headA} headB={headB} onA={setHeadA} onB={setHeadB} />}
              {activeView === "players" && <PlayersView players={selectedPeriodKey ? seasonPlayers : scopePlayers} sessions={scopeSessions} allSessions={homeSessions} tournaments={tournaments} onOpenTournament={openTournament} scope={performanceScope} initialPlayer={selectedPlayer ?? memberName} viewer={memberName} onCompare={compareWith} />}
             {activeView === "guidelines" && <GuidelinesView />}
            {activeView === "account" && (
              <AccountView
                memberName={memberName}
                sessions={homeSessions}
                standing={myStanding}
                isDark={isDark}
                onToggleTheme={toggleTheme}
                canInstall={canInstall}
                onInstall={() => void install()}
                spreadsheetUrl={IS_DEMO ? null : dashboard.spreadsheetUrl ?? null}
                onLogout={() => void onLogout()}
                onOpenProfile={() => openPlayer(memberName)}
              />
            )}
            </Suspense>
          </div>

          </div>
          <footer className="mt-8 grid gap-4 border-t border-border py-7 text-xs text-muted-foreground sm:grid-cols-[1fr_auto_auto] sm:items-end">
             <div className="space-y-1"><p className="font-mono text-[11px] uppercase tracking-[0.14em] text-foreground">{sessions.length} cash games{tournamentSessions.length ? ` · ${tournamentSessions.length} ${tournamentSessions.length === 1 ? "tournament" : "tournaments"}` : ""} · {dashboard.totals.totalRecords} player results</p><p data-testid="text-footer-latest">{dashboard.totals.latestSession ? `Latest game #${dashboard.totals.latestSession}` : "Season in progress"}</p></div>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em]">{IS_DEMO ? "Demo data · every name is fictional" : "Numbers sourced from the club sheet"}</span>
            <a href="https://abhayjhade.com" target="_blank" rel="noreferrer" data-testid="link-portfolio" className="inline-flex min-h-[44px] items-center gap-1.5 font-medium text-primary hover:underline">More work by Abhay <span aria-hidden="true">→</span></a>
          </footer>
        </div>
      </main>
      <BottomTabBar active={activeView} onNavigate={navigate} liveOpen={liveOpen} />
      {IS_DEMO && <DemoTour activeView={activeView} onNavigate={navigate} />}
    </div>
    </PointsProvider>
    </AchievementsProvider>
    </AvatarProvider>
  );
}

function ErrorState({ refreshing, onRetry }: { refreshing: boolean; onRetry: () => void }) { return <div className="flex min-h-[100dvh] items-center justify-center bg-background px-5 text-foreground"><div data-testid="state-dashboard-error" className="max-w-md rounded-2xl border border-destructive/30 bg-card p-7 text-center soft-shadow"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive"><Activity className="h-5 w-5" /></div><h1 className="mt-4 text-xl font-semibold">The club sheet is out of reach</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">The last dashboard request did not complete. Your figures have not been changed.</p><button onClick={onRetry} disabled={refreshing} data-testid="button-retry-dashboard" className="mt-5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">{refreshing ? "Checking source" : "Try again"}</button></div></div>; }
function EmptyDashboard() { return <div className="flex min-h-[100dvh] items-center justify-center bg-background px-5 text-foreground"><EmptyPanel title="No season figures yet" description="The connected sheet is ready, but there are no recorded poker sessions to display." /></div>; }
function DashboardSkeleton() { return <div data-testid="state-dashboard-loading" className="min-h-[100dvh] bg-background p-5 text-foreground sm:p-10"><div className="mx-auto max-w-[1200px] animate-pulse space-y-5"><div className="h-8 w-56 rounded-lg bg-secondary" /><div className="h-16 w-3/4 rounded-xl bg-secondary" /><div className="grid grid-cols-2 gap-3 md:grid-cols-6">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-28 rounded-2xl bg-secondary" />)}</div><div className="h-80 rounded-2xl bg-secondary" /><div className="grid gap-3 md:grid-cols-3">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-44 rounded-2xl bg-secondary" />)}</div></div></div>; }
function formatSyncTime(value: string) { const date = new Date(value); if (Number.isNaN(date.getTime())) return "recently"; return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(date); }
function quarterForMonth(value: string): string { const month = Number(value); return month <= 3 ? "Q1" : month <= 6 ? "Q2" : month <= 9 ? "Q3" : "Q4"; }
function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><ErrorBoundary><WouterRouter><Switch><Route path="/admin">{IS_DEMO ? <DemoAdminNotice /> : <Suspense fallback={<AuthLoadingState />}><AdminPage /></Suspense>}</Route><Route path="/dashboard" component={Home} /><Route path="/public" component={PublicSnapshotPage} /><Route path="/" component={RootLandingPage} /><Route component={NotFound} /></Switch></WouterRouter><Toaster /></ErrorBoundary></TooltipProvider></QueryClientProvider>;
}

export default App;