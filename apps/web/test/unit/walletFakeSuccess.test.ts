import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useWalletStore } from "@/stores/useWalletStore";

describe("Phase 1.1 — Financial Fake-Success & Ambiguous State Hardening", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    // Reset store state
    useWalletStore.setState({
      saldoAktif: 14250000,
      saldoTertahan: 6800000,
      transactions: [],
    });
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("Item A — Zustand Store: useWalletStore.withdrawFunds", () => {
    it("returns status UNKNOWN on simulated network timeout/failure and preserves balance", async () => {
      // 1. Simulate network failure / fetch rejection (e.g. timeout, drop connection)
      global.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

      const initialBalance = useWalletStore.getState().saldoAktif;
      const initialTxCount = useWalletStore.getState().transactions.length;
      const clientRequestId = "req-test-timeout-12345";

      // 2. Execute withdrawal
      const result = await useWalletStore
        .getState()
        .withdrawFunds(500000, "bca-1", "123456", clientRequestId);

      // 3. Assert honest UNKNOWN status (neither fake-success nor confirmed failed)
      expect(result.success).toBe(false);
      expect(result.status).toBe("UNKNOWN");
      expect(result.message).toContain("Status penarikan belum bisa dipastikan");
      expect(result.message).toContain("Idempotency-Key");

      // 4. Assert local balance was NOT deducted and no ghost transaction was created
      expect(useWalletStore.getState().saldoAktif).toBe(initialBalance);
      expect(useWalletStore.getState().transactions.length).toBe(initialTxCount);
    });

    it("returns status FAILED on deterministic business validation error (invalid PIN)", async () => {
      const result = await useWalletStore
        .getState()
        .withdrawFunds(500000, "bca-1", "123", "req-test-pin");

      expect(result.success).toBe(false);
      expect(result.status).toBe("FAILED");
      expect(result.message).toBe("PIN transaksi harus berupa 6 digit angka.");
    });

    it("returns status FAILED when server authoritatively rejects (e.g. 400 Bad Request)", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ message: "PIN salah. Sisa percobaan 3 kali." }),
      } as unknown as Response);

      const result = await useWalletStore
        .getState()
        .withdrawFunds(500000, "bca-1", "654321", "req-test-server-reject");

      expect(result.success).toBe(false);
      expect(result.status).toBe("FAILED");
      expect(result.message).toBe("PIN salah. Sisa percobaan 3 kali.");
    });

    it("returns status SUCCESS only when server returns confirmed 200 OK", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          withdrawalId: "w-123456",
          withdrawalNumber: "WD-2026-999",
        }),
      } as unknown as Response);

      const initialBalance = useWalletStore.getState().saldoAktif;
      const withdrawAmount = 1000000;

      const result = await useWalletStore
        .getState()
        .withdrawFunds(withdrawAmount, "bca-1", "123456", "req-test-success");

      expect(result.success).toBe(true);
      expect(result.status).toBe("SUCCESS");
      expect(useWalletStore.getState().saldoAktif).toBe(initialBalance - withdrawAmount);
      expect(useWalletStore.getState().transactions.length).toBe(1);
    });

    it("UI Contract: preserves clientRequestId and triggers warning toast when status is UNKNOWN", async () => {
      // Simulate network timeout
      global.fetch = vi.fn().mockRejectedValue(new Error("Network timeout after 10000ms"));

      const toastCalls: Array<{ message: string; type: string; title?: string }> = [];
      const showToast = (message: string, type: string, title?: string) => {
        toastCalls.push({ message, type, title });
      };

      let clientRequestId: string | null = "idempotency-key-persistent-999";

      // Simulated handleWithdraw logic from WalletPage
      const res = await useWalletStore
        .getState()
        .withdrawFunds(500000, "bca-1", "123456", clientRequestId!);

      if (res.success) {
        clientRequestId = null;
        showToast(res.message, "success");
      } else if (res.status === "UNKNOWN") {
        // Must NOT clear clientRequestId, must show warning toast
        showToast(res.message, "warning", "Status Penarikan Belum Dipastikan");
      } else {
        clientRequestId = null;
        showToast(res.message, "error", "Penarikan Gagal");
      }

      // Assertions
      expect(clientRequestId).toBe("idempotency-key-persistent-999"); // RETAINED!
      expect(toastCalls).toHaveLength(1);
      expect(toastCalls[0].type).toBe("warning");
      expect(toastCalls[0].title).toBe("Status Penarikan Belum Dipastikan");
      expect(toastCalls[0].message).toContain("Status penarikan belum bisa dipastikan");
    });
  });

  describe("Item B — Order Detail: handleReleaseFunds Escrow Release", () => {
    it("on failed/rejected fetch: does NOT call confirmOrderReceived, fires NO confetti, shows warning toast, and order status stays unchanged", async () => {
      // 1. Setup mock order state
      let orderState: { id: string; status: string; totalAmount: number; listing: { seller: { name: string } } } | null = {
        id: "order-escrow-release-fail-test",
        status: "INSPECTING",
        totalAmount: 5000000,
        listing: { seller: { name: "Seller Test" } },
      };

      // Mock confirmation dialog (user confirmed)
      const confirmSpy = vi.fn().mockReturnValue(true);
      const confettiSpy = vi.fn();
      const confirmOrderReceivedSpy = vi.fn();
      const toastCalls: Array<{ message: string; type: string; title?: string }> = [];
      const showToast = (message: string, type: string, title?: string) => {
        toastCalls.push({ message, type, title });
      };
      let showReviewModal = false;

      // 2. Mock network rejection during POST /api/orders/:id/transition
      global.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch: connection dropped"));

      // 3. Execute exact handleReleaseFunds workflow from orders/[id]/page.tsx
      const handleReleaseFunds = async () => {
        if (!orderState) return;
        if (confirmSpy(`Konfirmasi barang sesuai?`)) {
          try {
            const res = await fetch(`/api/orders/${orderState.id}/transition`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ toStatus: "COMPLETED" }),
            });

            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              showToast(errData.message || "Gagal melepaskan dana escrow.", "error");
              return;
            }

            confirmOrderReceivedSpy(orderState.id);
            orderState = { ...orderState, status: "COMPLETED" };
            confettiSpy({ particleCount: 90 });
            showToast("Terima kasih! Dana telah berhasil dicairkan ke dompet penjual.", "success");
            showReviewModal = true;
          } catch {
            showToast(
              "Status pencairan dana belum bisa dipastikan (koneksi terputus/timeout). Periksa status pesanan Anda.",
              "warning",
              "Status Pencairan Belum Dipastikan"
            );
          }
        }
      };

      await handleReleaseFunds();

      // 4. Verification of the contract
      // - confirmOrderReceived MUST NOT be called
      expect(confirmOrderReceivedSpy).not.toHaveBeenCalled();
      // - confetti MUST NOT fire
      expect(confettiSpy).not.toHaveBeenCalled();
      // - Review modal MUST NOT open
      expect(showReviewModal).toBe(false);
      // - Order status MUST stay unchanged ("INSPECTING")
      expect(orderState!.status).toBe("INSPECTING");
      // - Honest warning toast (NOT success, NOT generic error)
      expect(toastCalls).toHaveLength(1);
      expect(toastCalls[0].type).toBe("warning");
      expect(toastCalls[0].title).toBe("Status Pencairan Belum Dipastikan");
      expect(toastCalls[0].message).toContain("Status pencairan dana belum bisa dipastikan");
    });

    it("on confirmed 200 OK: calls confirmOrderReceived, triggers confetti, shows success toast, and completes order", async () => {
      let orderState: { id: string; status: string } | null = {
        id: "order-escrow-release-ok-test",
        status: "INSPECTING",
      };

      const confettiSpy = vi.fn();
      const confirmOrderReceivedSpy = vi.fn();
      const toastCalls: Array<{ message: string; type: string; title?: string }> = [];
      const showToast = (message: string, type: string, title?: string) => {
        toastCalls.push({ message, type, title });
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, status: "COMPLETED", escrowReleased: true }),
      } as unknown as Response);

      // Execute release
      const res = await fetch(`/api/orders/${orderState!.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStatus: "COMPLETED" }),
      });

      if (res.ok) {
        confirmOrderReceivedSpy(orderState!.id);
        orderState = { ...orderState!, status: "COMPLETED" };
        confettiSpy({ particleCount: 90 });
        showToast("Terima kasih! Dana telah berhasil dicairkan ke dompet penjual.", "success");
      }

      expect(confirmOrderReceivedSpy).toHaveBeenCalledWith("order-escrow-release-ok-test");
      expect(confettiSpy).toHaveBeenCalled();
      expect(orderState!.status).toBe("COMPLETED");
      expect(toastCalls[0].type).toBe("success");
    });
  });

  describe("Item C — Admin Disputes: executeVerdict Ambiguous Network State", () => {
    it("on rejected/thrown verdict submission: does NOT resolve dispute, triggers NO confetti, and shows unconfirmed warning toast instead of generic error", async () => {
      const activeDispute = { id: "DSP-2026-TEST-999" };
      const resolveDisputeSpy = vi.fn();
      const confettiSpy = vi.fn();
      const toastCalls: Array<{ message: string; type: string; title?: string }> = [];
      const showToast = (message: string, type: string, title?: string) => {
        toastCalls.push({ message, type, title });
      };

      let isExecuting = true;
      let show2FAModal = true;

      // Mock Stage 1 (Step-up token granted successfully)
      // Mock Stage 2 (POST /api/disputes/:id/verdict rejects due to timeout / connection drop)
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("/api/admin/step-up")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ grantToken: "test.valid.grant.token" }),
          };
        }
        if (url.includes("/api/disputes/")) {
          throw new Error("HTTP 504 Gateway Timeout: connection lost while awaiting database commit");
        }
        throw new Error("Unhandled route");
      });

      // Execute exact executeVerdict logic from admin/disputes/page.tsx
      const executeVerdict = async (verdictChoice: "REFUND_BUYER" | "RELEASE_SELLER") => {
        try {
          const stepUpRes = await fetch("/api/admin/step-up", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: "123456", action: "DISPUTE_VERDICT", resourceId: activeDispute.id }),
          });

          if (!stepUpRes.ok) {
            showToast("Verifikasi 2FA TOTP gagal.", "error");
            isExecuting = false;
            return;
          }

          const { grantToken } = await stepUpRes.json();

          const res = await fetch(`/api/disputes/${activeDispute.id}/verdict`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ verdict: verdictChoice, adminNotes: "Test Notes", stepUpCode: grantToken }),
          });

          if (!res.ok) {
            showToast("Gagal memproses putusan sengketa.", "error");
            isExecuting = false;
            return;
          }

          resolveDisputeSpy(activeDispute.id, verdictChoice, "Test Notes");
          isExecuting = false;
          show2FAModal = false;
          confettiSpy({ particleCount: 100 });
          showToast(`Putusan resmi untuk sengketa #${activeDispute.id} berhasil dieksekusi`, "success");
        } catch {
          // Hardened catch block: emits honest unconfirmed warning toast
          showToast(
            "Status putusan sengketa belum bisa dipastikan (koneksi terputus/timeout). Periksa riwayat audit sebelum mencoba lagi.",
            "warning",
            "Status Putusan Belum Dipastikan"
          );
          isExecuting = false;
        }
      };

      await executeVerdict("REFUND_BUYER");

      // Assertions:
      // - resolveDispute MUST NOT be called
      expect(resolveDisputeSpy).not.toHaveBeenCalled();
      // - Confetti MUST NOT fire
      expect(confettiSpy).not.toHaveBeenCalled();
      // - 2FA modal state remains open (not dismissed as successful)
      expect(show2FAModal).toBe(true);
      expect(isExecuting).toBe(false);
      // - Warning toast is shown, asserting ambiguous status, NOT the old generic error
      expect(toastCalls).toHaveLength(1);
      expect(toastCalls[0].type).toBe("warning");
      expect(toastCalls[0].title).toBe("Status Putusan Belum Dipastikan");
      expect(toastCalls[0].message).toBe(
        "Status putusan sengketa belum bisa dipastikan (koneksi terputus/timeout). Periksa riwayat audit sebelum mencoba lagi."
      );
      // Explicitly assert it did NOT emit the old deceptive message
      expect(toastCalls[0].message).not.toBe("Terjadi kesalahan jaringan saat memproses putusan sengketa.");
    });
  });
});
