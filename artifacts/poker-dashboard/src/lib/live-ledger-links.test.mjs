import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLiveLedgerUrl,
  dashboardSearchForView,
  getInitialDashboardView,
} from "./live-ledger-links.ts";

test("selects Live from the QR deep-link query without changing the protected route", () => {
  assert.equal(getInitialDashboardView("?view=live"), "live");
  assert.equal(getInitialDashboardView("?view=overview"), "overview");
  assert.equal(getInitialDashboardView(""), "overview");
});

test("opens Overview by default on every screen size while respecting explicit Live links", () => {
  assert.equal(getInitialDashboardView(""), "overview");
  assert.equal(getInitialDashboardView("?view=live"), "live");
  assert.equal(getInitialDashboardView("?view=overview"), "overview");
});

test("builds QR URLs using the app base path and no credentials", () => {
  assert.equal(
    buildLiveLedgerUrl("https://poker.example", "/"),
    "https://poker.example/dashboard?view=live",
  );
  assert.equal(
    buildLiveLedgerUrl("https://poker.example", "/riverside-poker"),
    "https://poker.example/riverside-poker/dashboard?view=live",
  );
});

test("updates only the Live view query parameter", () => {
  assert.equal(
    dashboardSearchForView("?filter=all&view=live", "overview"),
    "?filter=all",
  );
  assert.equal(
    dashboardSearchForView("?filter=all", "live"),
    "?filter=all&view=live",
  );
});