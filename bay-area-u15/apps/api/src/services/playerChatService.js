"use strict";

const { getPlayerChatContext } = require("./chatContextService");

function asRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asString(value, maxLength = 320) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 1)}…` : trimmed;
}

function asNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asBoolean(value) {
  return typeof value === "boolean" ? value : undefined;
}

function cleanObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null));
}

function takeMetrics(value, limit) {
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

function takeMatchEvidence(value, limit) {
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

function takePeerComparison(value, limit) {
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

function takeTrendValues(value, limit) {
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

function takeTrends(value, limit) {
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

function takeMatchupRows(value, limit) {
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

function takeCommentary(value, limit) {
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

function takeOverEvidence(value, limit) {
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

function takePhaseBucket(value) {
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

function takeDivisionOptions(value) {
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

function buildScopeNote(divisionOptions) {
  const divisionLabels = divisionOptions
    .map((item) => asString(item.divisionLabel, 80))
    .filter(Boolean);

  if (divisionLabels.length > 1) {
    return `This report combines player records across these phase/division rows: ${divisionLabels.join(", ")}. Do not describe an answer as phase-specific unless the evidence explicitly says so.`;
  }

  if (divisionLabels.length === 1) {
    return `Current report route is focused on ${divisionLabels[0]}. Do not infer additional phase/division scope beyond explicit evidence.`;
  }

  return "Phase/division coverage is not explicitly labeled in every evidence item. Do not claim phase-specific detail unless the evidence itself shows it.";
}

function buildCompactReport(report) {
  const meta = asRecord(report.meta) || {};
  const series = asRecord(meta.series) || {};
  const player = asRecord(meta.player) || {};
  const header = asRecord(report.header) || {};
  const scores = asRecord(report.scores) || {};
  const standardStats = asRecord(report.standardStats) || {};
  const reportPayload = asRecord(report.reportPayload) || {};
  const recommendationBadge = asRecord(reportPayload.recommendationBadge) || {};
  const drilldowns = asRecord(report.drilldowns) || {};
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

function normalizeHistory(value) {
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
    .filter(Boolean)
    .slice(-8);
}

function normalizeModelResponse(rawText) {
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
      .filter(Boolean)
      .slice(0, 4);

    const limitations = asArray(record.limitations)
      .map((item) => asString(item, 180))
      .filter(Boolean)
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

function resolveAiProviderConfig() {
  const openAiKey = asString(process.env.OPENAI_API_KEY, 400);
  if (openAiKey) {
    return {
      provider: "openai",
      apiKey: openAiKey,
      model: asString(process.env.OPENAI_MODEL, 120) || "gpt-4.1-mini",
    };
  }

  const lovableKey = asString(process.env.LOVABLE_API_KEY, 400);
  if (lovableKey) {
    return {
      provider: "lovable",
      apiKey: lovableKey,
      model: "google/gemini-2.5-flash",
    };
  }

  const error = new Error("No AI provider is configured. Set OPENAI_API_KEY or LOVABLE_API_KEY.");
  error.statusCode = 503;
  throw error;
}

async function requestChatCompletion(config, systemPrompt, userPrompt) {
  if (config.provider === "openai") {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    const body = await response.json().catch(async () => ({ errorText: await response.text().catch(() => "") }));
    const rawText = body?.choices?.[0]?.message?.content;
    const errorText = typeof body?.error?.message === "string"
      ? body.error.message
      : typeof body?.errorText === "string"
        ? body.errorText
        : "";

    return { response, rawText, errorText };
  }

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  const body = await response.json().catch(async () => ({ errorText: await response.text().catch(() => "") }));
  const rawText = body?.choices?.[0]?.message?.content;
  const errorText = typeof body?.error?.message === "string"
    ? body.error.message
    : typeof body?.errorText === "string"
      ? body.errorText
      : "";

  return { response, rawText, errorText };
}

async function answerPlayerReportChat(input) {
  const question = asString(input.question, 600);
  const reportFromRequest = asRecord(input.report);

  if (!question) {
    const error = new Error("A question is required.");
    error.statusCode = 400;
    throw error;
  }

  const aiConfig = resolveAiProviderConfig();
  const history = normalizeHistory(input.history);

  let databaseContext = null;
  let fallbackReport = reportFromRequest;

  try {
    const contextPayload = await getPlayerChatContext({
      seriesConfigKey: input.seriesConfigKey,
      playerId: input.playerId,
      divisionId: input.divisionId,
      question,
    });

    const contextRecord = asRecord(contextPayload);
    const contextReport = asRecord(contextRecord?.report);
    if (contextReport && !fallbackReport) {
      fallbackReport = contextReport;
    }

    if (contextRecord) {
      databaseContext = cleanObject({
        ...contextRecord,
        report: undefined,
      });
    }
  } catch (error) {
    if (!fallbackReport) {
      throw error;
    }
  }

  if (!databaseContext && !fallbackReport) {
    const error = new Error("Player report chat needs either report context or a resolvable player route.");
    error.statusCode = 400;
    throw error;
  }

  const compactReport = fallbackReport ? buildCompactReport(fallbackReport) : null;

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

  const { response, rawText, errorText } = await requestChatCompletion(aiConfig, systemPrompt, userPrompt);

  if (!response.ok) {
    if (response.status === 429) {
      const error = new Error("Rate limit exceeded. Please try again later.");
      error.statusCode = 429;
      throw error;
    }

    if (response.status === 402) {
      const error = new Error("AI credits exhausted. Please add credits to continue.");
      error.statusCode = 402;
      throw error;
    }

    const error = new Error(`${aiConfig.provider} AI error: ${response.status}${errorText ? ` - ${errorText}` : ""}`);
    error.statusCode = 502;
    throw error;
  }

  if (typeof rawText !== "string" || !rawText.trim()) {
    const error = new Error("No chat answer was generated.");
    error.statusCode = 502;
    throw error;
  }

  return normalizeModelResponse(rawText);
}

module.exports = {
  answerPlayerReportChat,
};
