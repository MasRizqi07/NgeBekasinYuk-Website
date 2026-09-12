import { NextResponse } from "next/server";
import { validateAuthoritativeSession } from "@/lib/auth/authoritativeSession";
import { WithdrawalRequestSchema } from "@/lib/validations";
import { WalletLedgerService, WalletDomainError } from "@/domain/wallet/WalletLedgerService";

export async function POST(request: Request) {
  try {
    const session = await validateAuthoritativeSession();
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Silakan login terlebih dahulu." }, { status: 401 });
    }

    const body = await request.json();
    const validated = WithdrawalRequestSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", details: validated.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { amount, bankName, accountNumber, accountHolder, pin } = validated.data;

    const result = await WalletLedgerService.requestWithdrawal({
      userId: session.id,
      amount,
      bankName,
      accountNumber,
      accountHolder,
      pin,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof WalletDomainError) {
      const statusCode =
        error.code === "INVALID_PIN"
          ? 401
          : error.code === "INSUFFICIENT_BALANCE"
          ? 422
          : 400;

      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: statusCode }
      );
    }

    console.error("[Wallet/Withdraw] Error:", error);
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR", message: "Gagal memproses penarikan saldo." },
      { status: 500 }
    );
  }
}
