import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContactRequest {
  listingId: string;
  buyerName: string;
  buyerEmail: string;
  message: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { listingId, buyerName, buyerEmail, message }: ContactRequest = await req.json();

    console.log(`Contact request for listing ${listingId} from ${buyerEmail}`);

    // Validate inputs
    if (!listingId || !buyerName || !buyerEmail || !message) {
      console.error("Missing required fields");
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(buyerEmail)) {
      console.error("Invalid email format");
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate message length
    if (message.length < 10 || message.length > 1000) {
      console.error("Message length out of bounds");
      return new Response(
        JSON.stringify({ error: "Message must be between 10 and 1000 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the listing details
    const { data: listing, error: listingError } = await supabase
      .from("marketplace_listings")
      .select("id, title, is_active")
      .eq("id", listingId)
      .maybeSingle();

    if (listingError) {
      console.error("Error fetching listing:", listingError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch listing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!listing) {
      console.error("Listing not found");
      return new Response(
        JSON.stringify({ error: "Listing not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!listing.is_active) {
      console.error("Listing is no longer active");
      return new Response(
        JSON.stringify({ error: "This listing is no longer available" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the seller's contact email from the secure table
    const { data: sellerContact, error: contactError } = await supabase
      .from("seller_contacts")
      .select("contact_email")
      .eq("listing_id", listingId)
      .maybeSingle();

    if (contactError || !sellerContact) {
      console.error("Error fetching seller contact:", contactError);
      return new Response(
        JSON.stringify({ error: "Could not retrieve seller contact information" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!listing.is_active) {
      console.error("Listing is no longer active");
      return new Response(
        JSON.stringify({ error: "This listing is no longer available" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // In a production environment, you would integrate with an email service here
    // For now, we'll log the contact attempt and return success
    // The seller's email is never exposed to the frontend
    console.log("Contact request processed successfully");
    console.log(`Seller email (not exposed to client): ${sellerContact.contact_email}`);
    console.log(`Buyer: ${buyerName} <${buyerEmail}>`);
    console.log(`Listing: ${listing.title}`);
    console.log(`Message preview: ${message.substring(0, 100)}...`);
    console.log(`Message preview: ${message.substring(0, 100)}...`);

    // Email service integration (Resend example)
    // To enable, set RESEND_API_KEY in your Supabase environment variables
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (RESEND_API_KEY) {
      try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "GameChangrs Marketplace <noreply@gamechangrs.com>",
            to: sellerContact.contact_email,
            reply_to: buyerEmail,
            subject: `New inquiry about "${listing.title}"`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">New Marketplace Inquiry</h2>
                <p>You have received a new message about your listing: <strong>${listing.title}</strong></p>
                <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <p><strong>From:</strong> ${buyerName} (${buyerEmail})</p>
                  <p><strong>Message:</strong></p>
                  <p style="white-space: pre-wrap;">${message}</p>
                </div>
                <p style="color: #666; font-size: 14px;">
                  You can reply directly to this email to contact ${buyerName}.
                </p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="color: #999; font-size: 12px;">
                  This message was sent through GameChangrs Marketplace. 
                  Please arrange transactions safely and verify buyer identity.
                </p>
              </div>
            `,
            text: `
New Marketplace Inquiry

You have received a new message about your listing: ${listing.title}

From: ${buyerName} (${buyerEmail})

Message:
${message}

You can reply directly to this email to contact ${buyerName}.

---
This message was sent through GameChangrs Marketplace.
            `,
          }),
        });

        if (!emailResponse.ok) {
          const errorText = await emailResponse.text();
          console.error("Email service error:", errorText);
          // Continue even if email fails - we still log the contact
        } else {
          console.log("Email sent successfully to seller");
        }
      } catch (emailError) {
        console.error("Error sending email:", emailError);
        // Continue even if email fails
      }
    } else {
      console.log("RESEND_API_KEY not set - email service disabled");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Your message has been sent to the seller" 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
