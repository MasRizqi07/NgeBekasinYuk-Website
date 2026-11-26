import { NextResponse } from "next/server";

export interface ProblemDetailsInput {
  type?: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  error: string;
  errors?: unknown;
}

/**
 * Emits an RFC 9457 Problem Details JSON response (`application/problem+json`)
 * while preserving `error` and `message` keys for existing client consumers.
 */
export function problemResponse(input: ProblemDetailsInput) {
  const slug = input.error.toLowerCase().replace(/_/g, "-");
  const body: Record<string, unknown> = {
    type: input.type ?? `https://ngebekasinyuk.id/errors/${slug}`,
    title: input.title,
    status: input.status,
    detail: input.detail,
    error: input.error,
    message: input.detail,
  };

  if (input.instance) {
    body.instance = input.instance;
  }
  if (input.errors !== undefined) {
    body.errors = input.errors;
  }

  return NextResponse.json(body, {
    status: input.status,
    headers: {
      "Content-Type": "application/problem+json; charset=utf-8",
    },
  });
}

export function requestPathname(request: Request): string {
  try {
    return new URL(request.url).pathname;
  } catch {
    return "/api/listings";
  }
}

export function handleRouteError(
  err: unknown,
  request: Request,
  fallbackLabel: string
) {
  if (
    err instanceof Error &&
    "status" in err &&
    "code" in err &&
    "title" in err &&
    typeof (err as { status: unknown }).status === "number" &&
    typeof (err as { code: unknown }).code === "string" &&
    typeof (err as { title: unknown }).title === "string"
  ) {
    const typedErr = err as Error & {
      status: number;
      code: string;
      title: string;
    };
    return problemResponse({
      error: typedErr.code,
      title: typedErr.title,
      status: typedErr.status,
      detail: typedErr.message,
      instance: requestPathname(request),
    });
  }

  console.error(`[${fallbackLabel}]`, err);
  return problemResponse({
    error: "INTERNAL_SERVER_ERROR",
    title: "Kesalahan Server Internal",
    status: 500,
    detail: "Terjadi kesalahan pada server saat memproses permintaan.",
    instance: requestPathname(request),
  });
}
