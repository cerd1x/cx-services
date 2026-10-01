import type { PaymentService } from "$services/domain/payment";

export class PaymentServiceCtx {
  __cxToken!: PaymentService;
}