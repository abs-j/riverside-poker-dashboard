export const MEMBER_USAGE_HEARTBEAT_MS = 30_000;
export const MAX_MEMBER_USAGE_SECONDS_PER_HEARTBEAT = 60;

export function visibleUsageSeconds(
  elapsedMilliseconds: number,
  wasVisible: boolean,
): number {
  if (!wasVisible || !Number.isFinite(elapsedMilliseconds)) return 0;
  const elapsedSeconds = Math.floor(elapsedMilliseconds / 1000);
  return Math.min(
    MAX_MEMBER_USAGE_SECONDS_PER_HEARTBEAT,
    Math.max(0, elapsedSeconds),
  );
}

export function formatVisibleDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  if (safeSeconds < 60) return `${safeSeconds} sec`;
  const totalMinutes = Math.floor(safeSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${totalMinutes} min`;
}
