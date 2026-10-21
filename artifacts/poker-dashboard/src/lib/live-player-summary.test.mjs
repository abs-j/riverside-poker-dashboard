import assert from "node:assert/strict";
import test from "node:test";

import {
  formatLivePlayerSummaryRows,
  livePlayerNetProfit,
} from "./live-player-summary.ts";

test("calculates player net profit as cash-outs minus buy-ins", () => {
  assert.equal(livePlayerNetProfit({ buyIns: 60, cashOuts: 100 }), 40);
  assert.equal(livePlayerNetProfit({ buyIns: 60, cashOuts: 30 }), -30);
});

test("formats player totals as tab-separated rows without a heading row", () => {
  assert.equal(
    formatLivePlayerSummaryRows([
      { playerName: "Alex", buyIns: 120, cashOuts: 75.5, netProfit: -44.5 },
      { playerName: "Sam", buyIns: 0, cashOuts: 40 },
    ]),
    "Alex\t120.00\t75.50\nSam\t0.00\t40.00",
  );
});

test("keeps player names on one row and one cell", () => {
  assert.equal(
    formatLivePlayerSummaryRows([
      { playerName: "  Alex\tSmith\n", buyIns: 1, cashOuts: 0 },
    ]),
    "Alex Smith\t1.00\t0.00",
  );
});

test("formats an empty summary list as empty text", () => {
  assert.equal(formatLivePlayerSummaryRows([]), "");
});