import { ID } from "$services/shared/kernel";
import type { Asset, AssetData, AssetUpdate } from "../../model/asset.model";
import type { Balance } from "../../value-objects/balance.vo";
import type { AssetMutationInput, AssetMutationData } from "../../model/asset-mutation.model";

export abstract class AssetRepository {
  abstract save(asset: AssetData & { balance: Balance }, tx?: unknown): Promise<Asset | null>;
  abstract findAll(userId: ID, tx?: unknown): Promise<Asset[]>;
  abstract findByName(name: string, userId: ID, tx?: unknown): Promise<Asset | null>;
  abstract findById(userId: ID, assetId: ID, tx?: unknown): Promise<Asset | null>;
  abstract update(userId: ID, id: number, data: AssetUpdate, tx?: unknown): Promise<Asset>;
  abstract delete(name: string, userId: ID, tx?: unknown): Promise<void>;
  abstract createAssetMutation(
    assetId: ID,
    data: AssetMutationInput,
    tx?: unknown,
  ): Promise<AssetMutationData>;
  abstract findMutationsByAssetId(assetId: ID, userId: ID): Promise<AssetMutationData[]>;
}
