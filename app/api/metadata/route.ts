import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/errors";
import { generateMetadata } from "@/lib/openai";
import { metadataSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const payload = metadataSchema.parse(json);
    const metadata = await generateMetadata(
      payload.keyword,
      payload.tone,
      payload.duration,
      payload.language,
      payload.scriptText
    );

    return NextResponse.json({ metadata });
  } catch (error) {
    return toErrorResponse(error, "Failed to generate metadata.");
  }
}
