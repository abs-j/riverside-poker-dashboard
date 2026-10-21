import { type PerformanceScope, type DashboardPlayer as Player, type DashboardSession as Session, type TournamentEvent } from "@/lib/earnings-analytics";
import { TournamentRecordCard } from "@/components/tournament-record-card";
import { PointsBreakdownCard } from "@/components/points-breakdown-card";
import { Activity, CalendarDays, Camera, ChevronDown, CircleDollarSign, Search, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChartCard, ColumnChart, type Column } from "@/components/club-charts";
import { buildRegularOpponents, buildResultsByGame } from "@/lib/club-charts";
import { badgesFor, buildFormDots } from "@/lib/achievements";
import { useAchievements } from "@/components/achievements-context";
import { careerFor } from "@/lib/career";
import { BadgeChips, FormDots } from "@/components/form-dots";
import { Avatar } from "@/components/avatar";
import { TrophyShelf } from "@/components/trophy-shelf";
import { AvatarPickerDialog } from "@/components/avatar-picker-dialog";
import { avatarKey, useMemberAvatars } from "@/lib/avatars";
import { CartesianGrid, Tooltip as ChartTooltip, Line, LineChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { ChartEmpty, DataTooltip, EmptyPanel, HeadMetric, MetricCard, PageIntro, compactCurrency, formatCurrency, formatDate, monthLabel, normalizePlayerName, signedCurrency } from "./shared";

export function PlayersView({ players, sessions, allSessions, tournaments, onOpenTournament, scope, initialPlayer, viewer, onCompare }: { players: Player[]; sessions: Session[]; allSessions: Session[]; tournaments: TournamentEvent[]; onOpenTournament: (id: string) => void; scope: PerformanceScope; initialPlayer: string | null; viewer: string; onCompare: (name: string) => void }) {
  const activityLabel = scope === "tournaments" ? "Events" : "Games";
  const returnLabel = scope === "cash" ? "Cash-out" : scope === "tournaments" ? "Payout" : "Returned";
  const rateLabel = scope === "tournaments" ? "event" : "game";
  const defaultPlayer =
    players.find((player) => initialPlayer && normalizePlayerName(player.name) === normalizePlayerName(initialPlayer))?.name
    ?? players[0]?.name
    ?? "";
  const [playerQuery, setPlayerQuery] = useState(defaultPlayer);
  const [selectedName, setSelectedName] = useState(defaultPlayer);
  const [playerPickerOpen, setPlayerPickerOpen] = useState(false);
  const playerPickerRef = useRef<HTMLDivElement>(null);
  const filteredPlayers = useMemo(() => {
    const needle = normalizePlayerName(playerQuery);
    return players.filter((player) => !needle || normalizePlayerName(player.name).includes(needle));
  }, [players, playerQuery]);

  useEffect(() => {
    if (!players.some((player) => player.name === selectedName)) {
      const nextName = players[0]?.name ?? "";
      setSelectedName(nextName);
      setPlayerQuery(nextName);
    }
  }, [players, selectedName]);

  useEffect(() => {
    if (!playerPickerOpen) return;
    const handleOutsidePointer = (event: PointerEvent) => {
      if (!playerPickerRef.current?.contains(event.target as Node)) setPlayerPickerOpen(false);
    };
    document.addEventListener("pointerdown", handleOutsidePointer);
    return () => document.removeEventListener("pointerdown", handleOutsidePointer);
  }, [playerPickerOpen]);

  const selectedPlayer = players.find((player) => player.name === selectedName);
  const isOwnProfile = Boolean(selectedPlayer) && normalizePlayerName(selectedPlayer!.name) === normalizePlayerName(viewer);
  const { badges: badgeMap, careers } = useAchievements();
  const memberAvatars = useMemberAvatars();
  const [pickerOpen, setPickerOpen] = useState(false);
  const playerGames = useMemo(() => sessions
    .flatMap((session) => {
      const result = session.players.find((player) => normalizePlayerName(player.player) === normalizePlayerName(selectedName));
      return result ? [{ session, result }] : [];
    })
    .sort((left, right) => right.session.sessionNumber - left.session.sessionNumber), [sessions, selectedName]);
  const profitCurve = useMemo(() => {
    let cumulativeProfit = 0;
    return playerGames.slice().sort((left, right) => left.session.sessionNumber - right.session.sessionNumber).map(({ session, result }) => {
      cumulativeProfit += result.net;
      return {
        sessionNumber: session.sessionNumber,
        eventLabel: session.eventType === "tournament" ? "Tournament" : `#${session.sessionNumber}`,
        cumulativeProfit,
      };
    });
  }, [playerGames]);
  const choosePlayer = (name: string) => {
    setSelectedName(name);
    setPlayerQuery(name);
    setPlayerPickerOpen(false);
  };

  return (
    <section data-testid="section-players" className="space-y-4">
      <PageIntro eyebrow={`Player profiles / ${scope === "all" ? "all earnings" : scope === "cash" ? "cash games" : "tournaments"}`} title="Players" description="Search or select a player to see stats for the selected earnings scope and period." count={`${players.length} players in view`} />
      <div className="soft-shadow rounded-2xl border border-border bg-card p-4 sm:p-5">
        <label className="block max-w-xl">
          <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Find a player</span>
          <div ref={playerPickerRef} className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={playerQuery} onFocus={() => { setPlayerQuery(""); setPlayerPickerOpen(true); }} onChange={(event) => { setPlayerQuery(event.target.value); setPlayerPickerOpen(true); }} onKeyDown={(event) => { if (event.key === "Escape") setPlayerPickerOpen(false); if (event.key === "Enter" && filteredPlayers[0]) { event.preventDefault(); choosePlayer(filteredPlayers[0].name); } }} data-testid="input-player-search" role="combobox" aria-expanded={playerPickerOpen} aria-controls="player-profile-options" aria-autocomplete="list" type="search" placeholder="Search or select a player" className="h-11 w-full rounded-xl border border-border bg-background pl-9 pr-11 text-sm outline-none focus:border-primary" />
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setPlayerQuery(""); setPlayerPickerOpen((open) => !open); }} aria-label="Open player list" className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-muted-foreground">
              <ChevronDown className={`h-4 w-4 transition-transform ${playerPickerOpen ? "rotate-180" : ""}`} />
            </button>
            {playerPickerOpen && <div id="player-profile-options" role="listbox" className="absolute z-30 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-xl">
              {filteredPlayers.length ? filteredPlayers.map((player) => <button type="button" role="option" aria-selected={player.name === selectedName} key={player.name} onMouseDown={(event) => event.preventDefault()} onClick={() => choosePlayer(player.name)} className={`flex min-h-11 w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-secondary ${player.name === selectedName ? "bg-primary/10 font-semibold text-primary" : ""}`}>
                <span className="truncate">{player.name}</span>
                <span className="ml-3 shrink-0 font-mono text-xs text-muted-foreground">{signedCurrency(player.profitTotal)}</span>
              </button>) : <p className="px-3 py-4 text-center text-xs text-muted-foreground">No players match that search.</p>}
            </div>}
          </div>
          <span className="mt-2 block text-xs text-muted-foreground">{playerPickerOpen ? `${filteredPlayers.length} player${filteredPlayers.length === 1 ? "" : "s"} found · tap a name to view stats` : "Tap to search or choose from the player list."}</span>
        </label>
      </div>

      {selectedPlayer ? <>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard testId="metric-player-profit" label="Profit" value={signedCurrency(selectedPlayer.profitTotal)} detail={`${selectedPlayer.positiveSessionPct.toFixed(1)}% positive games`} tone={selectedPlayer.profitTotal >= 0 ? "positive" : "negative"} icon={<CircleDollarSign />} />
          <MetricCard testId="metric-player-games" label={activityLabel} value={String(selectedPlayer.gamesPlayed)} detail={`${activityLabel} in the selected scope`} icon={<CalendarDays />} />
          <MetricCard testId="metric-player-buy-ins" label="Buy-ins" value={formatCurrency(selectedPlayer.buyInTotal)} detail={`${formatCurrency(selectedPlayer.buyInPerGame)} per game`} icon={<Activity />} />
          <MetricCard testId="metric-player-cash-out" label={returnLabel} value={formatCurrency(selectedPlayer.cashOutTotal)} detail={`Net ${selectedPlayer.netPct.toFixed(1)}% of buy-ins`} icon={<Users />} />
        </div>

        <div className="soft-shadow rounded-2xl border border-border bg-card p-5 sm:p-6">
          <p className="section-label">Profit over time</p>
          <h2 className="mt-1 text-lg font-semibold">Cumulative profit by {scope === "tournaments" ? "event" : "game"}</h2>
          <p className="mt-1 text-xs text-muted-foreground">Based on the {playerGames.length} {playerGames.length === 1 ? "game" : "games"} on record; earlier results are included in the totals above.</p>
          <div className="mt-5 h-[280px]" data-testid="chart-player-profit">
            {profitCurve.length ? <ResponsiveContainer width="100%" height="100%">
              <LineChart data={profitCurve} margin={{ top: 12, right: 8, left: -15, bottom: 0 }}>
                <CartesianGrid stroke="hsl(var(--foreground) / .08)" vertical={false} strokeDasharray="3 4" />
                <XAxis dataKey="eventLabel" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(value) => compactCurrency(value)} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground) / .5)" strokeDasharray="4 4" />
                <ChartTooltip content={<DataTooltip />} />
                <Line dataKey="cumulativeProfit" name="Cumulative profit" stroke="hsl(var(--chart-1))" strokeWidth={2.5} dot={{ r: 2.5, fill: "hsl(var(--chart-1))" }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer> : <ChartEmpty label="Profit history will appear after this player records games." />}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="soft-shadow rounded-2xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-4">
                {isOwnProfile ? (
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    aria-label="Change your profile picture"
                    data-testid="button-change-avatar"
                    className="group relative shrink-0 rounded-full"
                  >
                    <Avatar name={selectedPlayer.name} size={64} />
                    <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow transition-transform group-hover:scale-110">
                      <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  </button>
                ) : (
                  <Avatar name={selectedPlayer.name} size={64} />
                )}
                <div className="min-w-0">
                  <p className="section-label">Profile</p>
                  <h2 className="mt-1 truncate text-lg font-semibold">{selectedPlayer.name}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2" data-testid="player-achievements">
                    <FormDots dots={buildFormDots(allSessions, selectedPlayer.name)} />
                    <BadgeChips badges={badgesFor(badgeMap, selectedPlayer.name)} />
                  </div>
                  {isOwnProfile && (
                    <button type="button" onClick={() => setPickerOpen(true)} className="mt-2 text-xs font-semibold text-primary hover:underline">
                      {memberAvatars.has(avatarKey(viewer)) ? "Change picture" : "Add a picture"}
                    </button>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onCompare(selectedPlayer.name)}
                data-testid="button-compare-player"
                className="shrink-0 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold hover:border-primary/50 hover:text-primary"
              >
                Compare with…
              </button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <HeadMetric label={`${activityLabel} in profit`} value={`${selectedPlayer.positiveSessionPct.toFixed(1)}%`} positive={selectedPlayer.positiveSessionPct >= 50} />
              <HeadMetric label="Return on buy-ins" value={`${selectedPlayer.netPct.toFixed(1)}%`} positive={selectedPlayer.netPct >= 0} />
              <HeadMetric label={`Profit per ${rateLabel}`} value={signedCurrency(selectedPlayer.profitPerSession)} positive={selectedPlayer.profitPerSession >= 0} />
              <HeadMetric label={`Buy-in per ${rateLabel}`} value={formatCurrency(selectedPlayer.buyInPerGame)} />
              <HeadMetric label={`Best ${scope === "cash" ? "game" : "result"}`} value={signedCurrency(selectedPlayer.maxWin)} positive={selectedPlayer.maxWin >= 0} />
              <HeadMetric label={`Worst ${scope === "cash" ? "game" : "result"}`} value={signedCurrency(selectedPlayer.maxLoss)} positive={selectedPlayer.maxLoss >= 0} />
            </div>
          </div>

          <div className="soft-shadow overflow-hidden rounded-2xl border border-border bg-card">
            <div className="border-b border-border px-5 py-4"><p className="section-label">Recent results</p><h2 className="mt-1 text-lg font-semibold">Latest activity</h2></div>
            {playerGames.length ? <div className="divide-y divide-border/70">
              {playerGames.slice(0, 8).map(({ session, result }) => <div key={`${session.eventType ?? "cash"}-${session.sessionNumber}`} data-testid={`row-player-game-${session.sessionNumber}`} className="flex items-center gap-3 px-5 py-3 text-sm">
                <div className="min-w-0 flex-1"><p className="font-medium">{formatDate(session.date)}</p><p className="text-[11px] text-muted-foreground">{session.eventType === "tournament" ? "Tournament event" : `${monthLabel(session.month)} · Game #${session.sessionNumber}`}</p></div>
                <span className="hidden font-mono text-xs text-muted-foreground sm:inline">in {formatCurrency(result.buyIn)} · out {formatCurrency(result.cashOut)}</span>
                <span className={`w-20 text-right font-mono text-sm font-semibold ${result.net >= 0 ? "text-chart-1" : "text-destructive"}`}>{signedCurrency(result.net)}</span>
              </div>)}
            </div> : <EmptyPanel title="No games in this scope" description="Try another season from the global filter." />}
          </div>
        </div>
        <PointsBreakdownCard playerName={selectedPlayer.name} previewNights={5} />
        <TournamentRecordCard tournaments={tournaments} playerName={selectedPlayer.name} onOpenTournament={onOpenTournament} />
        <TrophyShelf sessions={allSessions} playerName={selectedPlayer.name} badgeMap={badgeMap} careerGames={careerFor(careers, selectedPlayer.name)?.games} />
        <PlayerHistorySections sessions={sessions} playerName={selectedPlayer.name} />
        {isOwnProfile && <AvatarPickerDialog open={pickerOpen} onOpenChange={setPickerOpen} name={selectedPlayer.name} current={memberAvatars.get(avatarKey(viewer))} />}
      </> : <EmptyPanel title="Choose a player" description="Search for a name or select a player above to view their stats." />}
    </section>
  );
}

