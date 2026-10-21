import assert from "node:assert/strict";
import test from "node:test";

import { detectInstallPlatform, installSteps } from "./install-platform.ts";

const env = (userAgent, extra = {}) => ({ userAgent, standalone: false, maxTouchPoints: 0, ...extra });
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";

test("iPhone Safari needs Add to Home Screen instructions", () => {
  assert.equal(detectInstallPlatform(env(IPHONE)), "ios");
  assert.match(installSteps("ios").steps[1], /Add to Home Screen/);
});

test("iPad reporting a Mac user agent is still iOS", () => {
  assert.equal(detectInstallPlatform(env(MAC, { maxTouchPoints: 5 })), "ios");
  assert.equal(detectInstallPlatform(env(MAC)), "desktop");
});

test("Android and desktop are told apart", () => {
  assert.equal(detectInstallPlatform(env(ANDROID)), "android");
});

test("an installed app is reported as installed", () => {
  assert.equal(detectInstallPlatform(env(IPHONE, { standalone: true })), "installed");
});

test("links opened inside social apps are flagged", () => {
  assert.equal(detectInstallPlatform(env(`${IPHONE} Instagram 320.0`)), "inapp");
  assert.equal(detectInstallPlatform(env(`${ANDROID} FB_IAB/FB4A`)), "inapp");
});
