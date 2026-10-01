import type { SwapBalanceResult, AssetSwapGateway } from "../ports/out/asset-swap-gateway.port";
import { ID } from "$services/shared/kernel";

export class AssetSwapGatewayCtx implements AssetSwapGateway {
  mutateSwapAsset(
    _userId: ID,
    _fromAssetId: ID,
    _toAssetId: ID,
    _amount: string,
  ): Promise<SwapBalanceResult> {
    throw new Error("Method not implemented.");
  }
}