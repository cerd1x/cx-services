import { Money, findCurrency } from "@lib/money";
import { ID } from "$services/shared/kernel";
import { AssetService } from "$services/domain/assets";
import { SettingService } from "$services/domain/setting";
import {
  PaymentSettlementPort,
  type PaymentSettlementInput,
} from "../../../core/ports/out/payment-settlement.port";

/**
 * Settlement berbasis asset: default cash diambil dari setting user, lalu dana
 * dikreditkan lewat `AssetService.mutateAsset` (kode `CR`).
 */
export class AssetSettlementAdapter extends PaymentSettlementPort {
  async defaultCashAssetId(userId: number): Promise<number | null> {
    const setting = await SettingService.getInstance().settingByUserId(userId);
    return setting.defaultAssetCashId ?? null;
  }

  async settle(input: PaymentSettlementInput): Promise<void> {
    const currency = findCurrency(input.currency.toUpperCase());
    if (!currency) {
      throw new Error(`Unknown currency: ${input.currency}`);
    }

    await AssetService.getInstance().mutateAsset({
      userId: ID.new(input.userId),
      code: "CR",
      assetId: ID.new(input.assetId),
      amount: Money.fromNumber(input.amount, currency),
    });
  }
}
