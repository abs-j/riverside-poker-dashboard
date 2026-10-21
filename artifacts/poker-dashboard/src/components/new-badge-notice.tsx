import { useEffect } from "react";
import { BADGE_EMOJI } from "@/components/form-dots";
import { useAchievements } from "@/components/achievements-context";
import { useToast } from "@/hooks/use-toast";
import { badgesFor, newlyEarned } from "@/lib/achievements";
import { getBadgePopups } from "@/lib/preferences";
import { normalizeName } from "@/lib/club-charts";

const storageKey = (viewer: string) => `badges-seen:${normalizeName(viewer)}`;

function readSeen(viewer: string): string[] | null {
  try {
    const raw = window.localStorage.getItem(storageKey(viewer));
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : null;
  } catch {
    return null;
  }
}

function writeSeen(viewer: string, ids: string[]) {
  try {
    window.localStorage.setItem(storageKey(viewer), JSON.stringify(ids));
  } catch {
    // Private mode or blocked storage: the notice may show again next time, which is harmless.
  }
}

/**
 * Announces badges the member has earned since they last opened the site. The first visit
 * only records what they already have, so nobody is greeted by a pile of old badges.
 */
export function NewBadgeNotice({ viewer }: { viewer: string }) {
  const { toast } = useToast();
  const { badges } = useAchievements();

  useEffect(() => {
    if (!viewer || badges.size === 0) return;
    const current = badgesFor(badges, viewer);
    const seen = readSeen(viewer);
    if (seen === null) {
      writeSeen(viewer, current.map((badge) => badge.id));
      return;
    }
    const fresh = newlyEarned(current, seen);
    if (!fresh.length) return;
    writeSeen(viewer, [...new Set([...seen, ...current.map((badge) => badge.id)])]);
    if (!getBadgePopups()) return;
    toast({
      title: fresh.length === 1 ? "You earned a badge" : `You earned ${fresh.length} badges`,
      description: fresh.map((badge) => `${BADGE_EMOJI[badge.id]} ${badge.label}`).join("  ·  "),
      duration: 8000,
    });
  }, [badges, viewer, toast]);

  return null;
}
