// Logic for the top-three podium and the gradient initials avatars.

export type PodiumSource = { name: string; profitTotal: number; gamesPlayed: number; rank: number };
export type PodiumPlace = 1 | 2 | 3;
export type PodiumSlot = { place: PodiumPlace; name: string; net: number; games: number };

/**
 * The top three in display order: second, first, third (first stands in the middle).
 * Fewer than three players simply gives fewer slots.
 */
export function buildPodium(players: PodiumSource[]): PodiumSlot[] {
  const top = players
    .slice()
    .sort((left, right) => left.rank - right.rank || right.profitTotal - left.profitTotal)
    .slice(0, 3)
    .map((player, index): PodiumSlot => ({
      place: (index + 1) as PodiumPlace,
      name: player.name,
      net: player.profitTotal,
      games: player.gamesPlayed,
    }));
  const byPlace = new Map(top.map((slot) => [slot.place, slot]));
  return ([2, 1, 3] as PodiumPlace[]).map((place) => byPlace.get(place)).filter((slot): slot is PodiumSlot => Boolean(slot));
}

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const letters = parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0];
  return letters.toUpperCase();
}

// Hue pairs stay inside the violet / magenta / blue / teal family so avatars match the brand.
const AVATAR_HUES: Array<[number, number]> = [
  [262, 292],
  [280, 320],
  [300, 330],
  [236, 268],
  [212, 250],
  [190, 226],
  [322, 350],
  [252, 286],
];

/** Same name, same colours, every time. */
export function avatarHues(name: string): [number, number] {
  let hash = 0;
  for (const char of name.trim().toLowerCase()) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_HUES[hash % AVATAR_HUES.length];
}

/**
 * Everyone without a chosen picture still gets one: a sea creature picked from their name, so a
 * list of players is not a wall of identical icons. The same name always gets the same one.
 */
export function automaticPresetFor<T extends string>(name: string, presets: readonly T[]): T {
  let hash = 7;
  for (const char of name.trim().toLowerCase()) hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  return presets[hash % presets.length];
}
