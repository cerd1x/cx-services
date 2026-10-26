import { eq } from "drizzle-orm";
import { getDB } from "$services/shared/infra/db";
import { deserializeMoney, fromMinorUnits } from "$services/shared/infra/db/money";
import { transactionTable } from "$services/shared/infra/db/drizzle-schema/transaction.schema";
import { assetTable } from "$services/shared/infra/db/drizzle-schema/asset.schema";
import type { StatisticData } from "../../../core/model/statistic.model";
import { StatisticRepository } from "../../../core/ports/out/statistic-repository.port";

/** Nominal transaksi (string instance `Money` "IDR 1500000") -> angka major unit. */
function parseAmountValue(amount: string): number {
  try {
    return deserializeMoney(amount).toNumber();
  } catch {
    return 0;
  }
}

/** Saldo asset (minor unit) -> angka major unit. */
function parseBalanceValue(balance: number, currency: string): number {
  try {
    return fromMinorUnits(balance, currency).toNumber();
  } catch {
    return 0;
  }
}

export class StatisticRepositoryImpl implements StatisticRepository {
  async getStatistic(userId: number): Promise<StatisticData> {
    const txRows = await getDB()
      .select()
      .from(transactionTable)
      .where(eq(transactionTable.userId, userId));

    const assetRows = await getDB()
      .select({
        type: assetTable.type,
        balance: assetTable.balance,
        currency: assetTable.currency,
      })
      .from(assetTable)
      .where(eq(assetTable.userId, userId));

    const totalIncome = txRows
      .filter((r) => r.type === "income")
      .reduce((sum, r) => sum + parseAmountValue(r.amount), 0);

    const totalExpense = txRows
      .filter((r) => r.type === "expense")
      .reduce((sum, r) => sum + parseAmountValue(r.amount), 0);

    const totalProfit = txRows
      .filter((r) => {
        if (r.type !== "income") return false;
        if (
          r.category != null &&
          typeof r.category === "string" &&
          r.category.length > 0 &&
          r.category.includes("Add Balance")
        )
          return false;
        return true;
      })
      .reduce((sum, r) => sum + parseAmountValue(r.amount) - parseAmountValue(r.capital), 0);

    const totalLoan = assetRows
      .filter((a) => a.type === "loan")
      .reduce((sum, a) => sum + parseBalanceValue(a.balance, a.currency), 0);
    const totalCash = assetRows
      .filter((a) => a.type === "cash")
      .reduce((sum, a) => sum + parseBalanceValue(a.balance, a.currency), 0);
    const totalAsset =
      assetRows.reduce((sum, a) => sum + parseBalanceValue(a.balance, a.currency), 0) + totalProfit;

    return { totalIncome, totalExpense, totalProfit, totalLoan, totalCash, totalAsset };
  }
}
