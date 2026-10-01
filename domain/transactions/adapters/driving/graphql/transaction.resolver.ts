import type { YogaContext } from "$services/shared/infra/graphql/yoga-context";
import typeDefs from "./transaction.gql?raw";
import {
  TransactionType,
  TransactionStatus,
  AssetType,
} from "$services/shared/infra/graphql/types";
import type { Resolvers, Transaction as TxType } from "$services/shared/infra/graphql/types";
import { Transaction } from "../../../core/model/transaction.model";
import type {
  TransactionType as EntityTransactionType,
  PaymentMethod as EntityPaymentMethod,
} from "../../../core/model/transaction.model";
import { Balance } from "../../../../assets/core/value-objects/balance.vo";
import { ID } from "$services/shared/kernel";

const mapTx = (txinp: Transaction): TxType => {
  return {
    id: txinp.id?.toHash ?? "",
    amount: txinp.amount.toString(),
    capital: txinp.capital.toString(),
    type: txinp.type as TransactionType,
    status: txinp.status as TransactionStatus,
    paymentMethod: {
      type: txinp.paymentMethod.type as TxType["paymentMethod"]["type"],
      assetId: txinp.paymentMethod.assetId?.toString() ?? null,
    },
    customerId: txinp?.customerId ? ID.new(txinp?.customerId as string | number).toHash : null,
    category: txinp.category,
    createdAt: txinp.createdAt!,
    updatedAt: txinp.updatedAt,
    description: txinp.description,
  };
};

const resolvers: Resolvers<YogaContext> = {
  Query: {
    transaction: async (_parent, { id }, { transaction, userAuth }) => {
      const tx = await transaction.transaction(ID.new(id), userAuth!.id);
      return mapTx(tx);
    },
    transactions: async (_parent, _args, { transaction, userAuth }) => {
      const list = await transaction.transactions(userAuth!.id);
      return list.map(mapTx);
    },
    transactionConnection: async (_parent, args, { transaction, userAuth }) => {
      const page = await transaction.transactionsPage(userAuth!.id, {
        first: args.first ?? null,
        after: args.after ?? null,
        last: args.last ?? null,
        before: args.before ?? null,
      });
      return {
        edges: page.items.map((node, i) => ({
          cursor: page.cursors[i]!,
          node: mapTx(node),
        })),
        pageInfo: {
          hasNextPage: page.hasNextPage,
          hasPreviousPage: page.hasPreviousPage,
          startCursor: page.cursors[0] ?? null,
          endCursor: page.cursors.at(-1) ?? null,
        },
      };
    },
    transactionsByType: async (_parent, args, { transaction, userAuth }) => {
      const list = await transaction.transactionsByType(args.type, userAuth!.id);
      return list.map(mapTx);
    },
    transactionsByDateRange: async (_parent, args, { transaction, userAuth }) => {
      const list = await transaction.transactionsByDateRange(args.start, args.end, userAuth!.id);
      return list.map(mapTx);
    },
  },
  Mutation: {
    createTransaction: async (
      _parent,
      {
        input: {
          amount,
          capital,
          date: createdAt,
          type,
          category,
          description,
          paymentMethod,
          customerId,
          status,
          payWithAssetId,
          payToAssetId,
        },
      },
      { transaction, userAuth },
    ) => {
      const tx = await transaction.createTransaction({
        type: type as EntityTransactionType,
        amount: Balance.new(amount),
        capital: Balance.new(capital),
        createdAt,
        description: description ?? undefined,
        category: category ?? undefined,
        paymentMethod: paymentMethod
          ? {
              type: paymentMethod.type as EntityPaymentMethod["type"],
              assetId: paymentMethod.assetId ? ID.new(paymentMethod.assetId).toNumb : undefined,
            }
          : undefined,
        customerId: customerId ? ID.new(customerId).toNumb : undefined,
        status: status as TransactionStatus | undefined,
        userId: userAuth!.id.toNumb,
        payWithAssetId: payWithAssetId ? ID.new(payWithAssetId).toNumb : undefined,
        payToAssetId: payToAssetId ? ID.new(payToAssetId).toNumb : undefined,
      });
      return mapTx(tx);
    },
    updateTransaction: async (_parent, { id, input }, { transaction, userAuth }) => {
      const tx = await transaction.updateTransaction(
        ID.new(id),
        {
          type: (input.type ?? undefined) as EntityTransactionType | undefined,
          description: input.description ?? undefined,
          category: input.category ?? undefined,
          paymentMethod: input.paymentMethod
            ? {
                type: input.paymentMethod.type as EntityPaymentMethod["type"],
                assetId: input.paymentMethod.assetId
                  ? ID.new(input.paymentMethod.assetId).toNumb
                  : undefined,
              }
            : undefined,
          customerId: input.customerId ? ID.new(input.customerId).toNumb : undefined,
        },
        userAuth!.id,
      );
      return mapTx(tx);
    },
    deleteTransaction: async (_parent, { id }, { transaction, userAuth }) => {
      await transaction.deleteTransaction(ID.new(id), userAuth!.id);
      return true;
    },
    swapBalance: async (_parent, args, { transaction, userAuth }) => {
      const result = await transaction.swapBalance(
        userAuth!.id,
        ID.new(args.fromAssetId),
        ID.new(args.toAssetId),
        args.amount,
      );
      return {
        from: {
          id: result.from.IdStr,
          name: result.from.name,
          type: result.from.type as AssetType,
          balance: result.from.balance,
        },
        to: {
          id: result.to.IdStr,
          name: result.to.name,
          type: result.to.type as AssetType,
          balance: result.to.balance,
        },
      };
    },
  },
};

export { typeDefs as transactionTypeDefs };
export const transactionResolvers = resolvers;
