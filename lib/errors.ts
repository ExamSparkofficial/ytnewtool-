import { NextResponse } from "next/server";

export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
  }
}

export function toErrorResponse(error: unknown, fallbackMessage: string) {
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.message }, { status: error.statusCode });
  }

  if (error instanceof Error) {
    return NextResponse.json({ error: error.message || fallbackMessage }, { status: 500 });
  }

  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}
