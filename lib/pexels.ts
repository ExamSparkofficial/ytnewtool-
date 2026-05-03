import { AppError } from "@/lib/errors";
import { ensureOk, readJson } from "@/lib/http";

export interface PexelsClip {
  id: number;
  duration: number;
  width: number;
  height: number;
  userName: string;
  userUrl: string;
  videoUrl: string;
}

interface PexelsSearchResponse {
  videos?: Array<{
    id: number;
    duration: number;
    width: number;
    height: number;
    user?: {
      name?: string;
      url?: string;
    };
    video_files?: Array<{
      link?: string;
      width?: number;
      height?: number;
      quality?: string;
      file_type?: string;
    }>;
  }>;
}

function pickBestFile(
  files: NonNullable<PexelsSearchResponse["videos"]>[number]["video_files"] = []
) {
  return [...files]
    .filter((file) => file.link && file.file_type === "video/mp4")
    .sort((a, b) => {
      const scoreA = Math.abs((a.height ?? 0) - 1920) + Math.abs((a.width ?? 0) - 1080);
      const scoreB = Math.abs((b.height ?? 0) - 1920) + Math.abs((b.width ?? 0) - 1080);
      return scoreA - scoreB;
    })[0];
}

export async function searchPexelsClips(keyword: string, clipCount: number) {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    return [];
  }

  try {
    const response = await fetch(
      `https://api.pexels.com/v1/videos/search?query=${encodeURIComponent(
        keyword
      )}&orientation=portrait&per_page=${Math.max(clipCount * 2, 6)}`,
      {
        headers: {
          Authorization: apiKey
        },
        cache: "no-store"
      }
    );

    await ensureOk(response, "Pexels");
    const payload = await readJson<PexelsSearchResponse>(response);

    return (payload.videos ?? [])
      .map((video) => {
        const file = pickBestFile(video.video_files);

        if (!file?.link || !video.user?.name || !video.user?.url) {
          return null;
        }

        return {
          id: video.id,
          duration: video.duration,
          width: video.width,
          height: video.height,
          userName: video.user.name,
          userUrl: video.user.url,
          videoUrl: file.link
        } satisfies PexelsClip;
      })
      .filter((clip): clip is PexelsClip => Boolean(clip))
      .slice(0, clipCount);
  } catch {
    return [];
  }
}

export async function downloadBinaryFile(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  await ensureOk(response, "Remote media download");

  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) {
    throw new AppError("Downloaded media file was empty.", 502);
  }

  return buffer;
}
