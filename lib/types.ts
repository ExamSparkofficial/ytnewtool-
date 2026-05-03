export const tones = ["motivational", "finance", "storytelling"] as const;
export const durations = [30, 60] as const;
export const contentLanguages = ["english", "hindi", "hinglish"] as const;

export type Tone = (typeof tones)[number];
export type DurationOption = (typeof durations)[number];
export type ContentLanguage = (typeof contentLanguages)[number];

export const languageLabels: Record<ContentLanguage, string> = {
  english: "English",
  hindi: "Hindi",
  hinglish: "Hinglish"
};

export interface EngineInput {
  keyword: string;
  tone: Tone;
  duration: DurationOption;
  language: ContentLanguage;
}

export interface GeneratedScript {
  id: string;
  title: string;
  hook: string;
  body: string;
  cta: string;
  narrationText: string;
}

export interface VoiceVariation {
  id: string;
  label: string;
  description: string;
  voiceId: string;
  assetKey: string;
  previewUrl: string;
  durationSeconds: number;
}

export interface GeneratedMetadata {
  titles: string[];
  description: string;
  tags: string;
  hashtags: string;
}

export interface VideoCredit {
  name: string;
  url: string;
}

export interface GeneratedVideo {
  assetKey: string;
  videoUrl: string;
  durationSeconds: number;
  usedFallbackVisuals: boolean;
  credits: VideoCredit[];
}
