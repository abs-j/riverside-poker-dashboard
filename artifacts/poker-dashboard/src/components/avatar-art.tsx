import type { ReactElement } from "react";

export const AVATAR_PRESETS = [
  { id: "fish", label: "Fish" },
  { id: "shark", label: "Shark" },
  { id: "whale", label: "Whale" },
  { id: "octopus", label: "Octopus" },
  { id: "dolphin", label: "Dolphin" },
  { id: "crab", label: "Crab" },
  { id: "turtle", label: "Turtle" },
  { id: "jellyfish", label: "Jellyfish" },
] as const;

export type AvatarPresetId = (typeof AVATAR_PRESETS)[number]["id"];

export const isPresetId = (value: string | null | undefined): value is AvatarPresetId =>
  AVATAR_PRESETS.some((preset) => preset.id === value);

const Eye = ({ x, y, r = 2.6 }: { x: number; y: number; r?: number }) => (
  <>
    <circle cx={x} cy={y} r={r} fill="#fff" />
    <circle cx={x + 0.7} cy={y + 0.2} r={r * 0.5} fill="#0f172a" />
  </>
);

// Each illustration is drawn on a 64 x 64 canvas with its own sea-coloured background.
const ART: Record<AvatarPresetId, (gradientId: string) => ReactElement> = {
  fish: (id) => (
    <>
      <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#38bdf8" /><stop offset="1" stopColor="#6366f1" /></linearGradient></defs>
      <rect width="64" height="64" fill={`url(#${id})`} />
      <circle cx="14" cy="14" r="3" fill="#fff" opacity=".35" /><circle cx="22" cy="9" r="1.8" fill="#fff" opacity=".3" />
      <path d="M46 33 L59 22 L59 44 Z" fill="#f97316" />
      <ellipse cx="30" cy="33" rx="18" ry="13" fill="#fb923c" />
      <path d="M26 20 Q31 12 38 20 Z" fill="#f97316" />
      <path d="M26 33 Q30 40 38 38" fill="none" stroke="#fdba74" strokeWidth="2" strokeLinecap="round" />
      <Eye x={20} y={30} r={3} />
    </>
  ),
  shark: (id) => (
    <>
      <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#0ea5e9" /><stop offset="1" stopColor="#1e3a8a" /></linearGradient></defs>
      <rect width="64" height="64" fill={`url(#${id})`} />
      <path d="M51 36 L62 24 L60 48 Z" fill="#64748b" />
      <path d="M28 27 L37 10 L43 29 Z" fill="#64748b" />
      <ellipse cx="31" cy="37" rx="23" ry="12" fill="#94a3b8" />
      <path d="M10 40 Q31 52 52 40 Q31 46 10 40 Z" fill="#f1f5f9" />
      <path d="M11 36 Q18 41 26 39" fill="none" stroke="#0f172a" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M14 38 l2 3 l2 -3 M19 39 l2 3 l2 -3" fill="#fff" stroke="#fff" strokeWidth="1" />
      <Eye x={19} y={32} />
    </>
  ),
  whale: (id) => (
    <>
      <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#22d3ee" /><stop offset="1" stopColor="#4f46e5" /></linearGradient></defs>
      <rect width="64" height="64" fill={`url(#${id})`} />
      <path d="M28 20 Q28 12 24 8 M28 20 Q28 12 33 8" fill="none" stroke="#e0f2fe" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M50 38 Q58 36 60 26 Q54 26 52 32 Q54 24 62 22 Q62 36 52 44 Z" fill="#2563eb" />
      <path d="M6 40 Q8 24 30 24 Q50 24 52 40 Q52 52 30 52 Q10 52 6 40 Z" fill="#3b82f6" />
      <path d="M8 42 Q30 54 51 42 Q50 52 30 52 Q12 52 8 42 Z" fill="#dbeafe" />
      <Eye x={17} y={36} />
      <path d="M14 43 Q19 46 24 44" fill="none" stroke="#1e3a8a" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  octopus: (id) => (
    <>
      <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f0abfc" /><stop offset="1" stopColor="#7c3aed" /></linearGradient></defs>
      <rect width="64" height="64" fill={`url(#${id})`} />
      <g fill="none" stroke="#ec4899" strokeWidth="5" strokeLinecap="round">
        <path d="M18 40 Q12 48 16 56" /><path d="M26 42 Q24 52 28 58" /><path d="M38 42 Q40 52 36 58" /><path d="M46 40 Q52 48 48 56" />
      </g>
      <circle cx="32" cy="28" r="16" fill="#f472b6" />
      <circle cx="26" cy="20" r="3" fill="#fbcfe8" opacity=".7" />
      <Eye x={26} y={30} r={3.2} /><Eye x={38} y={30} r={3.2} />
      <path d="M28 38 Q32 41 36 38" fill="none" stroke="#9d174d" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  dolphin: (id) => (
    <>
      <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#67e8f9" /><stop offset="1" stopColor="#2563eb" /></linearGradient></defs>
      <rect width="64" height="64" fill={`url(#${id})`} />
      <path d="M52 22 Q60 18 62 10 Q54 12 50 18 Z" fill="#475569" />
      <path d="M6 44 Q10 22 34 22 Q48 22 54 32 Q46 30 40 36 Q30 52 6 44 Z" fill="#64748b" />
      <path d="M8 44 Q28 52 40 36 Q30 46 8 44 Z" fill="#e2e8f0" />
      <path d="M30 24 Q34 12 42 14 Q38 20 38 26 Z" fill="#475569" />
      <path d="M6 44 L2 46 L8 40" fill="#64748b" stroke="#64748b" strokeWidth="2" strokeLinejoin="round" />
      <Eye x={20} y={34} />
    </>
  ),
  crab: (id) => (
    <>
      <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fda4af" /><stop offset="1" stopColor="#f97316" /></linearGradient></defs>
      <rect width="64" height="64" fill={`url(#${id})`} />
      <g fill="#dc2626"><circle cx="12" cy="20" r="7" /><circle cx="52" cy="20" r="7" /></g>
      <g stroke="#dc2626" strokeWidth="3" strokeLinecap="round" fill="none"><path d="M20 38 L10 44" /><path d="M22 44 L14 52" /><path d="M44 38 L54 44" /><path d="M42 44 L50 52" /><path d="M18 30 L12 24" /><path d="M46 30 L52 24" /></g>
      <ellipse cx="32" cy="40" rx="17" ry="11" fill="#ef4444" />
      <path d="M26 30 L26 24 M38 30 L38 24" stroke="#b91c1c" strokeWidth="2.5" strokeLinecap="round" />
      <Eye x={26} y={22} r={3} /><Eye x={38} y={22} r={3} />
      <path d="M27 42 Q32 46 37 42" fill="none" stroke="#7f1d1d" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  turtle: (id) => (
    <>
      <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#86efac" /><stop offset="1" stopColor="#0d9488" /></linearGradient></defs>
      <rect width="64" height="64" fill={`url(#${id})`} />
      <g fill="#65a30d"><circle cx="14" cy="44" r="5" /><circle cx="46" cy="46" r="5" /><circle cx="54" cy="32" r="8" /><path d="M12 36 L6 36 L10 40 Z" /></g>
      <path d="M12 44 Q14 20 32 20 Q50 20 52 44 Z" fill="#15803d" />
      <path d="M32 20 L32 44 M20 28 L44 28 M16 38 L48 38" stroke="#86efac" strokeWidth="1.6" opacity=".7" />
      <Eye x={56} y={30} r={2.2} />
    </>
  ),
  jellyfish: (id) => (
    <>
      <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#c4b5fd" /><stop offset="1" stopColor="#6d28d9" /></linearGradient></defs>
      <rect width="64" height="64" fill={`url(#${id})`} />
      <g stroke="#f5d0fe" strokeWidth="2.6" strokeLinecap="round" fill="none"><path d="M20 34 Q16 42 20 50 Q24 56 20 60" /><path d="M28 36 Q26 46 30 52" /><path d="M36 36 Q38 46 34 54" /><path d="M44 34 Q48 42 44 50 Q40 56 44 60" /></g>
      <path d="M10 36 Q10 12 32 12 Q54 12 54 36 Q44 40 32 36 Q20 40 10 36 Z" fill="#e879f9" />
      <circle cx="24" cy="20" r="3" fill="#fae8ff" opacity=".7" />
      <Eye x={25} y={28} /><Eye x={39} y={28} />
    </>
  ),
};

/** The preset illustration, filling its parent. `uid` keeps gradient ids unique on the page. */
export function AvatarArt({ preset, uid }: { preset: AvatarPresetId; uid: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className="block h-full w-full">
      {ART[preset](`av-${preset}-${uid}`)}
    </svg>
  );
}
