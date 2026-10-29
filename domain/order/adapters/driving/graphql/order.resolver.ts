import type { YogaContext } from "$services/shared/infra/graphql/yoga-context";
import { ID } from "$services/shared/kernel";
import typeDefs from "./order.gql?raw";
import type {
  Resolvers,
  Order as GqlOrder,
  PaymentMethodType,
} from "$services/shared/infra/graphql/types";
import type { Order as OrderEntity } from "../../../core/model/order.model";

const isValidPaymentMethodType = (type: string): boolean => {
  return ["cash", "bank_transfer", "ewallet", "credit_card", "debit_card", "credit"].includes(type);
};

const mapPaymentMethod = (input: PaymentMethodType | null | undefined): string | undefined => {
  if (!input) return undefined;
  return isValidPaymentMethodType(input) ? input : undefined;
};

const mapOrder = (order: OrderEntity): GqlOrder => ({
  id: order.id?.str ?? "",
  userId: order.userId !== undefined ? ID.user(order.userId).str : undefined,
  status: order.status,
  paymentMethod: order.paymentMethod as PaymentMethodType,
  price: order.totalAmount,
  itemCount: order.itemCount,
  description: order.description,
  customerId: order.customerId !== undefined ? ID.contact(order.customerId).str : undefined,
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
        userId: userAuth!.id.decode,
        price: args.input.price,
        itemCount: args.input.itemCount,
        paymentMethod: mapPaymentMethod(args.input.paymentMethod),
        description: args.input.description ?? undefined,
        customerId: args.input.customerId ? ID.new(args.input.customerId).decode : undefined,
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
          customerId: args.input.customerId ? ID.new(args.input.customerId).decode : undefined,
        },
        userAuth!.id,
      );
      return mapOrder(result);
    },
    createOrderProductSale: async (_parent, args, { order, userAuth }) => {
      const result = await order.createOrderProductSale({
        userId: userAuth!.id.decode,
        productId: ID.new(args.input.productId),
        itemCount: args.input.itemCount,
        price: args.input.price,
        paymentMethod: mapPaymentMethod(args.input.paymentMethod),
        customerId: args.input.customerId ? ID.new(args.input.customerId).decode : undefined,
        description: args.input.description ?? undefined,
        payWithAssetId: args.input.payWithAssetId
          ? ID.new(args.input.payWithAssetId).decode
          : undefined,
        paymentStatus: args.input.paymentStatus ?? undefined,
      });
      return mapOrder(result);
    },
    createOrderExpense: async (_parent, args, { order, userAuth }) => {
      const result = await order.createOrderExpense({
        userId: userAuth!.id.decode,
        price: args.input.price,
        itemCount: args.input.itemCount,
        paymentMethod: mapPaymentMethod(args.input.paymentMethod),
        customerId: args.input.customerId ? ID.new(args.input.customerId).decode : undefined,
        description: args.input.description ?? undefined,
        payWithAssetId: args.input.payWithAssetId
          ? ID.new(args.input.payWithAssetId).decode
          : undefined,
      });
      return mapOrder(result);
    },
    createOrderLoan: async (_parent, args, { order, userAuth }) => {
      const result = await order.createOrderLoan({
        userId: userAuth!.id.decode,
        price: args.input.price,
        itemCount: args.input.itemCount,
        paymentMethod: mapPaymentMethod(args.input.paymentMethod),
        customerId: args.input.customerId ? ID.new(args.input.customerId).decode : undefined,
        description: args.input.description ?? undefined,
        payWithAssetId: args.input.payWithAssetId
          ? ID.new(args.input.payWithAssetId).decode
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
