const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | Array<Record<string, unknown>>;
};

type ChatCompletionRequest = {
  messages: ChatMessage[];
  responseFormat?: Record<string, unknown>;
  temperature?: number;
  maxCompletionTokens?: number;
};

type HttpError = Error & { statusCode?: number };

function createHttpError(statusCode: number, message: string): HttpError {
  const error = new Error(message) as HttpError;
  error.statusCode = statusCode;
  return error;
}

function readErrorMessage(body: any): string {
  if (typeof body?.error?.message === "string" && body.error.message.trim()) {
    return body.error.message.trim();
  }

  if (typeof body?.message === "string" && body.message.trim()) {
    return body.message.trim();
  }

  if (typeof body?.errorText === "string" && body.errorText.trim()) {
    return body.errorText.trim();
  }

  return "";
}

async function parseResponseBody(response: Response) {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { errorText: text };
  }
}

export function getOpenAiConfig() {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    throw createHttpError(500, "OPENAI_API_KEY is not configured");
  }

  return {
    apiKey,
    model: Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini",
  };
}

export async function requestChatCompletion({
  messages,
  responseFormat,
  temperature = 0.2,
  maxCompletionTokens,
}: ChatCompletionRequest) {
  const { apiKey, model } = getOpenAiConfig();

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature,
      max_completion_tokens: maxCompletionTokens,
      messages,
      ...(responseFormat ? { response_format: responseFormat } : {}),
    }),
  });

  const body = await parseResponseBody(response);

  if (!response.ok) {
    const rawMessage = readErrorMessage(body);
    const lowerMessage = rawMessage.toLowerCase();

    if (response.status === 429) {
      const statusCode = lowerMessage.includes("quota") || lowerMessage.includes("billing")
        ? 402
        : 429;
      const message = statusCode === 402
        ? "OpenAI credits exhausted."
        : "Rate limit exceeded. Please try again later.";
      throw createHttpError(statusCode, message);
    }

    if (response.status === 401 || response.status === 403) {
      throw createHttpError(500, "OpenAI API key is invalid or not authorized.");
    }

    throw createHttpError(response.status, rawMessage || `OpenAI API error: ${response.status}`);
  }

  return body;
}

export async function requestStructuredObject<T>({
  name,
  schema,
  messages,
  temperature = 0.2,
  maxCompletionTokens,
}: {
  name: string;
  schema: Record<string, unknown>;
  messages: ChatMessage[];
  temperature?: number;
  maxCompletionTokens?: number;
}): Promise<T> {
  const body = await requestChatCompletion({
    messages,
    temperature,
    maxCompletionTokens,
    responseFormat: {
      type: "json_schema",
      json_schema: {
        name,
        strict: true,
        schema,
      },
    },
  });

  const message = body?.choices?.[0]?.message;
  if (typeof message?.refusal === "string" && message.refusal.trim()) {
    throw createHttpError(422, message.refusal.trim());
  }

  const content = message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw createHttpError(502, "No structured response generated");
  }

  return JSON.parse(content) as T;
}

export async function requestTextCompletion({
  messages,
  temperature = 0.4,
  maxCompletionTokens = 220,
}: {
  messages: ChatMessage[];
  temperature?: number;
  maxCompletionTokens?: number;
}) {
  const body = await requestChatCompletion({
    messages,
    temperature,
    maxCompletionTokens,
  });

  const message = body?.choices?.[0]?.message;
  if (typeof message?.refusal === "string" && message.refusal.trim()) {
    throw createHttpError(422, message.refusal.trim());
  }

  const content = message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw createHttpError(502, "No text response generated");
  }

  return content.trim();
}

export function errorStatus(error: unknown, fallback = 500) {
  if (typeof error === "object" && error && "statusCode" in error) {
    const statusCode = Number((error as { statusCode?: number }).statusCode);
    if (Number.isFinite(statusCode) && statusCode > 0) {
      return statusCode;
    }
  }

  return fallback;
}
