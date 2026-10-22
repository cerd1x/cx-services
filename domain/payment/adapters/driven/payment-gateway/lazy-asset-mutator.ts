import type { Money } from "@lib/money";
import type { ID } from "$services/shared/kernel";
import { AssetService } from "$services/domain/assets";
import type { AssetGatewayAsset, AssetMutator } from "./asset-gateway.adapter";

/**
 * `AssetMutator` yang me-resolve `AssetService.getInstance()` saat dipanggil.
 *
 * Komposisi payment tidak boleh menangkap singleton asset saat module load:
 * asset → transaction → asset (siklus), jadi resolusi dilakukan lazy.
 */
export class LazyAssetMutator implements AssetMutator {
  assets(userId: ID): Promise<AssetGatewayAsset[]> {
    return AssetService.getInstance().assets(userId);
  }

  assetById(userId: ID, assetId: ID): Promise<AssetGatewayAsset | null> {
    return AssetService.getInstance().assetById(userId, assetId);
  }

  mutateAddAsset(userId: ID, assetId: ID, amount: Money): Promise<AssetGatewayAsset> {
    return AssetService.getInstance().mutateAddAsset(userId, assetId, amount);
  }

  mutateSubtractAsset(userId: ID, assetId: ID, amount: Money): Promise<AssetGatewayAsset> {
    return AssetService.getInstance().mutateSubtractAsset(userId, assetId, amount);
  }
}
