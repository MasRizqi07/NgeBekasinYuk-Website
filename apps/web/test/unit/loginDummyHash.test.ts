import { describe, it, expect, vi, afterEach } from "vitest";
import bcrypt from "bcryptjs";
import { POST } from "@/app/api/auth/login/route";

describe("Login Dummy-Hash Timing Guard Unit Test (AC9.4)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("runs bcrypt.compare against a valid bcrypt dummy hash when the email does not exist", async () => {
    const compareSpy = vi.spyOn(bcrypt, "compare");

    const unknownEmail = `nonexistent-${Date.now()}-${Math.random().toString(36).slice(2)}@ngebekasinyuk.id`;
    const req = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: unknownEmail, password: "AttemptPassword123!" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(["error", "message"]);
    expect(body.error).toBe("INVALID_CREDENTIALS");

    expect(compareSpy).toHaveBeenCalledTimes(1);
    expect(compareSpy.mock.calls[0][0]).toBe("AttemptPassword123!");
    expect(String(compareSpy.mock.calls[0][1])).toMatch(/^\$2[aby]\$10\$/);
  });
});
