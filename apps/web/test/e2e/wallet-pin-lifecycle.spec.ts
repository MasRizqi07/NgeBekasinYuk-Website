import { test, expect } from "@playwright/test";
import { prisma } from "../../src/server/db/prisma";

test.describe("Wallet PIN Lifecycle E2E (Phase 4)", () => {
  const ts = Date.now().toString().slice(-6);
  const testName = `Wallet User ${ts}`;
  const testEmail = `wallet-lifecycle-${ts}@ngebekasinyuk.id`;
  const testPassword = "Password123!";
  const testPin = "741852";

  test("new user registers -> withdraw attempt -> set-PIN form appears -> set PIN -> withdraw succeeds", async ({
    page,
  }) => {
    // 1. New user registers
    await page.goto("/register");
    await page.fill('input[type="text"]', testName);
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', testPassword);
    await page.click('button[type="submit"]');

    // Wait for registration redirection
    await page.waitForURL((url) => url.pathname.includes("/profile/verification") || url.pathname === "/", {
      timeout: 15_000,
    });

    // Find the newly registered user in Postgres
    const user = await prisma.user.findUnique({
      where: { email: testEmail },
      include: { wallet: true },
    });
    expect(user).toBeDefined();
    // Task 4.6 invariant: new registration has hashedPin: null
    expect(user?.hashedPin).toBeNull();

    // 2. Fund user wallet & create bank account in DB to enable withdrawal
    await prisma.wallet.update({
      where: { userId: user!.id },
      data: { activeBalance: 5000000 },
    });
    await prisma.bankAccount.create({
      data: {
        userId: user!.id,
        bankCode: "BCA",
        bankName: "Bank Central Asia",
        accountNumber: "8820192837",
        accountHolder: testName,
        isDefault: true,
      },
    });

    // 3. Navigate to wallet page
    await page.goto("/wallet");
    await expect(page.locator("body")).toBeVisible();

    // If set-PIN form is already shown (via GET /api/wallet/pin returning hasPin: false)
    // or if withdrawal form is visible, attempt withdrawal
    const setPinHeader = page.getByText(/Atur PIN Transaksi Baru/i);
    const isSetPinDirectlyVisible = await setPinHeader.isVisible().catch(() => false);

    if (!isSetPinDirectlyVisible) {
      // Select 500 Rb quick chip to ensure amount <= activeBalance
      await page.click('button:has-text("500 Rb")');
      const pinInput = page.getByLabel("PIN Transaksi 6 Digit");
      await pinInput.fill("123456");
      await page.click('button:has-text("Konfirmasi & Tarik")');

      // 4. Assert Set-PIN form appears upon receiving 409 PIN_NOT_SET
      await expect(page.getByText(/Atur PIN Transaksi Baru/i)).toBeVisible({ timeout: 10_000 });
    }

    // 5. Fill and submit Set-PIN form
    await page.getByLabel("Password Akun").fill(testPassword);
    await page.getByLabel("PIN Transaksi Baru 6 Digit").fill(testPin);
    await page.getByLabel("Konfirmasi PIN Transaksi").fill(testPin);
    await page.click('button:has-text("Simpan & Aktifkan PIN Transaksi")');

    // 6. Assert success and withdrawal form reappears
    await expect(page.getByText(/PIN transaksi berhasil diatur/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Formulir Tarik Dana/i)).toBeVisible({ timeout: 10_000 });

    // Verify in Postgres that hashedPin is now set
    const userWithPin = await prisma.user.findUnique({ where: { id: user!.id } });
    expect(userWithPin?.hashedPin).not.toBeNull();

    // 7. Withdraw succeeds with the newly set PIN
    const pinInput = page.getByLabel("PIN Transaksi 6 Digit");
    await pinInput.fill(testPin);
    await page.click('button:has-text("Konfirmasi & Tarik")');

    // Assert withdrawal success
    await expect(page.getByText(/berhasil diproses/i)).toBeVisible({ timeout: 15_000 });

    // 8. Server-side verification: withdrawal record exists in Postgres
    const withdrawal = await prisma.withdrawal.findFirst({
      where: { walletId: user!.wallet!.id },
    });
    expect(withdrawal).toBeDefined();
    expect(withdrawal?.status).toBe("SUCCESS");
  });
});
