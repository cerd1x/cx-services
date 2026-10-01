import type { YogaContext } from "$services/shared/infra/graphql/yoga-context";
import { ID } from "$services/shared/kernel";
import typeDefs from "./order.gql?raw";
import type { Resolvers } from "$services/shared/infra/graphql/types";

const isValidPaymentMethodType = (type: string): boolean => {
  return ["cash", "bank_transfer", "ewallet", "credit_card", "debit_card", "credit"].includes(type);
};

const mapPaymentMethod = (input: string | null | undefined): string | undefined => {
  if (!input) return undefined;
  return isValidPaymentMethodType(input) ? input : undefined;
};

const resolvers: Resolvers<YogaContext> = {
  Query: {
    order: async (_parent, args, { order, userAuth }) => {
      const result = await order.order(ID.new(args.id), userAuth!.id);
      return {
        id: result.id?.toHash ?? "",
        userId: result.userId?.toString(),
        status: result.status,
        paymentMethod: result.paymentMethod,
        totalAmount: result.totalAmount,
        currency: result.currency,
        itemCount: result.itemCount,
        description: result.description,
        customerId: result.customerId?.toString(),
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      };
    },
    orders: async (_parent, _args, { order, userAuth }) => {
      const orders = await order.orders(userAuth!.id);
      return orders.map((o) => ({
        id: o.id?.toHash ?? "",
        userId: o.userId?.toString(),
        status: o.status,
        paymentMethod: o.paymentMethod,
        totalAmount: o.totalAmount,
        currency: o.currency,
        itemCount: o.itemCount,
        description: o.description,
        customerId: o.customerId?.toString(),
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
      }));
    },
  },
  Mutation: {
    createOrder: async (_parent, args, { order, userAuth }) => {
      const result = await order.createOrder({
        userId: userAuth!.id.toNumb,
        price: args.input.totalAmount,
        currency: args.input.currency,
        itemCount: args.input.itemCount,
        paymentMethod: mapPaymentMethod(args.input.paymentMethod),
        description: args.input.description ?? undefined,
        customerId: args.input.customerId ? parseInt(args.input.customerId) : undefined,
      });
      return {
        id: result.id?.toHash ?? "",
        userId: result.userId?.toString(),
        status: result.status,
        paymentMethod: result.paymentMethod,
        totalAmount: result.totalAmount,
        currency: result.currency,
        itemCount: result.itemCount,
        description: result.description,
        customerId: result.customerId?.toString(),
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      };
    },
    updateOrder: async (_parent, args, { order, userAuth }) => {
      const result = await order.updateOrder(
        ID.new(args.id),
        {
          status: (args.input.status as "pending" | "success" | "cancelled") ?? undefined,
          paymentMethod: mapPaymentMethod(args.input.paymentMethod),
          description: args.input.description ?? undefined,
          customerId: args.input.customerId ? parseInt(args.input.customerId) : undefined,
        },
        userAuth!.id,
      );
      return {
        id: result.id?.toHash ?? "",
        userId: result.userId?.toString(),
        status: result.status,
        paymentMethod: result.paymentMethod,
        totalAmount: result.totalAmount,
        currency: result.currency,
        itemCount: result.itemCount,
        description: result.description,
        customerId: result.customerId?.toString(),
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      };
    },
    createOrderProductSale: async (_parent, args, { order, userAuth }) => {
      const result = await order.createOrderProductSale({
        userId: userAuth!.id.toNumb,
        productId: ID.new(args.input.productId),
        itemCount: args.input.itemCount,
        price: args.input.totalAmount,
        currency: args.input.currency,
        paymentMethod: mapPaymentMethod(args.input.paymentMethod),
        customerId: args.input.customerId ? ID.new(args.input.customerId).toNumb : undefined,
        description: args.input.description ?? undefined,
        payToAssetId: args.input.payToAssetId ? ID.new(args.input.payToAssetId).toNumb : undefined,
      });
      return {
        id: result.id?.toHash ?? "",
        userId: result.userId?.toString(),
        status: result.status,
        paymentMethod: result.paymentMethod,
        totalAmount: result.totalAmount,
        currency: result.currency,
        itemCount: result.itemCount,
        description: result.description,
        customerId: result.customerId?.toString(),
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      };
    },
    createOrderExpense: async (_parent, args, { order, userAuth }) => {
      const result = await order.createOrderExpense({
        userId: userAuth!.id.toNumb,
        price: args.input.totalAmount,
        currency: args.input.currency,
        itemCount: args.input.itemCount,
        paymentMethod: mapPaymentMethod(args.input.paymentMethod),
        customerId: args.input.customerId ? ID.new(args.input.customerId).toNumb : undefined,
        description: args.input.description ?? undefined,
        payWithAssetId: args.input.payWithAssetId
          ? ID.new(args.input.payWithAssetId).toNumb
          : undefined,
      });
      return {
        id: result.id?.toHash ?? "",
        userId: result.userId?.toString(),
        status: result.status,
        paymentMethod: result.paymentMethod,
        totalAmount: result.totalAmount,
        currency: result.currency,
        itemCount: result.itemCount,
        description: result.description,
        customerId: result.customerId?.toString(),
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      };
    },
    createOrderLoan: async (_parent, args, { order, userAuth }) => {
      const result = await order.createOrderLoan({
        userId: userAuth!.id.toNumb,
        price: args.input.totalAmount,
        currency: args.input.currency,
        itemCount: args.input.itemCount,
        paymentMethod: mapPaymentMethod(args.input.paymentMethod),
        customerId: args.input.customerId ? ID.new(args.input.customerId).toNumb : undefined,
        description: args.input.description ?? undefined,
        payWithAssetId: args.input.payWithAssetId
          ? ID.new(args.input.payWithAssetId).toNumb
          : undefined,
      });
      return {
        id: result.id?.toHash ?? "",
        userId: result.userId?.toString(),
        status: result.status,
        paymentMethod: result.paymentMethod,
        totalAmount: result.totalAmount,
        currency: result.currency,
        itemCount: result.itemCount,
        description: result.description,
        customerId: result.customerId?.toString(),
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      };
    },
    deleteOrder: async (_parent, args, { order, userAuth }) => {
      await order.deleteOrder(ID.new(args.id), userAuth!.id);
      return true;
    },
  },
};

export { typeDefs as orderTypeDefs };
export const orderResolvers = resolvers;
