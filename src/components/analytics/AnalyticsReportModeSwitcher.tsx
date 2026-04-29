import { BrainCircuit, FileSearch } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AnalyticsReportModeSwitcherProps = {
  executiveHref: string;
  intelligenceHref: string;
  activeMode: "executive" | "intelligence";
  linkState?: unknown;
  className?: string;
};

const inactiveButtonClassName =
  "border-border/80 bg-background/70 text-muted-foreground hover:bg-background hover:text-foreground";
const activeButtonClassName =
  "border-cyan-400/20 bg-cyan-400/15 text-cyan-50 hover:bg-cyan-400/20 hover:text-cyan-50";

export default function AnalyticsReportModeSwitcher({
  executiveHref,
  intelligenceHref,
  activeMode,
  linkState,
  className,
}: AnalyticsReportModeSwitcherProps) {
  return (
    <div
      className={cn(
        "inline-flex flex-wrap gap-2 rounded-2xl border border-border/80 bg-background/45 p-2",
        className
      )}
    >
      <Button
        asChild
        variant="outline"
        className={cn(
          "min-w-[11rem] justify-between rounded-xl",
          activeMode === "executive" ? activeButtonClassName : inactiveButtonClassName
        )}
      >
        <Link to={executiveHref} state={linkState} aria-current={activeMode === "executive" ? "page" : undefined}>
          Executive Report
          <FileSearch className="h-4 w-4" />
        </Link>
      </Button>
      <Button
        asChild
        variant="outline"
        className={cn(
          "min-w-[11rem] justify-between rounded-xl",
          activeMode === "intelligence" ? activeButtonClassName : inactiveButtonClassName
        )}
      >
        <Link
          to={intelligenceHref}
          state={linkState}
          aria-current={activeMode === "intelligence" ? "page" : undefined}
        >
          Player Intelligence
          <BrainCircuit className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}
