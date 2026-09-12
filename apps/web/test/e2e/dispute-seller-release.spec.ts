import { test, expect } from "@playwright/test";
import { signSession } from "@/lib/auth/session";
import { DEV_ADMIN_TOTP_SEED, generateTotpCode, clearTotpReplayHistory } from "@/lib/auth/totp";

import { prisma } from "@/server/db/prisma";

test.describe("Dispute Seller Release E2E Flow", () => {
  test.beforeEach(async () => {
    clearTotpReplayHistory();
    await prisma.dispute.updateMany({
      where: { id: "DSP-2026-88421" },
      data: { status: "UNDER_REVIEW", verdict: null, decidedByAdminId: null, decidedAt: null },
    });
    await prisma.escrowAccount.updateMany({
      where: { order: { dispute: { id: "DSP-2026-88421" } } },
      data: { status: "FROZEN_DISPUTE", isReleased: false, isRefunded: false, idempotencyKey: null },
    });
    await prisma.escrowLedgerEntry.deleteMany({
      where: { escrowAccount: { order: { dispute: { id: "DSP-2026-88421" } } } },
    });
  });

  test("admin executes seller release verdict with TOTP step-up and releases escrow", async ({ page, context }) => {
    const adminToken = await signSession({
      id: "usr-admin-sarah",
      email: "sarah.admin@ngebekasinyuk.id",
      name: "Sarah Lestari",
      role: "ADMIN",
      isVerified: true,
    });

    await context.addCookies([
      {
        name: "ngebekasinyuk_session",
        value: adminToken,
        domain: "localhost",
        path: "/",
      },
    ]);

    await page.goto("/admin/disputes");
    await expect(page.getByText(/Antrean Mediasi Aktif/i).first()).toBeVisible({ timeout: 10_000 });

    // 1. Select RELEASE_SELLER radio option
    await page.click('text=[Putuskan untuk Penjual / RELEASE ESCROW]');

    // 2. Open 2FA modal
    await page.click('button:has-text("Eksekusi Putusan & Buka Otorisasi 2FA")');
    await expect(page.getByText(/Otorisasi 2FA Super Admin/i).first()).toBeVisible();

    // 3. Generate and enter TOTP
    const totp = generateTotpCode(DEV_ADMIN_TOTP_SEED);
    await page.fill('input[placeholder="6-digit TOTP"]', totp);

    // 4. Submit verdict
    await page.click('button:has-text("Otorisasi & Lepaskan")');
    await expect(page.getByText(/berhasil dieksekusi/i).first()).toBeVisible({ timeout: 10_000 });
  });
});
