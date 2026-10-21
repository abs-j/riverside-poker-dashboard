// Entirely fictional club data for the public demo. Names, results and venues are invented
// and generated from a fixed seed, so every visitor sees the same believable season.
// The shapes match the real /api/poker/dashboard response.

export const DEMO_VIEWER = "Sam Carter";

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Persona = { name: string; skill: number; attendance: number };

// skill: roughly -1 (donates) to +1 (grinds). attendance: chance of turning up on a given night.
export const DEMO_PLAYERS: Persona[] = [
  { name: "Sam Carter", skill: 0.45, attendance: 0.9 },
  { name: "Maya Brooks", skill: 0.8, attendance: 0.85 },
  { name: "Leo Fernandez", skill: 0.25, attendance: 0.75 },
  { name: "Nina Okafor", skill: 0.55, attendance: 0.7 },
  { name: "Theo Larsen", skill: -0.2, attendance: 0.8 },
  { name: "Ivy Chen", skill: 0.1, attendance: 0.65 },
  { name: "Marcus Webb", skill: -0.6, attendance: 0.75 },
  { name: "Zara Haddad", skill: 0.35, attendance: 0.55 },
  { name: "Owen Doyle", skill: -0.35, attendance: 0.6 },
  { name: "Hana Sato", skill: 0.0, attendance: 0.5 },
  { name: "Felix Moreau", skill: -0.8, attendance: 0.55 },
  { name: "Ruby Patel", skill: 0.2, attendance: 0.45 },
  { name: "Caleb Ross", skill: -0.45, attendance: 0.4 },
  { name: "Elena Petrova", skill: 0.6, attendance: 0.35 },
];

type SessionPlayer = { player: string; buyIn: number; cashOut: number; net: number; status: string | null };
type Session = {
  sessionNumber: number;
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
  players: SessionPlayer[];
};

const iso = (date: Date) => date.toISOString().slice(0, 10);

function buildSessions(): Session[] {
  const random = rng(20260);
  const sessions: Omit<Session, "sessionNumber">[] = [];
  // Thursday nights from early February to mid October.
  for (let day = new Date(Date.UTC(2026, 1, 5)); day <= new Date(Date.UTC(2026, 9, 15)); day = new Date(day.getTime() + 7 * 86_400_000)) {
    if (random() < 0.12) continue;
    let present = DEMO_PLAYERS.filter((p) => random() < p.attendance);
    while (present.length < 6) present = DEMO_PLAYERS.filter((p) => present.includes(p) || random() < 0.5);
    present = present.slice(0, 10);

    const entries = present.map((p) => {
      const rebuys = random() < 0.32 ? 1 + (random() < 0.3 ? 1 : 0) : 0;
      return { p, buyIn: 20 + rebuys * 10 };
    });
    const pot = entries.reduce((sum, e) => sum + e.buyIn, 0);
    const weights = entries.map((e) => Math.exp(e.p.skill * 0.9 + (random() - 0.5) * 2.6) ** 1.7);
    const weightTotal = weights.reduce((a, b) => a + b, 0);
    // Whole 50c chips, with anything left over going to the biggest stack so the table balances.
    const cashOuts = weights.map((w) => Math.round(((pot * w) / weightTotal) * 2) / 2);
    const biggest = cashOuts.indexOf(Math.max(...cashOuts));
    cashOuts[biggest] = round2(cashOuts[biggest] + (pot - cashOuts.reduce((a, b) => a + b, 0)));

    const players: SessionPlayer[] = entries.map((e, index) => ({
      player: e.p.name,
      buyIn: e.buyIn,
      cashOut: cashOuts[index],
      net: round2(cashOuts[index] - e.buyIn),
      status: null,
    }));
    const ordered = [...players].sort((a, b) => b.net - a.net);
    const date = iso(day);
    sessions.push({
      date,
      month: date.slice(5, 7),
      totalBuyIn: round2(pot),
      totalCashOut: round2(cashOuts.reduce((a, b) => a + b, 0)),
      totalNet: 0,
      playerCount: players.length,
      winner: ordered[0].player,
      winnerProfit: ordered[0].net,
      lowPlayer: ordered[ordered.length - 1].player,
      lowProfit: ordered[ordered.length - 1].net,
      players,
    });
  }
  return sessions.map((session, index) => ({ ...session, sessionNumber: index + 1 }));
}

