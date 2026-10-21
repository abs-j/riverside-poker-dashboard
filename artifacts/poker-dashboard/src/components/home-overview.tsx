import { useMemo, type ReactNode } from "react";
import { CalendarDays } from "lucide-react";
import { ChartCard, ColumnChart, type Column } from "@/components/club-charts";
import { buildResultsByGame, normalizeName, type ChartSession } from "@/lib/club-charts";
import type { DashboardPlayer as Player, TournamentSnapshot } from "@/lib/earnings-analytics";
import { AnimatedNumber } from "@/components/animated-number";
import { usePoints } from "@/components/points-context";
import { PointsPodiumCard } from "@/components/points-podium-card";
import { pointsFor } from "@/lib/points";
import { Podium } from "@/components/podium";
import { Avatar } from "@/components/avatar";
import { prefersReducedMotion } from "@/lib/motion";
import { formatDate, signedCurrency } from "@/views/shared";
import "./home-overview.css";

type HomeOverviewProps = {
  memberName: string;
  /** Combined cash + tournament standings, ranked. */
  standings: Player[];
  /** Cash-only totals, used for the cash/tournament split. */
  cashPlayers: Player[];
  tournament: TournamentSnapshot | undefined;
  /** Every game, cash and tournament, for the results-by-game chart. */
  sessions: ChartSession[];
  latestDate: string | null;
  onOpenSession: (sessionNumber: number) => void;
  onSeeGames: () => void;
  onSeePlayers: () => void;
  onOpenPlayer: (name: string) => void;
  onOpenAccount: () => void;
  /** Opens the club points table. */
  onSeePoints: () => void;
  /** How many tournaments the totals include. */
  tournamentCount?: number;
  /** Shown between the headline numbers and the standings (the last-game card). */
  afterHero?: ReactNode;
};

