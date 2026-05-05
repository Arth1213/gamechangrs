import { useEffect, useId, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type SeriesOnboardingSourceSystem = "cricclubs" | "cricheroes" | "espncricinfo" | "cricbuzz" | "other";

type SeriesOnboardingRequestFormState = {
  requesterName: string;
  requesterEmail: string;
  requesterPhone: string;
  organizationName: string;
  sourceSystem: SeriesOnboardingSourceSystem;
  seriesName: string;
  seriesUrl: string;
  seasonYear: string;
  targetAgeGroup: string;
  notes: string;
};

function createSeriesOnboardingRequestForm(
  requesterName = "",
  requesterEmail = ""
): SeriesOnboardingRequestFormState {
  return {
    requesterName,
    requesterEmail,
    requesterPhone: "",
    organizationName: "",
    sourceSystem: "cricclubs",
    seriesName: "",
    seriesUrl: "",
    seasonYear: "",
    targetAgeGroup: "",
    notes: "",
  };
}

type SeriesOnboardingRequestPanelProps = {
  requesterName: string;
  requesterEmail: string;
  requesterUserId?: string | null;
  title?: string;
  description?: string;
  submitLabel?: string;
};

export function SeriesOnboardingRequestPanel({
  requesterName,
  requesterEmail,
  requesterUserId,
  title = "Request new series onboarding",
  description = "Submit the minimum onboarding details here. The platform admin will receive your email, phone number, and source details so they can continue the setup offline.",
  submitLabel = "Request new series onboarding",
}: SeriesOnboardingRequestPanelProps) {
  const { toast } = useToast();
  const fieldId = useId();
  const [formState, setFormState] = useState<SeriesOnboardingRequestFormState>(() =>
    createSeriesOnboardingRequestForm(requesterName, requesterEmail)
  );
  const [submitStatus, setSubmitStatus] = useState<"idle" | "saving">("idle");

  useEffect(() => {
    setFormState((current) => ({
      ...current,
      requesterName: current.requesterName || requesterName,
      requesterEmail: current.requesterEmail || requesterEmail,
    }));
  }, [requesterEmail, requesterName]);

  async function handleSubmitRequest() {
    const trimmedName = formState.requesterName.trim();
    const trimmedEmail = formState.requesterEmail.trim();
    const trimmedPhone = formState.requesterPhone.trim();
    const trimmedOrganization = formState.organizationName.trim();
    const trimmedSeriesName = formState.seriesName.trim();
    const trimmedSeriesUrl = formState.seriesUrl.trim();
    const trimmedSeasonYear = formState.seasonYear.trim();
    const trimmedAgeGroup = formState.targetAgeGroup.trim();
    const trimmedNotes = formState.notes.trim();

    if (!trimmedName || !trimmedEmail || !trimmedPhone || !trimmedOrganization || !trimmedSeriesName || !trimmedSeriesUrl || !trimmedSeasonYear || !trimmedAgeGroup) {
      toast({
        variant: "destructive",
        title: "Missing required details",
        description: "Name, email, phone, organization, source URL, series name, season year, and age group are required.",
      });
      return;
    }

    setSubmitStatus("saving");

    try {
      const { data, error } = await supabase.functions.invoke("request-series-onboarding", {
        body: {
          requesterName: trimmedName,
          requesterEmail: trimmedEmail,
          requesterPhone: trimmedPhone,
          requesterUserId: requesterUserId || null,
          organizationName: trimmedOrganization,
          sourceSystem: formState.sourceSystem,
          seriesName: trimmedSeriesName,
          seriesUrl: trimmedSeriesUrl,
          seasonYear: trimmedSeasonYear,
          targetAgeGroup: trimmedAgeGroup,
          notes: trimmedNotes || null,
        },
      });

      if (error) {
        throw error;
      }

      toast({
        title: "New series request sent",
        description:
          data?.message
          || "The platform-admin inbox has received your onboarding request. They can now contact you offline.",
      });

      setFormState((current) => ({
        ...createSeriesOnboardingRequestForm(trimmedName, trimmedEmail),
        requesterPhone: trimmedPhone,
      }));
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Series request failed",
        description: error instanceof Error ? error.message : "The onboarding request could not be sent right now.",
      });
    } finally {
      setSubmitStatus("idle");
    }
  }

  return (
    <Card className="border-border/80 bg-card/85 shadow-xl">
      <CardHeader className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-sky-400/30 bg-sky-400/10 text-sky-200">
            Request New Series
          </Badge>
          <Badge variant="outline" className="border-border/80 bg-background/60 text-foreground">
            Platform Admin Review
          </Badge>
        </div>
        <div className="space-y-2">
          <CardTitle className="font-display text-2xl text-foreground">{title}</CardTitle>
          <CardDescription className="max-w-3xl text-sm leading-7">
            {description}
          </CardDescription>
          <p className="text-xs text-muted-foreground">
            The request is tied to your signed-in GameChangrs account identity. Name and email are shown for confirmation.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${fieldId}-requester-name`}>Your name</Label>
            <Input
              id={`${fieldId}-requester-name`}
              value={formState.requesterName}
              onChange={(event) => setFormState((current) => ({ ...current, requesterName: event.target.value }))}
              placeholder="Your full name"
              readOnly
              disabled
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${fieldId}-requester-email`}>Your email</Label>
            <Input
              id={`${fieldId}-requester-email`}
              type="email"
              value={formState.requesterEmail}
              onChange={(event) => setFormState((current) => ({ ...current, requesterEmail: event.target.value }))}
              placeholder="you@example.com"
              readOnly
              disabled
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${fieldId}-requester-phone`}>Phone number</Label>
            <Input
              id={`${fieldId}-requester-phone`}
              value={formState.requesterPhone}
              onChange={(event) => setFormState((current) => ({ ...current, requesterPhone: event.target.value }))}
              placeholder="+1 555 555 5555"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${fieldId}-requester-organization`}>Organization / club</Label>
            <Input
              id={`${fieldId}-requester-organization`}
              value={formState.organizationName}
              onChange={(event) => setFormState((current) => ({ ...current, organizationName: event.target.value }))}
              placeholder="Club, academy, school, or organizer name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${fieldId}-request-source-system`}>Source system</Label>
            <Select
              value={formState.sourceSystem}
              onValueChange={(value) => setFormState((current) => ({ ...current, sourceSystem: value as SeriesOnboardingSourceSystem }))}
            >
              <SelectTrigger id={`${fieldId}-request-source-system`}>
                <SelectValue placeholder="Select source system" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cricclubs">CricClubs</SelectItem>
                <SelectItem value="cricheroes">CricHeroes</SelectItem>
                <SelectItem value="espncricinfo">ESPNcricinfo</SelectItem>
                <SelectItem value="cricbuzz">Cricbuzz</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${fieldId}-request-season-year`}>Season year</Label>
            <Input
              id={`${fieldId}-request-season-year`}
              value={formState.seasonYear}
              onChange={(event) => setFormState((current) => ({ ...current, seasonYear: event.target.value }))}
              placeholder="2026"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${fieldId}-request-series-name`}>Series name</Label>
            <Input
              id={`${fieldId}-request-series-name`}
              value={formState.seriesName}
              onChange={(event) => setFormState((current) => ({ ...current, seriesName: event.target.value }))}
              placeholder="2026 Bay Area USAC Hub"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${fieldId}-request-age-group`}>Target age group</Label>
            <Input
              id={`${fieldId}-request-age-group`}
              value={formState.targetAgeGroup}
              onChange={(event) => setFormState((current) => ({ ...current, targetAgeGroup: event.target.value }))}
              placeholder="U15, U19, Open, Senior Women, etc."
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${fieldId}-request-url`}>Source series URL</Label>
          <Input
            id={`${fieldId}-request-url`}
            value={formState.seriesUrl}
            onChange={(event) => setFormState((current) => ({ ...current, seriesUrl: event.target.value }))}
            placeholder="Paste the live source URL for the requested series"
          />
          <p className="text-xs leading-6 text-muted-foreground">
            Current onboarding is CricClubs-first, but the platform admin can still triage future-source requests from this intake.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${fieldId}-request-notes`}>Notes for the platform admin</Label>
          <Textarea
            id={`${fieldId}-request-notes`}
            value={formState.notes}
            onChange={(event) => setFormState((current) => ({ ...current, notes: event.target.value }))}
            placeholder="Optional context: deadline, expected divisions, urgency, or what you need from the onboarding."
            className="min-h-[120px]"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={() => void handleSubmitRequest()} disabled={submitStatus === "saving"}>
            {submitStatus === "saving" ? "Submitting request..." : submitLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
