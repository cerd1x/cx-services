export type PaymentSettlementInput = {
  userId: number;
  /** Asset tujuan settlement (mis. `setting.defaultAssetCashId`). */
  assetId: number;
  amount: number;
  currency: string;
};

/**
 * Port untuk settlement internal setelah charge berhasil.
 *
 * Dipisah dari `PaymentGateway` karena settlement bukan operasi gateway
 * eksternal: ia memindahkan/mengkredit saldo ke asset milik user.
 */
export abstract class PaymentSettlementPort {
  /** Asset default cash user dari setting; `null` bila belum diatur. */
  abstract defaultCashAssetId(userId: number): Promise<number | null>;

  /** Kredit dana settlement ke asset tujuan. */
  abstract settle(input: PaymentSettlementInput): Promise<void>;
}
