import { randomUUID } from "node:crypto";

import { getRequiredEnv, getOptionalEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { readJson } from "@/lib/http";
import { getMetadataPrompt, getScriptPrompt } from "@/lib/prompts";
import type {
  ContentLanguage,
  DurationOption,
  GeneratedMetadata,
  GeneratedScript,
  Tone
} from "@/lib/types";
import { stripMarkdown } from "@/lib/utils";

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    finishReason?: string;
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  promptFeedback?: {
    blockReason?: string;
  };
}

const defaultGeminiModel = "gemini-2.5-flash";

function resolveGeminiModel() {
  const configuredModel = getOptionalEnv("GEMINI_MODEL", defaultGeminiModel).trim();

  if (!configuredModel || configuredModel.startsWith("gemini-1.5")) {
    return defaultGeminiModel;
  }

  return configuredModel;
}

async function createStructuredCompletion<T>(params: {
  schemaName: string;
  schema: Record<string, unknown>;
  system: string;
  user: string;
}) {
  const apiKey = getRequiredEnv("GEMINI_API_KEY");
  const model = resolveGeminiModel();

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: params.system }]
        },
        contents: [
          {
            role: "user",
            parts: [{ text: params.user }]
          }
        ],
        generationConfig: {
          temperature: 0.9,
          responseMimeType: "application/json",
          responseJsonSchema: params.schema
        }
      })
    }
  );

  if (!response.ok) {
    const text = await response.text();
    const hint =
      response.status === 403
        ? " Check that the Generative Language API is enabled for the Google Cloud project, your API key is unrestricted or allows generativelanguage.googleapis.com, and Vercel is redeployed with GEMINI_MODEL=gemini-2.5-flash or no GEMINI_MODEL override."
        : "";

    throw new AppError(
      `Gemini ${model} request failed (${response.status}): ${text.slice(0, 280)}${hint}`,
      502
    );
  }

  const payload = await readJson<GeminiGenerateContentResponse>(response);
  const candidate = payload.candidates?.[0];
  const text = candidate?.content?.parts?.map((part) => part.text ?? "").join("").trim();

  if (!text) {
    const reason = payload.promptFeedback?.blockReason ?? candidate?.finishReason ?? "empty response";
    throw new AppError(`Gemini returned no JSON output: ${reason}.`, 502);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new AppError(`Gemini returned invalid JSON: ${text.slice(0, 200)}`, 502);
  }
}

export async function generateScripts(
  keyword: string,
  tone: Tone,
  duration: DurationOption,
  language: ContentLanguage
) {
  const result = await createStructuredCompletion<{
    scripts: Array<{
      title: string;
      hook: string;
      body: string;
      cta: string;
    }>;
  }>({
    schemaName: "video_scripts",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        scripts: {
          type: "array",
          minItems: 3,
          maxItems: 3,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              hook: { type: "string" },
              body: { type: "string" },
              cta: { type: "string" }
            },
            required: ["title", "hook", "body", "cta"]
          }
        }
      },
      required: ["scripts"]
    },
    system:
      "You are an expert short-form video scriptwriter. Return only valid JSON matching the requested schema.",
    user: getScriptPrompt(keyword, tone, duration, language)
  });

  return result.scripts.map<GeneratedScript>((script) => {
    const hook = stripMarkdown(script.hook);
    const body = stripMarkdown(script.body);
    const cta = stripMarkdown(script.cta);

    return {
      id: randomUUID(),
      title: stripMarkdown(script.title),
      hook,
      body,
      cta,
      narrationText: `${hook} ${body} ${cta}`.replace(/\s+/g, " ").trim()
    };
  });
}

export async function generateMetadata(
  keyword: string,
  tone: Tone,
  duration: DurationOption,
  language: ContentLanguage,
  scriptText: string
) {
  const result = await createStructuredCompletion<GeneratedMetadata>({
    schemaName: "video_metadata",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        titles: {
          type: "array",
          minItems: 3,
          maxItems: 3,
          items: { type: "string" }
        },
        description: { type: "string" },
        tags: { type: "string" },
        hashtags: { type: "string" }
      },
      required: ["titles", "description", "tags", "hashtags"]
    },
    system:
      "You are a growth strategist for short-form video channels. Return only valid JSON matching the requested schema.",
    user: getMetadataPrompt(keyword, tone, duration, language, scriptText)
  });

  return {
    titles: result.titles.map(stripMarkdown),
    description: stripMarkdown(result.description),
    tags: stripMarkdown(result.tags),
    hashtags: stripMarkdown(result.hashtags)
  };
}