const QUARTERS = [
  { quarter: "Q1", range: "Jan 1 — Mar 31", months: ["01", "02", "03"] },
  { quarter: "Q2", range: "Apr 1 — Jun 30", months: ["04", "05", "06"] },
  { quarter: "Q3", range: "Jul 1 — Sep 30", months: ["07", "08", "09"] },
  { quarter: "Q4", range: "Oct 1 — Dec 31", months: ["10", "11", "12"] },
];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function summarise(sessions: Session[]) {
  const nets = new Map<string, number>();
  for (const session of sessions) for (const p of session.players) nets.set(p.player, round2((nets.get(p.player) ?? 0) + p.net));
  const top = [...nets.entries()].sort((a, b) => b[1] - a[1])[0];
  const totalBuyIn = round2(sessions.reduce((sum, s) => sum + s.totalBuyIn, 0));
  return {
    sessionCount: sessions.length,
    recordCount: sessions.reduce((sum, s) => sum + s.playerCount, 0),
    totalBuyIn,
    totalCashOut: round2(sessions.reduce((sum, s) => sum + s.totalCashOut, 0)),
    totalNet: round2(sessions.reduce((sum, s) => sum + s.totalNet, 0)),
    avgPot: sessions.length ? round2(totalBuyIn / sessions.length) : 0,
    uniquePlayers: new Set(sessions.flatMap((s) => s.players.map((p) => p.player))).size,
    topWinner: top?.[0] ?? null,
    topWinnerProfit: top?.[1] ?? 0,
    positiveSessions: sessions.flatMap((s) => s.players).filter((p) => p.net > 0).length,
    negativeSessions: sessions.flatMap((s) => s.players).filter((p) => p.net <= 0).length,
  };
}

type Result = {
  player: string; entries: number; rebuys: number; topUp: boolean; freeEntry: boolean; finishPlace: number | null;
  knockouts: number; eliminatedBy: string | null; invested: number; bountiesWon: number; mainPrize: number;
  totalReturn: number; netProfit: number; inTheMoney: boolean;
};

