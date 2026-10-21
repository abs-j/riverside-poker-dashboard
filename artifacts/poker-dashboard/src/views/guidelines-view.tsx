import { ChevronDown } from "lucide-react";

import { useIsMobile } from "@/hooks/use-mobile";
import { PageIntro } from "./shared";
import { CLUB_NAME, CLUB_RULES_LABEL } from "@/lib/brand";

export function GuidelinesView() {
  const isMobile = useIsMobile();
  return (
    <section data-testid="section-guidelines" className="space-y-4">
      <PageIntro eyebrow="Club guide / fair play" title="Guidelines & Poker Rules" description="Everything you need to know to keep our games friendly, fair, and easy to enjoy." count="Club reference" />

      <div className="soft-shadow rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="section-label">Quick access</p>
            <h2 className="mt-1 text-lg font-semibold">Play well, keep it social</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Our poker club is all about friendly competition, good games, and enjoying poker with mates.</p>
          </div>
          <div className="flex gap-2 text-xs font-semibold">
            <a href="#club-guidelines" className="rounded-lg bg-secondary px-3 py-2 text-muted-foreground hover:text-foreground">Guidelines</a>
            <a href="#club-rules" className="rounded-lg bg-secondary px-3 py-2 text-muted-foreground hover:text-foreground">Game rules</a>
            <a href="#tournament-setup" className="rounded-lg bg-secondary px-3 py-2 text-muted-foreground hover:text-foreground">Tournament</a>
          </div>
        </div>
      </div>

      <div id="club-guidelines" className="scroll-mt-4 soft-shadow rounded-2xl border border-border bg-card">
        <div className="border-b border-border p-5 sm:p-6">
          <p className="section-label">Guidelines</p>
          <h2 className="mt-1 text-lg font-semibold">How we run the club</h2>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
          {clubGuidelines.map((guideline, index) => <div key={guideline} className="flex gap-3 rounded-xl border border-border/70 bg-secondary/15 p-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-mono text-xs font-semibold text-primary">{index + 1}</span>
            <p className="text-sm leading-6">{guideline}</p>
          </div>)}
        </div>
      </div>

      <div id="club-rules" className="scroll-mt-4 space-y-4">
        <div className="px-1">
          <p className="section-label">{CLUB_RULES_LABEL}</p>
          <h2 className="mt-1 text-lg font-semibold">Game rules</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {clubRuleSections.map((section, sectionIndex) => <details key={section.title} open={!isMobile && sectionIndex < 2} className={`group soft-shadow rounded-2xl border border-border bg-card ${section.title === "Table Shuffles" || section.title === "General Rules" ? "lg:col-span-2" : ""}`}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 sm:p-6">
              <h3 className="text-base font-semibold">{section.title}</h3>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="px-5 pb-5 sm:px-6 sm:pb-6">
              {section.intro && <p className="text-sm leading-6 text-muted-foreground">{section.intro}</p>}
              <ul className="mt-4 space-y-2.5">
                {section.items.map((item) => <li key={item} className="flex gap-3 text-sm leading-6">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{item}</span>
                </li>)}
              </ul>
            </div>
          </details>)}
        </div>
      </div>

      <TournamentSetupSection />
    </section>
  );
}

