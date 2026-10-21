import { useEffect, useState } from "react";
import { Download, Share2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { renderShareCard, type GroupCardModel, type ShareCardModel } from "@/lib/share-card";

type ShareImageDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  model: ShareCardModel | GroupCardModel;
  title?: string;
  description?: string;
  /** Used for the downloaded file name and the share text. */
  fileName: string;
  shareText: string;
};

export function ShareImageDialog({
  open,
  onOpenChange,
  model,
  fileName,
  shareText,
  title = "Your night, as a picture",
  description = "Save it or send it straight to the group chat.",
}: ShareImageDialogProps) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    setBlob(null);
    setUrl(null);
    setError("");
    renderShareCard(model)
      .then((result) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(result);
        setBlob(result);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setError("The image could not be created in this browser.");
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, model]);

  const file = blob ? new File([blob], fileName, { type: "image/png" }) : null;
  const canShareFile = Boolean(file && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] }));

  const download = () => {
    if (!url) return;
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const share = async () => {
    if (!file) return;
    try {
      await navigator.share({ files: [file], text: shareText });
    } catch (shareError) {
      if (!(shareError instanceof DOMException && shareError.name === "AbortError")) download();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-share-image" className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="share-preview overflow-hidden rounded-2xl border border-border bg-secondary/40">
          {url ? (
            <img src={url} alt={"rows" in model ? `${model.title}: ${model.subtitle}` : `${model.playerName}'s result: ${model.result}`} data-testid="img-share-card" className="block w-full" />
          ) : error ? (
            <p className="p-8 text-center text-sm text-destructive">{error}</p>
          ) : (
            <div className="skeleton aspect-[4/5] w-full" />
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {canShareFile && (
            <button
              type="button"
              onClick={() => void share()}
              data-testid="button-share-image-send"
              className="inline-flex h-11 items-center sm:flex-1 justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              <Share2 className="h-4 w-4" />
              Share
            </button>
          )}
          <button
            type="button"
            onClick={download}
            disabled={!url}
            data-testid="button-share-image-download"
            className={`inline-flex h-11 items-center sm:flex-1 justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-50 ${
              canShareFile ? "border border-border bg-background" : "bg-primary text-primary-foreground"
            }`}
          >
            <Download className="h-4 w-4" />
            Save image
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
