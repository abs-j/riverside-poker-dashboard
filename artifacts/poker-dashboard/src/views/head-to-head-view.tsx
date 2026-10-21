import { type PerformanceScope, type DashboardPlayer as Player, type DashboardSession as Session } from "@/lib/earnings-analytics";
import { ChevronDown } from "lucide-react";
import { useEffect } from "react";
import { useMemo } from "react";
import { ChartCard, CumulativeLineChart, SERIES_COLORS } from "@/components/club-charts";
import { buildCumulativeRuns } from "@/lib/club-charts";
import { usePoints } from "@/components/points-context";
import { pointsFor } from "@/lib/points";
import { playerTournamentRecord } from "@/lib/tournaments";
import { ChartEmpty, ContributorBadge, EmptyPanel, HeadMetric, PageIntro, formatCurrency, formatDate, signedCurrency } from "./shared";

export function HeadToHeadView({ players, sessions, scope, initialPlayer, headA, headB, onA, onB }: { players: Player[]; sessions: Session[]; scope: PerformanceScope; initialPlayer: string | null; headA: string; headB: string; onA: (value: string) => void; onB: (value: string) => void }) {
  const { rowsFor, tournaments } = usePoints();
  const allPoints = rowsFor("ALL");
  const extrasFor = (name: string) => ({
    points: pointsFor(allPoints, name),
    tournament: playerTournamentRecord(tournaments, name),
  });
  const earningsScopeLabel = scope === "all" ? "all earnings" : scope === "cash" ? "cash games" : "tournaments";
  const activityLabel = scope === "tournaments" ? "events" : "games";
  const returnLabel = scope === "cash" ? "Cash-out" : scope === "tournaments" ? "Payout" : "Returned";
  useEffect(() => { if (initialPlayer && players.some((player) => player.name === initialPlayer) && initialPlayer !== headA && initialPlayer !== headB) onA(initialPlayer); }, [initialPlayer, players, headA, headB, onA]);
  useEffect(() => {
    const names = players.map((player) => player.name);
    if (names.length === 0) {
      if (headA) onA("");
      if (headB) onB("");
      return;
    }
    if (!names.includes(headA)) onA(names[0]);
    if (!names.includes(headB) || headB === headA) {
      onB(names.find((name) => name !== headA) ?? names[0]);
    }
  }, [players, headA, headB, onA, onB]);
  const playerA = players.find((player) => player.name === headA);
  const playerB = players.find((player) => player.name === headB);
  const metrics = (name: string, player?: Player) => {
    const records = sessions.flatMap((session) => session.players.filter((item) => item.player === name));
    const positive = records.filter((record) => record.net > 0).length;
    const games = player?.gamesPlayed ?? records.length;
    const buyIn = player?.buyInTotal ?? records.reduce((total, record) => total + record.buyIn, 0);
    const cashOut = player?.cashOutTotal ?? records.reduce((total, record) => total + record.cashOut, 0);
    const net = player?.profitTotal ?? records.reduce((total, record) => total + record.net, 0);
    const positivePct = player?.positiveSessionPct ?? (records.length ? positive / records.length * 100 : 0);
    const best = player?.maxWin ?? (records.length ? Math.max(...records.map((record) => record.net)) : 0);
    const worst = player?.maxLoss ?? (records.length ? Math.min(...records.map((record) => record.net)) : 0);
    return { games, buyIn, cashOut, net, positive: positivePct, netPct: player?.netPct ?? (buyIn ? net / buyIn * 100 : 0), profitPerRecord: player?.profitPerSession ?? (games ? net / games : 0), buyInPerRecord: player?.buyInPerGame ?? (games ? buyIn / games : 0), best, worst };
  };
  const a = metrics(headA, playerA);
  const b = metrics(headB, playerB);
  const runs = useMemo(() => buildCumulativeRuns(sessions, [headA, headB].filter(Boolean)), [sessions, headA, headB]);
  const since = sessions.length ? formatDate(sessions.slice().sort((x, y) => x.date.localeCompare(y.date))[0].date, "d MMM") : "";
  const bothPlayed = [headA, headB].every((name) => (runs.results.get(name) ?? []).some((value) => value !== null));
  const comparisonRows = [
    { label: "Net result", a: a.net, b: b.net, format: signedCurrency, higherIsBetter: true },
    { label: `${scope === "tournaments" ? "Events" : "Games"} in profit`, a: a.positive, b: b.positive, format: (value: number) => `${value.toFixed(1)}%`, higherIsBetter: true },
    { label: "Return on buy-ins", a: a.netPct, b: b.netPct, format: (value: number) => `${value.toFixed(1)}%`, higherIsBetter: true },
    { label: `Profit per ${scope === "tournaments" ? "event" : "game"}`, a: a.profitPerRecord, b: b.profitPerRecord, format: signedCurrency, higherIsBetter: true },
    { label: scope === "tournaments" ? "Events played" : "Games played", a: a.games, b: b.games, format: (value: number) => String(value), higherIsBetter: true },
    { label: returnLabel, a: a.cashOut, b: b.cashOut, format: formatCurrency, higherIsBetter: true },
    { label: `Buy-in per ${scope === "tournaments" ? "event" : "game"}`, a: a.buyInPerRecord, b: b.buyInPerRecord, format: formatCurrency, higherIsBetter: false },
    { label: "Best result", a: a.best, b: b.best, format: signedCurrency, higherIsBetter: true },
    { label: "Worst result", a: a.worst, b: b.worst, format: signedCurrency, higherIsBetter: true },
  ];
  return <section data-testid="section-head-to-head" className="space-y-4">
    <PageIntro eyebrow={`Head-to-head / ${earningsScopeLabel}`} title="Compare two players" description={`See how two players stack up on ${earningsScopeLabel}.`} count="Head-to-head" />
     <div className="soft-shadow rounded-2xl border border-border bg-card p-5 sm:p-6"><div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-end"><PlayerSelect label="Player one" value={headA} players={players} exclude={headB} onChange={onA} testId="select-head-player-a" /><div className="hidden pb-2 text-center font-mono text-xs text-muted-foreground md:block">VS</div><PlayerSelect label="Player two" value={headB} players={players} exclude={headA} onChange={onB} testId="select-head-player-b" /></div></div>
    {playerA && playerB && <HeadToHeadComparison playerA={playerA} playerB={playerB} rows={comparisonRows} />}
     {playerA && playerB ? <><div className="grid gap-3 md:grid-cols-2">{[["a", playerA, a], ["b", playerB, b]].map(([key, player, data]) => { const typedPlayer = player as Player; const typedData = data as typeof a; return <div key={key as string} data-testid={`card-head-player-${key as string}`} className="soft-shadow rounded-2xl border border-border bg-card p-5"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary font-mono text-sm font-semibold">{initials(typedPlayer.name)}</span><div><p className="font-semibold">{typedPlayer.name}{typedPlayer.isClubContributor && <ContributorBadge />}</p><p className="text-xs text-muted-foreground">Rank #{typedPlayer.rank} · {typedPlayer.gamesPlayed} {activityLabel} played</p></div></div><div className="mt-5 grid grid-cols-2 gap-3"><HeadMetric label="Net result" value={signedCurrency(typedData.net)} positive={typedData.net >= 0} /><HeadMetric label={`${activityLabel[0].toUpperCase()}${activityLabel.slice(1)} in profit`} value={`${typedData.positive.toFixed(1)}%`} positive={typedData.positive >= 50} /><HeadMetric label="Buy-ins" value={formatCurrency(typedData.buyIn)} /><HeadMetric label={`${activityLabel[0].toUpperCase()}${activityLabel.slice(1)} in view`} value={String(typedData.games)} /><HeadMetric label="Club points" value={extrasFor(typedPlayer.name).points ? `${Math.round(extrasFor(typedPlayer.name).points!.points)} pts · #${extrasFor(typedPlayer.name).points!.rank}` : "Not scored"} /><HeadMetric label="Tournament net" value={extrasFor(typedPlayer.name).tournament ? signedCurrency(extrasFor(typedPlayer.name).tournament!.net) : "No tournaments"} positive={extrasFor(typedPlayer.name).tournament ? extrasFor(typedPlayer.name).tournament!.net >= 0 : undefined} /></div></div>; })}</div><ChartCard testId="chart-head-to-head" eyebrow="Side by side" title="Money in and out" description="Net result, buy-ins and returns for each player.">
      <HeadToHeadBars nameA={headA} nameB={headB} metrics={[
        { label: "Net result", a: a.net, b: b.net, signed: true },
        { label: "Buy-ins", a: a.buyIn, b: b.buyIn },
        { label: returnLabel, a: a.cashOut, b: b.cashOut },
      ]} />
    </ChartCard>
    <ChartCard testId="card-head-to-head-run" eyebrow="Over time" title="Who has the stronger run?" description={`Running total over the ${runs.games.length} games on record${since ? ` since ${since}` : ""}. Flat stretches are games a player sat out.`}>
      {bothPlayed ? <CumulativeLineChart runs={runs} highlight={[{ name: headA, color: SERIES_COLORS[0] }, { name: headB, color: SERIES_COLORS[1] }]} height={280} /> : <ChartEmpty label="A comparison will appear once both players have recorded games in this scope." />}
    </ChartCard>
  </> : <EmptyPanel title="Choose two players to compare" description="Use the selectors above to open a side-by-side view of the season." />}
  </section>;
}

type ComparisonRow = { label: string; a: number; b: number; format: (value: number) => string; higherIsBetter: boolean };

function HeadToHeadComparison({ playerA, playerB, rows }: { playerA?: Player; playerB?: Player; rows: ComparisonRow[] }) {
  if (!playerA || !playerB) return null;
  return <div className="soft-shadow overflow-hidden rounded-2xl border border-border bg-card"><div className="border-b border-border p-5"><p className="section-label">Category winners</p><h2 className="mt-1 text-lg font-semibold">Who has the better result?</h2><p className="mt-1 text-xs text-muted-foreground">Higher is better except buy-in per game, where lower cost wins. Ties are shown explicitly.</p></div><div className="overflow-x-auto"><table data-testid="table-head-to-head-comparison" className="w-full min-w-[680px] text-left text-sm"><thead className="bg-secondary/35 text-[11px] uppercase tracking-[0.12em] text-muted-foreground"><tr><th className="px-5 py-3">Category</th><th className="px-5 py-3">{playerA.name}</th><th className="px-5 py-3">{playerB.name}</th><th className="px-5 py-3">Better result</th></tr></thead><tbody>{rows.map((row) => { const tie = row.a === row.b; const aWins = row.higherIsBetter ? row.a > row.b : row.a < row.b; return <tr key={row.label} className="border-t border-border/70"><td className="px-5 py-3 font-medium">{row.label}</td><td className={`px-5 py-3 font-mono ${!tie && aWins ? "font-semibold text-chart-1" : "text-muted-foreground"}`}>{row.format(row.a)}</td><td className={`px-5 py-3 font-mono ${!tie && !aWins ? "font-semibold text-chart-1" : "text-muted-foreground"}`}>{row.format(row.b)}</td><td className="px-5 py-3 font-semibold">{tie ? "Tie" : aWins ? playerA.name : playerB.name}</td></tr>; })}</tbody></table></div></div>;
}

function PlayerSelect({ label, value, players, exclude, onChange, testId }: { label: string; value: string; players: Player[]; exclude?: string; onChange: (value: string) => void; testId: string }) {
  return <label className="block"><span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</span><div className="relative"><select value={value} onChange={(event) => onChange(event.target.value)} data-testid={testId} className="h-11 w-full appearance-none rounded-xl border border-border bg-background px-3 pr-9 text-sm font-medium outline-none focus:border-primary"><option value="" disabled>Select a player</option>{players.map((player) => <option key={player.name} value={player.name} disabled={player.name === exclude && player.name !== value}>{player.name}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /></div></label>;
}

function initials(value: string) { return value.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(); }

type BarMetric = { label: string; a: number; b: number; signed?: boolean };

function HeadToHeadBars({ nameA, nameB, metrics }: { nameA: string; nameB: string; metrics: BarMetric[] }) {
  const colors = [SERIES_COLORS[0], SERIES_COLORS[1]];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
        {[nameA, nameB].map((name, index) => (
          <span key={name} className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors[index] }} />{name}</span>
        ))}
      </div>
      {metrics.map((metric) => {
        const max = Math.max(Math.abs(metric.a), Math.abs(metric.b), 1);
        return (
          <div key={metric.label}>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{metric.label}</p>
            {[metric.a, metric.b].map((value, index) => (
              <div key={index} className="mb-1.5 flex items-center gap-3">
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full" style={{ width: `${(Math.abs(value) / max) * 100}%`, backgroundColor: metric.signed && value < 0 ? "hsl(var(--destructive))" : colors[index] }} />
                </div>
                <span className="w-24 shrink-0 text-right font-mono text-xs font-semibold">{metric.signed ? signedCurrency(value) : formatCurrency(value)}</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
