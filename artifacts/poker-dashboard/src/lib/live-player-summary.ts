export type CopyableLivePlayerSummary = {
  playerName: string;
  buyIns: number;
  cashOuts: number;
};

export function livePlayerNetProfit(
  summary: Pick<CopyableLivePlayerSummary, "buyIns" | "cashOuts">,
): number {
  return Math.round((summary.cashOuts - summary.buyIns) * 100) / 100;
}

export function formatLivePlayerSummaryRows(
  summaries: readonly CopyableLivePlayerSummary[],
): string {
  return summaries
    .map((summary) =>
      [
        summary.playerName.replace(/[\t\r\n]+/g, " ").trim(),
        summary.buyIns.toFixed(2),
        summary.cashOuts.toFixed(2),
      ].join("\t"),
    )
    .join("\n");
}

export async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall back for embedded previews where clipboard permission may be denied.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.setAttribute("aria-hidden", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-10000px";
  document.body.appendChild(textarea);
  let copied = false;
  try {
    textarea.select();
    copied = document.execCommand("copy");
  } finally {
    textarea.remove();
  }
  if (!copied) throw new Error("Clipboard access is unavailable.");
}