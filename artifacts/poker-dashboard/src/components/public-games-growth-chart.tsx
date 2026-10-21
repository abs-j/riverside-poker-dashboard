import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from "recharts";
import { ChartEmpty } from "@/views/shared";

function PublicGamesGrowthTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name?: string; value?: number; color?: string }>; label?: string | number }) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value;
  return <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-lg"><p className="mb-1 font-mono text-[11px] text-muted-foreground">{label}</p><p className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: payload[0]?.color }} />Individual games played: <strong className="font-mono">{value ?? 0}</strong></p></div>;
}

// Own module so the chart library is only downloaded where this chart is shown.
export default function PublicGamesGrowthChart({ data }: { data: Array<{ label: string; cumulativeGames: number }> }) {
  const gamesGrowth = data;
  return gamesGrowth.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={gamesGrowth} margin={{ top: 12, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="hsl(var(--foreground) / .08)" vertical={false} strokeDasharray="3 4" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <ChartTooltip content={<PublicGamesGrowthTooltip />} />
                  <Line type="monotone" dataKey="cumulativeGames" name="Individual games played" stroke="hsl(var(--chart-1))" strokeWidth={3} dot={{ r: 4, fill: "hsl(var(--chart-1))", strokeWidth: 0 }} activeDot={{ r: 6 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
  ) : (
    <ChartEmpty label="Individual game growth will appear after the first recorded games." />
  );
}
