import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuthenticatedUser } from "../_shared/auth.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

interface ConnectionEmailRequest {
  connectionId: string;
  action: "request" | "accepted";
}

type ConnectionRecord = {
  id: string;
  coach_id: string;
  student_id: string;
  code: string;
  requester_type: "coach" | "player" | null;
};

type PartyDetails = {
  role: "coach" | "player";
  id: string;
  userId: string | null;
  name: string;
  email: string | null;
};

async function loadPartyDetails(
  supabase: ReturnType<typeof createClient>,
  role: "coach" | "player",
  id: string,
): Promise<PartyDetails> {
  const table = role === "coach" ? "coaches" : "players";
  const { data, error } = await supabase
    .from(table)
    .select("id, user_id, name, email")
    .eq("id", id)
    .single();

  if (error || !data) {
    const loadError = new Error(`Could not resolve ${role} details`);
    (loadError as Error & { status?: number }).status = 404;
    throw loadError;
  }

  return {
    role,
    id: String(data.id),
    userId: typeof data.user_id === "string" ? data.user_id : null,
    name: typeof data.name === "string" && data.name.trim() ? data.name.trim() : role === "coach" ? "Coach" : "Player",
    email: typeof data.email === "string" && data.email.trim() ? data.email.trim() : null,
  };
}

const handler = async (req: Request): Promise<Response> => {
  const corsResponse = handleCors(req);
  if (corsResponse) {
    return corsResponse;
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    const authenticatedUser = await requireAuthenticatedUser(req);
    const { connectionId, action }: ConnectionEmailRequest = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: connection, error: connectionError } = await supabase
      .from("connections")
      .select("id, coach_id, student_id, code, requester_type")
      .eq("id", connectionId)
      .single();

    if (connectionError || !connection) {
      const error = new Error("Connection was not found");
      (error as Error & { status?: number }).status = 404;
      throw error;
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const requesterType = connection.requester_type === "coach" ? "coach" : "player";
    const requester = await loadPartyDetails(
      supabase,
      requesterType,
      requesterType === "coach" ? connection.coach_id : connection.student_id,
    );
    const recipient = await loadPartyDetails(
      supabase,
      requesterType === "coach" ? "player" : "coach",
      requesterType === "coach" ? connection.student_id : connection.coach_id,
    );

    if (!requester.email || !recipient.email) {
      const error = new Error("Connection email participants are missing email addresses");
      (error as Error & { status?: number }).status = 400;
      throw error;
    }

    const allowedUserIds =
      action === "request"
        ? [requester.userId].filter((value): value is string => Boolean(value))
        : [recipient.userId].filter((value): value is string => Boolean(value));
    if (!allowedUserIds.includes(authenticatedUser.userId)) {
      const error = new Error("You do not have permission to send this connection email");
      (error as Error & { status?: number }).status = 403;
      throw error;
    }

    console.log(`Sending ${action} email for connection ${connectionId}`);

    const baseUrl = Deno.env.get("SITE_URL") || "https://game-changrs.com";
    const verifyUrl = `${baseUrl}/coaching-marketplace/verify-connection?code=${connection.code}&connectionId=${connectionId}`;

    // Generate a unique Jitsi Meet room for this connection
    const roomId = `gamechangrs-${connectionId.slice(0, 8)}-${Date.now().toString(36)}`;
    const meetLink = `https://meet.jit.si/${roomId}`;

    let subject: string;
    let htmlContent: string;

    if (action === "request") {
      subject = `New Connection Request from ${requester.name}`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2563eb;">New Connection Request</h1>
          <p>Hi ${recipient.name},</p>
          <p><strong>${requester.name}</strong> (${requester.role}) wants to connect with you on the Cricket Coaching platform.</p>
          <p>If you'd like to accept this connection, click the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Accept Connection
            </a>
          </div>
          <p>Or use this verification code: <strong style="font-size: 24px; color: #2563eb;">${connection.code}</strong></p>
          <p style="color: #666; font-size: 14px;">This code expires in 24 hours.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
          <div style="background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0 0 8px; font-weight: bold; color: #0369a1;">📹 Video Meeting Room</p>
            <p style="margin: 0 0 12px; color: #555; font-size: 14px;">A dedicated video meeting room has been created for your coaching sessions. Both of you can use this link anytime:</p>
            <div style="text-align: center;">
              <a href="${meetLink}" style="background-color: #0ea5e9; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">
                Join Video Meeting
              </a>
            </div>
            <p style="margin: 12px 0 0; color: #888; font-size: 12px; text-align: center;">Link: ${meetLink}</p>
          </div>
          <p style="color: #999; font-size: 12px;">If you didn't expect this request, you can safely ignore this email.</p>
        </div>
      `;
    } else {
      subject = `Connection Accepted - Welcome ${requester.name}!`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #22c55e;">Connection Accepted!</h1>
          <p>Hi ${requester.name},</p>
          <p>Great news! <strong>${recipient.name}</strong> has accepted your connection request.</p>
          <p>You can now:</p>
          <ul>
            <li>View their contact information</li>
            <li>Book coaching sessions</li>
            <li>Start your training journey together</li>
          </ul>
          <div style="background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0 0 8px; font-weight: bold; color: #0369a1;">📹 Video Meeting Room</p>
            <p style="margin: 0 0 12px; color: #555; font-size: 14px;">Use this dedicated link for your coaching sessions:</p>
            <div style="text-align: center;">
              <a href="${meetLink}" style="background-color: #0ea5e9; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">
                Join Video Meeting
              </a>
            </div>
            <p style="margin: 12px 0 0; color: #888; font-size: 12px; text-align: center;">Link: ${meetLink}</p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${baseUrl}/coaching-marketplace" style="background-color: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Go to Dashboard
            </a>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
          <p style="color: #999; font-size: 12px;">Happy coaching!</p>
        </div>
      `;
    }

    // Send email using Resend API directly
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "GameChangrs <noreply@game-changrs.com>",
        to: [action === "request" ? recipient.email : requester.email],
        subject: subject,
        html: htmlContent,
      }),
    });

    const emailData = await emailResponse.json();
    
    if (!emailResponse.ok) {
      console.error("Resend API error:", emailData);
      throw new Error(emailData.message || "Failed to send email");
    }

    console.log("Email sent successfully:", emailData);

    return new Response(JSON.stringify({ success: true, emailData }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-connection-email function:", error);
    const status = typeof error?.status === "number" ? error.status : 500;
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
