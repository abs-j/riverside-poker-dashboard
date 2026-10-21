import { createContext, useContext, useId, useMemo, type ReactNode } from "react";
import { AVATAR_PRESETS, AvatarArt, isPresetId } from "@/components/avatar-art";
import { avatarImageUrl, avatarKey, type MemberAvatar } from "@/lib/avatars";
import { automaticPresetFor } from "@/lib/podium";

const AvatarContext = createContext<Map<string, MemberAvatar>>(new Map());

/** Makes every <Avatar> on the page show the member's chosen picture, if they set one. */
export function AvatarProvider({ avatars, children }: { avatars: Map<string, MemberAvatar>; children: ReactNode }) {
  return <AvatarContext.Provider value={avatars}>{children}</AvatarContext.Provider>;
}

type AvatarProps = {
  name: string;
  size?: number;
  className?: string;
  ring?: string;
};

/** A round picture: the member's preset or upload, or an automatic one picked from their name when they have none. */
export function Avatar({ name, size = 40, className = "", ring }: AvatarProps) {
  const avatars = useContext(AvatarContext);
  const uid = useId().replace(/:/g, "");
  const chosen = useMemo(() => avatars.get(avatarKey(name)), [avatars, name]);
  const frame = {
    width: size,
    height: size,
    boxShadow: ring ? `0 0 0 3px hsl(var(--card)), 0 0 0 5px ${ring}` : undefined,
  };

  if (chosen?.kind === "preset" && isPresetId(chosen.preset)) {
    return (
      <span aria-hidden="true" className={`inline-block shrink-0 overflow-hidden rounded-full ${className}`} style={frame}>
        <AvatarArt preset={chosen.preset} uid={uid} />
      </span>
    );
  }
  if (chosen?.kind === "upload") {
    return (
      <span aria-hidden="true" className={`inline-block shrink-0 overflow-hidden rounded-full bg-secondary ${className}`} style={frame}>
        <img src={avatarImageUrl(chosen)} alt="" width={size} height={size} loading="lazy" className="block h-full w-full object-cover" />
      </span>
    );
  }
  return (
    <span aria-hidden="true" className={`inline-block shrink-0 overflow-hidden rounded-full ${className}`} style={frame}>
      <AvatarArt preset={automaticPresetFor(name, AVATAR_PRESETS.map((preset) => preset.id))} uid={uid} />
    </span>
  );
}
