import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { SessionCard, SessionsView } from "./sessions-view";
import { TournamentCard, TournamentsView } from "./tournaments-view";
import { EmptyPanel, PageIntro, formatCurrency } from "./shared";
import type { PerformanceScope, DashboardSession as Session, TournamentEvent } from "@/lib/earnings-analytics";

export type GamesMode = "all" | "cash" | "tournaments";

type GamesViewProps = {
  mode: GamesMode;
  onMode: (mode: GamesMode) => void;
  cashSessions: Session[];
  tournaments: TournamentEvent[];
  viewer: string;
  selectedSession: number | null;
  onSelectSession: (number: number | null) => void;
  selectedTournament: string | null;
  onSelectTournament: (id: string | null) => void;
  onOpenPlayer: (name: string) => void;
};

function Tile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="soft-shadow rounded-2xl border border-border bg-card p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-mono text-xl font-semibold">{value}</p>
      {detail && <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>}
    </div>
  );
}

type Item =
  | { kind: "cash"; date: string; order: number; session: Session }
  | { kind: "tournament"; date: string; order: number; event: TournamentEvent };

/** Every game, newest first, with cash nights and tournaments mixed together. */
function AllGames(props: GamesViewProps) {
  const items = useMemo<Item[]>(() => {
    const cash: Item[] = props.cashSessions.map((session) => ({ kind: "cash", date: session.date, order: session.sessionNumber, session }));
    const tournaments: Item[] = props.tournaments.map((event, index) => ({ kind: "tournament", date: event.date, order: 10_000 + index, event }));
    return [...cash, ...tournaments].sort((a, b) => b.date.localeCompare(a.date) || b.order - a.order);
  }, [props.cashSessions, props.tournaments]);

  const totals = useMemo(() => {
    const cashPot = props.cashSessions.reduce((sum, session) => sum + session.totalBuyIn, 0);
    const tournamentPot = props.tournaments.reduce((sum, event) => sum + event.totalCollected, 0);
    return { cashPot, tournamentPot, players: new Set(
      [
        ...props.cashSessions.flatMap((session) => session.players.map((p) => p.player.trim().toLowerCase())),
        ...props.tournaments.flatMap((event) => event.results.map((r) => r.player.trim().toLowerCase())),
      ].filter((name) => name !== "bad beat jackpot"),
    ).size };
  }, [props.cashSessions, props.tournaments]);

  if (items.length === 0) {
    return <EmptyPanel title="No games in this selection" description="Try another month or quarter." />;
  }

  return (
    <section data-testid="section-all-games" className="space-y-4">
      <div data-testid="summary-all-games" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Games" value={String(items.length)} detail={`${props.cashSessions.length} cash · ${props.tournaments.length} tournaments`} />
        <Tile label="Cash buy-ins" value={formatCurrency(totals.cashPot)} detail="Across cash games" />
        <Tile label="Tournament pools" value={formatCurrency(totals.tournamentPot)} detail="Everything collected" />
        <Tile label="Players" value={String(totals.players)} detail="Different people" />
      </div>
      <div data-testid="grid-all-games" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item, index) =>
          item.kind === "cash" ? (
            <div
              key={`cash-${item.session.sessionNumber}`}
              id={`game-${item.session.sessionNumber}`}
              className="stagger-item scroll-mt-24"
              style={{ "--i": Math.min(index, 14) } as React.CSSProperties}
            >
              <SessionCard
                session={item.session}
                expanded={props.selectedSession === item.session.sessionNumber}
                onToggle={() =>
                  props.onSelectSession(props.selectedSession === item.session.sessionNumber ? null : item.session.sessionNumber)
                }
                onOpenPlayer={props.onOpenPlayer}
              />
            </div>
          ) : (
            <div key={`tournament-${item.event.id}`} className="stagger-item" style={{ "--i": Math.min(index, 14) } as React.CSSProperties}>
              <TournamentCard
                event={item.event}
                viewer={props.viewer}
                onOpen={() => {
                  props.onMode("tournaments");
                  props.onSelectTournament(item.event.id);
                }}
              />
            </div>
          ),
        )}
      </div>
    </section>
  );
}

/** Games: everything by default, or just cash games or just tournaments. */
export function GamesView(props: GamesViewProps) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLocaleLowerCase();
  // Searching narrows every mode to the games that player was in.
  const cashSessions = useMemo(
    () =>
      needle
        ? props.cashSessions.filter((session) => session.players.some((p) => p.player.toLocaleLowerCase().includes(needle)))
        : props.cashSessions,
    [props.cashSessions, needle],
  );
  const tournaments = useMemo(
    () =>
      needle
        ? props.tournaments.filter((event) => event.results.some((r) => r.player.toLocaleLowerCase().includes(needle)))
        : props.tournaments,
    [props.tournaments, needle],
  );
  const view = { ...props, cashSessions, tournaments };

  const choices: Array<{ value: GamesMode; label: string; count: number }> = [
    { value: "all", label: "All", count: cashSessions.length + tournaments.length },
    { value: "cash", label: "Cash games", count: cashSessions.length },
    { value: "tournaments", label: "Tournaments", count: tournaments.length },
  ];
  return (
    <div data-testid="section-games" className="space-y-4">
      <PageIntro
        eyebrow="Games"
        title="Every game, in context"
        description="Cash nights and tournaments, newest first. Open one for everyone's result and a recap to share."
        count={`${cashSessions.length + tournaments.length} in view`}
        compactOnMobile
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="group" aria-label="Game type" className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-secondary/55 p-1">
          {choices.map((choice) => (
            <button
              key={choice.value}
              type="button"
              aria-pressed={props.mode === choice.value}
              data-testid={`button-games-mode-${choice.value}`}
              onClick={() => props.onMode(choice.value)}
              className={`min-h-10 shrink-0 rounded-lg px-2 text-sm font-semibold transition-colors sm:px-4 ${
                props.mode === choice.value ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {choice.label}
              <span className="ml-1.5 rounded-full bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground sm:ml-2 sm:px-2">{choice.count}</span>
            </button>
          ))}
        </div>
        <label className="relative block sm:w-64">
          <span className="sr-only">Find a player in these games</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a player"
            data-testid="input-games-search"
            className="h-11 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </label>
      </div>
      {props.mode === "all" ? (
        <AllGames {...view} />
      ) : props.mode === "cash" ? (
        <SessionsView
          sessions={cashSessions}
          scope={"cash" as PerformanceScope}
          selectedSession={props.selectedSession}
          onSelectSession={props.onSelectSession}
          onOpenPlayer={props.onOpenPlayer}
          hideIntro
        />
      ) : (
        <TournamentsView
          tournaments={tournaments}
          viewer={props.viewer}
          selectedId={props.selectedTournament}
          onSelect={props.onSelectTournament}
          onOpenPlayer={props.onOpenPlayer}
        />
      )}
    </div>
  );
}
