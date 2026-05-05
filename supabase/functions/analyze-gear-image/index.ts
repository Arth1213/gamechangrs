import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { errorStatus, requestStructuredObject } from "../_shared/openai.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

const gearDetailsSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    category: {
      type: "string",
      enum: ["Cricket", "Football", "Basketball", "Tennis", "Running", "Other"],
    },
    condition: {
      type: "string",
      enum: ["Excellent", "Good", "Fair", "Needs Repair"],
    },
    description: { type: "string" },
    suggestedPrice: { type: "number" },
  },
  required: ["title", "category", "condition", "description", "suggestedPrice"],
  additionalProperties: false,
} as const;

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) {
    return corsResponse;
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      throw new Error("No image provided");
    }

    console.log("Analyzing gear image...");

    const gearDetails = await requestStructuredObject<{
      title: string;
      category: string;
      condition: string;
      description: string;
      suggestedPrice: number;
    }>({
      name: "gear_details",
      schema: gearDetailsSchema,
      messages: [
        {
          role: "system",
          content: "You analyze sports equipment images and return concise, marketplace-ready structured data. Prefer the most specific sport category visible in the image. Keep the description under 100 words and estimate a realistic resale price in INR.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this sports equipment image and extract the item title, category, condition, a concise description, and a suggested resale price in INR.",
            },
            {
              type: "image_url",
              image_url: {
                url: imageBase64,
              },
            },
          ],
        },
      ],
      temperature: 0.1,
      maxCompletionTokens: 400,
    });

    console.log("Extracted gear details:", gearDetails);

    return new Response(JSON.stringify(gearDetails), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error analyzing gear image:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to analyze image" }),
      {
        status: errorStatus(error),
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
