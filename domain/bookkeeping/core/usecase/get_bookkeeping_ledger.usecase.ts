import type { ID } from "$services/shared/kernel";
import { ValidationError } from "$services/shared/kernel/errors/service-error";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import {
  BookkeepingLedger,
  BookkeepingPeriod,
  bookkeepingFilterSchema,
  type BookkeepingFilter,
} from "../model/bookkeeping.model";
import { BookkeepingSource } from "../ports/out/bookkeeping-source.port";
import { logger } from "../value-objects/logger";

export type GetBookkeepingLedgerInput = {
  userId: ID;
  /** Bulan pada timezone pemanggil, format `YYYY-MM`. */
  month: string;
  /** Menit ke timur UTC (WIB = 420). Default 0 (UTC). */
  timezoneOffsetMinutes?: number;
  filter?: BookkeepingFilter;
};

export class GetBookkeepingLedgerUseCase extends CoreUsecase<
  BookkeepingLedger,
  GetBookkeepingLedgerInput
> {
  @logMethod(logger)
  async execute(input: GetBookkeepingLedgerInput): Promise<BookkeepingLedger> {
    const period = BookkeepingPeriod.from(input);

    const filter = bookkeepingFilterSchema.safeParse(input.filter ?? "all");
    if (!filter.success) {
      throw new ValidationError(filter.error.issues.map((issue) => issue.message).join(", "));
    }

    const source = this.deps.get(BookkeepingSource);
    const transactions = await source.listTransactions(
      input.userId,
      period.start,
      period.endExclusive,
    );

    return BookkeepingLedger.build({ period, filter: filter.data, transactions });
  }
}
