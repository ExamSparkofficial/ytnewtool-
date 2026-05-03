import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import { NextResponse } from "next/server";

import {
  concatClips,
  createPlaceholderClip,
  getMediaDuration,
  muxVideoWithAudioAndSubtitles,
  normalizeClip,
  runtimePath,
  writeBinaryFile
} from "@/lib/ffmpeg";
import { toErrorResponse } from "@/lib/errors";
import { downloadBinaryFile, searchPexelsClips } from "@/lib/pexels";
import { createSrtFromText } from "@/lib/subtitles";
import {
  cleanupExpiredArtifacts,
  createRuntimeJobDir,
  materializeAssetReference,
  writePublicBinary
} from "@/lib/storage";
import type { GeneratedVideo, VideoCredit } from "@/lib/types";
import { videoRenderSchema } from "@/lib/validators";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    cleanupExpiredArtifacts().catch(() => undefined);

    const json = await request.json();
    const payload = videoRenderSchema.parse(json);

    const jobId = randomUUID();
    const jobDir = await createRuntimeJobDir(jobId);
    const audioPath = await materializeAssetReference(
      payload.audioAssetKey,
      runtimePath(jobDir, "voice-track.mp3")
    );
    const audioDuration = await getMediaDuration(audioPath);
    const targetDuration = Math.max(audioDuration, payload.duration);

    const clipCount = payload.duration === 60 ? 3 : 2;
    const pexelsClips = await searchPexelsClips(payload.keyword, clipCount);
    const workingSegments: string[] = [];
    const credits: VideoCredit[] = [];

    // Prefer stock footage when available, but keep the pipeline resilient by
    // falling back to abstract visuals if the upstream media lookup fails.
    if (pexelsClips.length) {
      const perClipDuration = targetDuration / pexelsClips.length;

      for (const [index, clip] of pexelsClips.entries()) {
        const sourcePath = runtimePath(jobDir, `source-${index + 1}.mp4`);
        const segmentPath = runtimePath(jobDir, `segment-${index + 1}.mp4`);
        const sourceBuffer = await downloadBinaryFile(clip.videoUrl);

        await writeBinaryFile(sourcePath, sourceBuffer);
        const usableOffset = Math.max((clip.duration - perClipDuration) / 2, 0);

        await normalizeClip({
          inputPath: sourcePath,
          outputPath: segmentPath,
          clipDuration: perClipDuration,
          startOffsetSeconds: usableOffset
        });

        workingSegments.push(segmentPath);
        credits.push({
          name: clip.userName,
          url: clip.userUrl
        });
      }
    }

    if (!workingSegments.length) {
      const placeholderPath = runtimePath(jobDir, "placeholder.mp4");
      await createPlaceholderClip(placeholderPath, targetDuration);
      workingSegments.push(placeholderPath);
    }

    const baseVideoPath = runtimePath(jobDir, "base.mp4");

    if (workingSegments.length === 1) {
      await normalizeClip({
        inputPath: workingSegments[0],
        outputPath: baseVideoPath,
        clipDuration: targetDuration
      });
    } else {
      const concatListPath = runtimePath(jobDir, "concat.txt");
      await concatClips(workingSegments, concatListPath, baseVideoPath);
    }

    const subtitlesPath = runtimePath(jobDir, "captions.srt");
    const subtitleContent = createSrtFromText(payload.scriptText, targetDuration);
    await writeBinaryFile(subtitlesPath, Buffer.from(subtitleContent, "utf8"));

    // Burn subtitles into the final export so the resulting MP4 is immediately
    // usable on short-form platforms without another post-processing step.
    const finalVideoPath = runtimePath(jobDir, "render.mp4");
    await muxVideoWithAudioAndSubtitles({
      baseVideoPath,
      audioPath,
      subtitlePath: subtitlesPath,
      outputPath: finalVideoPath
    });

    const outputBuffer = await readFile(finalVideoPath);
    const savedVideo = await writePublicBinary("video", `${jobId}.mp4`, outputBuffer);

    const result: GeneratedVideo = {
      assetKey: savedVideo.assetKey,
      videoUrl: savedVideo.publicUrl,
      durationSeconds: await getMediaDuration(finalVideoPath),
      usedFallbackVisuals: !pexelsClips.length,
      credits
    };

    return NextResponse.json({ video: result });
  } catch (error) {
    return toErrorResponse(error, "Failed to render video.");
  }
}
