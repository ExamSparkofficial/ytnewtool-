import { AppError } from "@/lib/errors";

export function getRequiredEnv(name: "OPENAI_API_KEY" | "ELEVENLABS_API_KEY") {
  const value = process.env[name];

  if (!value) {
    throw new AppError(`${name} is missing. Add it to your .env.local file.`, 500);
  }

  return value;
}

export function getOptionalEnv(name: string, fallback = "") {
  return process.env[name] ?? fallback;
}
