import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/errors";
import { generateVoiceVariations } from "@/lib/elevenlabs";
import { cleanupExpiredArtifacts } from "@/lib/storage";
import { scriptSelectionSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    cleanupExpiredArtifacts().catch(() => undefined);

    const json = await request.json();
    const payload = scriptSelectionSchema.parse(json);
    const voices = await generateVoiceVariations(
      payload.scriptText,
      payload.tone,
      payload.language
    );

    return NextResponse.json({ voices });
  } catch (error) {
    return toErrorResponse(error, "Failed to generate voice previews.");
  }
}
