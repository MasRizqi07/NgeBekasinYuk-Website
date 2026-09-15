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

  describe("Zustand Store: useWalletStore.withdrawFunds", () => {
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
  });

  describe("UI Contract Simulation: Wallet Page handleWithdraw workflow", () => {
    it("preserves clientRequestId and triggers warning toast when status is UNKNOWN", async () => {
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
});
