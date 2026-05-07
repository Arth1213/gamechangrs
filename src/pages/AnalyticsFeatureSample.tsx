import { Activity, ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import AnalyticsSamplePreview from "@/components/analytics/AnalyticsSamplePreview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ANALYTICS_FEATURE_SAMPLES, getAnalyticsFeatureSample } from "@/lib/analyticsFeatureSamples";

export default function AnalyticsFeatureSample() {
  const { sampleId } = useParams<{ sampleId: string }>();
  const sample = getAnalyticsFeatureSample(sampleId);

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
              <CardContent className="space-y-6 p-6 lg:p-8">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-primary">Standalone sample</p>
                    <h2 className="mt-2 font-display text-3xl text-foreground">{sample.title}</h2>
                  </div>
                  <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{sample.audience}</p>
                </div>

                <div className={sample.pageContainerClassName}>
                  <AnalyticsSamplePreview
                    src={sample.previewImageSrc}
                    alt={sample.previewImageAlt}
                    masks={sample.previewMasks}
                    className={sample.pageFrameClassName}
                    imageClassName={sample.pageImageClassName}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              {ANALYTICS_FEATURE_SAMPLES.filter((entry) => entry.id !== sample.id).map((entry) => (
                <Card key={entry.id} className="border-border/80 bg-card/80 shadow-sm">
                  <CardContent className="flex h-full flex-col justify-between gap-4 p-6">
                    <div className="space-y-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-primary">Also live</p>
                      <h3 className="font-display text-2xl text-foreground">{entry.title}</h3>
                      <p className="text-sm leading-7 text-muted-foreground">{entry.description}</p>
                    </div>
                    <Button asChild variant="outline">
                      <Link to={entry.path}>Open {entry.title} sample</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
