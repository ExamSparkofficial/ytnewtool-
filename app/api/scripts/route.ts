import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/errors";
import { generateScripts } from "@/lib/openai";
import { cleanupExpiredArtifacts } from "@/lib/storage";
import { engineInputSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    cleanupExpiredArtifacts().catch(() => undefined);

    const json = await request.json();
    const payload = engineInputSchema.parse(json);
    const scripts = await generateScripts(
      payload.keyword,
      payload.tone,
      payload.duration,
      payload.language
    );

    return NextResponse.json({ scripts });
  } catch (error) {
    return toErrorResponse(error, "Failed to generate scripts.");
  }
}
