import type { ID } from "$services/shared/kernel";
import type {
  BookkeepingPaymentData,
  BookkeepingTransactionData,
} from "../../model/bookkeeping.model";

/**
 * Outbound port sumber data buku besar.
 *
 * Bookkeeping tidak punya tabel sendiri. Adapter produksi menerjemahkan
 * kontrak ini ke service modul transactions (dan payment untuk tab Failed);
 * use case hanya melihat data yang sudah dinormalisasi model bookkeeping.
 */
export abstract class BookkeepingSource {
  abstract listTransactions(
    userId: ID,
    start: Date,
    endExclusive: Date,
  ): Promise<BookkeepingTransactionData[]>;

  abstract listFailedPayments(
    userId: ID,
    start: Date,
    endExclusive: Date,
  ): Promise<BookkeepingPaymentData[]>;
}
