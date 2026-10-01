import type {
  PaymentGateway,
  GatewayChargeRequest,
  GatewayChargeResponse,
  GatewayRefundRequest,
  GatewayRefundResponse,
  GatewayStatusResponse,
} from "../../../core/ports/out/payment-gateway.port";

export class MockPaymentGateway implements PaymentGateway {
  #failNext = 0;

  failNext(count = 1): void {
    this.#failNext = Math.max(0, count);
  }

  get remainingFails(): number {
    return this.#failNext;
  }

  async charge(request: GatewayChargeRequest): Promise<GatewayChargeResponse> {
    const gatewayRef = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    if (this.#failNext > 0) {
      this.#failNext--;
      return {
        success: false,
        gatewayRef: "",
        status: "failed",
        error: "Simulated gateway failure",
      };
    }

    if (request.amount <= 0) {
      return {
        success: false,
        gatewayRef: "",
        status: "failed",
        error: "Amount must be positive",
      };
    }

    if (request.method === "credit_card" && request.amount > 100000000) {
      return {
        success: false,
        gatewayRef: "",
        status: "failed",
        error: "Credit card payment limit exceeded",
      };
    }

    return {
      success: true,
      gatewayRef,
      status: "completed",
      raw: {
        mock: true,
        method: request.method,
        amount: request.amount,
        currency: request.currency,
      },
    };
  }

  async refund(request: GatewayRefundRequest): Promise<GatewayRefundResponse> {
    return {
      success: true,
      refundId: `ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      status: "completed",
      raw: {
        mock: true,
        gatewayRef: request.gatewayRef,
        amount: request.amount,
        reason: request.reason,
      },
    };
  }

  async getStatus(gatewayRef: string): Promise<GatewayStatusResponse> {
    return {
      gatewayRef,
      status: "completed",
      raw: {
        mock: true,
      },
    };
  }
}
