import type { StatisticData } from "../../adapters/driven/drizzle/statistic.entity";

export class StatisticModel {
  static totalProfit(totalIncome: number, totalExpense: number): number {
    return totalIncome - totalExpense;
  }

  static summary(
    totals: Pick<StatisticData, "totalIncome" | "totalExpense">,
  ): Omit<StatisticData, "totalIncome" | "totalExpense" | "totalLoan" | "totalCash" | "totalAsset"> & {
    totalProfit: number;
  } {
    return { totalProfit: this.totalProfit(totals.totalIncome, totals.totalExpense) };
  }
}