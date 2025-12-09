import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64 } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!imageBase64) {
      throw new Error("No image provided");
    }

    console.log("Analyzing gear image...");

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
            content: `You are an expert at analyzing sports equipment images. Extract details about the item shown and return structured data. Be concise and accurate.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this sports equipment image and extract: 1) Title/name of the item 2) Category (Cricket, Football, Basketball, Tennis, Running, Other) 3) Condition (Excellent, Good, Fair, Needs Repair) 4) A brief description (max 100 words) 5) Suggested price range in INR if selling"
              },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64
                }
              }
            ]
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_gear_details",
              description: "Extract details from the sports equipment image",
              parameters: {
                type: "object",
                properties: {
                  title: { 
                    type: "string", 
                    description: "Name/title of the equipment" 
                  },
                  category: { 
                    type: "string", 
                    enum: ["Cricket", "Football", "Basketball", "Tennis", "Running", "Other"],
                    description: "Category of the sports equipment"
                  },
                  condition: { 
                    type: "string", 
                    enum: ["Excellent", "Good", "Fair", "Needs Repair"],
                    description: "Condition of the item"
                  },
                  description: { 
                    type: "string", 
                    description: "Brief description of the item" 
                  },
                  suggestedPrice: { 
                    type: "number", 
                    description: "Suggested price in INR" 
                  }
                },
                required: ["title", "category", "condition", "description", "suggestedPrice"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_gear_details" } }
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
        return new Response(JSON.stringify({ error: "Payment required. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log("AI response:", JSON.stringify(data));

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("Failed to extract gear details from image");
    }

    const gearDetails = JSON.parse(toolCall.function.arguments);
    console.log("Extracted gear details:", gearDetails);

    return new Response(JSON.stringify(gearDetails), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error analyzing gear image:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to analyze image" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
