import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { errorStatus, requestTextCompletion } from "../_shared/openai.ts";

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

    const summary = await requestTextCompletion({
      messages: [
        {
          role: "system",
          content: "You are a professional sports biography writer. Generate concise, engaging career summaries for cricket professionals. Keep summaries to 2-3 sentences maximum. Be factual and avoid hyperbole."
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.5,
      maxCompletionTokens: 220,
    });

    console.log('Generated summary:', summary);

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error generating career summary:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: errorStatus(error),
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
