import { AppError } from "@/lib/errors";

export async function readJson<T>(response: Response) {
  const text = await response.text();

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new AppError(`Upstream service returned invalid JSON: ${text.slice(0, 200)}`, 502);
  }
}

export async function ensureOk(response: Response, serviceName: string) {
  if (response.ok) {
    return;
  }

  const text = await response.text();
  throw new AppError(
    `${serviceName} request failed (${response.status}): ${text.slice(0, 280)}`,
    502
  );
}