/** The top of the Home page: where you stand, how it breaks down, and your game-by-game form. */
export function HomeOverview({
  memberName,
  standings,
  cashPlayers,
  tournament,
  sessions,
  latestDate,
  onOpenSession,
  onSeeGames,
  onSeePlayers,
  onOpenPlayer,
  onOpenAccount,
  onSeePoints,
  tournamentCount = 0,
  afterHero,
}: HomeOverviewProps) {
  const key = normalizeName(memberName);
  const { currentSeason, rowsFor } = usePoints();
  const myPoints = currentSeason ? pointsFor(rowsFor(currentSeason), memberName) : null;
  const me = standings.find((player) => normalizeName(player.name) === key);
  const cashNet = cashPlayers.find((player) => normalizeName(player.name) === key)?.profitTotal ?? 0;
  const tournamentNet = tournament?.available
    ? tournament.players.find((player) => normalizeName(player.player) === key)?.netProfit ?? 0
    : null;
  const total = me ? me.profitTotal : null;
  const rest = standings.slice(3, 5);

  const results = useMemo(() => buildResultsByGame(sessions, memberName), [sessions, memberName]);
  const columns = useMemo<Column[]>(
    () =>
      results.map((game) => ({
        key: String(game.sessionNumber),
        value: game.net,
        axis: formatDate(game.date, "d MMM"),
        title: formatDate(game.date),
        rows: [
          { label: "Result", value: signedCurrency(game.net) },
          { label: "Players at the table", value: String(game.playerCount) },
        ],
      })),
    [results],
  );

  return (
    <section data-testid="section-home-overview" className="story-first">
      <div className="sf-wrap stagger">
        <div className="sf-intro">
          <div className="flex min-w-0 items-center gap-3.5">
            <button
              type="button"
              onClick={onOpenAccount}
              aria-label="Open my account"
              data-testid="button-home-avatar"
              className="shrink-0 rounded-full transition-transform hover:scale-105"
            >
              <Avatar name={memberName} size={52} />
            </button>
            <div className="min-w-0">
              <p className="sf-kicker">Welcome back, {memberName}</p>
              <h1>
                Your game, <em>in numbers.</em>
              </h1>
            </div>
          </div>
          {latestDate && (
            <div className="sf-date-tag" data-testid="text-earnings-through">
              <CalendarDays size={14} aria-hidden="true" /> Through {formatDate(latestDate, "d MMM yyyy")}
            </div>
          )}
        </div>

        <div className="sf-story">
          <div
            className="sf-hero-card"
            onPointerMove={(event) => {
              if (prefersReducedMotion() || event.pointerType === "touch") return;
              const box = event.currentTarget.getBoundingClientRect();
              const px = (event.clientX - box.left) / box.width - 0.5;
              const py = (event.clientY - box.top) / box.height - 0.5;
              event.currentTarget.style.transform = `perspective(900px) rotateX(${(-py * 4).toFixed(2)}deg) rotateY(${(px * 5).toFixed(2)}deg)`;
            }}
            onPointerLeave={(event) => {
              event.currentTarget.style.transform = "";
            }}
          >
            <span className="sf-blob sf-blob-a" aria-hidden="true" />
            <span className="sf-blob sf-blob-b" aria-hidden="true" />
            <p className="sf-label" data-testid="text-personal-net-label">Your all-time net</p>
            <div className="sf-money" data-testid="text-personal-net">
              {total === null ? "—" : <AnimatedNumber value={total} format={signedCurrency} />}
            </div>
            <div className="sf-hero-bottom">
              <span className="sf-rank-pill" data-testid="text-personal-rank">
                {me ? `#${me.rank} of ${standings.length} on profit` : "Not on the leaderboard yet"}
              </span>
              {myPoints && (
                <span className="sf-rank-pill" data-testid="text-points-rank">
                  #{myPoints.rank} · {Math.round(myPoints.points)} club pts
                </span>
              )}
              <span>Cash games{tournament?.available ? " + tournament" : ""}</span>
            </div>
            <div className="sf-split-inline">
              <span>Cash <strong>{signedCurrency(cashNet)}</strong></span>
              {tournamentNet !== null && <span>Tournament <strong>{signedCurrency(tournamentNet)}</strong></span>}
            </div>
          </div>

          <aside className="sf-side-card">
            <h2>Where it came from</h2>
            <div className="sf-split">
              <div>
                <span>Cash games</span>
                <strong data-testid="text-cash-net"><AnimatedNumber value={cashNet} format={signedCurrency} /></strong>
              </div>
              <div>
                <span>Tournament</span>
                <strong data-testid="text-tournament-net">
                  {tournamentNet === null ? "—" : <AnimatedNumber value={tournamentNet} format={signedCurrency} />}
                </strong>
              </div>
            </div>
            <p className="sf-note">
              {tournament?.available && tournament.eventDate
                ? `${tournamentCount > 1 ? `${tournamentCount} tournaments, latest ` : "Tournament on "}${formatDate(tournament.eventDate)}. Results use net profit only.`
                : "Cash game totals from the club sheet."}
            </p>
          </aside>
        </div>

        {afterHero && <div style={{ marginTop: 16 }}>{afterHero}</div>}

        <div className="sf-content" style={{ marginTop: 16, alignItems: "stretch" }}>
          <ChartCard
            testId="card-home-standings"
            eyebrow="All-time profit"
            title="The profit podium"
            action={
              <button type="button" onClick={onSeePlayers} className="inline-flex min-h-[44px] items-center self-start whitespace-nowrap text-xs font-semibold text-primary hover:underline sm:self-auto">
                Full leaderboard →
              </button>
            }
          >
            <Podium players={standings} viewer={memberName} onOpenPlayer={onOpenPlayer} onOpenBoard={onSeePlayers} />
            <div className="sf-ranking" style={{ padding: 0, marginTop: 20 }}>
              {rest.map((row) => {
                const isMe = normalizeName(row.name) === key;
                return (
                  <button
                    type="button"
                    key={row.name}
                    onClick={() => onOpenPlayer(row.name)}
                    data-testid={`row-earnings-standing-${normalizeName(row.name).replace(/[^a-z0-9]+/g, "-")}`}
                    className={`sf-rank-row w-full text-left ${isMe ? "is-member" : ""}`}
                  >
                    <span className="sf-rank-num">{row.rank}</span>
                    <span className="sf-rank-name">
                      {row.name}
                      {isMe && <span className="sf-you">you</span>}
                    </span>
                    <span className={`sf-rank-value ${row.profitTotal >= 0 ? "sf-positive" : "sf-negative"}`}>
                      {signedCurrency(row.profitTotal)}
                    </span>
                  </button>
                );
              })}
              {me && me.rank > 5 && (
                <button
                  type="button"
                  onClick={() => onOpenPlayer(me.name)}
                  className="sf-rank-row is-member w-full text-left"
                >
                  <span className="sf-rank-num">{me.rank}</span>
                  <span className="sf-rank-name">{me.name}<span className="sf-you">you</span></span>
                  <span className={`sf-rank-value ${me.profitTotal >= 0 ? "sf-positive" : "sf-negative"}`}>{signedCurrency(me.profitTotal)}</span>
                </button>
              )}
            </div>
          </ChartCard>

          <PointsPodiumCard
            viewer={memberName}
            onOpenPlayer={onOpenPlayer}
            season={currentSeason ?? undefined}
            eyebrow="Club points"
            onSeeAll={onSeePoints}
            withRunnersUp
            testId="card-home-points-podium"
          />
        </div>

        <div style={{ marginTop: 16 }}>
          <ChartCard
            testId="card-home-results"
            eyebrow="Your form"
            title="Result by game"
            description="Net profit or loss each time you played. Click a column to open the game."
            action={
              <button type="button" onClick={onSeeGames} className="inline-flex min-h-[44px] items-center self-start whitespace-nowrap text-xs font-semibold text-primary hover:underline sm:self-auto">
                All games →
              </button>
            }
          >
            {columns.length ? (
              <ColumnChart
                columns={columns}
                diverging
                height={300}
                label={`${memberName} result by game`}
                onSelect={(key) => onOpenSession(Number(key))}
                testId="chart-home-results"
              />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">Your results will appear here after your first recorded game.</p>
            )}
          </ChartCard>
        </div>
      </div>
    </section>
  );
}
