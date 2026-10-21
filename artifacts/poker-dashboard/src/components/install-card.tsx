import { useState } from "react";
import { Download, X } from "lucide-react";

const DISMISS_KEY = "install-card-dismissed-at";
const SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;

function dismissedRecently(): boolean {
  try {
    const at = Number(window.localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < SNOOZE_MS;
  } catch {
    return false;
  }
}

/** A phone-only prompt near the top of Home. Dismissing hides it for a month. */
export function InstallCard({ oneTap, onInstall }: { oneTap: boolean; onInstall: () => void }) {
  const [hidden, setHidden] = useState(dismissedRecently);
  if (hidden) return null;
  return (
    <div data-testid="card-install-app" className="mb-4 flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/[0.06] p-3 pl-4 lg:hidden">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Download className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">Install the app</span>
        <span className="block text-xs text-muted-foreground">{oneTap ? "One tap to add it to your home screen." : "Add it to your home screen in a few taps."}</span>
      </span>
      <button
        type="button"
        onClick={onInstall}
        data-testid="button-install-card"
        className="inline-flex h-10 shrink-0 items-center rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground"
      >
        {oneTap ? "Install" : "Show me"}
      </button>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          try {
            window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
          } catch {
            // Hidden for this visit only.
          }
          setHidden(true);
        }}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
