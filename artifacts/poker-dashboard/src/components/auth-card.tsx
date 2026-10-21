import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ChevronRight, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { CLUB_NAME } from "@/lib/brand";

type AuthCardProps = {
  /** "admin" adds a restricted-area strip so the two pages cannot be confused. */
  tone: "member" | "admin";
  icon: ReactNode;
  areaLabel: string;
  eyebrow: string;
  title: string;
  intro: ReactNode;
  fieldLabel: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  error: string;
  /** When set, the button stays disabled until this many seconds have passed. */
  waitSeconds?: number;
  submitting: boolean;
  submitLabel: string;
  onSubmit: () => void;
  testIds: { input: string; submit: string; error: string };
  /** Small print directly under the button. */
  note?: ReactNode;
  footer?: ReactNode;
};

/** The sign-in card shared by the member and admin pages, so improvements land on both. */
export function AuthCard(props: AuthCardProps) {
  const [shown, setShown] = useState(false);
  const [remaining, setRemaining] = useState(props.waitSeconds ?? 0);

  useEffect(() => {
    setRemaining(props.waitSeconds ?? 0);
  }, [props.waitSeconds]);
  useEffect(() => {
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => setRemaining((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [remaining]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!props.submitting && remaining <= 0 && props.value.trim()) props.onSubmit();
  };
  const blocked = remaining > 0;
  const admin = props.tone === "admin";

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      {admin && (
        <div className="bg-amber-500/15 px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-800 dark:text-amber-200">
          Restricted · committee only
        </div>
      )}
      <div className="flex flex-1 items-center justify-center px-5 py-8">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-3">
            <div className="brand-mark flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_3px_0_hsl(262_80%_40%)]">
              {props.icon}
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight">{CLUB_NAME}</p>
              <p className="text-xs text-muted-foreground">{props.areaLabel}</p>
            </div>
          </div>

          <form onSubmit={submit} className={`soft-shadow rounded-2xl border bg-card p-6 sm:p-8 ${admin ? "border-amber-500/40" : "border-border"}`}>
            <p className="section-label text-primary">{props.eyebrow}</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">{props.title}</h1>
            <div className="mt-2 text-sm leading-6 text-muted-foreground">{props.intro}</div>

            <label className="mt-6 block">
              <span className="mb-2 block text-xs font-semibold text-foreground">{props.fieldLabel}</span>
              <span className="relative block">
                <input
                  autoFocus
                  type={shown ? "text" : "password"}
                  value={props.value}
                  onChange={(event) => props.onChange(event.target.value)}
                  placeholder={props.placeholder}
                  data-testid={props.testIds.input}
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="go"
                  aria-invalid={props.error ? true : undefined}
                  className="h-12 w-full rounded-xl border border-border bg-background pl-4 pr-12 text-sm outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => setShown((value) => !value)}
                  aria-label={shown ? `Hide ${props.fieldLabel.toLowerCase()}` : `Show ${props.fieldLabel.toLowerCase()}`}
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </span>
            </label>

            {props.error && (
              <p role="alert" data-testid={props.testIds.error} className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {props.error}
              </p>
            )}

            <button
              type="submit"
              disabled={props.submitting || blocked || !props.value.trim()}
              data-testid={props.testIds.submit}
              className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-60"
            >
              {props.submitting ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Checking…
                </>
              ) : blocked ? (
                `Try again in ${remaining >= 60 ? `${Math.ceil(remaining / 60)} min` : `${remaining}s`}`
              ) : (
                <>
                  {props.submitLabel}
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </button>
            {props.note && <div className="mt-4 text-xs leading-5 text-muted-foreground">{props.note}</div>}
          </form>
          {props.footer && <div className="mt-5 text-center text-xs text-muted-foreground">{props.footer}</div>}
        </div>
      </div>
    </div>
  );
}
