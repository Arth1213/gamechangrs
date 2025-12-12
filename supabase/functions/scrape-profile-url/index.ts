import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Use Lovable AI to extract profile data
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = profileType === 'coach' 
      ? `You are a data extractor for cricket coach profiles. Extract the following information from the provided webpage content. Return ONLY a valid JSON object with these fields (use null for fields you cannot find):
{
  "name": "full name of the coach",
  "bio": "brief biography or description (max 500 chars)",
  "location": "city, state, country",
  "years_experience": number or null,
  "teams_coached": ["array of team names"],
  "notable_players_coached": ["array of player names"],
  "specialties": ["batting", "bowling", "fielding", "fitness", "mental conditioning"],
  "coaching_level": "beginner" | "intermediate" | "advanced"
}`
      : `You are a data extractor for cricket player profiles. Extract the following information from the provided webpage content. Return ONLY a valid JSON object with these fields (use null for fields you cannot find):
{
  "name": "full name of the player",
  "location": "city, state, country",
  "playing_role": "batsman, bowler, all-rounder, wicket-keeper, etc",
  "age_group": "U10" | "U11" | "U12" | "U13" | "U14" | "U15" | "U16" | "U19" | "U21" | "Adult" | "Masters" | null,
  "experience_level": "beginner" | "intermediate" | "advanced",
  "matches_played": number or null,
  "batting_average": number or null,
  "batting_strike_rate": number or null,
  "bowling_economy": number or null,
  "best_figures": "string like 5/25" or null
}`;

    console.log('Sending content to AI for extraction...');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Extract profile information from this webpage content:\n\n${pageContent}` }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'AI credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: 'AI extraction failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const extractedText = aiData.choices?.[0]?.message?.content || '';
    
    console.log('AI response:', extractedText);

    // Parse the JSON from AI response
    let extractedData = {};
    try {
      // Find JSON in the response (it might be wrapped in markdown code blocks)
      const jsonMatch = extractedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      return new Response(
        JSON.stringify({ success: false, error: 'Could not parse extracted data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
