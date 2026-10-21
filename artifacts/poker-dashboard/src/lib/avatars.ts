// Profile pictures: the member list, saving a choice, and shrinking an uploaded photo.
import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type MemberAvatar = {
  key: string;
  name: string;
  kind: "preset" | "upload";
  preset: string | null;
  version: number;
};

const QUERY_KEY = ["/api/poker/avatars"] as const;

export const avatarKey = (name: string) => name.trim().replace(/\s+/g, " ").toLocaleLowerCase();

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { ...(init?.body ? { "content-type": "application/json" } : {}), ...init?.headers },
  });
  if (!response.ok) {
    let message = "Something went wrong. Please try again.";
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // Keep the generic message.
    }
    throw new Error(message);
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

/** Everyone's chosen picture, keyed by normalised name. Fails quietly: initials are the fallback. */
export function useMemberAvatars() {
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => request<{ avatars: MemberAvatar[] }>("/api/poker/avatars"),
    staleTime: 60_000,
    retry: false,
  });
  return useMemo(() => new Map((query.data?.avatars ?? []).map((item) => [item.key, item])), [query.data]);
}

export function useAvatarMutations() {
  const client = useQueryClient();
  const refresh = useCallback(() => client.invalidateQueries({ queryKey: QUERY_KEY }), [client]);
  const save = useMutation({
    mutationFn: (body: { kind: "preset"; preset: string } | { kind: "upload"; imageDataUrl: string }) =>
      request<MemberAvatar>("/api/poker/avatars/me", { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: () => request<void>("/api/poker/avatars/me", { method: "DELETE" }),
    onSuccess: refresh,
  });
  return { save, remove };
}

export const avatarImageUrl = (item: MemberAvatar) =>
  `/api/poker/avatars/image/${encodeURIComponent(item.key)}?v=${item.version}`;

const MAX_BYTES = 45 * 1024;

/**
 * Centre-crops a photo to a square and shrinks it to a small JPEG, lowering the quality
 * until it fits. The server enforces its own limit as well.
 */
export async function shrinkImageToDataUrl(file: File, size = 256): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file.");
  }
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("That image could not be read. Try a JPEG or PNG.");
  });
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Images are not supported in this browser.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close?.();

  for (const quality of [0.86, 0.74, 0.62, 0.5, 0.4]) {
    const url = canvas.toDataURL("image/jpeg", quality);
    // Base64 is 4/3 the size of the bytes it encodes.
    const bytes = ((url.length - url.indexOf(",") - 1) * 3) / 4;
    if (bytes <= MAX_BYTES) return url;
  }
  throw new Error("That image is too detailed to shrink. Try a simpler one.");
}
