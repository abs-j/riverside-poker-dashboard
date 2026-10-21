// Small per-device settings. Storage can be blocked, so every call is wrapped and falls back.

const BADGE_POPUPS_KEY = "pref:badge-popups";

export function getBadgePopups(): boolean {
  try {
    return window.localStorage.getItem(BADGE_POPUPS_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setBadgePopups(enabled: boolean): void {
  try {
    window.localStorage.setItem(BADGE_POPUPS_KEY, enabled ? "on" : "off");
  } catch {
    // Not saved; the switch still works for this visit.
  }
}
