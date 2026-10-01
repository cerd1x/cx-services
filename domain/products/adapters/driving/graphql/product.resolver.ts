import type { YogaContext } from "$services/shared/infra/graphql/yoga-context";
import { ID } from "$services/shared/kernel";
import typeDefs from "./product.gql?raw";
import type { Resolvers } from "$services/shared/infra/graphql/types";

const resolvers: Resolvers<YogaContext> = {
  Query: {
    product: async (_parent, args, { product, userAuth }) => {
      const result = await product.product(ID.new(args.id), userAuth!.id.toNumb);
      return {
        id: result.id?.toHash ?? "",
        name: result.name,
        description: result.description,
        price: result.price,
        capital: result.capital,
        margin: result.margin,
        currency: result.currency,
        stock: result.stock,
        trackStock: result.trackStock,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      };
    },
    products: async (_parent, _args, { product, userAuth }) => {
      const products = await product.products(userAuth!.id.toNumb);
      return products.map((p) => ({
        id: p.id?.toHash ?? "",
        name: p.name,
        description: p.description,
        price: p.price,
        capital: p.capital,
        margin: p.margin,
        currency: p.currency,
        stock: p.stock,
        trackStock: p.trackStock,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }));
    },
  },
  Mutation: {
    createProduct: async (_parent, args, { product, userAuth, setting }) => {
      const userSetting = await setting.settingByUserId(userAuth!.id.toNumb);
      const result = await product.createProduct(
        userAuth!.id.toNumb,
        args.input.name,
        args.input.price,
        userSetting.currency,
        args.input.description ?? undefined,
        args.input.stock ?? undefined,
        args.input.capital ?? undefined,
        args.input.trackStock ?? undefined,
      );
      return {
        id: result.id?.toHash ?? "",
        name: result.name,
        description: result.description,
        price: result.price,
        capital: result.capital,
        margin: result.margin,
        currency: result.currency,
        stock: result.stock,
        trackStock: result.trackStock,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      };
    },
    updateProduct: async (_parent, args, { product, userAuth }) => {
      const result = await product.updateProduct(
        ID.new(args.id),
        {
          name: args.input.name ?? undefined,
          description: args.input.description ?? undefined,
          price: args.input.price ?? undefined,
          capital: args.input.capital ?? undefined,
          currency: args.input.currency ?? undefined,
          stock: args.input.stock ?? undefined,
          trackStock: args.input.trackStock ?? undefined,
        },
        userAuth!.id.toNumb,
      );
      return {
        id: result.id?.toHash ?? "",
        name: result.name,
        description: result.description,
        price: result.price,
        capital: result.capital,
        margin: result.margin,
        currency: result.currency,
        stock: result.stock,
        trackStock: result.trackStock,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      };
    },
    deleteProduct: async (_parent, args, { product, userAuth }) => {
      await product.deleteProduct(ID.new(args.id), userAuth!.id.toNumb);
      return true;
    },
    importProductFromCSV: async (_parent, args, { product, userAuth }) => {
      if (!userAuth) throw new Error("Not authenticated");
      const buffer = Buffer.from(args.content, "base64");
      const file = new File([buffer], args.filename, { type: "text/csv" });
      const result = await product.importFromFile(userAuth.id.toNumb, file);
      return {
        imported: result.imported,
        failed: result.failed,
        merged: result.merged,
      };
    },
  },
};

export { typeDefs as productTypeDefs };
export const productResolvers = resolvers;
