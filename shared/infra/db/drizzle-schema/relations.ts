import { defineRelations } from "drizzle-orm";
import { userTable } from "./user.schema";
import { settingTable } from "./setting.schema";
import { tokenTable } from "./token.schema";
import { assetTable } from "./asset.schema";
import { contactTable } from "./contact.schema";
import { productTable } from "./product.schema";
import { transactionTable } from "./transaction.schema";
import { orderTable } from "./order.schema";
import { paymentTable } from "./payment.schema";
import { invoiceTable } from "./invoice.schema";
import { passkeyTable } from "./passkey.schema";

export const relations = defineRelations(
  {
    userTable,
    tokenTable,
    assetTable,
    contactTable,
    productTable,
    transactionTable,
    settingTable,
    orderTable,
    paymentTable,
    invoiceTable,
    passkeyTable,
  },
  (r) => ({
    userTable: {
      setting: r.one.settingTable({
        from: r.userTable.id,
        to: r.settingTable.userId,
      }),
      tokens: r.many.tokenTable(),
      passkeys: r.many.passkeyTable(),
    },
    tokenTable: {
      user: r.one.userTable({
        from: r.tokenTable.userId,
        to: r.userTable.id,
      }),
    },
    passkeyTable: {
      user: r.one.userTable({
        from: r.passkeyTable.userId,
        to: r.userTable.id,
      }),
    },
    settingTable: {
      user: r.one.userTable({
        from: r.settingTable.userId,
        to: r.userTable.id,
      }),
    },
    transactionTable: {
      contact: r.one.contactTable({
        from: r.transactionTable.customerId,
        to: r.contactTable.id,
      }),
    },
    contactTable: {
      transactions: r.many.transactionTable({
        from: r.contactTable.id,
        to: r.transactionTable.customerId,
      }),
      orders: r.many.orderTable({
        from: r.contactTable.id,
        to: r.orderTable.customerId,
      }),
    },
    orderTable: {
      contact: r.one.contactTable({
        from: r.orderTable.customerId,
        to: r.contactTable.id,
      }),
    },
    paymentTable: {
      user: r.one.userTable({
        from: r.paymentTable.userId,
        to: r.userTable.id,
      }),
      invoice: r.one.invoiceTable({
        from: r.paymentTable.invoiceId,
        to: r.invoiceTable.id,
      }),
    },
    invoiceTable: {
      user: r.one.userTable({
        from: r.invoiceTable.userId,
        to: r.userTable.id,
      }),
      contact: r.one.contactTable({
        from: r.invoiceTable.customerId,
        to: r.contactTable.id,
      }),
      payments: r.many.paymentTable({
        from: r.invoiceTable.id,
        to: r.paymentTable.invoiceId,
      }),
    },
  }),
);
