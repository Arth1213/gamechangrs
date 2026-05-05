import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

interface SessionNotificationRequest {
  sessionId: string;
  coachEmail: string;
  coachName: string;
  playerEmail: string;
  playerName: string;
  sessionDateTime: string;
  durationMinutes: number;
  timezone: string;
  action: "booked" | "confirmed" | "canceled";
}

const handler = async (req: Request): Promise<Response> => {
  const corsResponse = handleCors(req);
  if (corsResponse) {
    return corsResponse;
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    const { 
      sessionId,
      coachEmail, 
      coachName, 
      playerEmail, 
      playerName,
      sessionDateTime,
      durationMinutes,
      timezone,
      action 
    }: SessionNotificationRequest = await req.json();

    console.log(`Sending ${action} notification for session ${sessionId}`);

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    // Format the date for display
    const sessionDate = new Date(sessionDateTime);
    const dateOptions: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone || 'UTC',
    };
    const formattedDate = sessionDate.toLocaleString('en-US', dateOptions);

    const baseUrl = Deno.env.get("SITE_URL") || "https://game-changrs.com";

    // Prepare emails for both coach and player
    const emails: Array<{ to: string; subject: string; html: string }> = [];

    if (action === "booked") {
      // Email to coach
      emails.push({
        to: coachEmail,
        subject: `New Session Booking from ${playerName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #f59e0b;">New Session Booking!</h1>
            <p>Hi ${coachName},</p>
            <p><strong>${playerName}</strong> has booked a coaching session with you.</p>
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #374151;">Session Details</h3>
              <p><strong>Date & Time:</strong> ${formattedDate}</p>
              <p><strong>Duration:</strong> ${durationMinutes} minutes</p>
              <p><strong>Student:</strong> ${playerName}</p>
            </div>
            <p>Please confirm or manage this session from your dashboard:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${baseUrl}/coaching-marketplace/coach-dashboard" style="background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                View Dashboard
              </a>
            </div>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
            <p style="color: #999; font-size: 12px;">GameChangrs Cricket Coaching Platform</p>
          </div>
        `,
      });

      // Email to player
      emails.push({
        to: playerEmail,
        subject: `Session Booked with ${coachName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #22c55e;">Session Booked!</h1>
            <p>Hi ${playerName},</p>
            <p>Your coaching session with <strong>${coachName}</strong> has been booked successfully.</p>
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #374151;">Session Details</h3>
              <p><strong>Date & Time:</strong> ${formattedDate}</p>
              <p><strong>Duration:</strong> ${durationMinutes} minutes</p>
              <p><strong>Coach:</strong> ${coachName}</p>
              <p style="color: #f59e0b;"><strong>Status:</strong> Pending confirmation</p>
            </div>
            <p>The coach will confirm your session shortly. You'll receive another email once confirmed.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${baseUrl}/coaching-marketplace/player-dashboard" style="background-color: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                View My Sessions
              </a>
            </div>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
            <p style="color: #999; font-size: 12px;">GameChangrs Cricket Coaching Platform</p>
          </div>
        `,
      });
    } else if (action === "confirmed") {
      // Email to player when coach confirms
      emails.push({
        to: playerEmail,
        subject: `Session Confirmed with ${coachName}!`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #22c55e;">Session Confirmed! ✓</h1>
            <p>Hi ${playerName},</p>
            <p>Great news! <strong>${coachName}</strong> has confirmed your coaching session.</p>
            <div style="background-color: #dcfce7; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #22c55e;">
              <h3 style="margin-top: 0; color: #166534;">Confirmed Session</h3>
              <p><strong>Date & Time:</strong> ${formattedDate}</p>
              <p><strong>Duration:</strong> ${durationMinutes} minutes</p>
              <p><strong>Coach:</strong> ${coachName}</p>
            </div>
            <p>Don't forget to prepare for your session!</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${baseUrl}/coaching-marketplace/player-dashboard" style="background-color: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                View My Sessions
              </a>
            </div>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
            <p style="color: #999; font-size: 12px;">GameChangrs Cricket Coaching Platform</p>
          </div>
        `,
      });
    } else if (action === "canceled") {
      // Email to both parties
      emails.push({
        to: coachEmail,
        subject: `Session Canceled - ${playerName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #ef4444;">Session Canceled</h1>
            <p>Hi ${coachName},</p>
            <p>The following session has been canceled:</p>
            <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #ef4444;">
              <p><strong>Date & Time:</strong> ${formattedDate}</p>
              <p><strong>Duration:</strong> ${durationMinutes} minutes</p>
              <p><strong>Student:</strong> ${playerName}</p>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${baseUrl}/coaching-marketplace/coach-dashboard" style="background-color: #6b7280; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                View Dashboard
              </a>
            </div>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
            <p style="color: #999; font-size: 12px;">GameChangrs Cricket Coaching Platform</p>
          </div>
        `,
      });

      emails.push({
        to: playerEmail,
        subject: `Session Canceled with ${coachName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #ef4444;">Session Canceled</h1>
            <p>Hi ${playerName},</p>
            <p>Your session has been canceled:</p>
            <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #ef4444;">
              <p><strong>Date & Time:</strong> ${formattedDate}</p>
              <p><strong>Duration:</strong> ${durationMinutes} minutes</p>
              <p><strong>Coach:</strong> ${coachName}</p>
            </div>
            <p>You can book a new session from your dashboard.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${baseUrl}/coaching-marketplace/player-dashboard" style="background-color: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                Book New Session
              </a>
            </div>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
            <p style="color: #999; font-size: 12px;">GameChangrs Cricket Coaching Platform</p>
          </div>
        `,
      });
    }

    // Send all emails
    const results = [];
    for (const email of emails) {
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "GameChangrs <onboarding@resend.dev>",
          to: [email.to],
          subject: email.subject,
          html: email.html,
        }),
      });

      const emailData = await emailResponse.json();
      
      if (!emailResponse.ok) {
        console.error("Resend API error for", email.to, ":", emailData);
      } else {
        console.log("Email sent successfully to", email.to, ":", emailData);
        results.push({ to: email.to, success: true, data: emailData });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-session-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
