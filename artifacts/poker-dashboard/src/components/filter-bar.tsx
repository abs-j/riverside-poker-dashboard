import { ChevronDown } from "lucide-react";

export type ScopeValue = "all" | "cash" | "tournaments";
export type BreakdownValue = "months" | "quarters";
export type PeriodOption = { value: string; label: string; summary: string };

type Choice<T extends string> = { value: T; label: string };

function Segmented<T extends string>({
  label,
  value,
  choices,
  onChange,
  testIdPrefix,
}: {
  label: string;
  value: T;
  choices: Choice<T>[];
  onChange: (value: T) => void;
  testIdPrefix: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:inline">{label}</span>
      <div role="group" aria-label={label} className="flex flex-1 gap-1 rounded-lg bg-secondary/55 p-1 sm:flex-none">
        {choices.map((choice) => (
          <button
            key={choice.value}
            type="button"
            aria-pressed={value === choice.value}
            data-testid={`${testIdPrefix}-${choice.value}`}
            onClick={() => onChange(choice.value)}
            className={`min-h-10 flex-1 rounded-md px-3 text-xs font-semibold transition-colors sm:flex-none ${
              value === choice.value ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {choice.label}
          </button>
        ))}
      </div>
    </div>
  );
}

type FilterBarProps = {
  scope: ScopeValue;
  onScope: (scope: ScopeValue) => void;
  breakdown: BreakdownValue;
  onBreakdown: (breakdown: BreakdownValue) => void;
  period: string;
  onPeriod: (period: string) => void;
  periods: PeriodOption[];
  /** Hidden on Games, which has its own Cash games / Tournaments switch. */
  showScope?: boolean;
};

/** One compact bar: what to count (scope), how to slice it, and which slice. */
export function FilterBar({ scope, onScope, breakdown, onBreakdown, period, onPeriod, periods, showScope = true }: FilterBarProps) {
  return (
    <section
      data-testid="section-filter-bar"
      aria-label="Filters"
      className="mt-4 flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5"
    >
      {showScope && (
        <Segmented
          label="Show"
          value={scope}
          onChange={onScope}
          testIdPrefix="button-global-earnings-scope"
          choices={[
            { value: "all", label: "All" },
            { value: "cash", label: "Cash" },
            { value: "tournaments", label: "Tournaments" },
          ]}
        />
      )}
      <Segmented
        label="By"
        value={breakdown}
        onChange={onBreakdown}
        testIdPrefix="button-breakdown"
        choices={[
          { value: "months", label: "Month" },
          { value: "quarters", label: "Quarter" },
        ]}
      />
      <label className="relative flex items-center gap-2 sm:ml-auto">
        <span className="hidden text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:inline">
          {breakdown === "months" ? "Month" : "Quarter"}
        </span>
        <select
          value={period}
          onChange={(event) => onPeriod(event.target.value)}
          data-testid="select-period-filter"
          aria-label={breakdown === "months" ? "Month" : "Quarter"}
          className="h-9 w-full appearance-none rounded-lg border border-border bg-background pl-3 pr-9 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto sm:min-w-[220px]"
        >
          {periods.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label} · {option.summary}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 h-3.5 w-3.5 text-muted-foreground" />
      </label>
    </section>
  );
}
