import type { Money } from "@lib/money";
import type { ID } from "$services/shared/kernel";

export type SwapBalanceResult = {
  from: {
    IdStr: string;
    name: string;
    type: string;
    balance: Money;
  };
  to: {
    IdStr: string;
    name: string;
    type: string;
    balance: Money;
  };
};

export type AssetSwapGateway = {
  mutateSwapAsset(
    userId: ID,
    fromAssetId: ID,
    toAssetId: ID,
    amount: Money,
  ): Promise<SwapBalanceResult>;
};
