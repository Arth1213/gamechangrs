import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PoseData {
  joints: {
    name: string;
    x: number;
    y: number;
    confidence: number;
  }[];
  angles: {
    name: string;
    value: number;
  }[];
}

interface AnalysisRequest {
  mode: 'batting' | 'bowling';
  poseData: PoseData[];
  frameCount: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mode, poseData, frameCount } = await req.json() as AnalysisRequest;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log(`Analyzing ${mode} technique with ${frameCount} frames`);

    const systemPrompt = `You are an expert cricket coach and biomechanics analyst. You analyze cricket ${mode} technique from pose estimation data and provide detailed, actionable feedback.

Your analysis should cover these key areas for ${mode === 'batting' ? 'BATTING' : 'BOWLING'}:

${mode === 'batting' ? `
BATTING TECHNIQUE ASPECTS:
1. **Stance & Setup** (Weight: 15%)
   - Feet shoulder-width apart
   - Balanced weight distribution (50-50 or 60-40 back foot)
   - Relaxed grip, top hand dominant
   - Head still and eyes level

2. **Backlift & Trigger Movement** (Weight: 15%)
   - Bat comes straight back or slight angle
   - Minimal loop in backlift
   - Smooth trigger movement to get into position
   - Head and eyes tracking the ball

3. **Front Foot Play** (Weight: 20%)
   - Lead with the front shoulder
   - Front foot to the pitch of the ball
   - Head over front knee
   - Full face of bat to the ball

4. **Back Foot Play** (Weight: 20%)
   - Quick back and across movement
   - Weight transfer to back foot
   - High elbow position
   - Playing under the eyes

5. **Shot Execution** (Weight: 15%)
   - Timing of bat swing
   - Point of contact relative to body
   - Extension through the shot
   - Balance at point of contact

6. **Follow Through** (Weight: 15%)
   - Full extension of arms
   - High finish for lofted shots
   - Controlled finish for defensive shots
   - Balance maintained post-shot
` : `
BOWLING TECHNIQUE ASPECTS:
1. **Run-Up & Approach** (Weight: 15%)
   - Consistent run-up length and rhythm
   - Gradual acceleration to the crease
   - Smooth transition to delivery stride
   - Eyes fixed on target

2. **Bound & Gather** (Weight: 20%)
   - Explosive penultimate stride (bound)
   - Body aligned towards target
   - Back foot landing position
   - Momentum channeled forward

3. **Back Foot Contact** (Weight: 15%)
   - Parallel to crease or slightly angled
   - Braced back leg for pace bowlers
   - Hip rotation initiation
   - Arm position during loading

4. **Front Foot Contact** (Weight: 20%)
   - Braced front leg at delivery
   - Front arm pulling down and in
   - Hip-shoulder separation
   - Head position and stability

5. **Arm Action & Release** (Weight: 20%)
   - High arm action (close to vertical)
   - Elbow alignment for no-ball compliance
   - Wrist position at release
   - Ball release point relative to head

6. **Follow Through** (Weight: 10%)
   - Arm follows through past hip
   - Body rotation complete
   - Balance and deceleration
   - Ready position for fielding
`}

SCORING GUIDELINES:
- 90-100: Elite/International standard
- 80-89: Club/District first-team level
- 70-79: Good recreational player
- 60-69: Developing player with clear areas to improve
- Below 60: Significant technical issues to address

Provide your response in this exact JSON format:
{
  "overallScore": number (0-100),
  "overallGrade": "A+" | "A" | "A-" | "B+" | "B" | "B-" | "C+" | "C" | "C-" | "D" | "F",
  "summary": "2-3 sentence overview of the technique",
  "aspects": [
    {
      "name": "Aspect Name",
      "score": number (0-100),
      "status": "excellent" | "good" | "needs_improvement" | "poor",
      "feedback": "Detailed feedback for this aspect",
      "keyPoints": ["Point 1", "Point 2", "Point 3"]
    }
  ],
  "strengths": ["Strength 1", "Strength 2", "Strength 3"],
  "areasForImprovement": [
    {
      "issue": "Issue description",
      "severity": "high" | "medium" | "low",
      "drill": "Recommended drill or exercise to fix this"
    }
  ],
  "angleAnalysis": {
    "elbowAngle": { "value": number, "optimal": string, "assessment": string },
    "kneeAngle": { "value": number, "optimal": string, "assessment": string },
    "shoulderAngle": { "value": number, "optimal": string, "assessment": string },
    "hipAngle": { "value": number, "optimal": string, "assessment": string }
  },
  "comparisonToElite": "How this technique compares to elite players",
  "nextSteps": ["Step 1", "Step 2", "Step 3"]
}`;

    const userPrompt = `Analyze this ${mode} technique based on the following pose estimation data captured over ${frameCount} frames:

${JSON.stringify(poseData, null, 2)}

Provide a comprehensive analysis with scores, detailed feedback for each technical aspect, and specific drills for improvement. Be encouraging but honest about areas needing work.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const analysisText = data.choices?.[0]?.message?.content;
    
    if (!analysisText) {
      throw new Error("No analysis generated");
    }

    console.log("Analysis generated successfully");
    
    let analysis;
    try {
      analysis = JSON.parse(analysisText);
    } catch {
      console.error("Failed to parse analysis JSON:", analysisText);
      throw new Error("Invalid analysis format");
    }

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Analysis error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Analysis failed" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
