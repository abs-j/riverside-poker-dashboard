import { Suspense, lazy, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { getGetPokerLiveActivityQueryKey, getGetPokerLiveActivityHistoryQueryKey, useGetPokerLiveActivityHistory, useCreatePokerLiveActivity, useDeletePokerLiveActivity, useEndPokerLiveSession, useGetPokerLiveActivity, useStartPokerLiveSession, useSyncPokerLiveActivity, useUpdatePokerLiveActivity, type LiveActivityHistoryRecord, type LiveActivityEntry, type LiveActivityInputAction, type LivePlayerSummary } from "@workspace/api-client-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { buildLiveLedgerUrl } from "@/lib/live-ledger-links";
import { copyTextToClipboard, formatLivePlayerSummaryRows, livePlayerNetProfit } from "@/lib/live-player-summary";
import { ArrowDown, ArrowUp, Activity, Check, ChevronDown, CircleDollarSign, Copy, Download, MoreHorizontal, Pencil, Printer, QrCode, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { PageIntro, formatCurrency, formatDate, signedCurrency } from "./shared";
import { useQueryClient } from "@tanstack/react-query";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { CLUB_SLUG } from "@/lib/brand";

const LiveLedgerQr = lazy(() => import("@/components/live-ledger-qr"));

type LiveSessionViewProps = { memberName: string; availablePlayers: string[] };

export function LiveSessionView({ memberName, availablePlayers }: LiveSessionViewProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [endPromptOpen, setEndPromptOpen] = useState(false);
  const liveQuery = useGetPokerLiveActivity({
    query: {
      queryKey: getGetPokerLiveActivityQueryKey(),
      // Poll quickly only while a game is running; idle tables can check less often.
      refetchInterval: (query) => {
        const status = query.state.data?.sessionStatus;
        return status === "open" || status === "finalizing" ? 5_000 : 15_000;
      },
    },
  });
  const historyQuery = useGetPokerLiveActivityHistory({
    query: {
      queryKey: getGetPokerLiveActivityHistoryQueryKey(),
      enabled: false,
      staleTime: 30_000,
    },
  });
  const createMutation = useCreatePokerLiveActivity();
  const updateMutation = useUpdatePokerLiveActivity();
  const deleteMutation = useDeletePokerLiveActivity();
  const startMutation = useStartPokerLiveSession();
  const endMutation = useEndPokerLiveSession();
  const syncMutation = useSyncPokerLiveActivity();
  const [action, setAction] = useState<LiveActivityInputAction>("buy_in");
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [attributedPlayer, setAttributedPlayer] = useState("");
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<LiveActivityEntry | null>(null);
  const [deleteComment, setDeleteComment] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [formError, setFormError] = useState("");
  const [sessionNotice, setSessionNotice] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [showPlayerSelect, setShowPlayerSelect] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const qrContainerRef = useRef<HTMLElementTagNameMap["section"]>(null);
  const liveActivityFormRef = useRef<HTMLFormElement>(null);

  const snapshot = liveQuery.data;
  const entries = snapshot?.entries ?? [];
  const liveLedgerUrl = useMemo(
    () => buildLiveLedgerUrl(window.location.origin, import.meta.env.BASE_URL),
    [],
  );
  const isSaving =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending ||
    startMutation.isPending || endMutation.isPending;
  const isOpen = snapshot?.sessionStatus === "open";
  const playerOptions = [...new Set([memberName, ...availablePlayers].filter(Boolean))].sort((a, b) => a.localeCompare(b));

  const setSnapshot = (next: NonNullable<typeof snapshot>) => {
    queryClient.setQueryData(liveQuery.queryKey, next);
  };

  const beginEdit = (entry: LiveActivityEntry) => {
    setEditingEventId(entry.eventId);
    setAction(entry.action);
    setAmount(entry.amount.toFixed(2));
    setComment("");
    setAttributedPlayer(entry.memberName === memberName ? "" : entry.memberName);
    setFormError("");
    setSessionNotice("");
    setShowPlayerSelect(true);
    window.setTimeout(
      () => liveActivityFormRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
      0,
    );
  };

  const resetForm = (resetAction = true) => {
    setEditingEventId(null);
    if (resetAction) setAction("buy_in");
    setAmount("");
    setComment("");
    setAttributedPlayer("");
    setFormError("");
    setShowPlayerSelect(false);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    setSessionNotice("");
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFormError("Enter an amount greater than $0.");
      return;
    }
    const trimmedComment = comment.trim();
    if (editingEventId && !trimmedComment) {
      setFormError("Add a reason for this edit.");
      return;
    }
    if (trimmedComment.length > 500) {
      setFormError("Comments must be 500 characters or fewer.");
      return;
    }
    const typedPlayer = attributedPlayer.trim();
    const selectedPlayer = playerOptions.find(
      (player) => player.toLocaleLowerCase() === typedPlayer.toLocaleLowerCase(),
    );
    if (typedPlayer.length > 80) {
      setFormError("Player names must be 80 characters or fewer.");
      return;
    }
    const playerToAttribute = selectedPlayer ?? typedPlayer.replace(/\s+/g, " ");
    const payload = {
      action,
      amount: Math.round(parsedAmount * 100) / 100,
      ...(editingEventId
        ? { attributedPlayer: playerToAttribute || memberName }
        : playerToAttribute
          ? { attributedPlayer: playerToAttribute }
          : {}),
    };

    if (editingEventId) {
      updateMutation.mutate(
        { eventId: editingEventId, data: { ...payload, comment: trimmedComment } },
        {
          onSuccess: (next) => {
            setSnapshot(next);
            resetForm(false);
          },
          onError: (error) => setFormError(apiErrorMessage(error)),
        },
      );
    } else {
      createMutation.mutate(
        { data: { ...payload, ...(trimmedComment ? { comment: trimmedComment } : {}) } },
        {
          onSuccess: (next) => {
            setSnapshot(next);
            resetForm(false);
          },
          onError: (error) => setFormError(apiErrorMessage(error)),
        },
      );
    }
  };

  const remove = (entry: LiveActivityEntry) => {
    setFormError("");
    setSessionNotice("");
    setDeleteError("");
    setDeleteComment("");
    setDeletingEntry(entry);
  };

  const confirmDelete = () => {
    if (!deletingEntry) return;
    const reason = deleteComment.trim();
    if (!reason) {
      setDeleteError("Add a reason before deleting this entry.");
      return;
    }
    setDeleteError("");
    deleteMutation.mutate(
      { eventId: deletingEntry.eventId, data: { comment: reason } },
      {
        onSuccess: (next) => {
          setSnapshot(next);
          if (editingEventId === deletingEntry.eventId) resetForm();
          setDeletingEntry(null);
          setDeleteComment("");
        },
        onError: (error) => setDeleteError(apiErrorMessage(error)),
      },
    );
  };

  const start = () => {
    setFormError("");
    setSessionNotice("");
    startMutation.mutate(undefined, {
      onSuccess: (next) => {
        queryClient.setQueryData(liveQuery.queryKey, next);
      },
      onError: (error) => setFormError(apiErrorMessage(error)),
    });
  };

  // One tap adds a buy-in for the chosen player. A short-lived Undo covers a mis-tap without
  // asking for a written reason, and the removal is still recorded in the audit trail.
  const quickBuyIn = (value: number) => {
    if (!isOpen || isSaving) return;
    setFormError("");
    setSessionNotice("");
    const typed = attributedPlayer.trim();
    const matched = playerOptions.find((player) => player.toLocaleLowerCase() === typed.toLocaleLowerCase());
    const who = matched ?? typed.replace(/\s+/g, " ");
    const knownIds = new Set(entries.map((entry) => entry.eventId));
    createMutation.mutate(
      { data: { action: "buy_in", amount: value, ...(who ? { attributedPlayer: who } : {}) } },
      {
        onSuccess: (next) => {
          setSnapshot(next);
          const added = next.entries.find((entry) => !knownIds.has(entry.eventId));
          const undo = () => {
            if (!added) return;
            deleteMutation.mutate(
              { eventId: added.eventId, data: { comment: "Undone straight after logging (added in error)." } },
              { onSuccess: setSnapshot, onError: (error) => setFormError(apiErrorMessage(error)) },
            );
          };
          toast({
            title: `Buy-in of ${formatCurrency(value)} added`,
            description: who || memberName,
            duration: 7000,
            action: added ? <ToastAction altText="Undo this buy-in" onClick={undo}>Undo</ToastAction> : undefined,
          });
        },
        onError: (error) => setFormError(apiErrorMessage(error)),
      },
    );
  };

  const end = () => {
    if (snapshot) setEndPromptOpen(true);
  };

  const confirmEnd = () => {
    if (!snapshot) return;
    setEndPromptOpen(false);
    const isDiscard = !snapshot.hasRecordedActivity;
    setFormError("");
    endMutation.mutate(undefined, {
      onSuccess: (result) => {
        queryClient.setQueryData(liveQuery.queryKey, result.snapshot);
        const notice = result.outcome === "discarded"
          ? "Empty session discarded. It will not appear in ledger history."
          : result.outcome === "already_closed"
            ? "The session was already closed. Its saved ledger remains in history."
            : isDiscard
              ? "Activity was recorded before discard completed, so the session was closed and saved to history."
              : "Session closed and saved to ledger history.";
        setSessionNotice(notice);
        if (result.outcome !== "discarded") {
          void queryClient.invalidateQueries({ queryKey: ["/api/poker/live-activity/history"] });
        }
      },
      onError: (error) => setFormError(apiErrorMessage(error)),
    });
  };

  const downloadQr = () => {
    const svg = qrContainerRef.current?.querySelector("svg");
    if (!svg) return;
    const standaloneSvg = svg.cloneNode(true) as SVGSVGElement;
    standaloneSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const blob = new Blob([new XMLSerializer().serializeToString(standaloneSvg)], {
      type: "image/svg+xml;charset=utf-8",
    });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `${CLUB_SLUG}-poker-live-ledger.svg`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
  };

  const retrySheetBackup = () => {
    syncMutation.mutate(undefined, {
      onSuccess: setSnapshot,
      onError: (error) => setFormError(apiErrorMessage(error)),
    });
  };

  const toggleHistory = () => {
    const willShow = !showHistory;
    setShowHistory(willShow);
    if (willShow) void historyQuery.refetch();
  };

  if (liveQuery.isLoading) {
    return <LiveActivityLoading />;
  }

  if (liveQuery.isError || !snapshot) {
    return (
      <section className="space-y-4" data-testid="section-live-ledger">
        <PageIntro eyebrow="Live session ledger" title="Track tonight as it happens" description="The live activity service is unavailable right now." count="Sync unavailable" compactOnMobile />
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
          <p>We could not load the current session activity.</p>
          <button onClick={() => void liveQuery.refetch()} className="mt-4 rounded-lg bg-destructive px-3 py-2 text-xs font-semibold text-destructive-foreground">Try again</button>
        </div>
      </section>
    );
  }

  const balance = snapshot.totals.buyIns - snapshot.totals.cashOuts;
  const lastBuyIn = entries.find((entry) => entry.action === "buy_in")?.amount ?? null;

  return (
    <section className="space-y-5" data-testid="section-live-ledger">
      <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <PageIntro eyebrow="Live session ledger" title="Track tonight as it happens" description="Log buy-ins and cash-outs, check the balance, and keep a separate record of each session. Times use Melbourne time (AEST/AEDT)." count={`${snapshot.sessionStatus === "ended" ? "Closed" : snapshot.sessionStatus === "open" ? "Open" : "Not started"} · ${formatActivitySessionDate(snapshot.sessionDate)}`} compactOnMobile />
        <div className="flex shrink-0 items-center gap-2">
          <SyncBadge status={snapshot.syncStatus} lastSyncedAt={snapshot.lastSyncedAt} message={snapshot.syncMessage} compact />
          <div className="hidden items-center gap-2 lg:flex">
            <button type="button" onClick={() => setShowQr((value) => !value)} aria-expanded={showQr} aria-controls={showQr ? "live-ledger-qr" : undefined} data-testid="button-toggle-live-qr" className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-semibold"><QrCode className="h-3.5 w-3.5" />{showQr ? "Hide QR" : "Share Live"}</button>
            {snapshot.syncStatus !== "synced" && <button onClick={retrySheetBackup} disabled={syncMutation.isPending} data-testid="button-retry-live-sync" className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-semibold disabled:opacity-60"><RefreshCw className={syncMutation.isPending ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />{syncMutation.isPending ? "Retrying" : "Retry backup"}</button>}
          </div>
          <div className="lg:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" data-testid="button-more-live-actions" aria-label="More live ledger actions" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onSelect={() => setShowQr((value) => !value)}
                  aria-expanded={showQr}
                  data-testid="menu-toggle-live-qr"
                >
                  <QrCode className="h-4 w-4" />{showQr ? "Hide QR code" : "Share live QR"}
                </DropdownMenuItem>
                {snapshot.syncStatus !== "synced" && (
                  <DropdownMenuItem onSelect={retrySheetBackup} disabled={syncMutation.isPending} data-testid="menu-retry-live-sync">
                    <RefreshCw className={syncMutation.isPending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                    {syncMutation.isPending ? "Retrying backup…" : "Retry sheet backup"}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {sessionNotice && <p role="status" data-testid="status-live-session-notice" className="rounded-xl border border-chart-1/30 bg-chart-1/10 px-4 py-3 text-sm text-chart-1">{sessionNotice}</p>}
      {showQr && <section id="live-ledger-qr" ref={qrContainerRef} data-live-qr-print data-testid="section-live-qr" className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="flex justify-center rounded-xl bg-white p-3">
          <Suspense fallback={<div className="h-[220px] w-[220px]" />}><LiveLedgerQr value={liveLedgerUrl} /></Suspense>
        </div>
        <div className="min-w-0">
          <p className="section-label text-primary">Share the live ledger</p>
          <h2 className="mt-1 text-lg font-semibold">Scan to open Live</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">The link opens the Live ledger directly. Member sign-in is still required; the QR code contains no access code or token.</p>
          <p className="mt-3 break-all rounded-lg bg-secondary/60 px-3 py-2 font-mono text-[11px] text-muted-foreground">{liveLedgerUrl}</p>
          <div className="live-qr-actions mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={downloadQr} data-testid="button-download-live-qr" className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground"><Download className="h-3.5 w-3.5" />Download SVG</button>
            <button type="button" onClick={() => window.print()} data-testid="button-print-live-qr" className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-background px-4 text-xs font-semibold"><Printer className="h-3.5 w-3.5" />Print QR</button>
          </div>
        </div>
      </section>}

      <div className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 rounded-2xl border p-3 sm:gap-3 sm:px-5 sm:py-4 ${snapshot.sessionStatus === "ended" ? "border-chart-1/30 bg-chart-1/5" : "border-primary/25 bg-primary/5"}`} data-testid="section-live-session-controls">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-xs font-semibold sm:text-sm">
              <span className="sm:hidden">{snapshot.sessionStatus === "open" ? "Live session" : snapshot.sessionStatus === "ended" ? "Session closed" : "Ready for tonight"}</span>
              <span className="hidden sm:inline">{snapshot.sessionStatus === "ended" ? "Session closed" : snapshot.sessionStatus === "open" ? "Session in progress" : "Ready for a new session"}</span>
            </p>
            <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] ${snapshot.sessionStatus === "open" ? "bg-chart-1/10 text-chart-1" : "bg-secondary text-muted-foreground"}`}>
              {snapshot.sessionStatus === "open" ? "Open" : snapshot.sessionStatus === "ended" ? "Closed" : "Ready"}
            </span>
            {snapshot.hasRecordedActivity && <span className={`hidden rounded-md px-1.5 py-0.5 text-[11px] font-bold sm:inline-flex ${Math.abs(balance) < 0.01 ? "bg-secondary text-muted-foreground" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}>
              {Math.abs(balance) < 0.01 ? "Balanced" : "Unbalanced"}
            </span>}
          </div>
          <p className="mt-1 text-[11px] leading-4 text-muted-foreground sm:text-xs sm:leading-5">
            <span className="sm:hidden">
              {snapshot.sessionStatus === "ended"
                ? "Saved separately · excluded from historical results."
                : snapshot.sessionStatus === "open"
                  ? `${snapshot.startedBy ?? "A member"}${snapshot.startedAt ? ` · ${formatActivityTime(snapshot.startedAt)}` : ""}${snapshot.hasRecordedActivity ? "" : " · empty session"}`
                  : "Start when the game begins."}
            </span>
            <span className="hidden sm:inline">
              {snapshot.sessionStatus === "ended"
                ? `Closed by ${snapshot.endedBy ?? "a member"}. This ledger is saved separately and is not added to historical results.`
                : snapshot.sessionStatus === "open"
                  ? `Started by ${snapshot.startedBy ?? "a member"}${snapshot.startedAt ? ` · ${formatActivityTime(snapshot.startedAt)}` : ""}.${snapshot.hasRecordedActivity ? "" : " This session has no activity rows and can be discarded."}`
                  : "Start a ledger when the game begins."}
            </span>
          </p>
        </div>
        {(snapshot.sessionStatus === "not_started" || snapshot.sessionStatus === "ended") && <button onClick={start} disabled={isSaving} aria-label={snapshot.sessionStatus === "ended" ? "Start another session" : "Start session"} data-testid="button-start-live-session" className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary px-2.5 text-[11px] font-semibold text-primary-foreground disabled:opacity-60 sm:h-11 sm:gap-2 sm:px-5 sm:text-sm"><Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4" /><span className="sm:hidden">{startMutation.isPending ? "Starting…" : snapshot.sessionStatus === "ended" ? "New session" : "Start"}</span><span className="hidden sm:inline">{startMutation.isPending ? "Starting…" : snapshot.sessionStatus === "ended" ? "Start another session" : "Start session"}</span></button>}
        {snapshot.sessionStatus === "open" && <button onClick={end} disabled={isSaving} aria-label={snapshot.hasRecordedActivity ? "End session" : "Discard empty session"} data-testid="button-end-live-session" className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-destructive/35 bg-destructive/10 px-2.5 text-[11px] font-semibold text-destructive disabled:opacity-60 sm:h-11 sm:gap-2 sm:px-5 sm:text-sm">{snapshot.hasRecordedActivity ? <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}<span className="sm:hidden">{endMutation.isPending ? "Saving…" : snapshot.hasRecordedActivity ? "End" : "Discard"}</span><span className="hidden sm:inline">{endMutation.isPending ? snapshot.hasRecordedActivity ? "Ending…" : "Discarding…" : snapshot.hasRecordedActivity ? "End session" : "Discard empty session"}</span></button>}
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-2 sm:gap-3 xl:grid-cols-4">
        <LiveMetric label="Buy-ins" compactLabel="IN" value={formatCurrency(snapshot.totals.buyIns)} detail="Total added" tone="positive" />
        <LiveMetric label="Cash-outs" compactLabel="OUT" value={formatCurrency(snapshot.totals.cashOuts)} detail="Total returned" tone="negative" />
        <LiveMetric label="Net balance" compactLabel="NET" value={signedCurrency(balance)} detail="Buy-ins minus cash-outs" tone={Math.abs(balance) < 0.01 ? "neutral" : balance < 0 ? "positive" : "negative"} />
        <div className="hidden sm:block"><LiveMetric
          label="Balance"
          value={entries.length === 0 ? "No entries" : Math.abs(balance) < 0.01 ? "Balanced" : "Unbalanced"}
          detail={entries.length === 0 ? "Add activity to calculate" : snapshot.sessionStatus === "ended" ? "Closed ledger" : "Updates as entries are added"}
          tone={entries.length === 0 || Math.abs(balance) < 0.01 ? "neutral" : "negative"}
        /></div>
      </div>

      {snapshot.playerSummaries.length > 0 && <TonightBoard summaries={snapshot.playerSummaries} viewer={memberName} closed={snapshot.sessionStatus === "ended"} />}

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
        <form ref={liveActivityFormRef} onSubmit={submit} className={`min-w-0 soft-shadow rounded-2xl border bg-card p-4 sm:p-5 ${editingEventId ? "border-2 border-primary bg-primary/[0.06] shadow-xl ring-4 ring-primary/25 ring-offset-2 ring-offset-background" : "border-border"}`} data-testid="form-live-activity">
          {editingEventId && <div role="status" data-testid="status-live-edit-mode" className="mb-4 flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/10 px-3 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Pencil className="h-4 w-4" /></span>
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-primary">Edit mode</p>
              <p className="mt-0.5 text-xs font-semibold">{action === "buy_in" ? "Correcting a buy-in / rebuy" : "Correcting a cash-out"} · a reason is required</p>
            </div>
          </div>}
          <div className="flex items-start justify-between gap-3">
            <div><p className={`section-label ${editingEventId ? "text-primary" : "text-muted-foreground"}`}>{editingEventId ? "Editing entry · reason required" : "Quick entry"}</p><h2 className="mt-1 text-base font-semibold sm:text-lg">{editingEventId ? "Correct an entry" : "Log money movement"}</h2></div>
            {editingEventId && <button type="button" onClick={() => resetForm()} aria-label="Cancel editing" className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"><X className="h-3.5 w-3.5" />Cancel edit</button>}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-secondary/60 p-1 sm:mt-4">
            {([["buy_in", "↑ Buy-in / rebuy"], ["cash_out", "↓ Cash-out"]] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setAction(value)} className={`min-h-10 rounded-lg border px-2 py-2 text-xs font-bold transition-colors ${action === value ? value === "buy_in" ? "border-chart-1/30 bg-chart-1/15 text-chart-1 shadow-sm" : "border-destructive/30 bg-destructive/10 text-destructive shadow-sm" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{label}</button>)}
          </div>
          {!editingEventId && action === "buy_in" && <div className="mt-3" data-testid="chips-live-quick-amount">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">One-tap buy-in</span>
              {[...QUICK_AMOUNTS, ...(lastBuyIn !== null && !QUICK_AMOUNTS.includes(lastBuyIn) ? [lastBuyIn] : [])].map((value) => <button key={value} type="button" disabled={!isOpen || isSaving} onClick={() => quickBuyIn(value)} data-testid={`chip-live-amount-${value}`} aria-label={`Add a ${formatCurrency(value)} buy-in`} className="h-11 min-w-[3.5rem] rounded-full border border-border bg-background px-4 font-mono text-sm font-semibold transition-colors hover:border-primary/50 hover:bg-secondary active:scale-95 disabled:opacity-50">+${value}</button>)}
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">{isOpen ? <>Adds for <strong className="text-foreground">{attributedPlayer.trim() || memberName}</strong>. You can undo right after.</> : "Start the session to use these."}</p>
          </div>}
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 sm:mt-4 sm:block">
            <label className="block min-w-0"><span className="mb-1.5 block text-xs font-semibold">Amount</span><div className="relative"><span className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-mono text-sm text-muted-foreground">$</span><input value={amount} onChange={(event) => setAmount(event.target.value)} type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="10.00" required data-testid="input-live-amount" className="h-11 w-full min-w-0 rounded-xl border border-border bg-background pl-8 pr-3 font-mono text-sm outline-none focus:border-primary" /></div></label>
            <button type="submit" disabled={isSaving || !isOpen} aria-label={!isOpen ? "Start session to add activity" : isSaving ? "Saving activity" : editingEventId ? "Save correction" : "Add to ledger"} data-testid="button-save-live-activity" className="inline-flex h-11 min-w-[88px] items-center justify-center gap-1 rounded-xl bg-primary px-2 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60 sm:mt-5 sm:w-full sm:gap-2 sm:px-4 sm:text-sm">
              <span className="sm:hidden">{!isOpen ? "Start first" : isSaving ? "Saving…" : editingEventId ? "Save" : "Add"}</span>
              <span className="hidden sm:inline">{!isOpen ? "Start session to add activity" : isSaving ? "Saving…" : editingEventId ? "Save correction" : "Add to ledger"}</span>
              {isOpen && !isSaving && (editingEventId ? <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />)}
            </button>
          </div>
          <label className="mt-4 block">
            <span className="mb-1.5 flex items-center justify-between text-xs font-semibold">
              <span>{editingEventId ? "Reason for this edit" : "Comment"}</span>
              <span className="font-normal text-muted-foreground">{editingEventId ? "Required" : "Optional"}</span>
            </span>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={500}
              rows={2}
              required={Boolean(editingEventId)}
              placeholder={editingEventId ? "Explain what you’re correcting…" : "Add context for this buy-in or cash-out…"}
              data-testid="input-live-comment"
              className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
            <span className="mt-1 block text-right text-[11px] text-muted-foreground">{comment.length}/500</span>
          </label>
          <div className="mt-2.5 sm:mt-4">
            <button type="button" aria-expanded={showPlayerSelect} aria-controls="select-live-player" onClick={() => setShowPlayerSelect((current) => !current)} className="flex min-h-9 w-full items-center justify-between gap-2 rounded-lg border border-border/70 bg-background px-3 text-[11px] font-medium sm:hidden">
              <span className="text-muted-foreground">Player</span>
              <span className="truncate text-right font-semibold">{attributedPlayer || memberName}<span className="ml-1 font-normal text-muted-foreground">· {showPlayerSelect ? "hide" : "change"}</span></span>
            </button>
            <label className={`${showPlayerSelect ? "block" : "hidden"} mt-2 sm:mt-0 sm:block`}>
              <span className="mb-2 flex items-center justify-between text-xs font-semibold"><span>Change player</span><span className="font-normal text-muted-foreground">Optional · type to search</span></span>
              <input
                id="select-live-player"
                type="search"
                list="live-player-options"
                value={attributedPlayer}
                onChange={(event) => setAttributedPlayer(event.target.value)}
                maxLength={80}
                autoComplete="off"
                placeholder={`Myself — ${memberName}`}
                data-testid="select-live-player"
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              />
              <datalist id="live-player-options">
                {playerOptions
                  .filter((player) => player !== memberName)
                  .map((player) => <option key={player} value={player} />)}
              </datalist>
            </label>
          </div>
          <p className="mt-3 hidden text-xs leading-5 text-muted-foreground sm:block">Select a listed player or type a new name. Entries are timestamped when saved, while <strong className="text-foreground">{memberName}</strong> remains the audit actor.</p>
          {formError && <p data-testid="status-live-form-error" className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs leading-5 text-destructive">{formError}</p>}
        </form>

        <details open data-testid="section-live-activity" className="group min-w-0 rounded-2xl border border-border bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 sm:p-5">
            <span className="min-w-0"><span className="section-label block">Recent activity</span><span id="live-activity-heading" className="mt-1 block text-base font-semibold sm:text-lg">Tonight’s ledger</span></span>
            <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground"><span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold">{entries.length} {entries.length === 1 ? "entry" : "entries"}</span><ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" /></span>
          </summary>
          <div className="border-t border-border">
            {entries.length > 0 ? <div className="divide-y divide-border/70">{entries.map((entry) => <LiveActivityRow key={entry.eventId} entry={entry} onEdit={() => beginEdit(entry)} onDelete={() => remove(entry)} disabled={isSaving || !isOpen} />)}</div> : <div className="flex min-h-40 flex-col items-center justify-center px-5 py-8 text-center sm:min-h-56"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><CircleDollarSign className="h-5 w-5" /></div><p className="mt-4 text-sm font-semibold">No activity yet</p><p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">{isOpen ? "Add the first buy-in to start tonight’s session ledger." : "Start the session to create the first ledger entry."}</p></div>}
          </div>
        </details>
      </div>

      <div className="space-y-4">
        <details open className="group rounded-2xl border border-border bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 sm:p-5">
            <span className="min-w-0"><span className="section-label block">By player</span><span className="mt-1 block text-sm font-semibold">Player totals · {snapshot.sessionStatus === "ended" ? "closed" : "current"} session</span></span>
            <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">{snapshot.playerSummaries.length} {snapshot.playerSummaries.length === 1 ? "player" : "players"}<ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" /></span>
          </summary>
          <div className="border-t border-border p-3 sm:p-4">
            <LivePlayerSummaryList
              title={`Player totals · ${snapshot.sessionStatus === "ended" ? "closed" : "current"} session`}
              summaries={snapshot.playerSummaries}
              emptyMessage="Player totals will appear after the first active entry."
              testId="section-live-player-totals"
              embedded
            />
          </div>
        </details>

        {snapshot.closeSummary && <div data-testid="section-live-close-summary" className={`rounded-2xl border p-5 ${snapshot.closeSummary.balanceStatus === "balanced" ? "border-border bg-secondary/40" : "border-amber-500/45 bg-amber-500/10"}`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="section-label">Close summary</p><h2 className={`mt-1 text-xl font-semibold ${snapshot.closeSummary.balanceStatus === "balanced" ? "text-foreground" : "text-amber-700 dark:text-amber-300"}`}>{snapshot.closeSummary.balanceStatus === "balanced" ? "Balanced" : "Unbalanced"}</h2></div>
            <span data-testid={`status-live-balance-${snapshot.closeSummary.balanceStatus}`} className="font-mono text-sm font-semibold">{snapshot.closeSummary.difference >= 0 ? "+" : "−"}{formatCurrency(Math.abs(snapshot.closeSummary.difference))} difference</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Closed {formatActivityTime(snapshot.closeSummary.closedAt)}. Saved in ledger history only.</p>
        </div>}
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6" data-testid="section-live-ledger-history">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="section-label">Ledger history</p><h2 className="mt-1 text-lg font-semibold">Past sessions</h2></div>
          <button type="button" onClick={toggleHistory} data-testid="button-toggle-live-history" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-xs font-semibold">
            {showHistory ? "Hide history" : "View past ledgers"}<ChevronDown className={`h-4 w-4 transition-transform ${showHistory ? "rotate-180" : ""}`} />
          </button>
        </div>
        {showHistory && <div className="mt-4 border-t border-border pt-4">
          {historyQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading past ledgers…</p>
            : historyQuery.isError ? <div className="flex flex-col gap-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between"><span>Past ledgers could not be loaded.</span><button type="button" onClick={() => void historyQuery.refetch()} className="self-start rounded-lg border border-destructive/30 px-3 py-2 text-xs font-semibold sm:self-auto">Try again</button></div>
              : historyQuery.data?.sessions.length ? <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
                {historyQuery.data.sessions.map((pastSession) => <PastLedgerCard key={pastSession.sessionKey} session={pastSession} />)}
              </div>
                : <p className="text-sm text-muted-foreground">Closed ledgers will appear here.</p>}
        </div>}
      </section>
      <AlertDialog open={endPromptOpen} onOpenChange={setEndPromptOpen}>
        <AlertDialogContent data-testid="dialog-end-live-session">
          <AlertDialogHeader>
            <AlertDialogTitle>{snapshot.hasRecordedActivity ? "Close and save this ledger?" : "Discard this empty session?"}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                {snapshot.hasRecordedActivity ? (
                  <>
                    <p>
                      Buy-ins <strong className="font-mono">{formatCurrency(snapshot.totals.buyIns)}</strong> · cash-outs{" "}
                      <strong className="font-mono">{formatCurrency(snapshot.totals.cashOuts)}</strong>
                    </p>
                    <p className={Math.abs(balance) < 0.01 ? "text-chart-1" : "font-semibold text-amber-700 dark:text-amber-300"}>
                      {Math.abs(balance) < 0.01 ? "The ledger is balanced." : `Unbalanced by ${formatCurrency(Math.abs(balance))}. Check cash-outs before closing.`}
                    </p>
                    {snapshot.entries.length === 0 && <p>All activity rows were removed, but this used session will stay in ledger history.</p>}
                    <p>It stays in history and is not added to the historical Session Log.</p>
                  </>
                ) : (
                  <p>It has no activity and will be removed completely rather than kept in ledger history.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep playing</AlertDialogCancel>
            <AlertDialogAction onClick={confirmEnd} data-testid="button-confirm-end-live-session">
              {snapshot.hasRecordedActivity ? "Close ledger" : "Discard session"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {deletingEntry && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" role="presentation">
        <section
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="live-delete-title"
          aria-describedby="live-delete-description"
          className="w-full max-w-md rounded-2xl border-2 border-destructive/50 bg-card p-5 shadow-2xl sm:p-6"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive"><Trash2 className="h-5 w-5" /></span>
            <div>
              <p className="section-label text-destructive">Deleting ledger entry</p>
              <h2 id="live-delete-title" className="mt-1 text-lg font-semibold">Remove this {deletingEntry.action === "buy_in" ? "buy-in" : "cash-out"}?</h2>
              <p id="live-delete-description" className="mt-1 text-sm text-muted-foreground">{formatCurrency(deletingEntry.amount)} will be removed from active totals. The reason is kept in the audit history.</p>
            </div>
          </div>
          <label className="mt-5 block">
            <span className="mb-1.5 flex items-center justify-between text-xs font-semibold">
              <span>Reason for deleting</span><span className="text-destructive">Required</span>
            </span>
            <textarea
              autoFocus
              value={deleteComment}
              onChange={(event) => setDeleteComment(event.target.value)}
              maxLength={500}
              rows={3}
              required
              placeholder="Explain why this entry should be removed…"
              data-testid="input-live-delete-comment"
              className="w-full resize-y rounded-xl border border-destructive/35 bg-background px-3 py-2.5 text-sm outline-none focus:border-destructive"
            />
            <span className="mt-1 block text-right text-[11px] text-muted-foreground">{deleteComment.length}/500</span>
          </label>
          {deleteError && <p role="alert" data-testid="status-live-delete-error" className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs leading-5 text-destructive">{deleteError}</p>}
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" disabled={deleteMutation.isPending} onClick={() => setDeletingEntry(null)} className="h-10 rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-50">Cancel</button>
            <button type="button" disabled={deleteMutation.isPending || !deleteComment.trim()} onClick={confirmDelete} data-testid="button-confirm-live-delete" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-destructive px-4 text-sm font-semibold text-destructive-foreground disabled:cursor-not-allowed disabled:opacity-50">
              <Trash2 className="h-4 w-4" />{deleteMutation.isPending ? "Deleting…" : "Delete entry"}
            </button>
          </div>
        </section>
      </div>}
    </section>
  );
}

const QUICK_AMOUNTS = [10, 20, 50];

/** Who is up tonight: cashed-out players ranked by result, everyone still playing listed below. */
function TonightBoard({ summaries, viewer, closed }: { summaries: LivePlayerSummary[]; viewer: string; closed: boolean }) {
  const rows = useMemo(() => {
    const cashed = summaries
      .filter((row) => row.cashOuts > 0)
      .map((row) => ({ ...row, net: livePlayerNetProfit(row) }))
      .sort((a, b) => b.net - a.net || a.playerName.localeCompare(b.playerName));
    const playing = summaries
      .filter((row) => row.cashOuts <= 0)
      .slice()
      .sort((a, b) => b.buyIns - a.buyIns || a.playerName.localeCompare(b.playerName));
    return { cashed, playing };
  }, [summaries]);
  const isMe = (name: string) => name.trim().toLowerCase() === viewer.trim().toLowerCase();
  return (
    <section data-testid="section-live-tonight" className="soft-shadow rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="section-label text-primary">{closed ? "Final result" : "Tonight so far"}</p>
          <h2 className="mt-1 text-base font-semibold sm:text-lg">{rows.cashed.length ? "Who's up" : "Who's in"}</h2>
        </div>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{summaries.length} {summaries.length === 1 ? "player" : "players"}</span>
      </div>
      <ol className="mt-3 space-y-1">
        {rows.cashed.map((row, index) => (
          <li key={row.playerName} data-testid="row-live-tonight" className={`flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition-colors ${isMe(row.playerName) ? "bg-primary/[0.08]" : ""}`}>
            <span className="w-5 text-center font-mono text-xs text-muted-foreground">{index + 1}</span>
            <span className="min-w-0 flex-1 truncate font-medium">{row.playerName}{isMe(row.playerName) && <span className="ml-1.5 text-[11px] uppercase tracking-[0.08em] text-primary">you</span>}</span>
            <span className="hidden font-mono text-xs text-muted-foreground sm:inline">in {formatCurrency(row.buyIns)} · out {formatCurrency(row.cashOuts)}</span>
            <span className={`w-20 text-right font-mono text-sm font-semibold ${row.net >= 0 ? "text-chart-1" : "text-destructive"}`}>{signedCurrency(row.net)}</span>
          </li>
        ))}
        {rows.playing.map((row) => (
          <li key={row.playerName} data-testid="row-live-tonight-playing" className={`flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm ${isMe(row.playerName) ? "bg-primary/[0.08]" : ""}`}>
            <span className="flex w-5 justify-center" aria-hidden="true"><span className="h-2 w-2 rounded-full bg-chart-1" /></span>
            <span className="min-w-0 flex-1 truncate font-medium">{row.playerName}{isMe(row.playerName) && <span className="ml-1.5 text-[11px] uppercase tracking-[0.08em] text-primary">you</span>}</span>
            <span className="font-mono text-xs text-muted-foreground">{closed ? "no cash-out" : "still playing"} · in {formatCurrency(row.buyIns)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function LiveActivityRow({ entry, onEdit, onDelete, disabled, readOnly = false }: { entry: LiveActivityEntry; onEdit: () => void; onDelete: () => void; disabled: boolean; readOnly?: boolean }) {
  const isBuyIn = entry.action === "buy_in";
  const auditComments = entry.auditComments ?? [];
  return <div className={`flex flex-col gap-3 border-l-4 px-3 py-4 sm:flex-row sm:items-center sm:justify-between ${isBuyIn ? "border-chart-1/70 bg-chart-1/[0.035]" : "border-destructive/65 bg-destructive/[0.035]"}`}>
    <div className="flex min-w-0 items-start gap-3">
      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isBuyIn ? "bg-chart-1/15 text-chart-1" : "bg-destructive/10 text-destructive"}`}>{isBuyIn ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}</span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className={`text-sm font-bold ${isBuyIn ? "text-chart-1" : "text-destructive"}`}>{isBuyIn ? "↑ BUY-IN / REBUY" : "↓ CASH-OUT"}</p>
          <span className="rounded-md bg-secondary px-1.5 py-1 text-[11px] font-semibold text-muted-foreground">{entry.memberName}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{formatActivityTime(entry.occurredAt)} · {entry.createdBy === entry.updatedBy ? `logged by ${entry.createdBy}` : `logged by ${entry.createdBy} · last updated by ${entry.updatedBy}`}</p>
        {auditComments.length > 0
          ? <div className="mt-2 space-y-1">
              {auditComments.map((auditComment, index) => <p key={`${auditComment.createdAt}-${index}`} className="text-xs leading-5 text-foreground/80">
                <span className="font-semibold">{auditComment.action === "entry" ? "Note" : auditComment.action === "edit" ? "Edit reason" : "Delete reason"}:</span> {auditComment.comment}
                <span className="text-muted-foreground"> · {auditComment.createdBy} · {formatActivityTime(auditComment.createdAt)}</span>
              </p>)}
            </div>
          : entry.comment && <p className="mt-2 text-xs leading-5 text-foreground/80"><span className="font-semibold">Comment:</span> {entry.comment}</p>}
      </div>
    </div>
    <div className="flex items-center justify-between gap-3 pl-12 sm:justify-end sm:pl-0">
      <p className={`font-mono text-sm font-bold ${isBuyIn ? "text-chart-1" : "text-destructive"}`}>{isBuyIn ? "+" : "−"}{formatCurrency(entry.amount)}</p>
      {!readOnly && <div className="flex items-center gap-1">
        <button onClick={onEdit} disabled={disabled} aria-label={`Edit ${entry.action}`} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"><Pencil className="h-3.5 w-3.5" /></button>
        <button onClick={onDelete} disabled={disabled} aria-label={`Delete ${entry.action}`} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>}
    </div>
  </div>;
}

function PastLedgerCard({ session }: { session: LiveActivityHistoryRecord }) {
  return <details className="rounded-xl border border-border/70 bg-background">
    <summary className="flex cursor-pointer list-none flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="text-sm font-semibold">{formatActivitySessionDate(session.sessionDate)}</p><p className="mt-1 text-xs text-muted-foreground">{session.entries.length} entries · closed {formatActivityTime(session.endedAt)}</p></div>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="font-mono text-chart-1">In {formatCurrency(session.totals.buyIns)}</span>
        <span className="font-mono text-destructive">Out {formatCurrency(session.totals.cashOuts)}</span>
        <span className={`rounded-md px-2 py-1 font-semibold ${session.balanceStatus === "balanced" ? "bg-secondary text-muted-foreground" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}>{session.balanceStatus === "balanced" ? "Balanced" : "Unbalanced"}</span>
      </div>
    </summary>
    <div className="border-t border-border px-4 pt-4">
      <LivePlayerSummaryList
        title="Player totals for this session"
        summaries={session.playerSummaries}
        emptyMessage="No active entries were recorded for this session."
        testId={`section-history-player-totals-${session.sessionKey}`}
      />
    </div>
    <div className="divide-y divide-border/70 border-t border-border px-4">
      {session.entries.map((entry) => <LiveActivityRow key={entry.eventId} entry={entry} onEdit={() => undefined} onDelete={() => undefined} disabled readOnly />)}
    </div>
  </details>;
}

function LivePlayerSummaryList({ title, summaries, emptyMessage, testId, embedded = false }: { title: string; summaries: LivePlayerSummary[]; emptyMessage: string; testId: string; embedded?: boolean }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const copyRows = async () => {
    try {
      await copyTextToClipboard(formatLivePlayerSummaryRows(summaries));
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  };

  useEffect(() => {
    setCopyState("idle");
  }, [summaries]);

  const copyButton = summaries.length > 0 && <button type="button" onClick={copyRows} data-testid={`${testId}-copy`} aria-label="Copy player totals as a table without headings" className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs font-semibold hover:bg-secondary">
    {copyState === "copied" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    {copyState === "copied" ? "Copied" : copyState === "error" ? "Copy failed" : "Copy rows"}
  </button>;

  return <section data-testid={testId} className={embedded ? "p-0" : "rounded-2xl border border-border bg-card p-5 sm:p-6"}>
    {embedded
      ? copyButton && <div className="flex justify-end pb-3">{copyButton}</div>
      : <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
        <div><p className="section-label">By player</p><h2 className="mt-1 text-lg font-semibold">{title}</h2></div>
        {copyButton}
      </div>}
    {copyState === "error" && <p role="status" className="pt-3 text-xs text-destructive">Clipboard access failed. Allow clipboard access and try again.</p>}
    {summaries.length > 0 ? <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[460px] text-left text-sm">
        <thead><tr className="text-[11px] uppercase tracking-wide text-muted-foreground"><th className="py-2 pr-4 font-semibold">Player</th><th className="px-3 py-2 text-right font-semibold">Buy-ins</th><th className="px-3 py-2 text-right font-semibold">Cash-outs</th><th className="py-2 pl-3 text-right font-semibold">Net profit</th></tr></thead>
        <tbody className="divide-y divide-border/70">
          {summaries.map((summary) => {
            const netProfit = livePlayerNetProfit(summary);
            return <tr key={summary.playerName}>
              <th scope="row" className="py-3 pr-4 font-semibold">{summary.playerName}</th>
              <td className="px-3 py-3 text-right font-mono text-chart-1">{formatCurrency(summary.buyIns)}</td>
              <td className="px-3 py-3 text-right font-mono text-destructive">{formatCurrency(summary.cashOuts)}</td>
              <td className={`py-3 pl-3 text-right font-mono font-semibold ${netProfit > 0 ? "text-chart-1" : netProfit < 0 ? "text-destructive" : "text-muted-foreground"}`}>{signedCurrency(netProfit)}</td>
            </tr>;
          })}
        </tbody>
      </table>
    </div> : <p className="pt-4 text-sm text-muted-foreground">{emptyMessage}</p>}
  </section>;
}

function LiveMetric({ label, compactLabel, value, detail, tone }: { label: string; compactLabel?: string; value: string; detail: string; tone: "positive" | "negative" | "neutral" }) {
  return <article className="min-w-0 rounded-xl border border-border bg-card px-2.5 py-2.5 sm:rounded-2xl sm:p-4 sm:soft-shadow">
    <p className="truncate text-[11px] font-semibold uppercase tracking-[0.11em] text-muted-foreground sm:text-[11px]"><span className="sm:hidden">{compactLabel ?? label}</span><span className="hidden sm:inline">{label}</span></p>
    <p className={`mt-1.5 truncate font-mono text-[18px] font-semibold tracking-[-0.045em] sm:mt-2 sm:text-2xl ${tone === "positive" ? "text-chart-1" : tone === "negative" ? "text-destructive" : "text-foreground"}`}>{value}</p>
    <p className="mt-1 hidden truncate text-[11px] text-muted-foreground sm:block sm:text-[11px]">{detail}</p>
  </article>;
}

function SyncBadge({ status, lastSyncedAt, message, compact = false }: { status: "synced" | "pending" | "error"; lastSyncedAt: string | null; message: string | null; compact?: boolean }) {
  const label = status === "synced"
    ? `Sheet backup current${lastSyncedAt ? ` · ${formatActivityTime(lastSyncedAt)}` : ""}`
    : status === "pending" ? "Sheet backup pending" : "Sheet backup needs attention";
  const compactLabel = status === "synced" ? "Synced" : status === "pending" ? "Backup pending" : "Attention";
  return <span aria-label={label} title={message ?? label} data-testid="status-live-sync" className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${status === "synced" ? "border-chart-1/25 bg-chart-1/10 text-chart-1" : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}><span className={`h-1.5 w-1.5 rounded-full ${status === "synced" ? "bg-chart-1" : "bg-amber-500"}`} /><span className={compact ? "hidden lg:inline" : ""}>{label}</span>{compact && <span className="lg:hidden">{compactLabel}</span>}</span>;
}

function LiveActivityLoading() {
  return <section className="space-y-5" data-testid="state-live-activity-loading"><div className="h-24 skeleton rounded-2xl" /><div className="grid gap-3 sm:grid-cols-3"><div className="h-28 skeleton rounded-2xl" /><div className="h-28 skeleton rounded-2xl" /><div className="h-28 skeleton rounded-2xl" /></div><div className="h-96 skeleton rounded-2xl" /></section>;
}

function apiErrorMessage(error: unknown): string {
  const data = (error as { data?: { error?: string } } | null)?.data;
  return data?.error ?? (error instanceof Error ? error.message : "The live activity could not be saved.");
}

function formatActivityTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function formatActivitySessionDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return formatDate(value);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

