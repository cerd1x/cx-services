export interface GatewayChargeRequest {
  userId: number;
  assetId?: number;
  amount: number;
  currency: string;
  method: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface GatewayChargeResponse {
  success: boolean;
  gatewayRef: string;
  status: "pending" | "processing" | "completed" | "failed";
  raw?: Record<string, unknown>;
  error?: string;
}

export interface GatewayRefundRequest {
  gatewayRef: string;
  amount?: number;
  reason?: string;
}

export interface GatewayRefundResponse {
  success: boolean;
  refundId: string;
  status: "pending" | "completed" | "failed";
  raw?: Record<string, unknown>;
  error?: string;
}

export interface GatewayStatusResponse {
  gatewayRef: string;
  status: "pending" | "processing" | "completed" | "failed" | "refunded";
  raw?: Record<string, unknown>;
}

export abstract class PaymentGateway {
  abstract charge(request: GatewayChargeRequest): Promise<GatewayChargeResponse>;
  abstract refund(request: GatewayRefundRequest): Promise<GatewayRefundResponse>;
  abstract getStatus(gatewayRef: string): Promise<GatewayStatusResponse>;
}
