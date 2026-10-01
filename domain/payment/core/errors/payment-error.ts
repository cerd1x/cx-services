import { ServiceError } from "$services/shared/kernel/errors/service-error";

export class PaymentError extends ServiceError {
  constructor(message: string, code = 500) {
    super(message, code);
    this.name = "PaymentError";
  }
}

export class PaymentValidationError extends PaymentError {
  constructor(message: string) {
    super(message, 400);
    this.name = "PaymentValidationError";
  }
}

export class PaymentNotFoundError extends PaymentError {
  constructor(resource: string) {
    super(`${resource} not found`, 404);
    this.name = "PaymentNotFoundError";
  }
}

export class PaymentGatewayError extends PaymentError {
  constructor(message: string) {
    super(message, 502);
    this.name = "PaymentGatewayError";
  }
}

export class PaymentRetryExhaustedError extends PaymentError {
  constructor(paymentId: number, maxRetries: number) {
    super(`Payment ${paymentId} retry exhausted after ${maxRetries} attempts`, 422);
    this.name = "PaymentRetryExhaustedError";
  }
}

export class InvoiceError extends ServiceError {
  constructor(message: string, code = 500) {
    super(message, code);
    this.name = "InvoiceError";
  }
}

export class InvoiceValidationError extends InvoiceError {
  constructor(message: string) {
    super(message, 400);
    this.name = "InvoiceValidationError";
  }
}

export class InvoiceNotFoundError extends InvoiceError {
  constructor(resource: string) {
    super(`${resource} not found`, 404);
    this.name = "InvoiceNotFoundError";
  }
}
