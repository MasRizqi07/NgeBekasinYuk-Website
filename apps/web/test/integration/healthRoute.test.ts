import { describe, it, expect, vi, afterEach } from "vitest";
import { prisma } from "@/server/db/prisma";
import { GET } from "@/app/api/health/route";

describe("Health Endpoint Integration Tests (AC9.7)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("AC9.7: returns 200 { status: 'ok' } when PostgreSQL SELECT 1 succeeds and exposes no versions, env, or stack", async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ status: "ok" });
    expect(Object.keys(body)).toEqual(["status"]);
  });

  it("AC9.7: returns 503 without versions, env, or stack when database query fails", async () => {
    vi.spyOn(prisma, "$queryRaw").mockRejectedValueOnce(
      new Error("ECONNREFUSED postgresql://postgres:secret@db.internal:5432/prod at stack line 42")
    );

    const res = await GET();
    expect(res.status).toBe(503);

    const rawText = await res.text();
    const body = JSON.parse(rawText);
    expect(body).toEqual({ status: "error" });
    expect(Object.keys(body)).toEqual(["status"]);
    expect(rawText).not.toMatch(/postgres|secret|ECONNREFUSED|stack|version|env/i);
  });
});
