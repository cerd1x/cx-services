import { eq, and } from "drizzle-orm";
import { getDB } from "$services/shared/infra/db";
import { transactionTable } from "$services/shared/infra/db/drizzle-schema/transaction.schema";
import { assetTable } from "$services/shared/infra/db/drizzle-schema/asset.schema";
import type { StatisticData } from "../../../core/entity/statistic.entity";
import { StatisticRepository } from "../../../core/ports/out/statistic-repository.port";

function parseAmountValue(amount: string): number {
  const match = amount.trim().match(/^([A-Z]{3})\s+(-?[\d,]+(?:\.\d+)?)$/);
  if (!match) return 0;
  return parseFloat(match[2].replace(/,/g, ""));
}

export class StatisticRepositoryImpl implements StatisticRepository {
  async getStatistic(userId: number): Promise<StatisticData> {
    const txRows = await getDB()
      .select()
      .from(transactionTable)
      .where(eq(transactionTable.userId, userId));

    const assetRows = await getDB()
      .select({ type: assetTable.type, balance: assetTable.balance })
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
      .reduce((sum, a) => sum + a.balance, 0);
    const totalCash = assetRows
      .filter((a) => a.type === "cash")
      .reduce((sum, a) => sum + a.balance, 0);
    const totalAsset = assetRows.reduce((sum, a) => sum + a.balance, 0) + totalProfit;

    return { totalIncome, totalExpense, totalProfit, totalLoan, totalCash, totalAsset };
  }
}
