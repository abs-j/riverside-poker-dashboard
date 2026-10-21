import { useMemo } from "react";
import { ChartCard } from "@/components/club-charts";
import type { TournamentEvent } from "@/lib/earnings-analytics";
import { ordinal } from "@/lib/share-card";
import { playerTournamentRecord } from "@/lib/tournaments";
import { formatCurrency, formatDate, signedCurrency } from "@/views/shared";

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl bg-secondary/45 p-3">
      <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      <p className="mt-1.5 font-mono text-base font-semibold">{value}</p>
      {detail && <p className="mt-0.5 text-[11px] text-muted-foreground">{detail}</p>}
    </div>
  );
}

type TournamentRecordCardProps = {
  tournaments: TournamentEvent[];
  playerName: string;
  onOpenTournament: (id: string) => void;
};

/** A player's tournament record: totals plus one line per tournament, each opening its detail. */
export function TournamentRecordCard({ tournaments, playerName, onOpenTournament }: TournamentRecordCardProps) {
  const record = useMemo(() => playerTournamentRecord(tournaments, playerName), [tournaments, playerName]);
  if (!record) return null;

  return (
    <ChartCard
      testId="card-tournament-record"
      eyebrow="Tournaments"
      title="Tournament record"
      description={`${record.played} ${record.played === 1 ? "tournament" : "tournaments"} played. Results include bounties.`}
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Net" value={signedCurrency(record.net)} detail={record.roi === null ? undefined : `${Math.round(record.roi)}% return`} />
        <Stat label="Wins" value={String(record.wins)} detail={`${record.inTheMoney} in the money`} />
        <Stat label="Knockouts" value={String(record.knockouts)} detail={`${formatCurrency(record.bounties)} in bounties`} />
        <Stat
          label="Best finish"
          value={record.bestFinish === null ? "—" : ordinal(record.bestFinish)}
          detail={record.averageFinish === null ? "No finishes recorded" : `Average ${record.averageFinish.toFixed(1)}`}
        />
      </div>
      <ul className="mt-4 divide-y divide-border/70" data-testid="list-tournament-record">
        {record.history.map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              onClick={() => onOpenTournament(entry.id)}
              className="flex min-h-[48px] w-full items-center gap-3 py-2 text-left text-sm hover:text-primary"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{formatDate(entry.date)}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {entry.result.finishPlace ? `${ordinal(entry.result.finishPlace)} of ${entry.fieldSize}` : `${entry.fieldSize} players`}
                  {entry.result.knockouts > 0 ? ` · ${entry.result.knockouts} KO` : ""}
                  {entry.result.mainPrize > 0 ? ` · prize ${formatCurrency(entry.result.mainPrize)}` : ""}
                </span>
              </span>
              <span className={`font-mono font-semibold ${entry.result.netProfit >= 0 ? "text-chart-1" : "text-destructive"}`}>
                {signedCurrency(entry.result.netProfit)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}
