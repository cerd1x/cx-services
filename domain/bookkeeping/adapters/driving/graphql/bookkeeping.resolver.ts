import type { YogaContext } from "$services/shared/infra/graphql/yoga-context";
import typeDefs from "./bookkeeping.gql?raw";
import type {
  BookkeepingFailedPayment as GqlFailedPayment,
  BookkeepingFilter as GqlBookkeepingFilter,
  BookkeepingLedger as GqlLedger,
  PaymentMethodEnum,
  PaymentStatusEnum,
  Resolvers,
  Transaction as GqlTransaction,
} from "$services/shared/infra/graphql/types";
import { ID } from "$services/shared/kernel";
import type {
  BookkeepingPaymentData,
  BookkeepingTransactionData,
} from "../../../core/model/bookkeeping.model";

function mapTransaction(tx: BookkeepingTransactionData): GqlTransaction {
  return {
    id: ID.transaction(tx.id).str,
    type: tx.type as GqlTransaction["type"],
    status: tx.status as GqlTransaction["status"],
    paymentStatus: tx.paymentStatus as GqlTransaction["paymentStatus"],
    amount: tx.amount,
    capital: tx.capital,
    description: tx.description ?? null,
    category: tx.category ?? null,
    paymentMethod: {
      type: tx.paymentMethod.type as GqlTransaction["paymentMethod"]["type"],
      assetId:
        tx.paymentMethod.assetId !== undefined ? ID.asset(tx.paymentMethod.assetId).str : null,
    },
    customerId: tx.customerId !== undefined ? ID.contact(tx.customerId).str : null,
    createdAt: tx.createdAt,
    updatedAt: tx.updatedAt ?? null,
  };
}

function mapFailedPayment(payment: BookkeepingPaymentData): GqlFailedPayment {
  return {
    id: ID.payment(payment.id).str,
    amount: payment.amount,
    method: payment.method as PaymentMethodEnum,
    status: payment.status as PaymentStatusEnum,
    gatewayRef: payment.gatewayRef ?? null,
    description: payment.description ?? null,
    retryCount: payment.retryCount,
    maxRetries: payment.maxRetries,
    canRetry: payment.retryCount < payment.maxRetries,
    lastError: payment.lastError ?? null,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt ?? null,
  };
}

const resolvers: Resolvers<YogaContext> = {
  Query: {
    bookkeepingLedger: async (_parent, { input }, { bookkeeping, userAuth }) => {
      const ledger = await bookkeeping.getLedger({
        userId: userAuth!.id,
        month: input.month,
        timezoneOffsetMinutes: input.timezoneOffsetMinutes ?? 0,
        filter: input.filter ?? undefined,
      });

      return {
        month: ledger.month,
        filter: ledger.filter as GqlBookkeepingFilter,
        summaries: ledger.summaries.map((summary) => ({
          currency: summary.currency,
          income: summary.income,
          expense: summary.expense,
          profit: summary.profit,
          transactionCount: summary.transactionCount,
        })),
        groups: ledger.groups.map((group) => ({
          date: group.date,
          transactionCount: group.transactionCount,
          entries: group.entries.map((entry) => ({
            transaction: mapTransaction(entry.transaction),
            runningBalance: entry.runningBalance,
          })),
        })),
      } satisfies GqlLedger;
    },
    bookkeepingFailedPayments: async (_parent, { input }, { bookkeeping, userAuth }) => {
      const result = await bookkeeping.getFailedPayments({
        userId: userAuth!.id,
        month: input.month,
        timezoneOffsetMinutes: input.timezoneOffsetMinutes ?? 0,
      });

      return {
        month: result.month,
        payments: result.payments.map(mapFailedPayment),
        totalCount: result.totalCount,
        retryableCount: result.retryableCount,
      };
    },
  },
};

export { typeDefs as bookkeepingTypeDefs };
export const bookkeepingResolvers = resolvers;
