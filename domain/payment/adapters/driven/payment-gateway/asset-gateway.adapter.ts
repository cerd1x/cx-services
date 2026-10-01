import type {
  PaymentGateway,
  GatewayChargeRequest,
  GatewayChargeResponse,
  GatewayRefundRequest,
  GatewayRefundResponse,
  GatewayStatusResponse,
} from "../../../core/ports/out/payment-gateway.port";
import type { AssetService } from "$services/domain/assets";
import { Balance } from "../../../../assets/core/value-objects/balance.vo";
import { ID } from "$services/shared/kernel";

export interface AssetGatewayAsset {
  IdStr: string;
  name: string;
  balance: string;
}

export type AssetMutator = {
  assets(userId: ID): Promise<AssetGatewayAsset[]>;
  assetById(userId: ID, assetId: ID): Promise<AssetGatewayAsset | null>;
  mutateAddAsset(userId: ID, assetId: ID, amount: string): Promise<AssetGatewayAsset>;
  mutateSubtractAsset(userId: ID, assetId: ID, amount: string): Promise<AssetGatewayAsset>;
};

// Structural compatile: AssetService (domain `Asset`) memenuhi AssetMutator.
// `Asset` punya getter `IdStr`, `name`, dan `balance` (string).
type AssetServiceIsMutator = AssetService extends AssetMutator ? true : never;
const _assetServiceIsMutator: AssetServiceIsMutator = true;

export type AssetResolver = (userId: number, currency: string) => Promise<number | null>;

export interface AssetGatewayConfig {
  resolveAsset?: AssetResolver;
  defaultAssetName?: string;
}

interface GatewayRefParts {
  userId: number;
  assetId: number;
  currency?: string;
  amount?: number;
}

/**
 * PaymentGateway berbasis asset (saldo internal user).
 *
 * `charge` mendebit saldo asset milik user (via AssetService.mutateSubtractAsset),
 * `refund` mengembalikannya (mutateAddAsset). `gatewayRef` yang dihasilkan
 * meng-encode identitas user + asset + jumlah, sehingga refund/getStatus bisa
 * berjalan tanpa state eksternal.
 *
 * Ganti `MockPaymentGateway` dengan adapter ini saat payment ingin diselesaikan
 * lewat saldo asset, misalnya:
 *   ProcessPaymentUseCase.init(payRepo, new AssetPaymentGateway(assetService));
 */
export class AssetPaymentGateway implements PaymentGateway {
  #assets: AssetMutator;
  #config: Required<AssetGatewayConfig>;

  constructor(assets: AssetMutator, config: AssetGatewayConfig = {}) {
    this.#assets = assets;
    this.#config = {
      resolveAsset:
        config.resolveAsset ?? ((userId, currency) => this.#resolveDefaultAsset(userId, currency)),
      defaultAssetName: config.defaultAssetName ?? "MyCash",
    };
  }

  async charge(request: GatewayChargeRequest): Promise<GatewayChargeResponse> {
    try {
      const currency = request.currency.toUpperCase();

      const assetId =
        request.assetId ?? (await this.#config.resolveAsset(request.userId, currency));
      if (!assetId) {
        return this.#failed("No wallet asset found for this payment");
      }

      if (request.amount <= 0) {
        return this.#failed("Amount must be positive");
      }

      const asset = await this.#assets.assetById(ID.new(request.userId), ID.new(assetId));
      if (!asset) {
        return this.#failed("Wallet asset not found");
      }

      const balance = Balance.new(asset.balance);
      const amount = Balance.new(`${currency} ${request.amount}`);

      if (balance.code.toUpperCase() !== currency) {
        return this.#failed(
          `Currency mismatch: asset holds ${balance.code}, payment is ${currency}`,
        );
      }

      if (balance.value < amount.value) {
        return this.#failed(
          `Insufficient asset balance: have ${balance.code} ${balance.value}, need ${currency} ${request.amount}`,
        );
      }

      const gatewayRef = this.#makeRef(request.userId, assetId, currency, request.amount);

      await this.#assets.mutateSubtractAsset(
        ID.new(request.userId),
        ID.new(assetId),
        `${currency} ${request.amount}`,
      );

