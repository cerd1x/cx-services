import { PaymentGateway } from "../ports/out/payment-gateway.port";

/**
 * Token DI untuk gateway yang mendebit saldo asset (mis. `AssetPaymentGateway`).
 *
 * Dipisah dari `PaymentGateway` utama agar pembayaran yang tidak menyertakan
 * `assetId` (mis. gateway eksternal/mock) tidak ikut mendebit saldo wallet.
 */
export abstract class AssetChargeGatewayToken extends PaymentGateway {}
