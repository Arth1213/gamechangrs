import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

interface ConnectionEmailRequest {
  connectionId: string;
  recipientEmail: string;
  recipientName: string;
  senderName: string;
  senderType: "coach" | "player";
  verificationCode: string;
  action: "request" | "accepted";
}

const handler = async (req: Request): Promise<Response> => {
  const corsResponse = handleCors(req);
  if (corsResponse) {
    return corsResponse;
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    const { 
      connectionId,
      recipientEmail, 
      recipientName, 
      senderName, 
      senderType,
      verificationCode,
      action 
    }: ConnectionEmailRequest = await req.json();

    console.log(`Sending ${action} email to ${recipientEmail}`);

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    // Use the project URL for verification links - get from environment or use production URL
    const baseUrl = Deno.env.get("SITE_URL") || "https://game-changrs.com";
    const verifyUrl = `${baseUrl}/coaching-marketplace/verify-connection?code=${verificationCode}&connectionId=${connectionId}`;

    // Generate a unique Jitsi Meet room for this connection
    const roomId = `gamechangrs-${connectionId.slice(0, 8)}-${Date.now().toString(36)}`;
    const meetLink = `https://meet.jit.si/${roomId}`;

    let subject: string;
    let htmlContent: string;

    if (action === "request") {
      subject = `New Connection Request from ${senderName}`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2563eb;">New Connection Request</h1>
          <p>Hi ${recipientName},</p>
          <p><strong>${senderName}</strong> (${senderType}) wants to connect with you on the Cricket Coaching platform.</p>
          <p>If you'd like to accept this connection, click the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Accept Connection
            </a>
          </div>
          <p>Or use this verification code: <strong style="font-size: 24px; color: #2563eb;">${verificationCode}</strong></p>
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
      subject = `Connection Accepted - Welcome ${senderName}!`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #22c55e;">Connection Accepted!</h1>
          <p>Hi ${recipientName},</p>
          <p>Great news! <strong>${senderName}</strong> has accepted your connection request.</p>
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
        to: [recipientEmail],
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
