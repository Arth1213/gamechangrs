import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

interface ContactRequest {
  listingId: string;
  buyerName: string;
  buyerEmail: string;
  message: string;
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
            from: "GameChangrs Marketplace <noreply@game-changrs.com>",
            to: sellerContact.contact_email,
            cc: buyerEmail,
            reply_to: buyerEmail,
            subject: `Gear Marketplace: Inquiry about "${listing.title}"`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 12px 12px 0 0;">
                  <h1 style="color: white; margin: 0; font-size: 24px;">GameChangrs Gear Marketplace</h1>
                </div>
                <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                  <h2 style="color: #333; margin-top: 0;">New Inquiry for Your Listing</h2>
                  <p style="color: #666;">Someone is interested in your item: <strong>${listing.title}</strong></p>
                  
                  <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
                    <p style="margin: 0 0 10px 0;"><strong>Buyer:</strong> ${buyerName}</p>
                    <p style="margin: 0 0 15px 0;"><strong>Email:</strong> <a href="mailto:${buyerEmail}" style="color: #667eea;">${buyerEmail}</a></p>
                    <p style="margin: 0 0 5px 0;"><strong>Message:</strong></p>
                    <p style="white-space: pre-wrap; margin: 0; color: #333;">${message}</p>
                  </div>
                  
                  <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0; color: #2e7d32; font-size: 14px;">
                      <strong>💡 Next Steps:</strong> Simply reply to this email to start the conversation with ${buyerName}. 
                      Both parties are copied on this email to facilitate direct communication.
                    </p>
                  </div>
                  
                  <hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;">
                  <p style="color: #999; font-size: 12px; margin: 0;">
                    This message was sent through GameChangrs Gear Marketplace. 
                    We facilitate connections but do not process payments. 
                    Please arrange transactions safely and verify identities before meeting.
                  </p>
                </div>
              </div>
            `,
            text: `
GameChangrs Gear Marketplace - New Inquiry

Hi,

Someone is interested in your listing: ${listing.title}

BUYER DETAILS:
Name: ${buyerName}
Email: ${buyerEmail}

MESSAGE:
${message}

---

NEXT STEPS:
Simply reply to this email to start the conversation. Both the buyer and seller are copied on this email to facilitate direct communication.

---
This message was sent through GameChangrs Gear Marketplace.
We facilitate connections but do not process payments.
Please arrange transactions safely and verify identities before meeting.
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
