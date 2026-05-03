import { randomUUID } from "node:crypto";

import { getRequiredEnv, getOptionalEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { ensureOk, readJson } from "@/lib/http";
import { getMetadataPrompt, getScriptPrompt } from "@/lib/prompts";
import type {
  ContentLanguage,
  DurationOption,
  GeneratedMetadata,
  GeneratedScript,
  Tone
} from "@/lib/types";
import { stripMarkdown } from "@/lib/utils";

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
      refusal?: string | null;
    };
  }>;
}

async function createStructuredCompletion<T>(params: {
  schemaName: string;
  schema: Record<string, unknown>;
  system: string;
  user: string;
}) {
  // Keep the OpenAI integration centralized so every route gets the same
  // structured-output handling and error surface.
  const apiKey = getRequiredEnv("OPENAI_API_KEY");
  const model = getOptionalEnv("OPENAI_MODEL", "gpt-4o-mini");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.9,
      messages: [
        {
          role: "system",
          content: params.system
        },
        {
          role: "user",
          content: params.user
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: params.schemaName,
          strict: true,
          schema: params.schema
        }
      }
    })
  });

  await ensureOk(response, "OpenAI");
  const payload = await readJson<ChatCompletionResponse>(response);
  const message = payload.choices?.[0]?.message;

  if (!message?.content) {
    if (message?.refusal) {
      throw new AppError(`OpenAI refused the request: ${message.refusal}`, 400);
    }

    throw new AppError("OpenAI returned an empty response.", 502);
  }

  return JSON.parse(message.content) as T;
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
