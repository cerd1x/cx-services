import type { YogaContext } from "$services/shared/infra/graphql/yoga-context";
import typeDefs from "./payment.gql?raw";
import type {
  Resolvers,
  Payment as GqlPayment,
  Invoice as GqlInvoice,
  PaymentStatusEnum,
  InvoiceStatusEnum,
  PaymentMethodEnum,
} from "$services/shared/infra/graphql/types";
import type { PaymentData } from "../../../core/model/payment.model";
import type { InvoiceData } from "../../../core/model/invoice.model";
import { ID } from "$services/shared/kernel";

const toHashOrNull = (numb?: number): string | null =>
  numb !== undefined ? ID.new(numb).toHash : null;

function mapPayment(data: PaymentData): GqlPayment {
  return {
    id: data.id !== undefined ? ID.new(data.id).toHash : "",
    userId: ID.new(data.userId).toHash,
    invoiceId: toHashOrNull(data.invoiceId),
    amount: data.amount,
    currency: data.currency,
    method: data.method as PaymentMethodEnum,
    status: data.status as PaymentStatusEnum,
    gatewayRef: data.gatewayRef ?? null,
    description: data.description ?? null,
    retryCount: data.retryCount,
    maxRetries: data.maxRetries,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt ?? null,
  };
}

function mapInvoice(data: InvoiceData): GqlInvoice {
  return {
    id: data.id !== undefined ? ID.new(data.id).toHash : "",
    userId: ID.new(data.userId).toHash,
    invoiceNumber: data.invoiceNumber,
    customerId: toHashOrNull(data.customerId),
    items: data.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
    subtotal: data.subtotal,
    tax: data.tax,
    totalAmount: data.totalAmount,
    currency: data.currency,
    status: data.status as InvoiceStatusEnum,
    issuedAt: data.issuedAt ?? null,
    dueAt: data.dueAt ?? null,
    paidAt: data.paidAt ?? null,
    description: data.description ?? null,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt ?? null,
  };
}

const resolvers: Resolvers<YogaContext> = {
  Query: {
    payment: async (_parent, { id }, { payment, userAuth }) => {
      const data = await payment.getPayment(ID.new(id), userAuth!.id);
      return mapPayment(data);
    },
    payments: async (_parent, _args, { payment, userAuth }) => {
      const list = await payment.listPayments(userAuth!.id);
      return list.map(mapPayment);
    },
    paymentsByStatus: async (_parent, args, { payment, userAuth }) => {
      const list = await payment.listPaymentsByStatus(args.status, userAuth!.id);
      return list.map(mapPayment);
    },
    invoice: async (_parent, { id }, { payment, userAuth }) => {
      const data = await payment.getInvoice(ID.new(id), userAuth!.id);
      return mapInvoice(data);
    },
    invoices: async (_parent, _args, { payment, userAuth }) => {
      const list = await payment.listInvoices(userAuth!.id);
      return list.map(mapInvoice);
    },
    invoicesByStatus: async (_parent, args, { payment, userAuth }) => {
      const list = await payment.listInvoicesByStatus(args.status, userAuth!.id);
      return list.map(mapInvoice);
    },
  },
  Mutation: {
    processPayment: async (
      _parent,
      { input: { amount, currency, method, invoiceId, description } },
      { payment, userAuth },
    ) => {
      const data = await payment.processPayment({
        userId: userAuth!.id.toNumb,
        amount,
        currency,
        method,
        invoiceId: invoiceId ? ID.new(invoiceId).toNumb : undefined,
        description: description ?? undefined,
      });
      return mapPayment(data);
    },
    retryPayment: async (_parent, { paymentId }, { payment, userAuth }) => {
      const data = await payment.retryPayment(ID.new(paymentId), userAuth!.id);
      return mapPayment(data);
    },
    createInvoice: async (
      _parent,
      { input: { customerId, items, currency, tax, dueAt, description } },
      { payment, userAuth },
    ) => {
      const data = await payment.createInvoice({
        userId: userAuth!.id.toNumb,
        customerId: customerId ? ID.new(customerId).toNumb : undefined,
        items,
        currency,
        tax: tax ?? undefined,
        dueAt: dueAt ?? undefined,
        description: description ?? undefined,
      });
      return mapInvoice(data);
    },
    issueInvoice: async (_parent, { id }, { payment, userAuth }) => {
      const data = await payment.issueInvoice(ID.new(id), userAuth!.id);
      return mapInvoice(data);
    },
    cancelInvoice: async (_parent, { id }, { payment, userAuth }) => {
      const data = await payment.cancelInvoice(ID.new(id), userAuth!.id);
      return mapInvoice(data);
    },
  },
};

export { typeDefs as paymentTypeDefs };
export const paymentResolvers = resolvers;