function buildTournament(seed: number, id: string, date: string, title: string, venue: string, size: number) {
  const random = rng(seed);
  const buyIn = 20;
  const topUpCost = 10;
  const bounty = 5;
  const field = DEMO_PLAYERS.map((p) => ({ p, roll: p.skill * 0.7 + random() * 1.6 })).sort((a, b) => b.roll - a.roll).slice(0, size);
  // Strongest roll wins, but shuffle a little so it is not predictable from the leaderboard.
  const order = field.map((f) => f.p.name);
  const rebuys = new Map(order.map((name) => [name, random() < 0.35 ? 1 : 0]));
  const topUps = new Map(order.map((name) => [name, random() < 0.3]));

  const knockouts = new Map(order.map((name) => [name, 0]));
  const eliminatedBy = new Map<string, string>();
  order.forEach((name, index) => {
    const busts = (rebuys.get(name) ?? 0) + (index === 0 ? 0 : 1);
    for (let bust = 0; bust < busts; bust += 1) {
      const isFinal = index !== 0 && bust === busts - 1;
      const pool = isFinal ? order.slice(0, index) : order.filter((other) => other !== name);
      const killer = pool[Math.floor(random() * pool.length)];
      knockouts.set(killer, (knockouts.get(killer) ?? 0) + 1);
      if (isFinal) eliminatedBy.set(name, killer);
    }
  });

  const totalEntries = order.length + [...rebuys.values()].reduce((a, b) => a + b, 0);
  const totalKnockouts = [...knockouts.values()].reduce((a, b) => a + b, 0);
  const topUpCount = [...topUps.values()].filter(Boolean).length;
  const totalCollected = totalEntries * buyIn + topUpCount * topUpCost;
  const bountyPool = totalKnockouts * bounty;
  const mainPrizePool = round2(totalCollected - bountyPool);
  const shares = { first: 50, second: 30, third: 20 };
  const prizes = [shares.first, shares.second, shares.third].map((share) => round2((mainPrizePool * share) / 100));
  prizes[0] = round2(mainPrizePool - prizes[1] - prizes[2]);

  const results: Result[] = order.map((name, index) => {
    const invested = ((rebuys.get(name) ?? 0) + 1) * buyIn + (topUps.get(name) ? topUpCost : 0);
    const bountiesWon = (knockouts.get(name) ?? 0) * bounty;
    const mainPrize = index < 3 ? prizes[index] : 0;
    return {
      player: name,
      entries: 1,
      rebuys: rebuys.get(name) ?? 0,
      topUp: topUps.get(name) ?? false,
      freeEntry: false,
      finishPlace: index + 1,
      knockouts: knockouts.get(name) ?? 0,
      eliminatedBy: eliminatedBy.get(name) ?? null,
      invested,
      bountiesWon,
      mainPrize,
      totalReturn: round2(bountiesWon + mainPrize),
      netProfit: round2(bountiesWon + mainPrize - invested),
      inTheMoney: index < 3,
    };
  });
  const hunter = [...results].sort((a, b) => b.knockouts - a.knockouts || a.finishPlace! - b.finishPlace!)[0];

  return {
    id,
    date,
    title,
    status: "Completed",
    format: "Rebuy bounty",
    startTime: "8:00 pm",
    venue,
    buyIn,
    topUp: topUpCost,
    bounty,
    bountyBasis: "Per knockout",
    startingStack: 10000,
    topUpStack: 5000,
    shares,
    players: order.length,
    entries: order.length,
    rebuys: totalEntries - order.length,
    topUps: topUpCount,
    freeEntries: 0,
    knockouts: totalKnockouts,
    totalCollected,
    bountyPool,
    mainPrizePool,
    winner: order[0],
    runnerUp: order[1],
    thirdPlace: order[2],
    winnerPrize: prizes[0],
    topBountyHunter: hunter.player,
    mostKnockouts: hunter.knockouts,
    notes: null,
    dataCheck: "OK",
    results,
  };
}

