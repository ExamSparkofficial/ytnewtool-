import { createSign } from "node:crypto";
import { readFile } from "node:fs/promises";

import { AppError } from "@/lib/errors";
import { readJson } from "@/lib/http";

type ServiceAccountCredentials = {
  client_email?: string;
  private_key?: string;
};

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
};

let cachedToken: {
  accessToken: string;
  expiresAt: number;
} | null = null;

function base64Url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function normalizePrivateKey(privateKey: string) {
  return privateKey.replace(/\\n/g, "\n");
}

async function loadServiceAccountCredentials() {
  const inlineJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (inlineJson) {
    return JSON.parse(inlineJson) as ServiceAccountCredentials;
  }

  if (credentialsPath) {
    return JSON.parse(await readFile(credentialsPath, "utf8")) as ServiceAccountCredentials;
  }

  return null;
}

function createJwt(credentials: ServiceAccountCredentials, scope: string) {
  if (!credentials.client_email || !credentials.private_key) {
    throw new AppError("Google service account credentials are missing client_email or private_key.", 500);
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(
    JSON.stringify({
      iss: credentials.client_email,
      scope,
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now
    })
  );
  const unsignedJwt = `${header}.${claim}`;
  const signature = createSign("RSA-SHA256")
    .update(unsignedJwt)
    .sign(normalizePrivateKey(credentials.private_key));

  return `${unsignedJwt}.${base64Url(signature)}`;
}

export async function getGoogleCloudAccessToken() {
  const configuredToken = process.env.GOOGLE_CLOUD_ACCESS_TOKEN;
  if (configuredToken) {
    return configuredToken;
  }

  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken;
  }

  const credentials = await loadServiceAccountCredentials();
  if (!credentials) {
    throw new AppError(
      "Google TTS auth is missing. Set GOOGLE_TTS_API_KEY, GOOGLE_API_KEY, GOOGLE_CLOUD_ACCESS_TOKEN, GOOGLE_SERVICE_ACCOUNT_JSON, or GOOGLE_APPLICATION_CREDENTIALS.",
      500
    );
  }

  const assertion = createJwt(credentials, "https://www.googleapis.com/auth/cloud-platform");
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    const text = await response.text();
    throw new AppError(`Google auth request failed (${response.status}): ${text.slice(0, 280)}`, 502);
  }

  const payload = await readJson<TokenResponse>(response);
  if (!payload.access_token) {
    throw new AppError("Google auth returned an empty access token.", 502);
  }

  cachedToken = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + Math.max((payload.expires_in ?? 3600) - 120, 60) * 1000
  };

  return cachedToken.accessToken;
}
