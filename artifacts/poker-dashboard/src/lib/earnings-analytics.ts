export type PerformanceScope = "all" | "cash" | "tournaments";

export type TournamentSnapshotPlayer = {
  player: string;
  buyIn: number;
  returned: number;
  netProfit: number;
  /** Tournaments entered; absent on the older single-event snapshot, which means one. */
  tournaments?: number;
  profitableTournaments?: number;
  bestResult?: number;
  worstResult?: number;
};

export type TournamentResultRow = {
  player: string;
  entries: number;
  rebuys: number;
  topUp: boolean;
  freeEntry: boolean;
  finishPlace: number | null;
  knockouts: number;
  eliminatedBy: string | null;
  invested: number;
  bountiesWon: number;
  mainPrize: number;
  totalReturn: number;
  netProfit: number;
  inTheMoney: boolean;
};

export type TournamentEvent = {
  id: string;
  date: string;
  title: string;
  status: string;
  format: string;
  startTime: string | null;
  venue: string | null;
  buyIn: number;
  topUp: number;
  bounty: number;
  bountyBasis: string | null;
  startingStack: number;
  topUpStack: number;
  shares: { first: number; second: number; third: number };
  players: number;
  entries: number;
  rebuys: number;
  topUps: number;
  freeEntries: number;
  knockouts: number;
  totalCollected: number;
  bountyPool: number;
  mainPrizePool: number;
  winner: string | null;
  runnerUp: string | null;
  thirdPlace: string | null;
  winnerPrize: number;
  topBountyHunter: string | null;
  mostKnockouts: number;
  notes: string | null;
  dataCheck: string | null;
  results: TournamentResultRow[];
};

export type TournamentSnapshot = {
  available: boolean;
  eventDate: string | null;
  totalPlayers: number;
  totalInvested: number;
  totalReturned: number;
  totalNetProfit: number;
  players: TournamentSnapshotPlayer[];
};

export type DashboardPlayer = {
  rank: number;
  name: string;
  isClubContributor: boolean;
  buyInTotal: number;
  cashOutTotal: number;
  profitTotal: number;
  gamesPlayed: number;
  profitPerSession: number;
  positiveSessionPct: number;
  netPct: number;
  buyInPerGame: number;
  maxWin: number;
  maxLoss: number;
};

export type SessionPlayerRecord = {
  player: string;
  buyIn: number;
  cashOut: number;
  net: number;
  status: string | null;
};

export type DashboardSession = {
  sessionNumber: number;
  eventType?: "cash" | "tournament";
  /** Set on tournament sessions so they can be opened in the tournament detail. */
  tournamentId?: string;
  date: string;
  month: string;
  totalBuyIn: number;
  totalCashOut: number;
  totalNet: number;
  playerCount: number;
  winner: string | null;
  winnerProfit: number;
  lowPlayer: string | null;
  lowProfit: number;
  players: SessionPlayerRecord[];
};

export type ProfitPoint = {
  sessionNumber: number;
  player: string;
  cumulativeProfit: number;
  date: string | null;
  month: string | null;
};

const normalizePlayerName = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLocaleLowerCase();

const roundMoney = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

function sortPlayers(players: DashboardPlayer[]): DashboardPlayer[] {
  return players
    .sort(
      (left, right) =>
        right.profitTotal - left.profitTotal ||
        right.positiveSessionPct - left.positiveSessionPct ||
        left.name.localeCompare(right.name),
    )
    .map((player, index) => ({ ...player, rank: index + 1 }));
}

export function buildTournamentSession(
  snapshot: TournamentSnapshot,
  cashSessions: DashboardSession[],
): DashboardSession | null {
  if (!snapshot.available || !snapshot.eventDate || snapshot.players.length === 0) {
    return null;
  }

  const playerResults = snapshot.players.map((result) => ({
    player: result.player,
    buyIn: result.buyIn,
    cashOut: result.returned,
    net: result.netProfit,
    status: null,
  }));
  const byNet = playerResults.slice().sort(
    (left, right) => right.net - left.net || left.player.localeCompare(right.player),
  );
  const lowest = byNet[byNet.length - 1];
  const latestCashNumber = cashSessions.reduce(
    (maximum, session) => Math.max(maximum, session.sessionNumber),
    0,
  );

  return {
    sessionNumber: latestCashNumber + 1,
    eventType: "tournament",
    date: snapshot.eventDate,
    month: snapshot.eventDate.slice(5, 7),
    totalBuyIn: snapshot.totalInvested,
    totalCashOut: snapshot.totalReturned,
    totalNet: snapshot.totalNetProfit,
    playerCount: snapshot.totalPlayers,
    winner: byNet[0]?.player ?? null,
    winnerProfit: byNet[0]?.net ?? 0,
    lowPlayer: lowest?.player ?? null,
    lowProfit: lowest?.net ?? 0,
    players: playerResults,
  };
}

/**
 * One session per tournament, oldest first, numbered after the cash games. Falls back to the
 * single-event snapshot when the tournament tabs have no data.
 */
