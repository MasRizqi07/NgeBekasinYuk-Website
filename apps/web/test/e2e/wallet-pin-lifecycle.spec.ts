import { test, expect } from "@playwright/test";
import { prisma } from "../../src/server/db/prisma";
import bcrypt from "bcryptjs";

test.describe("Wallet PIN Lifecycle & Server-Authoritative Read E2E (Phase 4 & 4B)", () => {
  const ts = Date.now().toString().slice(-6);
  const testName = `Wallet User ${ts}`;
  const testEmail = `wallet-lifecycle-${ts}@ngebekasinyuk.id`;
  const testPassword = "Password123!";
  const testPin = "741852";

  test("new user registers -> withdraw attempt -> set-PIN form appears -> set PIN -> withdraw succeeds -> reload preserves state", async ({
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

    // 4. Assert Set-PIN form appears directly (authoritative GET /api/wallet returns hasPin: false)
    await expect(page.getByText(/Atur PIN Transaksi Baru/i)).toBeVisible({ timeout: 15_000 });

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
    await page.click('button:has-text("500 Rb")');
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

    // 9. Authoritative reload: page reload reconstructs state from PostgreSQL (4.500.000)
    await page.reload();
    await expect(page.getByText(/Rp 4\.500\.000/i)).toBeVisible({ timeout: 10_000 });
  });

  test("negative scenario: arbitrary payout bank details / foreign bankAccountId cannot be used", async ({
    request,
    page,
  }) => {
    // Register another user as attacker
    const ts2 = Date.now().toString().slice(-6);
    const attackerEmail = `attacker-${ts2}@ngebekasinyuk.id`;
    await page.goto("/register");
    await page.fill('input[type="text"]', "Attacker");
    await page.fill('input[type="email"]', attackerEmail);
    await page.fill('input[type="password"]', testPassword);
    await page.click('button[type="submit"]');

    await page.waitForURL((url) => url.pathname.includes("/profile/verification") || url.pathname === "/", {
      timeout: 15_000,
    });

    const attacker = await prisma.user.findUniqueOrThrow({
      where: { email: attackerEmail },
      include: { wallet: true },
    });

    // Fund attacker wallet and set PIN
    const hashedPin = await bcrypt.hash(testPin, 10);
    await prisma.user.update({
      where: { id: attacker.id },
      data: { hashedPin },
    });
    await prisma.wallet.update({
      where: { userId: attacker.id },
      data: { activeBalance: 2000000 },
    });

    // Create a legitimate bank account for Victim
    const victim = await prisma.user.create({
      data: {
        email: `victim-${ts2}@ngebekasinyuk.id`,
        name: "Victim User",
        role: "SELLER",
        hashedPassword: await bcrypt.hash("Password123!", 10),
        bankAccounts: {
          create: {
            bankCode: "BCA",
            bankName: "Bank Central Asia",
            accountNumber: "9988776655",
            accountHolder: "Victim User",
          },
        },
      },
      include: { bankAccounts: true },
    });

    // Attacker tries to withdraw to victim's bank account ID via API route
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    const res = await request.post("/api/wallet/withdraw", {
      headers: {
        Cookie: cookieHeader,
        "Content-Type": "application/json",
      },
      data: {
        amount: 500000,
        bankAccountId: victim.bankAccounts[0].id,
        pin: testPin,
      },
    });

    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("BANK_ACCOUNT_NOT_FOUND");

    // Invariant: Attacker balance must remain 2,000,000 in DB
    const attackerWallet = await prisma.wallet.findUniqueOrThrow({
      where: { userId: attacker.id },
    });
    expect(attackerWallet.activeBalance).toBe(2000000);
  });
});
