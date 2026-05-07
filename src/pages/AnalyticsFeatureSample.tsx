import { Activity, ArrowLeft } from "lucide-react";
import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAnalyticsFeatureSample } from "@/lib/analyticsFeatureSamples";
import { measureEmbeddedReportHeight } from "@/lib/iframeReport";

export default function AnalyticsFeatureSample() {
  const { sampleId } = useParams<{ sampleId: string }>();
  const sample = getAnalyticsFeatureSample(sampleId);
  const sampleFrameRef = useRef<HTMLIFrameElement | null>(null);
  const [sampleFrameHeight, setSampleFrameHeight] = useState(sample?.pageMinHeightPx || 2200);

  const handleSampleFrameLoad = () => {
    void measureEmbeddedReportHeight(sampleFrameRef.current, sample?.pageMinHeightPx || 2200)
      .then((height) => setSampleFrameHeight(height))
      .catch(() => undefined);
  };

  if (!sample) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <section className="pt-32 pb-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl">
              <Card className="border-border/80 bg-card/85 shadow-xl">
                <CardHeader>
                  <CardTitle className="font-display text-3xl text-foreground">Sample report not found</CardTitle>
                  <CardDescription>
                    Choose one of the public analytics feature samples from the landing page.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild>
                    <Link to="/analytics">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to Analytics
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="bg-gradient-hero pt-32 pb-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto space-y-8">
            <div className="space-y-5">
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" asChild>
                  <Link to="/analytics">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Analytics
                  </Link>
                </Button>
                <Badge className="gap-2 border border-cyan-400/20 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/10">
                  <Activity className="h-3.5 w-3.5" />
                  {sample.title} Sample
                </Badge>
              </div>

              <div className="space-y-3">
                <h1 className="max-w-5xl font-display text-4xl font-bold text-foreground md:text-5xl">
                  Public preview of the {sample.title.toLowerCase()} standalone report
                </h1>
                <p className="max-w-4xl text-lg leading-8 text-muted-foreground">{sample.description}</p>
                <div className="max-w-4xl rounded-2xl border border-border/80 bg-card/70 px-5 py-4 text-sm leading-7 text-cyan-100/90">
                  {sample.previewNote} {sample.standaloneContext}
                </div>
              </div>
            </div>

            <Card className="border-border/80 bg-card/85 shadow-xl">
              <CardContent className="space-y-5 p-6 lg:p-8">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-primary">Generated standalone report</p>
                    <h2 className="mt-2 font-display text-3xl text-foreground">{sample.title}</h2>
                  </div>
                  <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                    This is the actual generated standalone report, with player names blurred for the public sample.
                  </p>
                </div>

                <div className={sample.pageContainerClassName}>
                  <div className="relative overflow-hidden rounded-[28px] border border-border/80 bg-background/60">
                    <iframe
                      ref={sampleFrameRef}
                      src={sample.sampleHtmlSrc}
                      title={`${sample.title} standalone sample`}
                      loading="lazy"
                      onLoad={handleSampleFrameLoad}
                      style={{ height: `${sampleFrameHeight}px` }}
                      className={`block w-full border-0 ${sample.pageContentClassName}`}
                    />
                    <div className="pointer-events-none absolute inset-0">
                      {sample.previewMasks.map((mask, index) => (
                        <div
                          key={`${mask.left}-${mask.top}-${index}`}
                          className={`absolute border border-white/10 bg-slate-950/18 shadow-[0_18px_40px_rgba(2,6,23,0.24)] backdrop-blur-xl ${mask.className ?? "rounded-2xl"}`}
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
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
