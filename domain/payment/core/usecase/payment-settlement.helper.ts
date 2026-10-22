import type { ServiceContainer } from "$services/shared/base";
import type { PaymentGateway } from "../ports/out/payment-gateway.port";
import { PaymentSettlementPort } from "../ports/out/payment-settlement.port";

/**
 * Settle dana pembayaran `OrderProductSale` ke asset default cash milik user.
 *
 * @throws jika port settlement tidak terpasang atau `defaultAssetCashId` kosong.
 */
export async function settleOrderProductSale(
  deps: ServiceContainer,
  payment: { userId: number; amount: number; currency: string },
): Promise<void> {
  const settlement = deps.has(PaymentSettlementPort) ? deps.get(PaymentSettlementPort) : null;
  if (!settlement) {
    throw new Error("Payment settlement is not configured");
  }

  const assetId = await settlement.defaultCashAssetId(payment.userId);
  if (!assetId) {
    throw new Error(
      "Default cash asset (setting.defaultAssetCashId) is not configured for this user",
    );
  }

  await settlement.settle({
    userId: payment.userId,
    assetId,
    amount: payment.amount,
    currency: payment.currency,
  });
}

/** Kompensasi best-effort setelah charge berhasil tetapi settlement gagal. */
export async function refundCharge(gateway: PaymentGateway, gatewayRef: string): Promise<void> {
  try {
    await gateway.refund({ gatewayRef, reason: "Settlement failed" });
  } catch {
    /* biarkan error asli yang dilempar pemanggil */
  }
}
