import assert from "node:assert/strict";
import test from "node:test";

import { clamp01, easeOutCubic, tween } from "./motion.ts";

test("easing starts at zero, ends at one and never decreases", () => {
  assert.equal(easeOutCubic(0), 0);
  assert.equal(easeOutCubic(1), 1);
  let previous = -1;
  for (let step = 0; step <= 20; step++) {
    const value = easeOutCubic(step / 20);
    assert.ok(value >= previous);
    previous = value;
  }
});

test("easing clamps out-of-range input", () => {
  assert.equal(clamp01(-3), 0);
  assert.equal(clamp01(4), 1);
  assert.equal(easeOutCubic(2), 1);
});

test("tween moves from the start value to the target and works for negatives", () => {
  assert.equal(tween(0, 100, 0, 800), 0);
  assert.equal(tween(0, 100, 800, 800), 100);
  assert.equal(tween(-50, 50, 800, 800), 50);
  assert.ok(tween(0, 100, 400, 800) > 50, "ease-out is past halfway at half time");
  assert.equal(tween(10, 20, 0, 0), 20);
});
