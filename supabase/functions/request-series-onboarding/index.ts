import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

interface SeriesOnboardingRequest {
  requesterName: string;
  requesterEmail: string;
  requesterPhone: string;
  requesterUserId?: string | null;
  organizationName: string;
  sourceSystem: string;
  seriesName: string;
  seriesUrl: string;
  seasonYear: string;
  targetAgeGroup: string;
  notes?: string | null;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) {
    return corsResponse;
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const platformAdminEmail = Deno.env.get("PLATFORM_ADMIN_EMAIL") || "helloarth09@gmail.com";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = (await req.json()) as SeriesOnboardingRequest;

    const requesterName = normalizeText(body.requesterName);
    const requesterEmail = normalizeText(body.requesterEmail);
    const requesterPhone = normalizeText(body.requesterPhone);
    const requesterUserId = normalizeText(body.requesterUserId);
    const organizationName = normalizeText(body.organizationName);
    const sourceSystem = normalizeText(body.sourceSystem);
    const seriesName = normalizeText(body.seriesName);
    const seriesUrl = normalizeText(body.seriesUrl);
    const seasonYear = normalizeText(body.seasonYear);
    const targetAgeGroup = normalizeText(body.targetAgeGroup);
    const notes = normalizeText(body.notes);

    if (!requesterName || !requesterEmail || !requesterPhone || !organizationName || !sourceSystem || !seriesName || !seriesUrl || !seasonYear || !targetAgeGroup) {
      return new Response(
        JSON.stringify({ error: "Missing required onboarding request fields." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(requesterEmail)) {
      return new Response(
        JSON.stringify({ error: "Invalid requester email." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const subject = `Analytics new series onboarding request: ${seriesName}`;
    const message = [
      `Requester: ${requesterName}`,
      `Requester Email: ${requesterEmail}`,
      `Requester Phone: ${requesterPhone}`,
      `Requester User ID: ${requesterUserId || "-"}`,
      `Organization / Club: ${organizationName}`,
      `Source System: ${sourceSystem}`,
      `Series Name: ${seriesName}`,
      `Source URL: ${seriesUrl}`,
      `Season Year: ${seasonYear}`,
      `Target Age Group: ${targetAgeGroup}`,
      `Notes: ${notes || "-"}`,
    ].join("\n");

    const { error: insertError } = await supabase
      .from("contact_submissions")
      .insert([
        {
          name: requesterName,
          email: requesterEmail,
          subject,
          message,
          status: "new",
        },
      ]);

    if (insertError) {
      console.error("Failed to write onboarding request to contact_submissions:", insertError);
    }

    if (resendApiKey) {
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "GameChangrs Analytics <noreply@game-changrs.com>",
          to: [platformAdminEmail],
          reply_to: requesterEmail,
          subject,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px;">
              <h1 style="margin: 0 0 16px; color: #111827;">New Analytics Series Onboarding Request</h1>
              <p style="margin: 0 0 20px; color: #4b5563;">
                A signed-in Game-Changrs user requested onboarding for a new analytics series.
              </p>
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <tbody>
                  <tr><td style="padding: 8px 0; font-weight: 700; width: 190px;">Requester</td><td style="padding: 8px 0;">${requesterName}</td></tr>
                  <tr><td style="padding: 8px 0; font-weight: 700;">Requester email</td><td style="padding: 8px 0;"><a href="mailto:${requesterEmail}">${requesterEmail}</a></td></tr>
                  <tr><td style="padding: 8px 0; font-weight: 700;">Requester phone</td><td style="padding: 8px 0;">${requesterPhone}</td></tr>
                  <tr><td style="padding: 8px 0; font-weight: 700;">Requester user ID</td><td style="padding: 8px 0;">${requesterUserId || "-"}</td></tr>
                  <tr><td style="padding: 8px 0; font-weight: 700;">Organization / club</td><td style="padding: 8px 0;">${organizationName}</td></tr>
                  <tr><td style="padding: 8px 0; font-weight: 700;">Source system</td><td style="padding: 8px 0;">${sourceSystem}</td></tr>
                  <tr><td style="padding: 8px 0; font-weight: 700;">Series name</td><td style="padding: 8px 0;">${seriesName}</td></tr>
                  <tr><td style="padding: 8px 0; font-weight: 700;">Season year</td><td style="padding: 8px 0;">${seasonYear}</td></tr>
                  <tr><td style="padding: 8px 0; font-weight: 700;">Target age group</td><td style="padding: 8px 0;">${targetAgeGroup}</td></tr>
                  <tr><td style="padding: 8px 0; font-weight: 700;">Source URL</td><td style="padding: 8px 0;"><a href="${seriesUrl}">${seriesUrl}</a></td></tr>
                </tbody>
              </table>
              <div style="border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; background: #f9fafb;">
                <p style="margin: 0 0 8px; font-weight: 700; color: #111827;">Notes</p>
                <p style="margin: 0; color: #374151; white-space: pre-wrap;">${notes || "-"}</p>
              </div>
            </div>
          `,
          text: message,
        }),
      });

      if (!emailResponse.ok) {
        const errorText = await emailResponse.text();
        console.error("Failed to send onboarding email:", errorText);
        throw new Error("The onboarding request was stored, but the email notification failed.");
      }
    } else {
      console.log("RESEND_API_KEY not configured. Request stored without email send.");
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `The platform-admin onboarding inbox at ${platformAdminEmail} received this request.`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("request-series-onboarding failed:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