function PlayerHistorySections({ sessions, playerName }: { sessions: Session[]; playerName: string }) {
  const [showAllOpponents, setShowAllOpponents] = useState(false);
  const results = useMemo(() => buildResultsByGame(sessions, playerName), [sessions, playerName]);
  const opponents = useMemo(() => buildRegularOpponents(sessions, playerName), [sessions, playerName]);

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

  if (!results.length) return null;
  const visibleOpponents = showAllOpponents ? opponents : opponents.slice(0, 8);

  return (
    <div className="mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
      <ChartCard
        testId="card-player-results-by-game"
        eyebrow="Game by game"
        title="Result by game"
        description="Net profit or loss each time they played."
      >
        <ColumnChart columns={columns} diverging label={`${playerName} result by game`} testId="chart-player-results-by-game" />
      </ChartCard>

      <ChartCard
        testId="card-regular-opponents"
        eyebrow="At the table"
        title="Regular opponents"
        description="Players they have shared the most games with, and how often they finished ahead."
        action={opponents.length > 8 ? (
          <button type="button" onClick={() => setShowAllOpponents((value) => !value)} className="self-start whitespace-nowrap text-xs font-semibold text-primary hover:underline sm:self-auto">
            {showAllOpponents ? "Show fewer" : `Show all ${opponents.length}`}
          </button>
        ) : undefined}
      >
        {opponents.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">No shared games yet.</p>
        ) : (
          <ul className="divide-y divide-border/70">
            {visibleOpponents.map((opponent) => {
              const decided = opponent.finishedAhead + opponent.finishedBehind;
              const aheadPct = decided ? (opponent.finishedAhead / decided) * 100 : 0;
              return (
                <li key={opponent.name} data-testid={`row-opponent-${opponent.name}`} className="py-2.5">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium">{opponent.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {opponent.sharedGames} shared · ahead {opponent.finishedAhead} of {decided || opponent.sharedGames}
                    </span>
                  </div>
                  <div
                    className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary"
                    role="img"
                    aria-label={`Finished ahead in ${Math.round(aheadPct)}% of decided games`}
                  >
                    <div className="h-full rounded-full bg-chart-1" style={{ width: `${aheadPct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </ChartCard>
    </div>
  );
}
