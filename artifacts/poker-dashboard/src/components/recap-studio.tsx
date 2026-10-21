import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ClipboardCopy, Copy, Download, Share2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { renderRecapSlide } from "@/lib/recap-render";
import { RECAP_FORMATS, type RecapFormat, type RecapPack } from "@/lib/recaps";
import { CLUB_SLUG } from "@/lib/brand";

type Rendered = { blob: Blob; url: string };

type RecapStudioProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pack: RecapPack | null;
};

const FORMATS: RecapFormat[] = ["feed", "story", "square"];

async function copyPng(blob: Blob): Promise<void> {
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
    throw new Error("unsupported");
  }
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Instagram-ready recap images for one game: pick a size, then copy, save or share them. */
export function RecapStudio({ open, onOpenChange, pack }: RecapStudioProps) {
  const [format, setFormat] = useState<RecapFormat>("feed");
  const [index, setIndex] = useState(0);
  const [images, setImages] = useState<Rendered[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!open || !pack) return;
    let cancelled = false;
    const made: Rendered[] = [];
    setImages([]);
    setError("");
    setNotice("");
    (async () => {
      try {
        for (let i = 0; i < pack.slides.length; i++) {
          const result = await renderRecapSlide(pack.slides[i], format, {
            dateLabel: pack.dateLabel,
            index: i,
            total: pack.slides.length,
          });
          if (cancelled) return;
          made.push({ blob: result.blob, url: URL.createObjectURL(result.blob) });
        }
        if (!cancelled) setImages(made.slice());
      } catch {
        if (!cancelled) setError("The images could not be created in this browser.");
      }
    })();
    return () => {
      cancelled = true;
      made.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [open, pack, format]);

  useEffect(() => {
    setIndex(0);
  }, [pack?.id, format]);

  const total = pack?.slides.length ?? 0;
  const current = images[index] ?? null;
  const fileName = useCallback(
    (n: number) => `${CLUB_SLUG}-poker-${pack?.id ?? "recap"}-${format}-${n + 1}.png`,
    [pack?.id, format],
  );
  const files = useMemo(
    () => images.map((item, n) => new File([item.blob], fileName(n), { type: "image/png" })),
    [images, fileName],
  );
  const canShareFiles =
    files.length > 0 && typeof navigator.canShare === "function" && navigator.canShare({ files });
  const spec = RECAP_FORMATS[format];

  const say = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3500);
  };

  const copyImage = async () => {
    if (!current) return;
    try {
      await copyPng(current.blob);
      say("Image copied. Paste it straight into Instagram.");
    } catch {
      say("This browser can't copy images. Use Save instead.");
    }
  };

  const copyCaption = async () => {
    if (!pack) return;
    try {
      await navigator.clipboard.writeText(pack.caption);
      say("Caption copied.");
    } catch {
      say("Couldn't copy the caption here.");
    }
  };

  const saveAll = () => {
    images.forEach((item, n) => window.setTimeout(() => download(item.blob, fileName(n)), n * 250));
    say(`Saving ${images.length} images…`);
  };

  const shareAll = async () => {
    if (!pack || files.length === 0) return;
    try {
      await navigator.share({ files, text: pack.caption });
    } catch (shareError) {
      if (!(shareError instanceof DOMException && shareError.name === "AbortError")) saveAll();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-recap-studio" className="max-h-[92dvh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{pack?.title ?? "Recap"}</DialogTitle>
          <DialogDescription>Ready for Instagram. Copy a slide, save them, or share the whole set.</DialogDescription>
        </DialogHeader>

        <div role="group" aria-label="Image size" className="grid grid-cols-3 gap-1 rounded-xl bg-secondary/55 p-1">
          {FORMATS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={format === value}
              data-testid={`button-recap-format-${value}`}
              onClick={() => setFormat(value)}
              className={`min-h-10 rounded-lg px-2 text-xs font-semibold transition-colors ${
                format === value ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {RECAP_FORMATS[value].label}
            </button>
          ))}
        </div>
        <p className="-mt-1 text-[11px] text-muted-foreground">{spec.hint}</p>

        <div className="relative overflow-hidden rounded-2xl border border-border bg-secondary/40">
          {current ? (
            <img
              src={current.url}
              alt={`Slide ${index + 1} of ${total}`}
              data-testid="img-recap-slide"
              className="mx-auto block max-h-[50dvh] w-auto max-w-full"
            />
          ) : error ? (
            <p className="p-8 text-center text-sm text-destructive">{error}</p>
          ) : (
            <div className="skeleton mx-auto aspect-[4/5] max-h-[50dvh] w-full" />
          )}
          {total > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous slide"
                disabled={index === 0}
                onClick={() => setIndex((value) => Math.max(0, value - 1))}
                className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white disabled:opacity-0"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="Next slide"
                disabled={index === total - 1}
                onClick={() => setIndex((value) => Math.min(total - 1, value + 1))}
                className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white disabled:opacity-0"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
        </div>
        <div className="flex justify-center gap-2" role="tablist" aria-label="Slides">
          {Array.from({ length: total }, (_, n) => (
            <button
              key={n}
              type="button"
              role="tab"
              aria-selected={n === index}
              aria-label={`Slide ${n + 1}`}
              onClick={() => setIndex(n)}
              className={`h-2 rounded-full transition-all ${n === index ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30"}`}
            />
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!current}
            onClick={() => void copyImage()}
            data-testid="button-recap-copy"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            <Copy className="h-4 w-4" />
            Copy image
          </button>
          <button
            type="button"
            disabled={!current}
            onClick={() => current && download(current.blob, fileName(index))}
            data-testid="button-recap-save"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-semibold hover:bg-secondary disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Save image
          </button>
          <button
            type="button"
            disabled={images.length === 0}
            onClick={saveAll}
            data-testid="button-recap-save-all"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-semibold hover:bg-secondary disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Save all {total > 0 ? total : ""}
          </button>
          {canShareFiles ? (
            <button
              type="button"
              onClick={() => void shareAll()}
              data-testid="button-recap-share"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-semibold hover:bg-secondary"
            >
              <Share2 className="h-4 w-4" />
              Share all
            </button>
          ) : (
            <button
              type="button"
              disabled={!pack}
              onClick={() => void copyCaption()}
              data-testid="button-recap-caption"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-semibold hover:bg-secondary disabled:opacity-50"
            >
              <ClipboardCopy className="h-4 w-4" />
              Copy caption
            </button>
          )}
        </div>
        {canShareFiles && (
          <button
            type="button"
            onClick={() => void copyCaption()}
            data-testid="button-recap-caption"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl text-xs font-semibold text-primary hover:underline"
          >
            <ClipboardCopy className="h-3.5 w-3.5" />
            Copy the suggested caption
          </button>
        )}
        <p role="status" className="min-h-[1.25rem] text-center text-xs text-muted-foreground" data-testid="status-recap">{notice}</p>
        <p className="text-[11px] leading-4 text-muted-foreground">
          On a phone, Share all sends the whole set to Instagram. On a computer, copy a slide and paste it into Instagram&apos;s
          post box, or save them all and upload together.
        </p>
      </DialogContent>
    </Dialog>
  );
}
