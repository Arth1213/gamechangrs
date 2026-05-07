import { AnalyticsSampleMask } from "@/lib/analyticsFeatureSamples";
import { cn } from "@/lib/utils";

type AnalyticsSamplePreviewProps = {
  src: string;
  alt: string;
  masks: AnalyticsSampleMask[];
  className?: string;
  imageClassName?: string;
};

export default function AnalyticsSamplePreview({
  src,
  alt,
  masks,
  className,
  imageClassName,
}: AnalyticsSamplePreviewProps) {
  return (
    <div className={cn("relative overflow-hidden rounded-[28px] border border-border/80 bg-background/60", className)}>
      <img src={src} alt={alt} className={cn("h-full w-full", imageClassName)} />
      <div className="pointer-events-none absolute inset-0">
        {masks.map((mask, index) => (
          <div
            key={`${mask.left}-${mask.top}-${index}`}
            className={cn(
              "absolute border border-white/10 bg-slate-950/18 shadow-[0_18px_40px_rgba(2,6,23,0.24)] backdrop-blur-xl",
              mask.className ?? "rounded-2xl"
            )}
            style={{
              left: `${mask.left}%`,
              top: `${mask.top}%`,
              width: `${mask.width}%`,
              height: `${mask.height}%`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
