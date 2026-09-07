import { cn } from "@/lib/utils";

export function CricketBrandTile({ className }: { className?: string }) {
  return (
    <div
      className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden", className)}
      aria-hidden="true"
    >
      <img
        src="/brand/gamechangrs-icon-crisp.png"
        alt=""
        className="h-full w-full object-contain"
        draggable="false"
      />
    </div>
  );
}
