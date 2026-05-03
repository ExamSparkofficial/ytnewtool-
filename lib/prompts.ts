import type { ContentLanguage, DurationOption, Tone } from "@/lib/types";

const toneGuides: Record<Tone, string> = {
  motivational:
    "Use energetic, uplifting language that feels empowering, concise, and confidence-building.",
  finance:
    "Use clear, practical, credible language with smart takeaways and no unrealistic promises.",
  storytelling:
    "Use vivid, cinematic language with a narrative arc, emotional pacing, and a memorable payoff."
};

const languageGuides: Record<ContentLanguage, string> = {
  english:
    "Write fully in natural English. Keep the phrasing conversational and platform-native.",
  hindi:
    "Write fully in natural Hindi using Devanagari script. Keep the spoken rhythm crisp and modern.",
  hinglish:
    "Write in natural Hinglish using Roman script, mixing Hindi and English the way Indian creators speak in short videos."
};

function getLanguageInstruction(language: ContentLanguage) {
  return languageGuides[language];
}

export function getScriptPrompt(
  keyword: string,
  tone: Tone,
  duration: DurationOption,
  language: ContentLanguage
) {
  const targetWords = duration === 30 ? "70-90 words" : "130-160 words";

  return `
Generate 3 distinct short-form video scripts about "${keyword}".

Tone guidance:
${toneGuides[tone]}

Language guidance:
${getLanguageInstruction(language)}

Requirements:
- Each script must be optimized for a ${duration}-second vertical short.
- Keep each total narration around ${targetWords}.
- Make each concept clearly different in angle and framing.
- The hook must be strong enough for the first 3 seconds.
- The body should be compact and spoken naturally.
- The CTA should feel platform-native and not repetitive.
- Every field in the output must stay in ${language}.
- Avoid markdown, quotation marks, and emoji unless directly relevant.
  `.trim();
}

export function getMetadataPrompt(
  keyword: string,
  tone: Tone,
  duration: DurationOption,
  language: ContentLanguage,
  scriptText: string
) {
  return `
Generate SEO-friendly metadata for a short-form video.

Topic: ${keyword}
Tone: ${tone}
Duration: ${duration} seconds
Language: ${language}

Script:
${scriptText}

Requirements:
- Produce 3 compelling titles under 70 characters each.
- Write 1 platform-ready description between 2 and 4 sentences.
- Return tags as a single comma-separated line with no hash symbols.
- Return hashtags as a single space-separated line with leading # symbols.
- Keep all metadata in ${language}.
- Follow this language instruction exactly: ${getLanguageInstruction(language)}
- Keep it optimized for discoverability without sounding spammy.
  `.trim();
}
