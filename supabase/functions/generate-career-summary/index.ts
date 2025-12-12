import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CoachData {
  type: 'coach';
  name: string;
  bio?: string;
  location?: string;
  years_experience?: number;
  coaching_level?: string;
  specialties?: string[];
  teams_coached?: string[];
  notable_players_coached?: string[];
  average_rating?: number;
  number_of_ratings?: number;
}

interface PlayerData {
  type: 'player';
  name: string;
  location?: string;
  age_group?: string;
  playing_role?: string;
  experience_level?: string;
  matches_played?: number;
  batting_average?: number;
  batting_strike_rate?: number;
  bowling_economy?: number;
  best_figures?: string;
  training_categories_needed?: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const profileData: CoachData | PlayerData = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let prompt = '';
    
    if (profileData.type === 'coach') {
      const coach = profileData as CoachData;
      prompt = `Generate a professional, engaging career summary paragraph (2-3 sentences) for a cricket coach with the following details. Write in third person and make it sound natural and impressive:

Name: ${coach.name}
${coach.location ? `Location: ${coach.location}` : ''}
${coach.years_experience ? `Years of Experience: ${coach.years_experience}` : ''}
${coach.coaching_level ? `Coaching Level: ${coach.coaching_level}` : ''}
${coach.specialties?.length ? `Specialties: ${coach.specialties.join(', ')}` : ''}
${coach.teams_coached?.length ? `Teams Coached: ${coach.teams_coached.join(', ')}` : ''}
${coach.notable_players_coached?.length ? `Notable Players Coached: ${coach.notable_players_coached.join(', ')}` : ''}
${coach.average_rating ? `Rating: ${coach.average_rating.toFixed(1)}/5 from ${coach.number_of_ratings || 0} reviews` : ''}
${coach.bio ? `Additional Bio: ${coach.bio}` : ''}

Write only the summary paragraph, no headers or labels. If limited data is available, focus on what's provided and keep it brief but professional.`;
    } else {
      const player = profileData as PlayerData;
      prompt = `Generate a professional, engaging career summary paragraph (2-3 sentences) for a cricket player with the following details. Write in third person and make it sound natural and impressive:

Name: ${player.name}
${player.location ? `Location: ${player.location}` : ''}
${player.age_group ? `Age Group: ${player.age_group}` : ''}
${player.playing_role ? `Playing Role: ${player.playing_role}` : ''}
${player.experience_level ? `Experience Level: ${player.experience_level}` : ''}
${player.matches_played ? `Matches Played: ${player.matches_played}` : ''}
${player.batting_average ? `Batting Average: ${player.batting_average}` : ''}
${player.batting_strike_rate ? `Strike Rate: ${player.batting_strike_rate}` : ''}
${player.bowling_economy ? `Bowling Economy: ${player.bowling_economy}` : ''}
${player.best_figures ? `Best Bowling Figures: ${player.best_figures}` : ''}
${player.training_categories_needed?.length ? `Training Focus: ${player.training_categories_needed.join(', ')}` : ''}

Write only the summary paragraph, no headers or labels. If limited data is available, focus on what's provided and keep it brief but professional.`;
    }

    console.log('Generating career summary for:', profileData.name);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { 
            role: "system", 
            content: "You are a professional sports biography writer. Generate concise, engaging career summaries for cricket professionals. Keep summaries to 2-3 sentences maximum. Be factual and avoid hyperbole." 
          },
          { role: "user", content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content?.trim() || '';

    console.log('Generated summary:', summary);

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error generating career summary:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
