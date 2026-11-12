import { z } from "zod";

export const statisticSchema = z.object({
  totalIncome: z.number().default(0),
  totalExpense: z.number().default(0),
  totalProfit: z.number().default(0),
  totalLoan: z.number().default(0),
  totalCash: z.number().default(0),
  totalAsset: z.number().default(0),
});

export type StatisticInput = z.input<typeof statisticSchema>;
export type StatisticData = z.output<typeof statisticSchema>;

export class Statistic {
  #totalIncome: number;
  #totalExpense: number;
  #totalProfit: number;
  #totalLoan: number;
  #totalCash: number;
  #totalAsset: number;

  private constructor(data: StatisticData) {
    this.#totalIncome = data.totalIncome;
    this.#totalExpense = data.totalExpense;
    this.#totalProfit = data.totalProfit;
    this.#totalLoan = data.totalLoan;
    this.#totalCash = data.totalCash;
    this.#totalAsset = data.totalAsset;
  }

  get totalIncome(): number {
    return this.#totalIncome;
  }

  get totalExpense(): number {
    return this.#totalExpense;
  }

  get totalProfit(): number {
    return this.#totalProfit;
  }

  get totalLoan(): number {
    return this.#totalLoan;
  }

  get totalCash(): number {
    return this.#totalCash;
  }

  get totalAsset(): number {
    return this.#totalAsset;
  }

  get data(): StatisticData {
    return {
      totalIncome: this.#totalIncome,
      totalExpense: this.#totalExpense,
      totalProfit: this.#totalProfit,
      totalLoan: this.#totalLoan,
      totalCash: this.#totalCash,
      totalAsset: this.#totalAsset,
    };
  }

  static new(input: StatisticInput): Statistic {
    const result = statisticSchema.safeParse(input);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
    return new Statistic(result.data);
  }
}