function TournamentSetupSection() {
  return (
    <div id="tournament-setup" className="scroll-mt-4 space-y-4">
      <div className="px-1">
        <p className="section-label">Tournament setup</p>
        <h2 className="mt-1 text-lg font-semibold">{CLUB_NAME} Tournament</h2>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Buy-in", "$10", "Rebuy: $10"],
          ["Start time", "8:00 pm", "Rebuys close at 9:30 pm"],
          ["Starting stack", "200 chips", "1 / 2 blinds · 100 BB"],
          ["Chip value", "$200", "Cash-game equivalent per entry"],
        ].map(([label, value, detail]) => <div key={label} className="soft-shadow rounded-xl border border-border bg-card p-4">
          <p className="section-label">{label}</p>
          <p className="mt-2 font-mono text-xl font-medium tracking-tight">{value}</p>
          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{detail}</p>
        </div>)}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="soft-shadow rounded-2xl border border-border bg-card p-5 sm:p-6">
          <p className="section-label">Bounties</p>
          <h3 className="mt-1 text-base font-semibold">$2.50 per player</h3>
          <p className="mt-3 text-sm leading-6">Each player has a <strong>$2.50 bounty</strong>. The bounty is paid when that player is knocked out <strong>for the first time</strong>. Rebuying does not give you another bounty.</p>
        </article>
        <article className="soft-shadow rounded-2xl border border-border bg-card p-5 sm:p-6">
          <p className="section-label">Projected prize pool</p>
          <h3 className="mt-1 text-base font-semibold">$320 projected total</h3>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-secondary/35 p-3"><p className="font-mono text-sm font-semibold">16</p><p className="mt-1 text-[11px] text-muted-foreground">Players</p></div>
            <div className="rounded-lg bg-secondary/35 p-3"><p className="font-mono text-sm font-semibold">$40</p><p className="mt-1 text-[11px] text-muted-foreground">Bounties</p></div>
            <div className="rounded-lg bg-secondary/35 p-3"><p className="font-mono text-sm font-semibold">$280</p><p className="mt-1 text-[11px] text-muted-foreground">Main pool</p></div>
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">$20 average total spend per player. Payouts are based on the projected $320 collected and can be adjusted to the actual prize pool on the night.</p>
        </article>
      </div>

      <div className="soft-shadow overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border p-5 sm:p-6">
          <p className="section-label">Projected payouts</p>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {[["1st", "$140"], ["2nd", "$95"], ["3rd", "$45"]].map(([place, payout]) => <div key={place} className="rounded-xl bg-secondary/35 p-3 text-center"><p className="text-xs font-semibold">{place}</p><p className="mt-1 font-mono text-lg font-semibold text-chart-1">{payout}</p></div>)}
          </div>
        </div>
      </div>

      <div className="soft-shadow rounded-2xl border border-border bg-card p-5 sm:p-6">
        <p className="section-label">Tournament information</p>
        <h3 className="mt-1 text-base font-semibold">Joining, chips &amp; quarterly rewards</h3>
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          <div>
            <p className="text-sm leading-6">Players can <strong>join late or rebuy as many times as they like until 9:30 pm</strong>. Once you’re out after 9:30 pm, that’s it for the tournament — but cash games can start for anyone who’s busted.</p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Each buy-in or rebuy receives <strong className="text-foreground">$200 equivalent in cash-game chips</strong>, using the $1 chips from Ben’s set.</p>
          </div>
          <div className="border-t border-border/70 pt-5 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
            <p className="section-label">Quarterly Tournament Rewards</p>
            <h4 className="mt-1 text-sm font-semibold">Free entry for the first tournament of each quarter</h4>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">For the first tournament of each quarter, free entry will be awarded based on the leaderboard:</p>
            <ul className="mt-3 space-y-2.5">
              {[
                "Top 3 players from the previous quarter",
                "Bottom player from the previous quarter",
                "Top player of all time",
                "Bottom player of all time",
                "If a player qualifies in more than one category, they still receive one free entry.",
              ].map((item) => <li key={item} className="flex gap-3 text-sm leading-6">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>{item}</span>
              </li>)}
            </ul>
          </div>
        </div>
      </div>

      <div className="soft-shadow overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border p-5 sm:p-6">
          <p className="section-label">Blind structure</p>
          <h3 className="mt-1 text-base font-semibold">8:00 pm start schedule</h3>
          <p className="mt-2 text-xs text-muted-foreground">Starting blinds: 1 / 2 = 100 BB.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-secondary/35 text-[11px] uppercase tracking-[0.12em] text-muted-foreground"><tr><th className="px-5 py-3">Time</th><th className="px-5 py-3">Blinds</th><th className="px-5 py-3">Note</th></tr></thead>
            <tbody>{tournamentBlindStructure.map((level) => <tr key={level.time} className={`border-t border-border/70 ${level.note === "Rebuys close" ? "bg-primary/5" : ""}`}><td className="px-5 py-3 font-mono">{level.time}</td><td className={`px-5 py-3 font-mono ${level.note === "Rebuys close" ? "font-semibold text-primary" : ""}`}>{level.blinds}</td><td className={`px-5 py-3 text-xs ${level.note === "Rebuys close" ? "font-semibold text-primary" : "text-muted-foreground"}`}>{level.note || "—"}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const clubGuidelines = [
  "No rake or house cut — the club never takes a percentage of pots or winnings.",
  "The money stays with the players — all money played goes back to players through the games.",
  "No paid organizers — nobody is paid from the game for hosting or running the night.",
  "No mandatory extra fees — there are no additional charges required to play.",
  "No club profit — we’re here to play poker, not make money from running it.",
  "Stats are just for fun — our dashboard, rankings, and player stats are there for friendly competition and bragging rights.",
  "Keep it social — games are for our group and are about enjoying poker together.",
  "+1s are welcome — feel free to bring a mate along, but please don’t add them to the group chat unless the other members are happy for them to join.",
];

const clubRuleSections = [
  { title: "7-2 Rule", items: ["Win a hand with 7-2, suited or unsuited.", "No chops.", "Every other player pays the winner 25c."] },
  { title: "Bad Beat", intro: "Every player (including other tables) pays the losing player 25c if they lose with:", items: ["Nut Flush vs Straight Flush", "Full House vs Quads or better", "Quads or better"] },
  { title: "Bomb Pots", items: ["Monotone flop = Bomb Pot.", "Everyone puts in 25c.", "The first Bomb Pot of the night becomes a Stand-Up Game."] },
  { title: "Variants", intro: "Any variant can be called. Some favorites:", items: ["Double-Board Texas Hold’em", "Double-Board Omaha", "Pineapple — start with 5 cards and drop 1 card each round."] },
  { title: "Table Shuffles", intro: "We’ll aim to shuffle the tables roughly every hour to keep the games mixed up. If everyone’s happy where they are, there’s no need to force a shuffle.", items: ["When shuffling, deal everyone a high card to keep it random.", "2 tables: the bottom half of each table moves to the other table.", "3 tables: split each table into thirds by high card. The bottom third moves to one table and the middle third moves to the other, while the top third stays."] },
  { title: "General Rules", intro: "It’s a pretty chill game. We’re not going to be overly strict about technical rules like the one-chip rule or string bets.", items: ["Use common sense."] },
];

const tournamentBlindStructure = [
  { time: "8:00 pm", blinds: "1 / 2", note: "" },
  { time: "8:15 pm", blinds: "2 / 4", note: "" },
  { time: "8:30 pm", blinds: "3 / 6", note: "" },
  { time: "8:45 pm", blinds: "5 / 10", note: "" },
  { time: "9:00 pm", blinds: "8 / 16", note: "" },
  { time: "9:15 pm", blinds: "10 / 20", note: "" },
  { time: "9:30 pm", blinds: "15 / 30", note: "Rebuys close" },
  { time: "9:45 pm", blinds: "20 / 40", note: "" },
  { time: "10:00 pm", blinds: "30 / 60", note: "" },
  { time: "10:15 pm", blinds: "40 / 80", note: "" },
  { time: "10:30 pm", blinds: "60 / 120", note: "" },
  { time: "10:45 pm", blinds: "80 / 160", note: "" },
  { time: "11:00 pm", blinds: "100 / 200", note: "32 BB heads-up equivalent" },
  { time: "11:15 pm", blinds: "150 / 300", note: "16 BB heads-up equivalent" },
  { time: "11:30 pm", blinds: "200 / 400", note: "8 BB heads-up equivalent" },
];
