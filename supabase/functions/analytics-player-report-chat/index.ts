import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatRequest = {
  question?: string;
  history?: ChatHistoryMessage[];
  report?: Record<string, unknown>;
  seriesConfigKey?: string;
  playerId?: number;
  divisionId?: number | null;
};

const DEFAULT_CRICKET_API_BASE = "https://gamechangrs-cricket-api.onrender.com";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown, maxLength = 320) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 1)}…` : trimmed;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function cleanObject<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null));
}

function takeMetrics(value: unknown, limit: number) {
  return asArray(value)
    .slice(0, limit)
    .map((item) => {
      const record = asRecord(item);
      if (!record) {
        return null;
      }

      return cleanObject({
        label: asString(record.label, 120),
        value: asNumber(record.value),
        tone: asString(record.tone, 40),
        note: asString(record.note, 220),
        badge: asString(record.badge, 80),
        primary: asBoolean(record.primary),
      });
    })
    .filter(Boolean);
}

function takeMatchEvidence(value: unknown, limit: number) {
  return asArray(value)
    .slice(0, limit)
    .map((item) => {
      const record = asRecord(item);
      if (!record) {
        return null;
      }

      return cleanObject({
        matchId: asNumber(record.matchId),
        matchDateLabel: asString(record.matchDateLabel, 40),
        matchTitle: asString(record.matchTitle, 140),
        score: asNumber(record.score),
        note: asString(record.note, 240),
      });
    })
    .filter(Boolean);
}

function takePeerComparison(value: unknown, limit: number) {
  return asArray(value)
    .slice(0, limit)
    .map((item) => {
      const record = asRecord(item);
      if (!record) {
        return null;
      }

      return cleanObject({
        playerId: asNumber(record.playerId),
        divisionId: asNumber(record.divisionId),
        displayName: asString(record.displayName, 100),
        teamName: asString(record.teamName, 100),
        roleLabel: asString(record.roleLabel, 100),
        compositeScore: asNumber(record.compositeScore),
        percentileRank: asNumber(record.percentileRank),
        note: asString(record.note, 180),
      });
    })
    .filter(Boolean);
}

function takeTrendValues(value: unknown, limit: number) {
  return asArray(value)
    .slice(0, limit)
    .map((item) => {
      const record = asRecord(item);
      if (!record) {
        return null;
      }

      return cleanObject({
        label: asString(record.label, 40),
        value: asNumber(record.value),
      });
    })
    .filter(Boolean);
}

function takeTrends(value: unknown, limit: number) {
  return asArray(value)
    .slice(0, limit)
    .map((item) => {
      const record = asRecord(item);
      if (!record) {
        return null;
      }

      return cleanObject({
        title: asString(record.title, 80),
        status: asString(record.status, 40),
        note: asString(record.note, 220),
        values: takeTrendValues(record.values, 8),
      });
    })
    .filter(Boolean);
}

function takeMatchupRows(value: unknown, limit: number) {
  return asArray(value)
    .slice(0, limit)
    .map((item) => {
      const record = asRecord(item);
      if (!record) {
        return null;
      }

      return cleanObject({
        opponentName: asString(record.opponentName, 100),
        balls: asNumber(record.balls),
        runs: asNumber(record.runs),
        runsConceded: asNumber(record.runsConceded),
        wickets: asNumber(record.wickets),
        dismissals: asNumber(record.dismissals),
        strikeRate: asNumber(record.strikeRate),
        economy: asNumber(record.economy),
        dotPct: asNumber(record.dotPct),
        boundaryPct: asNumber(record.boundaryPct),
      });
    })
    .filter(Boolean);
}

function takeCommentary(value: unknown, limit: number) {
  return asArray(value)
    .slice(0, limit)
    .map((item) => {
      const record = asRecord(item);
      if (!record) {
        return null;
      }

      return cleanObject({
        matchDateLabel: asString(record.matchDateLabel, 40),
        matchTitle: asString(record.matchTitle, 140),
        inningsNo: asNumber(record.inningsNo),
        ballLabel: asString(record.ballLabel, 20),
        phase: asString(record.phase, 40),
        involvementType: asString(record.involvementType, 40),
        strikerName: asString(record.strikerName, 100),
        bowlerName: asString(record.bowlerName, 100),
        playerOutName: asString(record.playerOutName, 100),
        batterRuns: asNumber(record.batterRuns),
        totalRuns: asNumber(record.totalRuns),
        wicketFlag: asBoolean(record.wicketFlag),
        dismissalType: asString(record.dismissalType, 80),
        leverageScore: asNumber(record.leverageScore),
        totalEventWeight: asNumber(record.totalEventWeight),
        commentaryText: asString(record.commentaryText, 220),
      });
    })
    .filter(Boolean);
}

function takeOverEvidence(value: unknown, limit: number) {
  return asArray(value)
    .slice(0, limit)
    .map((item) => {
      const record = asRecord(item);
      if (!record) {
        return null;
      }

      return cleanObject({
        matchDateLabel: asString(record.matchDateLabel, 40),
        matchTitle: asString(record.matchTitle, 140),
        overNo: asNumber(record.overNo),
        balls: asNumber(record.balls),
        runs: asNumber(record.runs),
        wickets: asNumber(record.wickets),
        boundaries: asNumber(record.boundaries),
        stateText: asString(record.stateText, 120),
      });
    })
    .filter(Boolean);
}

function takePhaseBucket(value: unknown) {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  const bucket = cleanObject({
    overall: takeMatchupRows(record.overall, 10),
    powerplay: takeMatchupRows(record.powerplay, 10),
    middle: takeMatchupRows(record.middle, 10),
    death: takeMatchupRows(record.death, 10),
  });

  return Object.keys(bucket).length > 0 ? bucket : undefined;
}

function takeDivisionOptions(value: unknown) {
  return asArray(value)
    .slice(0, 8)
    .map((item) => {
      const record = asRecord(item);
      if (!record) {
        return null;
      }

      return cleanObject({
        divisionId: asNumber(record.divisionId),
        divisionLabel: asString(record.divisionLabel, 80),
        roleType: asString(record.roleType, 80),
        compositeScore: asNumber(record.compositeScore),
      });
    })
    .filter(Boolean);
}

function buildScopeNote(divisionOptions: Array<Record<string, unknown>>) {
  const divisionLabels = divisionOptions
    .map((item) => asString(item.divisionLabel, 80))
    .filter((value): value is string => Boolean(value));

  if (divisionLabels.length > 1) {
    return `This report combines player records across these phase/division rows: ${divisionLabels.join(", ")}. Do not describe an answer as phase-specific unless the evidence explicitly says so.`;
  }

  if (divisionLabels.length === 1) {
    return `Current report route is focused on ${divisionLabels[0]}. Do not infer additional phase/division scope beyond explicit evidence.`;
  }

  return "Phase/division coverage is not explicitly labeled in every evidence item. Do not claim phase-specific detail unless the evidence itself shows it.";
}

function buildCompactReport(report: Record<string, unknown>) {
  const meta = asRecord(report.meta) ?? {};
  const series = asRecord(meta.series) ?? {};
  const player = asRecord(meta.player) ?? {};
  const header = asRecord(report.header) ?? {};
  const scores = asRecord(report.scores) ?? {};
  const standardStats = asRecord(report.standardStats) ?? {};
  const reportPayload = asRecord(report.reportPayload) ?? {};
  const recommendationBadge = asRecord(reportPayload.recommendationBadge) ?? {};
  const drilldowns = asRecord(report.drilldowns) ?? {};
  const divisionOptions = takeDivisionOptions(player.divisionOptions);

  return cleanObject({
    meta: cleanObject({
      generatedAt: asString(meta.generatedAt, 60),
      series: cleanObject({
        configKey: asString(series.configKey, 80),
        name: asString(series.name, 120),
        targetAgeGroup: asString(series.targetAgeGroup, 40),
      }),
      player: cleanObject({
        playerId: asNumber(player.playerId),
        playerName: asString(player.playerName, 120),
        canonicalName: asString(player.canonicalName, 120),
        teamName: asString(player.teamName, 120),
        divisionOptions,
        scopeNote: buildScopeNote(divisionOptions),
      }),
    }),
    header: cleanObject({
      playerName: asString(header.playerName, 120),
      teamName: asString(header.teamName, 120),
      primaryRole: asString(header.primaryRole, 120),
      divisionLabel: asString(header.divisionLabel, 80),
      strengthSignal: asString(header.strengthSignal, 140),
      comparisonPool: asString(header.comparisonPool, 140),
      percentileRank: asNumber(header.percentileRank),
      confidenceScore: asNumber(header.confidenceScore),
      confidenceLabel: asString(header.confidenceLabel, 60),
      recommendation: asString(header.recommendation, 80),
      quickRead: asString(header.quickRead, 220),
    }),
    scores: cleanObject({
      compositeScore: asNumber(scores.compositeScore),
      tierLabel: asString(scores.tierLabel, 120),
      breakdown: asArray(scores.breakdown)
        .slice(0, 8)
        .map((item) => {
          const record = asRecord(item);
          if (!record) {
            return null;
          }

          return cleanObject({
            key: asString(record.key, 80),
            label: asString(record.label, 120),
            value: asNumber(record.value),
          });
        })
        .filter(Boolean),
    }),
    reportPayload: cleanObject({
      recommendationBadge: cleanObject({
        label: asString(recommendationBadge.label, 80),
        tone: asString(recommendationBadge.tone, 40),
        confidenceLabel: asString(recommendationBadge.confidenceLabel, 60),
        confidenceScore: asNumber(recommendationBadge.confidenceScore),
        percentileRank: asNumber(recommendationBadge.percentileRank),
        quickRead: asString(recommendationBadge.quickRead, 220),
        selectorTakeaway: asString(recommendationBadge.selectorTakeaway, 220),
      }),
    }),
    assessmentSnapshot: takeMetrics(report.assessmentSnapshot, 8),
    visualReadout: takeMetrics(report.visualReadout, 8),
    contextPerformance: takeMetrics(report.contextPerformance, 8),
    selectorInterpretation: takeMetrics(report.selectorInterpretation, 8),
    selectorTakeaway: asString(report.selectorTakeaway, 240),
    standardStats: cleanObject({
      currentSeries: asRecord(standardStats.currentSeries),
      overall: asRecord(standardStats.overall),
    }),
    matchEvidence: takeMatchEvidence(report.matchEvidence, 8),
    peerComparison: takePeerComparison(report.peerComparison, 8),
    trends: takeTrends(report.trends, 4),
    drilldowns: cleanObject({
      battingVsBowlers: takeMatchupRows(drilldowns.battingVsBowlers, 10),
      bowlingVsBatters: takeMatchupRows(drilldowns.bowlingVsBatters, 10),
      commentaryEvidence: takeCommentary(drilldowns.commentaryEvidence, 20),
      overEvidence: cleanObject({
        batting: takeOverEvidence(asRecord(drilldowns.overEvidence)?.batting, 8),
        bowlingBest: takeOverEvidence(asRecord(drilldowns.overEvidence)?.bowlingBest, 8),
        bowlingExpensive: takeOverEvidence(asRecord(drilldowns.overEvidence)?.bowlingExpensive, 8),
      }),
      phasePerformance: cleanObject({
        batting: takePhaseBucket(asRecord(drilldowns.phasePerformance)?.batting),
        bowling: takePhaseBucket(asRecord(drilldowns.phasePerformance)?.bowling),
      }),
    }),
  });
}

function normalizeHistory(value: unknown) {
  return asArray(value)
    .map((item) => {
      const record = asRecord(item);
      if (!record) {
        return null;
      }

      const role = record.role === "assistant" ? "assistant" : record.role === "user" ? "user" : null;
      const content = asString(record.content, 800);
      if (!role || !content) {
        return null;
      }

      return { role, content };
    })
    .filter((item): item is ChatHistoryMessage => Boolean(item))
    .slice(-8);
}

function normalizeModelResponse(rawText: string) {
  try {
    const parsed = JSON.parse(rawText);
    const record = asRecord(parsed);
    if (!record) {
      throw new Error("Model response was not an object.");
    }

    const evidence = asArray(record.evidence)
      .map((item) => {
        const evidenceItem = asRecord(item);
        if (!evidenceItem) {
          return null;
        }

        return cleanObject({
          label: asString(evidenceItem.label, 120),
          detail: asString(evidenceItem.detail, 240),
        });
      })
      .filter(Boolean)
      .slice(0, 4);

    const followUps = asArray(record.followUps)
      .map((item) => asString(item, 120))
      .filter((item): item is string => Boolean(item))
      .slice(0, 4);

    const limitations = asArray(record.limitations)
      .map((item) => asString(item, 180))
      .filter((item): item is string => Boolean(item))
      .slice(0, 3);

    return {
      answer: asString(record.answer, 4000) || rawText.trim(),
      evidence,
      followUps,
      limitations,
    };
  } catch (_error) {
    return {
      answer: rawText.trim(),
      evidence: [],
      followUps: [],
      limitations: [],
    };
  }
}

async function fetchDatabaseBackedContext(req: Request, body: ChatRequest) {
  const seriesConfigKey = asString(body.seriesConfigKey, 120);
  const playerId = asNumber(body.playerId);

  if (!seriesConfigKey || !playerId) {
    return null;
  }

  const authorization = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  if (!authorization.trim()) {
    return null;
  }

  const cricketApiBase = stripTrailingSlash(
    asString(Deno.env.get("CRICKET_API_BASE"), 240) || DEFAULT_CRICKET_API_BASE
  );

  const response = await fetch(
    `${cricketApiBase}/api/series/${encodeURIComponent(seriesConfigKey)}/players/${playerId}/chat-context`,
    {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: body.question || "",
        divisionId: body.divisionId ?? null,
      }),
    },
  );

  if (response.status === 401 || response.status === 403) {
    const error = new Error("You do not have access to this series chat context.");
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cricket API chat context failed with status ${response.status}: ${errorText}`);
  }

  return asRecord(await response.json());
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as ChatRequest;
    const question = asString(body.question, 600);
    const report = asRecord(body.report);

    if (!question) {
      return new Response(JSON.stringify({ error: "A question is required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const history = normalizeHistory(body.history);
    let databaseContext: Record<string, unknown> | null = null;

    try {
      databaseContext = await fetchDatabaseBackedContext(req, body);
    } catch (error) {
      if (!report) {
        throw error;
      }
      console.warn("Falling back to report-only player chat context:", error);
    }

    if (!databaseContext && !report) {
      return new Response(JSON.stringify({ error: "Player report chat needs either report context or a resolvable player route." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const compactReport = report ? buildCompactReport(report) : null;

    const systemPrompt = `You are the Game-Changrs player report assistant.

You answer only from the provided database-backed cricket context, the provided report context, and the provided conversation history.

Hard rules:
- Do not claim access to CricClubs, Supabase, Render, scorecards, or any source outside the provided context payloads.
- Prefer the database-backed cricket context when it is available, because it may include broader series evidence than the lightweight report shell.
- If the user asks for information that is not explicit in the provided context, say that directly and then offer the closest available evidence.
- Do not infer batting-order labels unless batting positions or batting-order buckets are explicitly present in context.
- Do not claim phase-specific or division-specific precision unless an evidence item explicitly provides that scope.
- If the context says the report combines multiple phase/division rows, preserve that caveat in your answer when relevant.
- If questionFocus includes a requested phase or division, filter your reasoning to matching rows only and say when matching rows are missing.
- If bowling-vs-batting-order rows are present, you may use their explicit batting-order bucket definitions.
- When citing commentary, include the match title or date label and the ball label when available.
- Keep the answer selector-friendly, concrete, and concise.

Return valid JSON only in this exact shape:
{
  "answer": "direct answer to the question",
  "evidence": [
    { "label": "short evidence label", "detail": "one concrete supporting detail" }
  ],
  "followUps": ["short follow-up question", "short follow-up question"],
  "limitations": ["only if there is a real data limitation"]
}`;

    const userPrompt = `Question:
${question}

Conversation history:
${JSON.stringify(history)}

Database-backed cricket context:
${JSON.stringify(databaseContext)}

Fallback report context:
${JSON.stringify(compactReport)}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
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
    const rawText = data?.choices?.[0]?.message?.content;

    if (typeof rawText !== "string" || !rawText.trim()) {
      throw new Error("No chat answer was generated.");
    }

    const payload = normalizeModelResponse(rawText);

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("analytics-player-report-chat error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Player report chat failed.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
