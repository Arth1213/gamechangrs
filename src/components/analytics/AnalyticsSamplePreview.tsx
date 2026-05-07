import { AnalyticsSampleMask } from "@/lib/analyticsFeatureSamples";
import { cn } from "@/lib/utils";

type AnalyticsSamplePreviewProps = {
  contentType?: "image" | "html";
  src: string;
  alt: string;
  masks: AnalyticsSampleMask[];
  className?: string;
  contentClassName?: string;
};

export default function AnalyticsSamplePreview({
  contentType = "image",
  src,
  alt,
  masks,
  className,
  contentClassName,
}: AnalyticsSamplePreviewProps) {
  return (
    <div className={cn("relative overflow-hidden rounded-[28px] border border-border/80 bg-background/60", className)}>
      {contentType === "html" ? (
        <iframe
          src={src}
          title={alt}
          loading="lazy"
          className={cn("h-full w-full border-0 bg-white pointer-events-none", contentClassName)}
        />
      ) : (
        <img src={src} alt={alt} className={cn("h-full w-full", contentClassName)} />
      )}
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
