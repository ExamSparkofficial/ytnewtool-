import { randomUUID } from "node:crypto";

import { getRequiredEnv, getOptionalEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { ensureOk } from "@/lib/http";
import { writePublicBinary } from "@/lib/storage";
import type { ContentLanguage, Tone, VoiceVariation } from "@/lib/types";
import { getMediaDuration } from "@/lib/ffmpeg";

type VoiceProfile = {
  label: string;
  description: string;
  voiceId: string;
  settings: {
    stability: number;
    similarity_boost: number;
    style: number;
    speed: number;
    use_speaker_boost: boolean;
  };
};

const languageDescriptions: Record<ContentLanguage, string> = {
  english: "Optimized for English delivery.",
  hindi: "Optimized for Hindi delivery.",
  hinglish: "Optimized for Hinglish delivery."
};

const toneVoices: Record<Tone, VoiceProfile[]> = {
  motivational: [
    {
      label: "Bold Coach",
      description: "Confident and punchy delivery for hype-driven shorts.",
      voiceId: "JBFqnCBsd6RMkjVDRZzb",
      settings: {
        stability: 0.35,
        similarity_boost: 0.8,
        style: 0.45,
        speed: 1.05,
        use_speaker_boost: true
      }
    },
    {
      label: "Driven Narrator",
      description: "Smooth, polished energy for inspiring performance content.",
      voiceId: "EXAVITQu4vr4xnSDxMaL",
      settings: {
        stability: 0.42,
        similarity_boost: 0.74,
        style: 0.35,
        speed: 1.02,
        use_speaker_boost: true
      }
    },
    {
      label: "Fast Closer",
      description: "Sharper pacing for strong hooks and decisive CTAs.",
      voiceId: "TxGEqnHWrfWFTfGW9XjX",
      settings: {
        stability: 0.38,
        similarity_boost: 0.7,
        style: 0.32,
        speed: 1.08,
        use_speaker_boost: true
      }
    }
  ],
  finance: [
    {
      label: "Analyst",
      description: "Measured and credible for educational money content.",
      voiceId: "21m00Tcm4TlvDq8ikWAM",
      settings: {
        stability: 0.58,
        similarity_boost: 0.82,
        style: 0.16,
        speed: 0.98,
        use_speaker_boost: true
      }
    },
    {
      label: "Executive",
      description: "Authority-forward tone with calm confidence.",
      voiceId: "IKne3meq5aSn9XLyUdCD",
      settings: {
        stability: 0.62,
        similarity_boost: 0.8,
        style: 0.18,
        speed: 0.96,
        use_speaker_boost: true
      }
    },
    {
      label: "Explainer",
      description: "Clear pacing for market breakdowns and tips.",
      voiceId: "pNInz6obpgDQGcFmaJgB",
      settings: {
        stability: 0.55,
        similarity_boost: 0.76,
        style: 0.12,
        speed: 1,
        use_speaker_boost: true
      }
    }
  ],
  storytelling: [
    {
      label: "Cinematic",
      description: "Warm, immersive narration with a dramatic touch.",
      voiceId: "cgSgspJ2msm6clMCkdW9",
      settings: {
        stability: 0.44,
        similarity_boost: 0.8,
        style: 0.4,
        speed: 0.97,
        use_speaker_boost: true
      }
    },
    {
      label: "Conversational",
      description: "Natural spoken cadence for casual story-led shorts.",
      voiceId: "XB0fDUnXU5powFXDhCwa",
      settings: {
        stability: 0.4,
        similarity_boost: 0.74,
        style: 0.26,
        speed: 1,
        use_speaker_boost: true
      }
    },
    {
      label: "Narrative Lift",
      description: "Balanced emotion for hooks, reveals, and satisfying endings.",
      voiceId: "XrExE9yKIg1WjnnlVkGX",
      settings: {
        stability: 0.36,
        similarity_boost: 0.73,
        style: 0.46,
        speed: 0.99,
        use_speaker_boost: true
      }
    }
  ]
};

export async function generateVoiceVariations(
  scriptText: string,
  tone: Tone,
  language: ContentLanguage
) {
  const apiKey = getRequiredEnv("ELEVENLABS_API_KEY");
  const modelId = getOptionalEnv("ELEVENLABS_MODEL", "eleven_multilingual_v2");
  const profiles = toneVoices[tone];

  const results = await Promise.allSettled(
    profiles.map(async (profile) => {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${profile.voiceId}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": apiKey
          },
          body: JSON.stringify({
            text: scriptText,
            model_id: modelId,
            voice_settings: profile.settings
          })
        }
      );

      await ensureOk(response, "ElevenLabs");

      const buffer = Buffer.from(await response.arrayBuffer());
      if (!buffer.length) {
        throw new AppError("ElevenLabs returned empty audio.", 502);
      }

      const fileName = `${randomUUID()}.mp3`;
      const asset = await writePublicBinary("audio", fileName, buffer);
      const durationSeconds = await getMediaDuration(asset.absolutePath);

      return {
        id: randomUUID(),
        label: profile.label,
        description: `${profile.description} ${languageDescriptions[language]}`,
        voiceId: profile.voiceId,
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

    throw new AppError(`Unable to generate voice variations. ${reasons}`, 502);
  }

  return successful;
}