export function buildTournamentSessions(
  tournaments: TournamentEvent[],
  snapshot: TournamentSnapshot | undefined,
  cashSessions: DashboardSession[],
): DashboardSession[] {
  if (tournaments.length === 0) {
    const legacy = snapshot ? buildTournamentSession(snapshot, cashSessions) : null;
    return legacy ? [legacy] : [];
  }
  const latestCashNumber = cashSessions.reduce(
    (maximum, session) => Math.max(maximum, session.sessionNumber),
    0,
  );
  return tournaments
    .slice()
    .sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id))
    .map((event, index) => {
      const players = event.results.map((result) => ({
        player: result.player,
        buyIn: result.invested,
        cashOut: result.totalReturn,
        net: result.netProfit,
        status: null,
      }));
      const byNet = players
        .slice()
        .sort((left, right) => right.net - left.net || left.player.localeCompare(right.player));
      const lowest = byNet[byNet.length - 1];
      const invested = roundMoney(players.reduce((sum, player) => sum + player.buyIn, 0));
      const returned = roundMoney(players.reduce((sum, player) => sum + player.cashOut, 0));
      return {
        sessionNumber: latestCashNumber + index + 1,
        eventType: "tournament" as const,
        tournamentId: event.id,
        date: event.date,
        month: event.date.slice(5, 7),
        totalBuyIn: invested,
        totalCashOut: returned,
        totalNet: roundMoney(returned - invested),
        playerCount: players.length,
        winner: event.winner ?? byNet[0]?.player ?? null,
        winnerProfit: byNet.find((player) => player.player === event.winner)?.net ?? byNet[0]?.net ?? 0,
        lowPlayer: lowest?.player ?? null,
        lowProfit: lowest?.net ?? 0,
        players,
      };
    });
}

export function buildTournamentLeaderboard(
  snapshot: TournamentSnapshot,
): DashboardPlayer[] {
  if (!snapshot.available) return [];

  const players = snapshot.players.map((result) => {
    const gamesPlayed = result.tournaments ?? 1;
    const profitable = result.profitableTournaments ?? (result.netProfit > 0 ? 1 : 0);
    return {
      rank: 0,
      name: result.player,
      isClubContributor: false,
      buyInTotal: result.buyIn,
      cashOutTotal: result.returned,
      profitTotal: result.netProfit,
      gamesPlayed,
      profitPerSession: result.netProfit / gamesPlayed,
      positiveSessionPct: (profitable / gamesPlayed) * 100,
      netPct: result.buyIn ? (result.netProfit / result.buyIn) * 100 : 0,
      buyInPerGame: result.buyIn / gamesPlayed,
      maxWin: result.bestResult ?? result.netProfit,
      maxLoss: result.worstResult ?? result.netProfit,
    };
  });

  return sortPlayers(players);
}

export function buildCombinedLeaderboard(
  cashPlayers: DashboardPlayer[],
  snapshot: TournamentSnapshot,
): DashboardPlayer[] {
  const tournamentByName = new Map(
    snapshot.available
      ? snapshot.players.map((result) => [normalizePlayerName(result.player), result])
      : [],
  );

  return sortPlayers(
    cashPlayers.map((cashPlayer) => {
      const tournamentResult = tournamentByName.get(
        normalizePlayerName(cashPlayer.name),
      );
      if (!tournamentResult) return { ...cashPlayer };

      const tournamentGames = tournamentResult.tournaments ?? 1;
      const profitableTournaments =
        tournamentResult.profitableTournaments ?? (tournamentResult.netProfit > 0 ? 1 : 0);
      const gamesPlayed = cashPlayer.gamesPlayed + tournamentGames;
      const buyInTotal = roundMoney(cashPlayer.buyInTotal + tournamentResult.buyIn);
      const cashOutTotal = roundMoney(
        cashPlayer.cashOutTotal + tournamentResult.returned,
      );
      const profitTotal = roundMoney(
        cashPlayer.profitTotal + tournamentResult.netProfit,
      );
      const positiveGames =
        (cashPlayer.positiveSessionPct / 100) * cashPlayer.gamesPlayed +
        profitableTournaments;

      return {
        ...cashPlayer,
        buyInTotal,
        cashOutTotal,
        profitTotal,
        gamesPlayed,
        profitPerSession: profitTotal / gamesPlayed,
        positiveSessionPct: (positiveGames / gamesPlayed) * 100,
        netPct: buyInTotal ? (profitTotal / buyInTotal) * 100 : 0,
        buyInPerGame: buyInTotal / gamesPlayed,
        maxWin: Math.max(cashPlayer.maxWin, tournamentResult.bestResult ?? tournamentResult.netProfit),
        maxLoss: Math.min(cashPlayer.maxLoss, tournamentResult.worstResult ?? tournamentResult.netProfit),
      };
    }),
  );
}

export function buildPlayerProfitHistory(
  sessions: DashboardSession[],
): ProfitPoint[] {
  const runningTotals = new Map<string, number>();
  const history: ProfitPoint[] = [];

  for (const session of sessions
    .slice()
    .sort((left, right) => left.sessionNumber - right.sessionNumber)) {
    for (const result of session.players) {
      const key = normalizePlayerName(result.player);
      const cumulativeProfit = roundMoney(
        (runningTotals.get(key) ?? 0) + result.net,
      );
      runningTotals.set(key, cumulativeProfit);
      history.push({
        sessionNumber: session.sessionNumber,
        player: result.player,
        cumulativeProfit,
        date: session.date,
        month: session.month,
      });
    }
  }

  return history;
}
