import { execFile } from "node:child_process";
import { access, chmod, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";

import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";

import { getOptionalEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";

const execFileAsync = promisify(execFile);

async function ensureExecutable(command: string) {
  if (process.platform === "win32" || !path.isAbsolute(command)) {
    return;
  }

  await chmod(command, 0o755).catch(() => undefined);
}

async function pathExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isWindowsBinaryOnNonWindows(filePath: string) {
  return process.platform !== "win32" && filePath.toLowerCase().endsWith(".exe");
}

async function resolveBinaryPath(
  configuredPath: string | undefined,
  fallbackPaths: Array<string | null | undefined>,
  commandName: string
) {
  if (configuredPath) {
    const resolvedPath = path.isAbsolute(configuredPath)
      ? configuredPath
      : path.join(process.cwd(), configuredPath);

    if (!isWindowsBinaryOnNonWindows(resolvedPath) && (await pathExists(resolvedPath))) {
      return resolvedPath;
    }
  }

  for (const fallbackPath of fallbackPaths) {
    if (
      fallbackPath &&
      !isWindowsBinaryOnNonWindows(fallbackPath) &&
      (await pathExists(fallbackPath))
    ) {
      return fallbackPath;
    }
  }

  return commandName;
}

async function runBinary(command: string | Promise<string>, args: string[]) {
  try {
    const resolvedCommand = await command;
    await ensureExecutable(resolvedCommand);
    await execFileAsync(resolvedCommand, args, {
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 10
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new AppError(error.message, 500);
    }

    throw new AppError("Media processor failed to run.", 500);
  }
}

export function getFfmpegPath() {
  const configured = getOptionalEnv("FFMPEG_PATH");
  const installerPlatform = `${process.platform}-${process.arch}`;
  const installerBinary = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  const installerPath = path.join(
    process.cwd(),
    "node_modules",
    "@ffmpeg-installer",
    installerPlatform,
    installerBinary
  );

  return resolveBinaryPath(
    configured || undefined,
    [ffmpegStatic, installerPath],
    "ffmpeg"
  );
}

export function getFfprobePath() {
  const configured = getOptionalEnv("FFPROBE_PATH");
  return resolveBinaryPath(configured || undefined, [ffprobeStatic.path], "ffprobe");
}

export async function getMediaDuration(filePath: string) {
  const { stdout } = await execFileAsync(
    await getFfprobePath(),
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath
    ],
    {
      windowsHide: true
    }
  );

  const duration = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(duration)) {
    throw new AppError("Unable to read media duration with ffprobe.", 500);
  }

  return duration;
}

export async function writeBinaryFile(targetPath: string, buffer: Buffer) {
  await writeFile(targetPath, buffer);
}

export async function normalizeClip(params: {
  inputPath: string;
  outputPath: string;
  clipDuration: number;
  startOffsetSeconds?: number;
}) {
  const startOffset = params.startOffsetSeconds ?? 0;

  await runBinary(getFfmpegPath(), [
    "-y",
    "-ss",
    startOffset.toFixed(2),
    "-t",
    params.clipDuration.toFixed(2),
    "-i",
    params.inputPath,
    "-vf",
    "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30",
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-pix_fmt",
    "yuv420p",
    params.outputPath
  ]);
}

export async function createPlaceholderClip(outputPath: string, durationSeconds: number) {
  await runBinary(getFfmpegPath(), [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=0x0f172a:s=1080x1920:d=${durationSeconds.toFixed(2)}`,
    "-vf",
    "drawbox=x=80:y=180:w=920:h=1560:color=0x38bdf8@0.12:t=fill,drawbox=x=120:y=220:w=840:h=1480:color=0xf59e0b@0.08:t=fill,noise=alls=10:allf=t",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-pix_fmt",
    "yuv420p",
    outputPath
  ]);
}

export async function concatClips(inputPaths: string[], concatListPath: string, outputPath: string) {
  const fileList = inputPaths
    .map((clipPath) => `file '${clipPath.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`)
    .join("\n");

  await writeFile(concatListPath, fileList, "utf8");

  await runBinary(getFfmpegPath(), [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    concatListPath,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-pix_fmt",
    "yuv420p",
    "-an",
    outputPath
  ]);
}

function escapeSubtitlePath(filePath: string) {
  return filePath.replace(/\\/g, "/").replace(/:/g, "\\:");
}

export async function muxVideoWithAudioAndSubtitles(params: {
  baseVideoPath: string;
  audioPath: string;
  subtitlePath: string;
  outputPath: string;
  durationSeconds: number;
}) {
  const subtitleFilter = `subtitles='${escapeSubtitlePath(
    params.subtitlePath
  )}':force_style='FontName=Arial,FontSize=20,PrimaryColour=&H00FFFFFF,OutlineColour=&H00301709,BorderStyle=1,Outline=3,Shadow=0,MarginV=120,Alignment=2'`;

  const baseArgs = [
    "-y",
    "-i",
    params.baseVideoPath,
    "-i",
    params.audioPath,
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-af",
    "apad",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-t",
    params.durationSeconds.toFixed(2),
    "-movflags",
    "+faststart",
    "-pix_fmt",
    "yuv420p"
  ];

  try {
    await runBinary(getFfmpegPath(), [
      ...baseArgs.slice(0, 5),
      "-vf",
      subtitleFilter,
      ...baseArgs.slice(5),
      params.outputPath
    ]);
  } catch {
    await runBinary(getFfmpegPath(), [...baseArgs, params.outputPath]);
  }
}

export function runtimePath(jobDir: string, fileName: string) {
  return path.join(jobDir, fileName);
}
