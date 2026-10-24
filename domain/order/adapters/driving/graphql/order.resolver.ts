import type { YogaContext } from "$services/shared/infra/graphql/yoga-context";
import { ID } from "$services/shared/kernel";
import typeDefs from "./order.gql?raw";
import type {
  Resolvers,
  Order as GqlOrder,
  PaymentMethodType,
} from "$services/shared/infra/graphql/types";
import type { Order as OrderEntity } from "../../../core/model/order.model";
import { resolveMoney } from "../../../core/usecase/order_input.validator";

const isValidPaymentMethodType = (type: string): boolean => {
  return ["cash", "bank_transfer", "ewallet", "credit_card", "debit_card", "credit"].includes(type);
};

const mapPaymentMethod = (input: PaymentMethodType | null | undefined): string | undefined => {
  if (!input) return undefined;
  return isValidPaymentMethodType(input) ? input : undefined;
};

const mapOrder = (order: OrderEntity): GqlOrder => ({
  id: order.id?.toHash ?? "",
  userId: order.userId?.toString(),
  status: order.status,
  paymentMethod: order.paymentMethod as PaymentMethodType,
  totalAmount: order.totalAmount.toNumber(),
  currency: order.currency,
  itemCount: order.itemCount,
  description: order.description,
  customerId: order.customerId?.toString(),
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
});

const resolvers: Resolvers<YogaContext> = {
  Query: {
    order: async (_parent, args, { order, userAuth }) => {
      const result = await order.order(ID.new(args.id), userAuth!.id);
      return mapOrder(result);
    },
    orders: async (_parent, _args, { order, userAuth }) => {
      const orders = await order.orders(userAuth!.id);
      return orders.map(mapOrder);
    },
  },
  Mutation: {
    createOrder: async (_parent, args, { order, userAuth }) => {
      const result = await order.createOrder({
        userId: userAuth!.id.toNumb,
        price: resolveMoney(args.input.totalAmount, args.input.currency),
        itemCount: args.input.itemCount,
        paymentMethod: mapPaymentMethod(args.input.paymentMethod),
        description: args.input.description ?? undefined,
        customerId: args.input.customerId ? parseInt(args.input.customerId) : undefined,
      });
      return mapOrder(result);
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
      return mapOrder(result);
    },
    createOrderProductSale: async (_parent, args, { order, userAuth }) => {
      const result = await order.createOrderProductSale({
        userId: userAuth!.id.toNumb,
        productId: ID.new(args.input.productId),
        itemCount: args.input.itemCount,
        price: resolveMoney(args.input.totalAmount, args.input.currency),
        paymentMethod: mapPaymentMethod(args.input.paymentMethod),
        customerId: args.input.customerId ? ID.new(args.input.customerId).toNumb : undefined,
        description: args.input.description ?? undefined,
        payWithAssetId: args.input.payWithAssetId
          ? ID.new(args.input.payWithAssetId).toNumb
          : undefined,
        paymentStatus: args.input.paymentStatus ?? undefined,
      });
      return mapOrder(result);
    },
    createOrderExpense: async (_parent, args, { order, userAuth }) => {
      const result = await order.createOrderExpense({
        userId: userAuth!.id.toNumb,
        price: resolveMoney(args.input.totalAmount, args.input.currency),
        itemCount: args.input.itemCount,
        paymentMethod: mapPaymentMethod(args.input.paymentMethod),
        customerId: args.input.customerId ? ID.new(args.input.customerId).toNumb : undefined,
        description: args.input.description ?? undefined,
        payWithAssetId: args.input.payWithAssetId
          ? ID.new(args.input.payWithAssetId).toNumb
          : undefined,
      });
      return mapOrder(result);
    },
    createOrderLoan: async (_parent, args, { order, userAuth }) => {
      const result = await order.createOrderLoan({
        userId: userAuth!.id.toNumb,
        price: resolveMoney(args.input.totalAmount, args.input.currency),
        itemCount: args.input.itemCount,
        paymentMethod: mapPaymentMethod(args.input.paymentMethod),
        customerId: args.input.customerId ? ID.new(args.input.customerId).toNumb : undefined,
        description: args.input.description ?? undefined,
        payWithAssetId: args.input.payWithAssetId
          ? ID.new(args.input.payWithAssetId).toNumb
          : undefined,
        paymentStatus: args.input.paymentStatus ?? undefined,
      });
      return mapOrder(result);
    },
    deleteOrder: async (_parent, args, { order, userAuth }) => {
      await order.deleteOrder(ID.new(args.id), userAuth!.id);
      return true;
    },
  },
};

export { typeDefs as orderTypeDefs };
export const orderResolvers = resolvers;
