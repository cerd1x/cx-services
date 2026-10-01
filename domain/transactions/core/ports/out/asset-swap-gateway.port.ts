import type { ID } from "$services/shared/kernel";

export type SwapBalanceResult = {
  from: {
    IdStr: string;
    name: string;
    type: string;
    balance: string;
  };
  to: {
    IdStr: string;
    name: string;
    type: string;
    balance: string;
  };
};

export type AssetSwapGateway = {
  mutateSwapAsset(
    userId: ID,
    fromAssetId: ID,
    toAssetId: ID,
    amount: string,
  ): Promise<SwapBalanceResult>;
};