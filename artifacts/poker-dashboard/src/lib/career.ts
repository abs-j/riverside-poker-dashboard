// A member's whole record, not just the nights that have a dated entry in the session log.
// Totals come from the leaderboard; game-by-game results come from the sheet's running-profit
// history, which covers every cash game the member has played.

export type CareerPlayerRow = {
  name: string;
  profitTotal: number;
  gamesPlayed: number;
  positiveSessionPct: number;
  maxWin: number;
  maxLoss: number;
};

export type CareerHistoryPoint = { sessionNumber: number; player: string; cumulativeProfit: number };

export type Career = {
  name: string;
  /** Every game counted in the leaderboard (cash and tournament when combined). */
  games: number;
  net: number;
  /** Share of games finished in profit, 0 to 100. */
  inProfitPct: number;
  bestGame: number;
  worstGame: number;
  /** Cash-game results, oldest first. Empty when the history has nothing for this member. */
  results: number[];
  longestWinStreak: number;
  /** Positive: consecutive wins at the end of the history; negative: consecutive losses. */
  currentStreak: number;
};

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const keyOf = (name: string) => name.trim().replace(/\s+/g, " ").toLocaleLowerCase();

/** Per-game results recovered from a running total: each result is the step between totals. */
export function resultsFromHistory(history: CareerHistoryPoint[], name: string): number[] {
  const key = keyOf(name);
  const mine = history
    .filter((point) => keyOf(point.player) === key)
    .slice()
    .sort((a, b) => a.sessionNumber - b.sessionNumber);
  let previous = 0;
  return mine.map((point) => {
    const result = round2(point.cumulativeProfit - previous);
    previous = point.cumulativeProfit;
    return result;
  });
}

function streaks(results: number[]) {
  let longest = 0;
  let run = 0;
  for (const result of results) {
    run = result > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  let current = 0;
  const last = Math.sign(results[results.length - 1] ?? 0);
  if (last !== 0) {
    for (let i = results.length - 1; i >= 0 && Math.sign(results[i]) === last; i--) current += last;
  }
  return { longest, current };
}

export function buildCareers(players: CareerPlayerRow[], history: CareerHistoryPoint[]): Map<string, Career> {
  const careers = new Map<string, Career>();
  for (const player of players) {
    const results = resultsFromHistory(history, player.name);
    const { longest, current } = streaks(results);
    careers.set(keyOf(player.name), {
      name: player.name,
      games: player.gamesPlayed,
      net: player.profitTotal,
      inProfitPct: player.positiveSessionPct,
      bestGame: player.maxWin,
      worstGame: player.maxLoss,
      results,
      longestWinStreak: longest,
      currentStreak: current,
    });
  }
  return careers;
}

export const careerFor = (careers: Map<string, Career>, name: string): Career | null =>
  careers.get(keyOf(name)) ?? null;
