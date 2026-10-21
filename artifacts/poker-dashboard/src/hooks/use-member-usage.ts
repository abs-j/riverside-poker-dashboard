import { useEffect } from "react";
import {
  recordMemberUsage,
  type MemberUsageInput,
} from "@workspace/api-client-react";
import {
  MEMBER_USAGE_HEARTBEAT_MS,
  visibleUsageSeconds,
} from "@/lib/member-usage";

export function useMemberUsageTracking(
  section: MemberUsageInput["section"],
): void {
  useEffect(() => {
    let measuredAt = Date.now();
    let wasVisible = document.visibilityState === "visible";

    const send = (pageView: boolean, activeSeconds: number) => {
      const payload: MemberUsageInput = {
        section,
        pageView,
        activeSeconds,
      };
      void recordMemberUsage(payload, {
        credentials: "include",
        keepalive: true,
      }).catch(() => undefined);
    };

    const flush = () => {
      const now = Date.now();
      const activeSeconds = visibleUsageSeconds(now - measuredAt, wasVisible);
      measuredAt = now;
      if (activeSeconds > 0) send(false, activeSeconds);
    };

    const handleVisibilityChange = () => {
      flush();
      wasVisible = document.visibilityState === "visible";
    };

    send(true, 0);
    const heartbeat = window.setInterval(flush, MEMBER_USAGE_HEARTBEAT_MS);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", flush);

    return () => {
      flush();
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", flush);
    };
  }, [section]);
}
