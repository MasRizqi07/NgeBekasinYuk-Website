import { NextResponse } from "next/server";
import { WebhookSimulationSchema } from "@/lib/validations";
import { defaultPaymentProvider } from "@/domain/payment/PaymentProvider";
import { env } from "@/lib/env";

export async function POST(request: Request) {
  // Prohibit demo webhook simulation in production (HP2-P1-11, HP3-P1-03)
  if (env.APP_ENV === "production" || !env.DEMO_PAYMENT_PROVIDER) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: "Endpoint tidak ditemukan atau dinonaktifkan di environment ini." },
      { status: 404 }
    );
  }

  try {
    const body = await request.json();
    const validated = WebhookSimulationSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", details: validated.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { paymentAttemptId, orderId, amount } = validated.data;

    const result = await defaultPaymentProvider.simulateWebhook({
      paymentAttemptId,
      orderId,
      amount,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Payment/SimulateWebhook] Error:", error);
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR", message: "Gagal memproses simulasi webhook." },
      { status: 500 }
    );
  }
}
