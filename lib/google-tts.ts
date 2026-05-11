import { randomUUID } from "node:crypto";
import { rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { getGoogleCloudAccessToken } from "@/lib/google-auth";
import { AppError } from "@/lib/errors";
import { ensureOk, readJson } from "@/lib/http";
import { writePublicBinary } from "@/lib/storage";
import type { ContentLanguage, Tone, VoiceVariation } from "@/lib/types";
import { getMediaDuration } from "@/lib/ffmpeg";

type SsmlGender = "MALE" | "FEMALE";

type VoiceProfile = {
  label: string;
  description: string;
  gender: SsmlGender;
  speakingRate: number;
  pitch: number;
};

type TtsResponse = {
  audioContent?: string;
};

const languageDescriptions: Record<ContentLanguage, string> = {
  english: "Optimized for English delivery.",
  hindi: "Optimized for Hindi delivery.",
  hinglish: "Optimized for Hinglish delivery."
};

const languageCodes: Record<ContentLanguage, string> = {
  english: "en-US",
  hindi: "hi-IN",
  hinglish: "en-IN"
};

const toneVoices: Record<Tone, VoiceProfile[]> = {
  motivational: [
    {
      label: "Bold Coach",
      description: "Confident and punchy Google TTS delivery for hype-driven shorts.",
      gender: "MALE",
      speakingRate: 1.08,
      pitch: 1.5
    },
    {
      label: "Driven Narrator",
      description: "Smooth, polished energy for inspiring performance content.",
      gender: "FEMALE",
      speakingRate: 1.04,
      pitch: 0.5
    },
    {
      label: "Fast Closer",
      description: "Sharper pacing for strong hooks and decisive CTAs.",
      gender: "MALE",
      speakingRate: 1.15,
      pitch: 2
    }
  ],
  finance: [
    {
      label: "Analyst",
      description: "Measured and credible Google TTS delivery for educational money content.",
      gender: "MALE",
      speakingRate: 0.98,
      pitch: -1
    },
    {
      label: "Executive",
      description: "Authority-forward tone with calm confidence.",
      gender: "FEMALE",
      speakingRate: 0.96,
      pitch: -0.5
    },
    {
      label: "Explainer",
      description: "Clear pacing for market breakdowns and practical tips.",
      gender: "MALE",
      speakingRate: 1,
      pitch: 0
    }
  ],
  storytelling: [
    {
      label: "Cinematic",
      description: "Warm, immersive narration with a dramatic touch.",
      gender: "MALE",
      speakingRate: 0.94,
      pitch: -1.5
    },
    {
      label: "Conversational",
      description: "Natural spoken cadence for casual story-led shorts.",
      gender: "FEMALE",
      speakingRate: 1,
      pitch: 0
    },
    {
      label: "Narrative Lift",
      description: "Balanced emotion for hooks, reveals, and satisfying endings.",
      gender: "FEMALE",
      speakingRate: 0.98,
      pitch: 1
    }
  ]
};

async function getTtsHeaders() {
  const apiKey =
    process.env.GOOGLE_TTS_API_KEY ?? process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;

  if (apiKey) {
    return {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    };
  }

  const accessToken = await getGoogleCloudAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`
  };
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID ?? process.env.GOOGLE_CLOUD_PROJECT;

  if (projectId) {
    headers["x-goog-user-project"] = projectId;
  }

  return headers;
}

export async function generateVoiceVariations(
  scriptText: string,
  tone: Tone,
  language: ContentLanguage
) {
  const profiles = toneVoices[tone];
  const languageCode = languageCodes[language];
  const headers = await getTtsHeaders();

  const results = await Promise.allSettled(
    profiles.map(async (profile) => {
      const response = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
        method: "POST",
        headers,
        body: JSON.stringify({
          input: {
            text: scriptText
          },
          voice: {
            languageCode,
            ssmlGender: profile.gender
          },
          audioConfig: {
            audioEncoding: "MP3",
            speakingRate: profile.speakingRate,
            pitch: profile.pitch
          }
        })
      });

      await ensureOk(response, "Google Text-to-Speech");

      const payload = await readJson<TtsResponse>(response);
      if (!payload.audioContent) {
        throw new AppError("Google Text-to-Speech returned empty audio.", 502);
      }

      const buffer = Buffer.from(payload.audioContent, "base64");
      if (!buffer.length) {
        throw new AppError("Google Text-to-Speech returned empty audio.", 502);
      }

      const fileName = `${randomUUID()}.mp3`;
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
        voiceId: `google-tts:${languageCode}:${profile.gender}:${profile.speakingRate}:${profile.pitch}`,
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

    throw new AppError(`Unable to generate Google TTS voice variations. ${reasons}`, 502);
  }

  return successful;
}