export function buildDemoDashboard() {
  const sessions = buildSessions().map((session) => ({ ...session, totalNet: round2(session.players.reduce((sum, p) => sum + p.net, 0)) }));

  const tournaments = [
    buildTournament(11, "tournament-2026-04-25", "2026-04-25", "Spring Classic", "The Back Room", 10),
    buildTournament(22, "tournament-2026-07-18", "2026-07-18", "Midwinter Bounty", "The Back Room", 12),
    buildTournament(33, "tournament-2026-10-10", "2026-10-10", "Autumn Showdown", "The Back Room", 11),
  ];

  const leaderboard = DEMO_PLAYERS.map((persona) => {
    const rows = sessions.flatMap((s) => s.players.filter((p) => p.player === persona.name));
    const buyInTotal = round2(rows.reduce((sum, r) => sum + r.buyIn, 0));
    const cashOutTotal = round2(rows.reduce((sum, r) => sum + r.cashOut, 0));
    const profitTotal = round2(cashOutTotal - buyInTotal);
    const games = rows.length;
    return {
      name: persona.name,
      isClubContributor: ["Maya Brooks", "Sam Carter", "Leo Fernandez"].includes(persona.name),
      buyInTotal,
      cashOutTotal,
      profitTotal,
      gamesPlayed: games,
      profitPerSession: games ? round2(profitTotal / games) : 0,
      positiveSessionPct: games ? round2((rows.filter((r) => r.net > 0).length / games) * 100) : 0,
      netPct: buyInTotal ? round2((profitTotal / buyInTotal) * 100) : 0,
      buyInPerGame: games ? round2(buyInTotal / games) : 0,
      maxWin: Math.max(0, ...rows.map((r) => r.net)),
      maxLoss: Math.min(0, ...rows.map((r) => r.net)),
    };
  })
    .filter((p) => p.gamesPlayed > 0)
    .sort((a, b) => b.profitTotal - a.profitTotal)
    .map((p, index) => ({ ...p, rank: index + 1 }));

  const running = new Map<string, number>();
  const playerProfitHistory = sessions.flatMap((session) => {
    for (const p of session.players) running.set(p.player, round2((running.get(p.player) ?? 0) + p.net));
    return [...running.entries()].map(([player, cumulativeProfit]) => ({
      sessionNumber: session.sessionNumber,
      player,
      cumulativeProfit,
      date: session.date,
      month: session.month,
    }));
  });

  const months = MONTH_NAMES.map((label, index) => {
    const month = String(index + 1).padStart(2, "0");
    const inMonth = sessions.filter((s) => s.month === month);
    return { month, label, range: `${label} 1 — ${label} ${new Date(Date.UTC(2026, index + 1, 0)).getUTCDate()}`, ...summarise(inMonth) };
  }).filter((m) => m.sessionCount > 0);

  const quarters = QUARTERS.map(({ quarter, range, months: qMonths }) => ({
    quarter,
    label: quarter,
    range,
    ...summarise(sessions.filter((s) => qMonths.includes(s.month))),
  }));

  const latestTournament = tournaments[tournaments.length - 1];
  const tournamentSnapshot = {
    available: true,
    eventDate: latestTournament.date,
    totalPlayers: latestTournament.results.length,
    totalInvested: round2(latestTournament.results.reduce((sum, r) => sum + r.invested, 0)),
    totalReturned: round2(latestTournament.results.reduce((sum, r) => sum + r.totalReturn, 0)),
    totalNetProfit: round2(latestTournament.results.reduce((sum, r) => sum + r.netProfit, 0)),
    players: latestTournament.results.map((r) => {
      const all = tournaments.flatMap((t) => t.results.filter((x) => x.player === r.player));
      return {
        player: r.player,
        buyIn: r.invested,
        returned: r.totalReturn,
        netProfit: r.netProfit,
        tournaments: all.length,
        profitableTournaments: all.filter((x) => x.netProfit > 0).length,
        bestResult: Math.max(...all.map((x) => x.netProfit)),
        worstResult: Math.min(...all.map((x) => x.netProfit)),
      };
    }),
  };

  const totalBuyIn = round2(sessions.reduce((sum, s) => sum + s.totalBuyIn, 0));
  const totalCashOut = round2(sessions.reduce((sum, s) => sum + s.totalCashOut, 0));
  const lastSession = sessions[sessions.length - 1];

  return {
    title: "Riverside Poker Club",
    spreadsheetUrl: "",
    lastUpdated: new Date().toISOString(),
    isStale: false,
    totals: {
      balanceStatus: Math.abs(totalBuyIn - totalCashOut) < 0.01 ? "balanced" : "unbalanced",
      balanceDifference: round2(totalBuyIn - totalCashOut),
      totalBuyIn,
      totalCashOut,
      totalSessions: sessions.length,
      activePlayers: leaderboard.length,
      latestSession: lastSession.sessionNumber,
      latestGameDate: lastSession.date,
      totalRecords: sessions.reduce((sum, s) => sum + s.playerCount, 0),
      positiveSessions: leaderboard.filter((p) => p.profitTotal > 0).length,
      negativeSessions: leaderboard.filter((p) => p.profitTotal <= 0).length,
    },
    leaderboard,
    defaultPlayer: DEMO_VIEWER,
    tournamentSnapshot,
    tournaments,
    playerProfitHistory,
    months,
    quarters,
    sessions,
  };
}

export type DemoDashboard = ReturnType<typeof buildDemoDashboard>;

export function buildPublicSummary(dashboard: DemoDashboard) {
  const monthlyGames = dashboard.months.map((m) => ({
    month: `2026-${m.month}`,
    label: m.label.slice(0, 3),
    gameCount: m.recordCount,
  }));
  return {
    title: dashboard.title,
    latestGameDate: dashboard.totals.latestGameDate,
    totalSessions: dashboard.totals.totalSessions,
    totalPlayers: dashboard.totals.activePlayers,
    totalGames: dashboard.totals.totalRecords,
    lastUpdated: dashboard.lastUpdated,
    isStale: false,
    months: dashboard.months.map((m) => ({ month: m.month, label: m.label, range: m.range, sessionCount: m.sessionCount, gameCount: m.recordCount })),
    monthlyGames,
  };
}
