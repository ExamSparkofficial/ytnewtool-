import { z } from "zod";

import { contentLanguages, durations, tones } from "@/lib/types";

export const engineInputSchema = z.object({
  keyword: z
    .string()
    .trim()
    .min(2, "Keyword must be at least 2 characters.")
    .max(120, "Keyword must be 120 characters or fewer."),
  tone: z.enum(tones),
  duration: z.union([z.literal(durations[0]), z.literal(durations[1])]),
  language: z.enum(contentLanguages)
});

export const scriptSelectionSchema = z.object({
  scriptText: z
    .string()
    .trim()
    .min(20, "A generated script is required.")
    .max(2500, "Script text is too long for this workflow."),
  tone: z.enum(tones),
  language: z.enum(contentLanguages)
});

export const metadataSchema = engineInputSchema.extend({
  scriptText: z
    .string()
    .trim()
    .min(20, "A generated script is required.")
    .max(2500, "Script text is too long for metadata generation.")
});

export const videoRenderSchema = engineInputSchema.extend({
  scriptText: z
    .string()
    .trim()
    .min(20, "A generated script is required.")
    .max(2500, "Script text is too long for rendering."),
  audioAssetKey: z
    .string()
    .trim()
    .min(5, "A generated voice track is required.")
    .max(255, "Audio asset reference is invalid.")
});
