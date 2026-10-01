import { Asset } from "../../adapters/driven/drizzle/asset.entity";
import { AssetMutation, type AssetMutationInput } from "../../adapters/driven/drizzle/asset-mutation.entity";
import { Balance } from "../value-objects/balance.vo";
import { BalanceModel } from "./balance.model";
import { RequiredErr } from "$services/shared/kernel/errors/service-error";

export class AssetRules {
  static validateAssetName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new RequiredErr("name", { class: AssetRules });
    }
    if (name.length > 100) {
      throw new RequiredErr("name", { class: AssetRules });
    }
  }

  static validateAssetType(type: Asset["type"]): void {
    const validTypes = ["bank", "ewallet", "cash", "loan", "crypto"] as const;
    if (!validTypes.includes(type)) {
      throw new RequiredErr("type", { class: AssetRules });
    }
  }

  static validateMutationAmount(amount: number): void {
    if (amount <= 0) {
      throw new RequiredErr("amount", { class: AssetRules });
    }
  }

  static validateBalanceForMutation(currentBalance: Balance, amount: Balance, type: "add" | "subtract"): void {
    if (type === "subtract") {
      BalanceModel.canSubtract(currentBalance, amount);
    }
  }

  static canMutateAsset(asset: Asset, type: "add" | "subtract", amount: Balance): void {
    this.validateMutationAmount(amount.value);
    if (type === "subtract") {
      const current = Balance.new(asset.balance);
      BalanceModel.canSubtract(current, amount);
    }
  }

  static validateSwapPreconditions(fromAsset: Asset, toAsset: Asset, amount: Balance): void {
    if (fromAsset.IdStr === toAsset.IdStr) {
      throw new RequiredErr("swap", { class: AssetRules });
    }
    this.validateMutationAmount(amount.value);
    const fromBalance = Balance.new(fromAsset.balance);
    BalanceModel.canSubtract(fromBalance, amount);
  }

  static createMutationData(input: AssetMutationInput): AssetMutationInput {
    return {
      ...input,
      description: input.description ?? null,
    };
  }
}
