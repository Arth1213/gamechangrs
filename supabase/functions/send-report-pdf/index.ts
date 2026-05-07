import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

import { requireAuthenticatedUser } from "../_shared/auth.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

interface SendReportPdfRequest {
  email: string;
  reportLabel: string;
  filename: string;
  pdfBase64: string;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const handler = async (req: Request): Promise<Response> => {
  const corsResponse = handleCors(req);
  if (corsResponse) {
    return corsResponse;
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    const authenticatedUser = await requireAuthenticatedUser(req);
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const { email, reportLabel, filename, pdfBase64 }: SendReportPdfRequest = await req.json();
    const recipientEmail = normalizeText(email);
    const resolvedReportLabel = normalizeText(reportLabel) || "Player report";
    const resolvedFilename = normalizeText(filename) || "player-report.pdf";
    const resolvedPdfBase64 = normalizeText(pdfBase64).replace(/^data:application\/pdf;base64,/i, "");

    if (!isValidEmail(recipientEmail)) {
      const error = new Error("A valid email address is required");
      (error as Error & { status?: number }).status = 400;
      throw error;
    }

    if (!resolvedPdfBase64) {
      const error = new Error("The report PDF payload is empty");
      (error as Error & { status?: number }).status = 400;
      throw error;
    }

    const senderName = authenticatedUser.fullName || authenticatedUser.email || "A GameChangrs user";
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "GameChangrs <noreply@game-changrs.com>",
        to: [recipientEmail],
        subject: `${resolvedReportLabel} PDF`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111827;">
            <h1 style="margin: 0 0 16px; font-size: 24px; line-height: 1.3;">${resolvedReportLabel}</h1>
            <p style="margin: 0 0 12px;">${senderName} sent you a preserved PDF copy of the latest standalone report.</p>
            <p style="margin: 0; color: #6b7280;">The report is attached to this email.</p>
          </div>
        `,
        attachments: [
          {
            filename: resolvedFilename,
            content: resolvedPdfBase64,
          },
        ],
      }),
    });

    const emailPayload = await emailResponse.json();
    if (!emailResponse.ok) {
      console.error("Resend API error while sending report PDF:", emailPayload);
      throw new Error(emailPayload?.message || "Failed to send report PDF email");
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `${resolvedReportLabel} PDF sent to ${recipientEmail}.`,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      },
    );
  } catch (error) {
    console.error("Error in send-report-pdf:", error);
    const status = typeof (error as { status?: unknown })?.status === "number" ? Number((error as { status?: number }).status) : 500;

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unable to send report PDF.",
      }),
      {
        status,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      },
    );
  }
};

serve(handler);
