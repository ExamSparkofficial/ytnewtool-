import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { put } from "@vercel/blob";

import { AppError } from "@/lib/errors";

const publicRoot = path.join(process.cwd(), "public", "generated");
const localRuntimeRoot = path.join(process.cwd(), "runtime");
const tempRuntimeRoot = path.join(os.tmpdir(), "ai-content-engine");

type PublicKind = "audio" | "video" | "metadata";

function isVercelRuntime() {
  return process.env.VERCEL === "1" || Boolean(process.env.VERCEL_URL);
}

function hasBlobStorage() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function getRuntimeRoot() {
  return isVercelRuntime() ? tempRuntimeRoot : localRuntimeRoot;
}

function getContentType(kind: PublicKind, fileName: string) {
  if (fileName.endsWith(".wav")) {
    return "audio/wav";
  }

  if (kind === "audio" || fileName.endsWith(".mp3")) {
    return "audio/mpeg";
  }

  if (kind === "video" || fileName.endsWith(".mp4")) {
    return "video/mp4";
  }

  return "text/plain; charset=utf-8";
}

function isRemoteAssetReference(assetRef: string) {
  return /^https?:\/\//i.test(assetRef);
}

export async function ensureStorageRoots() {
  const tasks = [mkdir(getRuntimeRoot(), { recursive: true })];

  if (!hasBlobStorage()) {
    tasks.push(
      mkdir(publicRoot, { recursive: true }),
      mkdir(path.join(publicRoot, "audio"), { recursive: true }),
      mkdir(path.join(publicRoot, "video"), { recursive: true }),
      mkdir(path.join(publicRoot, "metadata"), { recursive: true })
    );
  }

  await Promise.all(tasks);
}

export async function createRuntimeJobDir(jobId: string) {
  const jobDir = path.join(getRuntimeRoot(), jobId);
  await mkdir(jobDir, { recursive: true });
  return jobDir;
}

export async function writePublicBinary(
  kind: PublicKind,
  fileName: string,
  buffer: Buffer
) {
  await ensureStorageRoots();

  const assetKey = `${kind}/${fileName}`;

  if (hasBlobStorage()) {
    const blob = await put(assetKey, buffer, {
      access: "public",
      addRandomSuffix: true,
      contentType: getContentType(kind, fileName)
    });

    return {
      assetKey: blob.url,
      absolutePath: "",
      publicUrl: blob.url
    };
  }

  if (isVercelRuntime()) {
    throw new AppError(
      "BLOB_READ_WRITE_TOKEN is required on Vercel so generated media can be stored durably.",
      500
    );
  }

  const absolutePath = path.join(publicRoot, assetKey);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);

  return {
    assetKey,
    absolutePath,
    publicUrl: `/generated/${assetKey}`
  };
}

export async function writePublicText(kind: PublicKind, fileName: string, content: string) {
  await ensureStorageRoots();

  const assetKey = `${kind}/${fileName}`;

  if (hasBlobStorage()) {
    const blob = await put(assetKey, content, {
      access: "public",
      addRandomSuffix: true,
      contentType: getContentType(kind, fileName)
    });

    return {
      assetKey: blob.url,
      absolutePath: "",
      publicUrl: blob.url
    };
  }

  if (isVercelRuntime()) {
    throw new AppError(
      "BLOB_READ_WRITE_TOKEN is required on Vercel so generated media can be stored durably.",
      500
    );
  }

  const absolutePath = path.join(publicRoot, assetKey);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, "utf8");

  return {
    assetKey,
    absolutePath,
    publicUrl: `/generated/${assetKey}`
  };
}

export async function resolvePublicAssetPath(assetKey: string) {
  const absolutePath = path.join(publicRoot, assetKey);
  const normalizedRoot = path.normalize(publicRoot);
  const normalizedPath = path.normalize(absolutePath);
  const relative = path.relative(normalizedRoot, normalizedPath);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new AppError("Invalid asset path.", 400);
  }

  return normalizedPath;
}

export async function materializeAssetReference(assetRef: string, targetPath: string) {
  if (!isRemoteAssetReference(assetRef)) {
    return resolvePublicAssetPath(assetRef);
  }

  const response = await fetch(assetRef, { cache: "no-store" });
  if (!response.ok) {
    throw new AppError(`Unable to download generated asset (${response.status}).`, 502);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(targetPath, buffer);
  return targetPath;
}

export async function cleanupExpiredArtifacts(maxAgeHours = 24) {
  await ensureStorageRoots();

  const expirationMs = maxAgeHours * 60 * 60 * 1000;
  const now = Date.now();
  const roots = [getRuntimeRoot()];

  if (!hasBlobStorage()) {
    roots.push(publicRoot);
  }

  await Promise.all(
    roots.map(async (root) => {
      const entries = await readdir(root, { withFileTypes: true });

      await Promise.all(
        entries
          .filter((entry) => entry.name !== ".gitkeep")
          .map(async (entry) => {
            const fullPath = path.join(root, entry.name);
            const info = await stat(fullPath);

            if (now - info.mtimeMs > expirationMs) {
              await rm(fullPath, { recursive: true, force: true });
            }
          })
      );
    })
  );
}
