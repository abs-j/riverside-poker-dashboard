export type InitialDashboardView = "overview" | "live";

export function getInitialDashboardView(search: string): InitialDashboardView {
  const requestedView = new URLSearchParams(search).get("view");
  if (requestedView === "live") return "live";
  if (requestedView === "overview") return "overview";
  return "overview";
}

export function dashboardSearchForView(search: string, view: string): string {
  const params = new URLSearchParams(search);
  if (view === "live") {
    params.set("view", "live");
  } else {
    params.delete("view");
  }
  const nextSearch = params.toString();
  return nextSearch ? `?${nextSearch}` : "";
}

export function buildLiveLedgerUrl(origin: string, baseUrl: string): string {
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const appBase = new URL(normalizedBaseUrl, origin);
  const liveUrl = new URL("dashboard", appBase);
  liveUrl.searchParams.set("view", "live");
  return liveUrl.toString();
}