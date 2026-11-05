import { findCurrency, Money } from "@lib/money";
import { ValidationError } from "$services/shared/kernel/errors/service-error";
import { z } from "zod";

/**
 * Filter buku besar.
 *
 * `all` menampilkan semua tipe transaksi. `outcome` disediakan karena
 * `TransactionType` di modul transactions juga memuat nilai tersebut, walau
 * chip-nya belum dipakai di cx-dompetqu.
 */
export const BOOKKEEPING_FILTERS = ["all", "income", "expense", "transfer", "outcome"] as const;

export type BookkeepingFilter = (typeof BOOKKEEPING_FILTERS)[number];

export const bookkeepingFilterSchema = z.enum(BOOKKEEPING_FILTERS);

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Month must use YYYY-MM format");

const timezoneOffsetSchema = z
  .number()
  .int("Timezone offset must be an integer")
  .min(-840, "Timezone offset must be at least -840 minutes")
  .max(840, "Timezone offset must be at most 840 minutes");

export const bookkeepingPeriodSchema = z.object({
  month: monthSchema,
  timezoneOffsetMinutes: timezoneOffsetSchema.default(0),
});

export type BookkeepingPeriodInput = z.input<typeof bookkeepingPeriodSchema>;
export type BookkeepingPeriodData = z.output<typeof bookkeepingPeriodSchema>;

type TransactionType = "income" | "expense" | "transfer" | "outcome";

/**
 * Snapshot transaksi yang dibutuhkan buku besar.
 *
 * Modul bookkeeping sengaja tidak menyimpan tabel sendiri: sumber datanya
 * adalah transaksi. Tipe ini adalah kontrak anti-korupsi antara port sumber
 * data dan model buku besar, supaya `core/` tidak bergantung pada entity
 * modul transactions.
 */
export type BookkeepingTransactionData = {
  id: number;
  type: TransactionType;
  status: string;
  paymentStatus: string;
  paymentMethod: { type: string; assetId?: number };
  customerId?: number;
  amount: Money;
  capital: Money;
  description?: string;
  category?: string;
  createdAt: Date;
  updatedAt?: Date;
};

/** Snapshot payment gagal yang ditampilkan pada tab Failed. */
export type BookkeepingPaymentData = {
  id: number;
  amount: Money;
  method: string;
  status: string;
  gatewayRef?: string;
  description?: string;
  retryCount: number;
  maxRetries: number;
  lastError?: string;
  createdAt: Date;
  updatedAt?: Date;
};

export type BookkeepingSummaryData = {
  currency: string;
  income: Money;
  expense: Money;
  profit: Money;
  transactionCount: number;
};

export type BookkeepingEntryData = {
  transaction: BookkeepingTransactionData;
  runningBalance: Money;
};

export type BookkeepingDayGroupData = {
  /** Tanggal kalender lokal (`YYYY-MM-DD`) pada timezone pemanggil. */
  date: string;
  transactionCount: number;
  entries: BookkeepingEntryData[];
};

export type BookkeepingFailedPaymentsData = {
  month: string;
  payments: BookkeepingPaymentData[];
  totalCount: number;
  retryableCount: number;
};

function validationMessage(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join(", ");
}

function currencyOf(money: Money) {
  const currency = findCurrency(money.currency.code);
  if (!currency) throw new ValidationError(`Unknown currency: ${money.currency.code}`);
  return currency;
}

/**
 * Value object periode buku besar.
 *
 * Bulan dihitung pada timezone pemanggil, bukan UTC. Client mengirim offset
 * menit ke timur UTC (mis. WIB = `420`) supaya transaksi dini hari tanggal 1
 * tidak jatuh ke bulan sebelumnya.
 */
export class BookkeepingPeriod {
  #month!: string;
  #timezoneOffsetMinutes!: number;
  #start!: Date;
  #endExclusive!: Date;

  private constructor(data: BookkeepingPeriodData) {
    this.#month = data.month;
    this.#timezoneOffsetMinutes = data.timezoneOffsetMinutes;

    const [year, month] = data.month.split("-").map(Number);
    const monthIndex = month! - 1;
    const offsetMs = data.timezoneOffsetMinutes * 60_000;

    this.#start = new Date(Date.UTC(year!, monthIndex, 1) - offsetMs);
    this.#endExclusive = new Date(Date.UTC(year!, monthIndex + 1, 1) - offsetMs);
  }

  static from(input: BookkeepingPeriodInput): BookkeepingPeriod {
    const result = bookkeepingPeriodSchema.safeParse(input);
    if (!result.success) throw new ValidationError(validationMessage(result.error));
    return new BookkeepingPeriod(result.data);
  }

  get month(): string {
    return this.#month;
  }

  get timezoneOffsetMinutes(): number {
    return this.#timezoneOffsetMinutes;
  }

  /** Batas awal bulan (inklusif) sebagai instant UTC. */
  get start(): Date {
    return this.#start;
  }

  /** Batas akhir bulan (eksklusif) sebagai instant UTC. */
  get endExclusive(): Date {
    return this.#endExclusive;
  }

  contains(date: Date): boolean {
    const time = date.getTime();
    return time >= this.#start.getTime() && time < this.#endExclusive.getTime();
  }

