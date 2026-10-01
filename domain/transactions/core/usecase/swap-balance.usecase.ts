import type { SwapBalanceResult } from "../ports/out/asset-swap-gateway.port";
import { ID } from "$services/shared/kernel";
import { AssetSwapGatewayCtx } from "./asset-swap-gateway.ctx";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type SwapBalanceInput = {
  userId: ID;
  fromAssetId: ID;
  toAssetId: ID;
  amount: string;
};

export class SwapBalanceUseCase extends CoreUsecase<SwapBalanceResult, SwapBalanceInput> {
  @logMethod(logger)
  async execute(input: SwapBalanceInput): Promise<SwapBalanceResult> {
    const asset = this.deps.get(AssetSwapGatewayCtx);
    const { userId, fromAssetId, toAssetId, amount } = input;
    const result = await asset.mutateSwapAsset(
      userId,
      fromAssetId,
      toAssetId,
      amount,
    );
    return result;
  }
}