import type { Resolvers, Asset, AssetType } from "$gql/types.generated";
import type { YogaContext } from "$services/shared/infra/graphql/yoga-context";
import { Balance } from "../../../core/value-objects/balance.vo";
import type { AssetInput } from "../../driven/drizzle/asset.entity";
import { ID } from "$services/shared/kernel";
import typeDefs from "./asset.gql?raw";

const resolvers: Resolvers<YogaContext> = {
  Query: {
    assets: async (_parent, _args, { asset, userAuth }) => {
      let result: Asset[] = [];
      const assets = await asset.assets(userAuth!.id);

      for (const item of assets) {
        result = [
          ...result,
          { balance: item.balance, name: item.name, type: item.type as AssetType, id: item.IdStr },
        ];
      }

      return result;
    },
    asset: async (_, args, { asset, userAuth }) => {
      const result = await asset.assetByName(args.name, userAuth!.id);
      return {
        id: result.IdStr,
        balance: result.balance,
        name: result.name,
        type: result.type as AssetType,
      };
    },
    assetById: async (_, args, { asset, userAuth }) => {
      const result = await asset.assetById(userAuth!.id, ID.new(args.id));
      if (!result) return null;
      return {
        id: result.IdStr,
        balance: result.balance,
        name: result.name,
        type: result.type as AssetType,
      };
    },
    assetMutations: async (_parent, args, { asset, userAuth }) => {
      const mutations = await asset.assetMutations(userAuth!.id, ID.new(args.assetId));
      return mutations.map((m) => ({
        id: String(m.id),
        type: m.type,
        amount: m.amount,
        currency: m.currency,
        balanceBefore: m.balanceBefore,
        balanceAfter: m.balanceAfter,
        description: m.description ?? null,
        createdAt: m.createdAt ?? new Date().toISOString(),
      }));
    },
  },
  Mutation: {
    createAsset: async (_parent, args, { asset, userAuth }) => {
      const { name, type, balance } = args.input;
      const result = await asset.createAsset({
        userId: userAuth!.id,
        balance: Balance.new(balance),
        name,
        type: type as AssetType,
      });
      return {
        id: result.IdStr,
        balance: result.balance,
        name: result.name,
        type: result.type as AssetType,
      };
    },
    updateAsset: async (_parent, args, { asset, userAuth }) => {
      const input: Partial<AssetInput> & { balance?: Balance } = {};
      if (args.input.name) input.name = args.input.name;
      if (args.input.type) input.type = args.input.type as AssetType;
      if (args.input.balance) input.balance = Balance.new(args.input.balance);

      const result = await asset.updateAsset(userAuth!.id, ID.new(args.id), input);
      return {
        id: result.IdStr,
        balance: result.balance,
        name: result.name,
        type: result.type as AssetType,
      };
    },
    addBalance: async (_parent, args, { asset, userAuth }) => {
      const result = await asset.mutateAddAsset(userAuth!.id, ID.new(args.assetId), args.amount);
      return {
        id: result.IdStr,
        balance: result.balance,
        name: result.name,
        type: result.type as AssetType,
      };
    },
    subtractBalance: async (_parent, args, { asset, userAuth }) => {
      const result = await asset.mutateSubtractAsset(
        userAuth!.id,
        ID.new(args.assetId),
        args.amount,
      );
      return {
        id: result.IdStr,
        balance: result.balance,
        name: result.name,
        type: result.type as AssetType,
      };
    },
    deleteAsset: async (_parent, args, { asset, userAuth }) => {
      await asset.deleteAsset(args.name, userAuth!.id);
      return true;
    },
  },
};

export { typeDefs as assetTypeDefs };
export const assetResolvers = resolvers;
