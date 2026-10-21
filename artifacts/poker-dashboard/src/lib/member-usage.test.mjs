import assert from "node:assert/strict";
import test from "node:test";

import {
  formatVisibleDuration,
  visibleUsageSeconds,
} from "./member-usage.ts";

test("visible usage excludes time spent in a background tab", () => {
  assert.equal(visibleUsageSeconds(45_000, false), 0);
});

test("visible usage records elapsed foreground seconds", () => {
  assert.equal(visibleUsageSeconds(29_999, true), 29);
});

test("visible usage caps delayed heartbeats to avoid counting long sleeps", () => {
  assert.equal(visibleUsageSeconds(3_600_000, true), 60);
  assert.equal(visibleUsageSeconds(-1_000, true), 0);
});

test("formats total visible time for the admin report", () => {
  assert.equal(formatVisibleDuration(38), "38 sec");
  assert.equal(formatVisibleDuration(125), "2 min");
  assert.equal(formatVisibleDuration(3_840), "1h 4m");
});