      const refreshed = await this.#assets.assetById(ID.new(request.userId), ID.new(assetId));

      return {
        success: true,
        gatewayRef,
        status: "completed",
        raw: {
          gateway: "asset",
          assetId,
          method: request.method,
          amount: request.amount,
          currency,
          balanceBefore: balance.value,
          balanceAfter: refreshed ? Balance.new(refreshed.balance).value : undefined,
          description: request.description,
        },
      };
    } catch (error) {
      return this.#failed(error instanceof Error ? error.message : String(error));
    }
  }

  async refund(request: GatewayRefundRequest): Promise<GatewayRefundResponse> {
    try {
      const ref = this.#parseRef(request.gatewayRef);
      if (!ref) {
        return {
          success: false,
          refundId: "",
          status: "failed",
          error: "Unrecognized asset gateway reference",
        };
      }

      if (!ref.currency || !ref.amount) {
        return {
          success: false,
          refundId: "",
          status: "failed",
          error: "Refund requires a stored amount and currency",
        };
      }

      const amount = request.amount ?? ref.amount;

      await this.#assets.mutateAddAsset(
        ID.new(ref.userId),
        ID.new(ref.assetId),
        `${ref.currency} ${amount}`,
      );

      return {
        success: true,
        refundId: `asset-ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        status: "completed",
        raw: {
          gateway: "asset",
          gatewayRef: request.gatewayRef,
          assetId: ref.assetId,
          amount,
          currency: ref.currency,
          reason: request.reason,
        },
      };
    } catch (error) {
      return {
        success: false,
        refundId: "",
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getStatus(gatewayRef: string): Promise<GatewayStatusResponse> {
    const ref = this.#parseRef(gatewayRef);
    if (!ref) {
      return { gatewayRef, status: "failed" };
    }
    return {
      gatewayRef,
      status: "completed",
      raw: {
        gateway: "asset",
        userId: ref.userId,
        assetId: ref.assetId,
        currency: ref.currency,
        amount: ref.amount,
      },
    };
  }

  async #resolveDefaultAsset(userId: number, currency: string): Promise<number | null> {
    const normalized = currency.toUpperCase();
    const list = await this.#assets.assets(ID.new(userId));

    const byCurrency = list.find(
      (asset) => Balance.new(asset.balance).code.toUpperCase() === normalized,
    );
    if (byCurrency) return ID.new(byCurrency.IdStr).toNumb;

    const byName = list.find((asset) => asset.name === this.#config.defaultAssetName);
    if (byName) return ID.new(byName.IdStr).toNumb;

    const first = list[0];
    return first ? ID.new(first.IdStr).toNumb : null;
  }

  #makeRef(userId: number, assetId: number, currency: string, amount: number): string {
    return `asset:${userId}.${assetId}.${Date.now()}.${Math.random()
      .toString(36)
      .slice(2, 8)}.${currency}.${amount}`;
  }

  #parseRef(gatewayRef: string): GatewayRefParts | null {
    const [prefix, body] = gatewayRef.split(":");
    if (prefix !== "asset") return null;

    const [userId, assetId, , , currency = "", amount = ""] = body.split(".");
    const parsedUserId = Number(userId);
    const parsedAssetId = Number(assetId);

    if (!Number.isFinite(parsedUserId) || !Number.isFinite(parsedAssetId)) {
      return null;
    }

    const parts: GatewayRefParts = {
      userId: parsedUserId,
      assetId: parsedAssetId,
    };

    if (currency) parts.currency = currency;
    const parsedAmount = Number(amount);
    if (amount && Number.isFinite(parsedAmount)) parts.amount = parsedAmount;

    return parts;
  }

  #failed(error: string): GatewayChargeResponse {
    return { success: false, gatewayRef: "", status: "failed", error };
  }
}
