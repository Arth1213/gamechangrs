import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { errorStatus, requestStructuredObject } from "../_shared/openai.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const coachSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    bio: { type: "string" },
    location: { type: "string" },
    years_experience: { type: ["number", "null"] },
    teams_coached: { type: "array", items: { type: "string" } },
    notable_players_coached: { type: "array", items: { type: "string" } },
    specialties: {
      type: "array",
      items: {
        type: "string",
        enum: ["batting", "bowling", "fielding", "fitness", "mental conditioning"],
      },
    },
    coaching_level: {
      type: ["string", "null"],
      enum: ["beginner", "intermediate", "advanced", null],
    },
  },
  required: [
    "name",
    "bio",
    "location",
    "years_experience",
    "teams_coached",
    "notable_players_coached",
    "specialties",
    "coaching_level",
  ],
  additionalProperties: false,
} as const;

const playerSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    location: { type: "string" },
    playing_role: { type: "string" },
    age_group: {
      type: ["string", "null"],
      enum: ["U10", "U11", "U12", "U13", "U14", "U15", "U16", "U19", "U21", "Adult", "Masters", null],
    },
    experience_level: {
      type: ["string", "null"],
      enum: ["beginner", "intermediate", "advanced", null],
    },
    matches_played: { type: ["number", "null"] },
    batting_average: { type: ["number", "null"] },
    batting_strike_rate: { type: ["number", "null"] },
    bowling_economy: { type: ["number", "null"] },
    best_figures: { type: ["string", "null"] },
  },
  required: [
    "name",
    "location",
    "playing_role",
    "age_group",
    "experience_level",
    "matches_played",
    "batting_average",
    "batting_strike_rate",
    "bowling_economy",
    "best_figures",
  ],
  additionalProperties: false,
} as const;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, profileType } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (profileType !== "coach" && profileType !== "player") {
      return new Response(
        JSON.stringify({ success: false, error: 'profileType must be coach or player' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Scraping URL for ${profileType} profile:`, url);

    // Fetch the page content
    let pageContent = '';
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ProfileScraper/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.status}`);
      }

      const html = await response.text();
      
      // Extract text content from HTML (basic parsing)
      pageContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 8000); // Limit content length for AI processing
    } catch (fetchError) {
      console.error('Error fetching URL:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: 'Could not fetch the URL. The page may be protected or unavailable.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!pageContent || pageContent.length < 50) {
      return new Response(
        JSON.stringify({ success: false, error: 'Could not extract meaningful content from the page.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = profileType === 'coach' 
      ? `You extract structured cricket coach profile data from webpage text. Use only details that are clearly supported by the provided page content. If a field is not supported, return null for scalar values and [] for arrays. Keep bio under 500 characters.`
      : `You extract structured cricket player profile data from webpage text. Use only details that are clearly supported by the provided page content. If a field is not supported, return null for numeric/scalar values. Do not invent statistics.`;

    console.log('Sending content to AI for extraction...');

    const extractedData = await requestStructuredObject<Record<string, unknown>>({
      name: profileType === "coach" ? "coach_profile" : "player_profile",
      schema: profileType === "coach" ? coachSchema : playerSchema,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Profile type: ${profileType}\nExtract profile information from this webpage content:\n\n${pageContent}`,
        },
      ],
      temperature: 0,
      maxCompletionTokens: 900,
    });

    // Filter out null values and empty arrays
    const cleanedData: Record<string, any> = {};
    for (const [key, value] of Object.entries(extractedData)) {
      if (value !== null && value !== undefined && value !== '' && 
          !(Array.isArray(value) && value.length === 0)) {
        cleanedData[key] = value;
      }
    }

    console.log('Extracted profile data:', cleanedData);

    return new Response(
      JSON.stringify({ success: true, data: cleanedData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in scrape-profile-url:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: errorStatus(error), headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
