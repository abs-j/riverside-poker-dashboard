import { useCallback, useEffect, useMemo, useState } from "react";
import { detectInstallPlatform, type InstallPlatform } from "@/lib/install-platform";

// Chromium fires `beforeinstallprompt` when the app can be installed with one tap. Safari on
// iOS never does, and Chrome only sometimes, so the install entry is always shown (unless the
// app is already installed) and falls back to step-by-step instructions.
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function readEnvironment() {
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return { userAgent: navigator.userAgent, standalone, maxTouchPoints: navigator.maxTouchPoints ?? 0 };
}

export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const platform: InstallPlatform = useMemo(
    () => (installed ? "installed" : detectInstallPlatform(readEnvironment())),
    [installed],
  );

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as InstallEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setInstalled(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  /** One tap when the browser allows it; otherwise show the steps for this device. */
  const install = useCallback(async () => {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice.catch(() => undefined);
      setDeferred(null);
      return;
    }
    setHelpOpen(true);
  }, [deferred]);

  return {
    /** True whenever there is something useful to offer: everywhere except the installed app. */
    canInstall: platform !== "installed",
    /** True when a single tap installs, with no instructions needed. */
    oneTap: deferred !== null,
    platform,
    install,
    helpOpen,
    setHelpOpen,
  };
}
