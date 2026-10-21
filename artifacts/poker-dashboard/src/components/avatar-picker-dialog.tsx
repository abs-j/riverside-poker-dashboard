import { useRef, useState } from "react";
import { Camera, Check, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar } from "@/components/avatar";
import { AVATAR_PRESETS, AvatarArt } from "@/components/avatar-art";
import { automaticPresetFor } from "@/lib/podium";
import { shrinkImageToDataUrl, useAvatarMutations, type MemberAvatar } from "@/lib/avatars";

type AvatarPickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  current: MemberAvatar | undefined;
};

export function AvatarPickerDialog({ open, onOpenChange, name, current }: AvatarPickerDialogProps) {
  const { save, remove } = useAvatarMutations();
  const automatic = automaticPresetFor(name, AVATAR_PRESETS.map((preset) => preset.id));
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const done = () => {
    setError("");
    onOpenChange(false);
  };
  const fail = (cause: unknown) => setError(cause instanceof Error ? cause.message : "Something went wrong.");

  const choosePreset = (preset: string) => {
    setError("");
    save.mutate({ kind: "preset", preset }, { onSuccess: done, onError: fail });
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      const imageDataUrl = await shrinkImageToDataUrl(file);
      await save.mutateAsync({ kind: "upload", imageDataUrl });
      done();
    } catch (cause) {
      fail(cause);
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const pending = busy || save.isPending || remove.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-avatar-picker" className="max-w-md">
        <DialogHeader>
          <DialogTitle>Your profile picture</DialogTitle>
          <DialogDescription>Pick a sea creature or upload your own photo. Everyone in the club will see it.</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4">
          <Avatar name={name} size={72} />
          <div className="min-w-0 text-sm">
            <p className="truncate font-semibold">{name}</p>
            <p className="text-xs text-muted-foreground">
              {current ? (current.kind === "upload" ? "Using your own photo" : "Using a preset") : `Automatic: ${AVATAR_PRESETS.find((preset) => preset.id === automatic)?.label ?? "picture"}`}
            </p>
          </div>
        </div>

        <div role="group" aria-label="Preset pictures" className="grid grid-cols-4 gap-2.5">
          {AVATAR_PRESETS.map((preset) => {
            const selected = current
              ? current.kind === "preset" && current.preset === preset.id
              : false;
            return (
              <button
                key={preset.id}
                type="button"
                disabled={pending}
                onClick={() => choosePreset(preset.id)}
                aria-pressed={selected}
                aria-label={preset.label}
                data-testid={`avatar-preset-${preset.id}`}
                className={`group relative flex flex-col items-center gap-1.5 rounded-xl border p-2 text-[11px] font-medium transition-colors disabled:opacity-60 ${
                  selected ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 hover:bg-secondary"
                }`}
              >
                <span className="block h-12 w-12 overflow-hidden rounded-full">
                  <AvatarArt preset={preset.id} uid={`picker-${preset.id}`} />
                </span>
                {preset.label}
                {selected && <Check className="absolute right-1 top-1 h-3.5 w-3.5 text-primary" aria-hidden="true" />}
              </button>
            );
          })}
        </div>

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="sr-only"
          data-testid="input-avatar-file"
          onChange={(event) => void onFile(event.target.files?.[0])}
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={pending}
            onClick={() => fileInput.current?.click()}
            data-testid="button-avatar-upload"
            className="inline-flex h-11 items-center sm:flex-1 justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            <Camera className="h-4 w-4" />
            {busy ? "Preparing photo…" : "Upload your own"}
          </button>
          {current && (
            <button
              type="button"
              disabled={pending}
              onClick={() => remove.mutate(undefined, { onSuccess: done, onError: fail })}
              data-testid="button-avatar-remove"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-semibold hover:bg-secondary disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" />
              Use automatic picture
            </button>
          )}
        </div>
        {error && <p role="alert" data-testid="status-avatar-error" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
        <p className="text-[11px] leading-4 text-muted-foreground">Photos are cropped to a square and shrunk before saving. Keep it club-friendly: club admins can remove any picture.</p>
      </DialogContent>
    </Dialog>
  );
}

