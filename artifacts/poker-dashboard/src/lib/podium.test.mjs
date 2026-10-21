import assert from "node:assert/strict";
import test from "node:test";

import { avatarHues, buildPodium, initialsOf } from "./podium.ts";

const player = (name, profitTotal, rank) => ({ name, profitTotal, gamesPlayed: 5, rank });

test("podium puts first place in the middle", () => {
  const slots = buildPodium([player("C", 10, 3), player("A", 90, 1), player("B", 50, 2), player("D", 1, 4)]);
  assert.deepEqual(slots.map((slot) => slot.place), [2, 1, 3]);
  assert.deepEqual(slots.map((slot) => slot.name), ["B", "A", "C"]);
});

test("podium copes with fewer than three players", () => {
  assert.deepEqual(buildPodium([player("A", 5, 1)]).map((slot) => slot.place), [1]);
  assert.deepEqual(buildPodium([player("A", 5, 1), player("B", 2, 2)]).map((slot) => slot.place), [2, 1]);
  assert.deepEqual(buildPodium([]), []);
});

test("initials use first and last word", () => {
  assert.equal(initialsOf("Abhay"), "AB");
  assert.equal(initialsOf("Ben Ch"), "BC");
  assert.equal(initialsOf("  jason   v "), "JV");
  assert.equal(initialsOf(""), "?");
});

test("avatar colours are stable per name and ignore case", () => {
  assert.deepEqual(avatarHues("Abhay"), avatarHues("  abhay "));
  const [a, b] = avatarHues("Someone");
  assert.ok(a >= 180 && b <= 360);
});

import { automaticPresetFor } from "./podium.ts";

test("automatic pictures are stable per name and spread across the set", () => {
  const presets = ["fish", "shark", "whale", "octopus", "dolphin", "crab", "turtle", "jellyfish"];
  assert.equal(automaticPresetFor("Abhay", presets), automaticPresetFor("  abhay ", presets));
  const names = ["Ranuka", "Hayley", "Abhay", "Jason", "Ben Ch", "Shiv", "Manas", "Alfie", "Kaustav", "Vivan", "Toby", "Raju", "Shanaa", "Sadeesha"];
  const used = new Set(names.map((name) => automaticPresetFor(name, presets)));
  assert.ok(used.size >= 5, `only ${used.size} different pictures for ${names.length} players`);
});
