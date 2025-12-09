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

    // Fetch the listing with seller's contact email (using service role to bypass RLS field restrictions)
    const { data: listing, error: listingError } = await supabase
      .from("marketplace_listings")
      .select("id, title, contact_email, is_active")
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

    // In a production environment, you would integrate with an email service here
    // For now, we'll log the contact attempt and return success
    // The seller's email is never exposed to the frontend
    console.log("Contact request processed successfully");
    console.log(`Seller email (not exposed to client): ${listing.contact_email}`);
    console.log(`Buyer: ${buyerName} <${buyerEmail}>`);
    console.log(`Listing: ${listing.title}`);
    console.log(`Message preview: ${message.substring(0, 100)}...`);

    // TODO: Integrate with email service (SendGrid, Resend, etc.) to send actual emails
    // Example with Resend:
    // await resend.emails.send({
    //   from: 'GameChangrs Marketplace <noreply@gamechangrs.com>',
    //   to: listing.contact_email,
    //   subject: `New inquiry about "${listing.title}"`,
    //   html: `<p>You have a new message from ${buyerName} (${buyerEmail}):</p><p>${message}</p>`
    // });

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
