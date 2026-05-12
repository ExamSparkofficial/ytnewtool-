import { randomUUID } from "node:crypto";
import { rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { getOptionalEnv, getRequiredEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { writePublicBinary } from "@/lib/storage";
import type { ContentLanguage, Tone, VoiceVariation } from "@/lib/types";
import { getMediaDuration } from "@/lib/ffmpeg";

type VoiceProfile = {
  label: string;
  description: string;
  voiceName: string;
  instruction: string;
};

type GeminiTtsResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: {
          mimeType?: string;
          data?: string;
        };
      }>;
    };
  }>;
};

const languageDescriptions: Record<ContentLanguage, string> = {
  english: "Optimized for English delivery.",
  hindi: "Optimized for Hindi delivery.",
  hinglish: "Optimized for Hinglish delivery."
};

const languageInstructions: Record<ContentLanguage, string> = {
  english: "Speak in natural English.",
  hindi: "Speak in natural Hindi using a modern Indian cadence.",
  hinglish: "Speak in natural Hinglish with an Indian creator cadence."
};

const toneVoices: Record<Tone, VoiceProfile[]> = {
  motivational: [
    {
      label: "Bold Coach",
      description: "Confident and punchy Gemini TTS delivery for hype-driven shorts.",
      voiceName: "Kore",
      instruction: "Use a bold, energetic, coach-like delivery with strong emphasis."
    },
    {
      label: "Driven Narrator",
      description: "Smooth, polished energy for inspiring performance content.",
      voiceName: "Puck",
      instruction: "Use a bright, upbeat delivery with crisp pacing."
    },
    {
      label: "Fast Closer",
      description: "Sharper pacing for strong hooks and decisive CTAs.",
      voiceName: "Charon",
      instruction: "Use a direct, quick, high-conviction delivery."
    }
  ],
  finance: [
    {
      label: "Analyst",
      description: "Measured and credible Gemini TTS delivery for educational money content.",
      voiceName: "Charon",
      instruction: "Use a calm, trustworthy analyst tone with clear pacing."
    },
    {
      label: "Executive",
      description: "Authority-forward tone with calm confidence.",
      voiceName: "Kore",
      instruction: "Use a composed, confident executive delivery."
    },
    {
      label: "Explainer",
      description: "Clear pacing for market breakdowns and practical tips.",
      voiceName: "Puck",
      instruction: "Use a friendly explainer tone that is easy to follow."
    }
  ],
  storytelling: [
    {
      label: "Cinematic",
      description: "Warm, immersive narration with a dramatic touch.",
      voiceName: "Charon",
      instruction: "Use a warm cinematic narrator delivery with dramatic pauses."
    },
    {
      label: "Conversational",
      description: "Natural spoken cadence for casual story-led shorts.",
      voiceName: "Puck",
      instruction: "Use a conversational, natural creator voice."
    },
    {
      label: "Narrative Lift",
      description: "Balanced emotion for hooks, reveals, and satisfying endings.",
      voiceName: "Kore",
      instruction: "Use an emotionally balanced delivery with a satisfying lift at the end."
    }
  ]
};

function parseSampleRate(mimeType = "") {
  const match = mimeType.match(/rate=(\d+)/i);
  return match ? Number.parseInt(match[1], 10) : 24000;
}

function pcmToWav(pcmBuffer: Buffer, sampleRate: number) {
  const header = Buffer.alloc(44);
  const channels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcmBuffer.length, 40);

  return Buffer.concat([header, pcmBuffer]);
}

function extractAudioBuffer(payload: GeminiTtsResponse) {
  const inlineData = payload.candidates?.[0]?.content?.parts?.find((part) => part.inlineData)
    ?.inlineData;

  if (!inlineData?.data) {
    throw new AppError("Gemini TTS returned empty audio.", 502);
  }

  const audioBuffer = Buffer.from(inlineData.data, "base64");
  if (!audioBuffer.length) {
    throw new AppError("Gemini TTS returned empty audio.", 502);
  }

  if (inlineData.mimeType?.includes("audio/wav")) {
    return audioBuffer;
  }

  return pcmToWav(audioBuffer, parseSampleRate(inlineData.mimeType));
}

export async function generateVoiceVariations(
  scriptText: string,
  tone: Tone,
  language: ContentLanguage
) {
  const apiKey = getRequiredEnv("GEMINI_API_KEY");
  const model = getOptionalEnv("GEMINI_TTS_MODEL", "gemini-2.5-flash-preview-tts");
  const profiles = toneVoices[tone];

  const results = await Promise.allSettled(
    profiles.map(async (profile) => {
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
            contents: [
              {
                parts: [
                  {
                    text: `${profile.instruction} ${languageInstructions[language]} Speak only the script text, with no extra words.\n\nScript:\n${scriptText}`
                  }
                ]
              }
            ],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: profile.voiceName
                  }
                }
              }
            }
          })
        }
      );

      if (!response.ok) {
        const text = await response.text();
        throw new AppError(
          `Gemini TTS ${model} request failed (${response.status}): ${text.slice(0, 280)}`,
          502
        );
      }

      const payload = (await response.json()) as GeminiTtsResponse;
      const buffer = extractAudioBuffer(payload);
      const fileName = `${randomUUID()}.wav`;
      const tempAudioPath = path.join(os.tmpdir(), fileName);
      let durationSeconds = 0;

      try {
        await writeFile(tempAudioPath, buffer);
        durationSeconds = await getMediaDuration(tempAudioPath);
      } finally {
        await rm(tempAudioPath, { force: true });
      }

      const asset = await writePublicBinary("audio", fileName, buffer);

      return {
        id: randomUUID(),
        label: profile.label,
        description: `${profile.description} ${languageDescriptions[language]}`,
        voiceId: `gemini-tts:${model}:${profile.voiceName}`,
        assetKey: asset.assetKey,
        previewUrl: asset.publicUrl,
        durationSeconds
      } as VoiceVariation;
    })
  );

  const successful = results.flatMap((entry) =>
    entry.status === "fulfilled" ? [entry.value as VoiceVariation] : []
  );

  if (!successful.length) {
    const reasons = results
      .flatMap((entry) => {
        if (entry.status !== "rejected") {
          return [];
        }

        return [entry.reason instanceof Error ? entry.reason.message : "Unknown error"];
      })
      .join(" | ");

    throw new AppError(`Unable to generate Gemini TTS voice variations. ${reasons}`, 502);
  }

  return successful;
}
