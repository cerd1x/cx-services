import type { ID } from "$services/shared/kernel";
import type { MutateAssetInput, MutateAssetResult } from "$services/domain/assets";
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

  mutateAsset(input: MutateAssetInput): Promise<MutateAssetResult> {
    return AssetService.getInstance().mutateAsset(input);
  }
}
