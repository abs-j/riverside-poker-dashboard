import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { installSteps, type InstallPlatform } from "@/lib/install-platform";

type InstallHelpDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platform: InstallPlatform;
};

/** Step-by-step install instructions for browsers that cannot show an install prompt. */
export function InstallHelpDialog({ open, onOpenChange, platform }: InstallHelpDialogProps) {
  const { title, steps } = installSteps(platform);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-install-help" className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Installing gives you an icon, a full-screen app and faster opening.</DialogDescription>
        </DialogHeader>
        <ol className="space-y-3">
          {steps.map((step, index) => (
            <li key={step} className="flex gap-3 text-sm leading-6">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-semibold text-primary">{index + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}
