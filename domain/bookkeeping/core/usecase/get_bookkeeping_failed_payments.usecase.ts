import type { ID } from "$services/shared/kernel";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { BookkeepingFailedPayments, BookkeepingPeriod } from "../model/bookkeeping.model";
import { BookkeepingSource } from "../ports/out/bookkeeping-source.port";
import { logger } from "../value-objects/logger";

export type GetBookkeepingFailedPaymentsInput = {
  userId: ID;
  /** Bulan pada timezone pemanggil, format `YYYY-MM`. */
  month: string;
  /** Menit ke timur UTC (WIB = 420). Default 0 (UTC). */
  timezoneOffsetMinutes?: number;
};

export class GetBookkeepingFailedPaymentsUseCase extends CoreUsecase<
  BookkeepingFailedPayments,
  GetBookkeepingFailedPaymentsInput
> {
  @logMethod(logger)
  async execute(input: GetBookkeepingFailedPaymentsInput): Promise<BookkeepingFailedPayments> {
    const period = BookkeepingPeriod.from(input);
    const source = this.deps.get(BookkeepingSource);
    const payments = await source.listFailedPayments(
      input.userId,
      period.start,
      period.endExclusive,
    );

    return BookkeepingFailedPayments.build({ period, payments });
  }
}