  /** Tanggal kalender lokal (`YYYY-MM-DD`) untuk pengelompokan harian. */
  localDateKey(date: Date): string {
    const shifted = new Date(date.getTime() + this.#timezoneOffsetMinutes * 60_000);
    return shifted.toISOString().slice(0, 10);
  }
}

function compareAscending(a: BookkeepingTransactionData, b: BookkeepingTransactionData): number {
  return a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id;
}

function compareDescending(a: BookkeepingTransactionData, b: BookkeepingTransactionData): number {
  return b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id;
}

/**
 * Buku besar satu bulan.
 *
 * Semua perhitungan (ringkasan per mata uang, saldo berjalan, grup harian)
 * dilakukan di model — bukan di resolver/usecase — supaya aturan buku besar
 * tetap satu sumber. Saldo berjalan dimulai dari nol pada bulan terpilih,
 * sama seperti perilaku tab Bookkeeping cx-dompetqu.
 */
export class BookkeepingLedger {
  #month!: string;
  #filter!: BookkeepingFilter;
  #summaries!: BookkeepingSummaryData[];
  #groups!: BookkeepingDayGroupData[];

  private constructor(data: {
    month: string;
    filter: BookkeepingFilter;
    summaries: BookkeepingSummaryData[];
    groups: BookkeepingDayGroupData[];
  }) {
    this.#month = data.month;
    this.#filter = data.filter;
    this.#summaries = data.summaries;
    this.#groups = data.groups;
  }

  static build(input: {
    period: BookkeepingPeriod;
    filter: BookkeepingFilter;
    transactions: BookkeepingTransactionData[];
  }): BookkeepingLedger {
    const { period, filter, transactions } = input;
    const inPeriod = transactions.filter((tx) => period.contains(tx.createdAt));
    const filtered = filter === "all" ? inPeriod : inPeriod.filter((tx) => tx.type === filter);

    const balances = new Map<number, Money>();
    const runningByCurrency = new Map<string, Money>();
    const summaries = new Map<
      string,
      { income: Money; expense: Money; transactionCount: number }
    >();

    for (const tx of [...filtered].sort(compareAscending)) {
      const code = tx.amount.currency.code;
      const currency = currencyOf(tx.amount);
      const running = runningByCurrency.get(code) ?? Money.zero(currency);
      const next =
        tx.type === "income"
          ? running.add(tx.amount)
          : tx.type === "expense"
            ? running.subtract(tx.amount)
            : running;

      runningByCurrency.set(code, next);
      balances.set(tx.id, next);

      const summary = summaries.get(code) ?? {
        income: Money.zero(currency),
        expense: Money.zero(currency),
        transactionCount: 0,
      };
      if (tx.type === "income") summary.income = summary.income.add(tx.amount);
      if (tx.type === "expense") summary.expense = summary.expense.add(tx.amount);
      summary.transactionCount += 1;
      summaries.set(code, summary);
    }

    const groups = new Map<string, BookkeepingEntryData[]>();
    for (const tx of filtered.sort(compareDescending)) {
      const date = period.localDateKey(tx.createdAt);
      const entries = groups.get(date) ?? [];
      entries.push({
        transaction: tx,
        runningBalance: balances.get(tx.id) ?? Money.zero(currencyOf(tx.amount)),
      });
      groups.set(date, entries);
    }

    return new BookkeepingLedger({
      month: period.month,
      filter,
      summaries: [...summaries.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([code, summary]) => ({
          currency: code,
          income: summary.income,
          expense: summary.expense,
          profit: summary.income.subtract(summary.expense),
          transactionCount: summary.transactionCount,
        })),
      groups: [...groups.entries()].map(([date, entries]) => ({
        date,
        transactionCount: entries.length,
        entries,
      })),
    });
  }

  get month(): string {
    return this.#month;
  }

  get filter(): BookkeepingFilter {
    return this.#filter;
  }

  get summaries(): BookkeepingSummaryData[] {
    return this.#summaries;
  }

  get groups(): BookkeepingDayGroupData[] {
    return this.#groups;
  }
}

/**
 * Payment gagal pada satu bulan.
 *
 * Sumber datanya modul payment (`paymentsByStatus("failed")`), tetapi domain
 * bookkeeping yang menyaring periode dan menghitung payment yang masih bisa
 * di-retry supaya tab Failed mendapat satu kontrak yang utuh.
 */
export class BookkeepingFailedPayments {
  #month!: string;
  #payments!: BookkeepingPaymentData[];
  #totalCount!: number;
  #retryableCount!: number;

  private constructor(data: BookkeepingFailedPaymentsData) {
    this.#month = data.month;
    this.#payments = data.payments;
    this.#totalCount = data.totalCount;
    this.#retryableCount = data.retryableCount;
  }

  static build(input: {
    period: BookkeepingPeriod;
    payments: BookkeepingPaymentData[];
  }): BookkeepingFailedPayments {
    const payments = input.payments
      .filter((payment) => payment.status === "failed" && input.period.contains(payment.createdAt))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id);

    return new BookkeepingFailedPayments({
      month: input.period.month,
      payments,
      totalCount: payments.length,
      retryableCount: payments.filter((payment) => payment.retryCount < payment.maxRetries).length,
    });
  }

  get month(): string {
    return this.#month;
  }

  get payments(): BookkeepingPaymentData[] {
    return this.#payments;
  }

  get totalCount(): number {
    return this.#totalCount;
  }

  get retryableCount(): number {
    return this.#retryableCount;
  }
}
