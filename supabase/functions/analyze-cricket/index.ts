import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { errorStatus, requestStructuredObject } from "../_shared/openai.ts";

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

const KEY_JOINTS = [
  "nose",
  "left_shoulder",
  "right_shoulder",
  "left_elbow",
  "right_elbow",
  "left_wrist",
  "right_wrist",
  "left_hip",
  "right_hip",
  "left_knee",
  "right_knee",
  "left_ankle",
  "right_ankle",
] as const;

const angleValueSchema = {
  type: "object",
  properties: {
    value: { type: "number" },
    optimal: { type: "string" },
    assessment: { type: "string" },
  },
  required: ["value", "optimal", "assessment"],
  additionalProperties: false,
} as const;

const analysisSchema = {
  type: "object",
  properties: {
    overallScore: { type: "number" },
    overallGrade: {
      type: "string",
      enum: ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D", "F"],
    },
    summary: { type: "string" },
    aspects: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          score: { type: "number" },
          status: {
            type: "string",
            enum: ["excellent", "good", "needs_improvement", "poor"],
          },
          feedback: { type: "string" },
          keyPoints: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["name", "score", "status", "feedback", "keyPoints"],
        additionalProperties: false,
      },
    },
    strengths: {
      type: "array",
      items: { type: "string" },
    },
    areasForImprovement: {
      type: "array",
      items: {
        type: "object",
        properties: {
          issue: { type: "string" },
          severity: { type: "string", enum: ["high", "medium", "low"] },
          drill: { type: "string" },
        },
        required: ["issue", "severity", "drill"],
        additionalProperties: false,
      },
    },
    angleAnalysis: {
      type: "object",
      properties: {
        elbowAngle: angleValueSchema,
        kneeAngle: angleValueSchema,
        shoulderAngle: angleValueSchema,
        hipAngle: angleValueSchema,
      },
      required: ["elbowAngle", "kneeAngle", "shoulderAngle", "hipAngle"],
      additionalProperties: false,
    },
    comparisonToElite: { type: "string" },
    nextSteps: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "overallScore",
    "overallGrade",
    "summary",
    "aspects",
    "strengths",
    "areasForImprovement",
    "angleAnalysis",
    "comparisonToElite",
    "nextSteps",
  ],
  additionalProperties: false,
} as const;

function round(value: number, decimals = 3) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function normalizeAngleName(name: string) {
  return name.replace(/^(left|right)_/, "");
}

function sampleEvenly<T>(items: T[], sampleSize: number) {
  if (items.length <= sampleSize) {
    return items;
  }

  const indexes = new Set<number>();
  for (let i = 0; i < sampleSize; i++) {
    const index = Math.round((i * (items.length - 1)) / (sampleSize - 1));
    indexes.add(index);
  }

  return Array.from(indexes)
    .sort((a, b) => a - b)
    .map((index) => items[index]);
}

function summarizePoseData(poseData: PoseData[]) {
  const validFrames = poseData.filter((frame) => frame.joints.length > 0 || frame.angles.length > 0);
  const sourceFrames = validFrames.length > 0 ? validFrames : poseData;
  const sampledFrames = sampleEvenly(sourceFrames, Math.min(12, Math.max(sourceFrames.length, 1))).map((frame, index) => {
    const importantJoints = Object.fromEntries(
      frame.joints
        .filter((joint) => KEY_JOINTS.includes(joint.name as typeof KEY_JOINTS[number]))
        .map((joint) => [
          joint.name,
          {
            x: round(joint.x),
            y: round(joint.y),
            confidence: round(joint.confidence, 2),
          },
        ]),
    );

    const angles = Object.fromEntries(
      frame.angles.map((angle) => [angle.name, round(angle.value, 1)]),
    );

    return {
      sampledFrame: index + 1,
      joints: importantJoints,
      angles,
    };
  });

  const angleBuckets = new Map<string, number[]>();
  for (const frame of validFrames) {
    for (const angle of frame.angles) {
      const key = normalizeAngleName(angle.name);
      const bucket = angleBuckets.get(key) || [];
      bucket.push(angle.value);
      angleBuckets.set(key, bucket);
    }
  }

  const angleStats = Object.fromEntries(
    Array.from(angleBuckets.entries()).map(([name, values]) => {
      const average = values.reduce((sum, value) => sum + value, 0) / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);
      return [
        name,
        {
          average: round(average, 1),
          min: round(min, 1),
          max: round(max, 1),
          sampleCount: values.length,
        },
      ];
    }),
  );

  return {
    frameCount: poseData.length,
    validFrameCount: validFrames.length,
    sampledFrames,
    angleStats,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mode, poseData, frameCount } = await req.json() as AnalysisRequest;

    if (!mode || !Array.isArray(poseData) || typeof frameCount !== "number") {
      throw new Error("mode, poseData, and frameCount are required");
    }
    if (poseData.length === 0) {
      throw new Error("No pose data provided");
    }

    console.log(`Analyzing ${mode} technique with ${frameCount} frames`);

    const poseSummary = summarizePoseData(poseData);

    const systemPrompt = `You are an expert cricket coach and biomechanics analyst. You analyze cricket ${mode} technique from pose-estimation summaries and provide evidence-based, actionable feedback.

Your analysis should cover these key areas for ${mode === 'batting' ? 'BATTING' : 'BOWLING'}:

${mode === 'batting' ? `
BATTING TECHNIQUE ASPECTS:
1. Stance & Setup
2. Backlift & Trigger Movement
3. Front Foot Play
4. Back Foot Play
5. Shot Execution
6. Follow Through
` : `
BOWLING TECHNIQUE ASPECTS:
1. Run-Up & Approach
2. Bound & Gather
3. Back Foot Contact
4. Front Foot Contact
5. Arm Action & Release
6. Follow Through
`}

SCORING GUIDELINES:
- 90-100: Elite/International standard
- 80-89: Club/District first-team level
- 70-79: Good recreational player
- 60-69: Developing player with clear areas to improve
- Below 60: Significant technical issues to address

Use only evidence visible in the supplied pose summary. Keep strengths and next steps concise. When angle averages are provided, use those values directly or very close to them in angleAnalysis.`;

    const userPrompt = `Analyze this ${mode} technique from the following pose summary:

${JSON.stringify(poseSummary)}

Return a complete JSON analysis. Include exactly 6 aspect entries, at least 3 strengths, at least 3 improvement items, and 3 next steps. Be encouraging but direct about weaknesses.`;

    const analysis = await requestStructuredObject<{
      overallScore: number;
      overallGrade: string;
      summary: string;
      aspects: Array<{
        name: string;
        score: number;
        status: "excellent" | "good" | "needs_improvement" | "poor";
        feedback: string;
        keyPoints: string[];
      }>;
      strengths: string[];
      areasForImprovement: Array<{
        issue: string;
        severity: "high" | "medium" | "low";
        drill: string;
      }>;
      angleAnalysis: {
        elbowAngle: { value: number; optimal: string; assessment: string };
        kneeAngle: { value: number; optimal: string; assessment: string };
        shoulderAngle: { value: number; optimal: string; assessment: string };
        hipAngle: { value: number; optimal: string; assessment: string };
      };
      comparisonToElite: string;
      nextSteps: string[];
    }>({
      name: "cricket_technique_analysis",
      schema: analysisSchema,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      maxCompletionTokens: 1800,
    });

    console.log("Analysis generated successfully");

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Analysis error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Analysis failed"
    }), {
      status: errorStatus(error),
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
