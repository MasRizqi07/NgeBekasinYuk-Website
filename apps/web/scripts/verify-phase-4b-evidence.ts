import { prisma } from "../src/server/db/prisma";
import bcrypt from "bcryptjs";

const BASE_URL = "http://localhost:3000";

const failures: string[] = [];

function assertEq<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    const errorMsg = `[ASSERTION FAILED] ${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`;
    console.error(`❌ ${errorMsg}`);
    failures.push(errorMsg);
  } else {
    console.log(`✅ [ASSERTION PASSED] ${label}: ${JSON.stringify(actual)}`);
  }
}

async function main() {
  console.log("====================================================================");
  console.log("PHASE 4B TEST SUITE: AUTHORITATIVE WALLET READ & PAYOUT INTEGRITY");
  console.log("====================================================================\n");

  const ts = Date.now().toString().slice(-6);
  const password = "Password123!";
  const pin = "741852";

  // Clean / Setup User A
  const emailA = `proof.a.${ts}@ngebekasinyuk.id`;
  const hashedPw = await bcrypt.hash(password, 10);

  const userA = await prisma.user.create({
    data: {
      email: emailA,
      name: "Proof User A",
      role: "SELLER",
      hashedPassword: hashedPw,
      hashedPin: null, // No default PIN
      wallet: {
        create: {
          activeBalance: 5_000_000,
          heldBalance: 500_000,
        },
      },
      bankAccounts: {
        create: {
          bankCode: "BCA",
          bankName: "Bank Central Asia",
          accountNumber: "1234567890",
          accountHolder: "Proof User A",
          isDefault: true,
        },
      },
    },
    include: { wallet: true, bankAccounts: true },
  });
  if (!userA.wallet) throw new Error("User A wallet not created");
  const walletAId = userA.wallet.id;

  // Setup User B (Victim / Foreign Account)
  const emailB = `proof.b.${ts}@ngebekasinyuk.id`;
  const userB = await prisma.user.create({
    data: {
      email: emailB,
      name: "Proof User B",
      role: "SELLER",
      hashedPassword: hashedPw,
      hashedPin: null,
      wallet: {
        create: {
          activeBalance: 2_000_000,
          heldBalance: 0,
        },
      },
      bankAccounts: {
        create: {
          bankCode: "MANDIRI",
          bankName: "Bank Mandiri",
          accountNumber: "9876543210",
          accountHolder: "Proof User B",
          isDefault: true,
        },
      },
    },
    include: { wallet: true, bankAccounts: true },
  });

  // Log in User A
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: emailA, password }),
  });

  const rawSetCookie = loginRes.headers.get("set-cookie") || "";
  const cookieMatch = rawSetCookie.match(/([^;]+)/);
  const cookieHeader = cookieMatch ? cookieMatch[1] : "";

  console.log("--------------------------------------------------------------------");
  console.log("TEST FIXTURES INITIALIZED:");
  console.log(`User A ID: ${userA.id} | BankAccount A: ${userA.bankAccounts[0].id}`);
  console.log(`User B ID: ${userB.id} | BankAccount B: ${userB.bankAccounts[0].id}`);
  console.log("--------------------------------------------------------------------\n");

  // =========================================================================
  // 1. GET /api/wallet without session -> 401
  // =========================================================================
  console.log(">>> 1. GET /api/wallet WITHOUT SESSION");
  const res1 = await fetch(`${BASE_URL}/api/wallet`);
  const body1 = await res1.json();
  console.log(`HTTP Status: ${res1.status}`);
  console.log(`Response: ${JSON.stringify(body1)}`);
  assertEq(res1.status, 401, "Scenario 1 HTTP status is 401");
  console.log("");

  // =========================================================================
  // 2. GET /api/wallet authenticated -> 200 (hasPin=false before setup)
  // =========================================================================
  console.log(">>> 2. GET /api/wallet AUTHENTICATED (hasPin=false before setup)");
  const res2 = await fetch(`${BASE_URL}/api/wallet`, {
    headers: { Cookie: cookieHeader },
  });
  const body2 = await res2.json();
  console.log(`HTTP Status: ${res2.status}`);
  console.log(`Response: ${JSON.stringify(body2)}`);
  assertEq(res2.status, 200, "Scenario 2 HTTP status is 200");
  assertEq(body2?.security?.hasPin, false, "Scenario 2 hasPin is false before setup");
  assertEq(body2?.wallet?.activeBalance, 5_000_000, "Scenario 2 activeBalance matches DB 5M");
  assertEq(body2?.bankAccounts?.[0]?.accountNumberMasked, "•••• •••• 7890", "Scenario 2 bank account masked");
  console.log("");

  // =========================================================================
  // 3. POST /api/wallet/pin invalid password -> 401
  // =========================================================================
  console.log(">>> 3. POST /api/wallet/pin INVALID PASSWORD");
  const res3 = await fetch(`${BASE_URL}/api/wallet/pin`, {
    method: "POST",
    headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
    body: JSON.stringify({ password: "WrongPassword!", pin: "741852" }),
  });
  const body3 = await res3.json();
  console.log(`HTTP Status: ${res3.status}`);
  console.log(`Response: ${JSON.stringify(body3)}`);
  assertEq(res3.status, 401, "Scenario 3 HTTP status is 401");
  console.log("");

  // =========================================================================
  // 4. POST /api/wallet/pin weak PIN -> 422
  // =========================================================================
  console.log(">>> 4. POST /api/wallet/pin WEAK PIN (123456)");
  const res4 = await fetch(`${BASE_URL}/api/wallet/pin`, {
    method: "POST",
    headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
    body: JSON.stringify({ password, pin: "123456" }),
  });
  const body4 = await res4.json();
  console.log(`HTTP Status: ${res4.status}`);
  console.log(`Response: ${JSON.stringify(body4)}`);
  assertEq(res4.status, 422, "Scenario 4 HTTP status is 422");
  console.log("");

  // =========================================================================
  // 5. POST /api/wallet/pin success -> 200
  // =========================================================================
  console.log(">>> 5. POST /api/wallet/pin SUCCESS (strong PIN 741852)");
  const res5 = await fetch(`${BASE_URL}/api/wallet/pin`, {
    method: "POST",
    headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
    body: JSON.stringify({ password, pin }),
  });
  const body5 = await res5.json();
  console.log(`HTTP Status: ${res5.status}`);
  console.log(`Response: ${JSON.stringify(body5)}`);
  assertEq(res5.status, 200, "Scenario 5 HTTP status is 200");
  assertEq(body5?.success, true, "Scenario 5 response success is true");
  console.log("");

  // =========================================================================
  // 6. POST /api/wallet/withdraw with foreign bankAccountId -> 404 (IDOR Defense)
  // =========================================================================
  console.log(">>> 6. POST /api/wallet/withdraw IDOR ATTACK (foreign bankAccountId)");
  const dbPreWalletA = await prisma.wallet.findUniqueOrThrow({ where: { userId: userA.id } });
  const dbPreWdA = await prisma.withdrawal.count({ where: { walletId: walletAId } });
  const dbPreLedgerA = await prisma.walletLedgerEntry.count({ where: { walletId: walletAId } });

  const res6 = await fetch(`${BASE_URL}/api/wallet/withdraw`, {
    method: "POST",
    headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: 500_000,
      bankAccountId: userB.bankAccounts[0].id,
      pin,
    }),
  });
  const body6 = await res6.json();
  console.log(`HTTP Status: ${res6.status}`);
  console.log(`Response: ${JSON.stringify(body6)}`);

  const dbPostWalletA = await prisma.wallet.findUniqueOrThrow({ where: { userId: userA.id } });
  const dbPostWdA = await prisma.withdrawal.count({ where: { walletId: walletAId } });
  const dbPostLedgerA = await prisma.walletLedgerEntry.count({ where: { walletId: walletAId } });

  assertEq(res6.status, 404, "Scenario 6 HTTP status is 404");
  assertEq(dbPostWalletA.activeBalance, dbPreWalletA.activeBalance, "Scenario 6 User A balance unchanged");
  assertEq(dbPostWdA, dbPreWdA, "Scenario 6 User A withdrawal count unchanged");
  assertEq(dbPostLedgerA, dbPreLedgerA, "Scenario 6 User A ledger entries count unchanged");
  console.log("");

  // =========================================================================
  // 7. POST /api/wallet/withdraw with User A's own bankAccountId -> 200
  // =========================================================================
  const idempotencyKey = `idemp-proof-${Date.now()}`;
  console.log(">>> 7. POST /api/wallet/withdraw OWN BANK ACCOUNT (1,000,000 IDR)");

  const res7 = await fetch(`${BASE_URL}/api/wallet/withdraw`, {
    method: "POST",
    headers: {
      Cookie: cookieHeader,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      amount: 1_000_000,
      bankAccountId: userA.bankAccounts[0].id,
      pin,
    }),
  });
  const body7 = await res7.json();
  console.log(`HTTP Status: ${res7.status}`);
  console.log(`Response: ${JSON.stringify(body7)}`);

  const dbAfterWdWalletA = await prisma.wallet.findUniqueOrThrow({ where: { userId: userA.id } });
  const dbAfterWdA = await prisma.withdrawal.count({ where: { walletId: walletAId } });
  const dbAfterLedgerA = await prisma.walletLedgerEntry.count({ where: { walletId: walletAId } });

  assertEq(res7.status, 200, "Scenario 7 HTTP status is 200");
  assertEq(body7?.isDuplicate, false, "Scenario 7 isDuplicate is false");
  assertEq(dbAfterWdWalletA.activeBalance, dbPreWalletA.activeBalance - 1_000_000, "Scenario 7 balance debited by 1,000,000");
  assertEq(dbAfterWdA, dbPreWdA + 1, "Scenario 7 withdrawal rows incremented by 1");
  assertEq(dbAfterLedgerA, dbPreLedgerA + 1, "Scenario 7 ledger rows incremented by 1");
  console.log("");

  // =========================================================================
  // 8. POST /api/wallet/withdraw duplicate retry -> 200 (isDuplicate: true)
  // =========================================================================
  console.log(">>> 8. POST /api/wallet/withdraw EXACT DUPLICATE RETRY (Same Idempotency-Key)");

  const res8 = await fetch(`${BASE_URL}/api/wallet/withdraw`, {
    method: "POST",
    headers: {
      Cookie: cookieHeader,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      amount: 1_000_000,
      bankAccountId: userA.bankAccounts[0].id,
      pin,
    }),
  });
  const body8 = await res8.json();
  console.log(`HTTP Status: ${res8.status}`);
  console.log(`Response: ${JSON.stringify(body8)}`);

  const dbFinalWalletA = await prisma.wallet.findUniqueOrThrow({ where: { userId: userA.id } });
  const dbFinalWdA = await prisma.withdrawal.count({ where: { walletId: walletAId } });
  const dbFinalLedgerA = await prisma.walletLedgerEntry.count({ where: { walletId: walletAId } });

  assertEq(res8.status, 200, "Scenario 8 HTTP status is 200");
  assertEq(body8?.isDuplicate, true, "Scenario 8 isDuplicate is true");
  assertEq(dbFinalWalletA.activeBalance, dbAfterWdWalletA.activeBalance, "Scenario 8 activeBalance unchanged on duplicate");
  assertEq(dbFinalWdA, dbAfterWdA, "Scenario 8 withdrawal rows unchanged on duplicate");
  assertEq(dbFinalLedgerA, dbAfterLedgerA, "Scenario 8 ledger rows unchanged on duplicate");
  console.log("");

  // Final Evaluation
  if (failures.length > 0) {
    console.error("====================================================================");
    console.error(`VERIFICATION FAILED: ${failures.length} assertion(s) failed:`);
    failures.forEach((f) => console.error(`  - ${f}`));
    console.error("====================================================================");
    process.exit(1);
  }

  console.log("====================================================================");
  console.log("ALL 8 SCENARIOS VERIFIED SUCCESSFULLY WITH DB INVARIANTS!");
  console.log("====================================================================");
}

main().catch((err) => {
  console.error("FATAL ERROR in proof script:", err);
  process.exit(1);
});
