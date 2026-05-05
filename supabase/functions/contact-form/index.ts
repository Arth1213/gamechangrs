import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

interface ContactFormRequest {
  name: string;
  email: string;
  subject: string;
  message: string;
  website?: string;
  startedAt?: string;
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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { name, email, subject, message, website, startedAt }: ContactFormRequest = await req.json();

    console.log(`Contact form submission from ${email} - Subject: ${subject}`);

    if (typeof website === "string" && website.trim()) {
      console.warn("Contact form honeypot triggered.");
      return new Response(
        JSON.stringify({
          success: true,
          message: "Your message has been received. We'll get back to you within 24 hours.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Validate inputs
    if (!name || !email || !subject || !message) {
      return new Response(
        JSON.stringify({ error: "All fields are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate message length
    if (message.length < 10 || message.length > 2000) {
      return new Response(
        JSON.stringify({ error: "Message must be between 10 and 2000 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (name.trim().length > 100 || subject.trim().length > 140) {
      return new Response(
        JSON.stringify({ error: "Name or subject is too long" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (startedAt) {
      const startedAtMs = Date.parse(startedAt);
      if (Number.isFinite(startedAtMs)) {
        const elapsedMs = Date.now() - startedAtMs;
        if (elapsedMs >= 0 && elapsedMs < 1500) {
          return new Response(
            JSON.stringify({ error: "Please take a moment before submitting the form." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [
      { count: recentSubmissionCount, error: recentCountError },
      { data: duplicateSubmission, error: duplicateError },
    ] = await Promise.all([
      supabase
        .from("contact_submissions")
        .select("id", { count: "exact", head: true })
        .eq("email", email)
        .gte("created_at", fifteenMinutesAgo),
      supabase
        .from("contact_submissions")
        .select("id")
        .eq("email", email)
        .eq("subject", subject)
        .eq("message", message)
        .gte("created_at", oneDayAgo)
        .limit(1),
    ]);

    if (recentCountError) {
      console.error("Error checking contact form rate limit:", recentCountError);
    }
    if (duplicateError) {
      console.error("Error checking duplicate contact submission:", duplicateError);
    }

    if (Number(recentSubmissionCount ?? 0) >= 5) {
      return new Response(
        JSON.stringify({ error: "Too many messages sent recently. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (duplicateSubmission && duplicateSubmission.length > 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "We already received that message and will follow up if needed.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Store contact form submission in database
    const { error: insertError } = await supabase
      .from("contact_submissions")
      .insert([
        {
          name,
          email,
          subject,
          message,
          status: "new",
        },
      ]);

    if (insertError) {
      console.error("Error storing contact submission:", insertError);
      // Continue even if DB insert fails - we'll still try to send email
    }

    // TODO: Integrate with email service (Resend, SendGrid, etc.) to send notification
    // Example with Resend:
    // const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    // if (RESEND_API_KEY) {
    //   await fetch("https://api.resend.com/emails", {
    //     method: "POST",
    //     headers: {
    //       "Authorization": `Bearer ${RESEND_API_KEY}`,
    //       "Content-Type": "application/json",
    //     },
    //     body: JSON.stringify({
    //       from: "GameChangrs Contact <noreply@gamechangrs.com>",
    //       to: "arth@game-changrs.com",
    //       subject: `New Contact Form: ${subject}`,
    //       html: `
    //         <h2>New Contact Form Submission</h2>
    //         <p><strong>Name:</strong> ${name}</p>
    //         <p><strong>Email:</strong> ${email}</p>
    //         <p><strong>Subject:</strong> ${subject}</p>
    //         <p><strong>Message:</strong></p>
    //         <p>${message.replace(/\n/g, "<br>")}</p>
    //       `,
    //     }),
    //   });
    // }

    console.log("Contact form submission processed successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Your message has been received. We'll get back to you within 24 hours." 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error) {
    console.error("Contact form error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
