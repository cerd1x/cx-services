import { Asset } from "../model/asset.model";
import type { Money } from "@lib/money";
import { ID } from "$services/shared/kernel";
import { NotFound, ValidationError } from "$services/shared/kernel/errors/service-error";
import { AssetRepository } from "../ports/out/asset-repository.port";
import { UnitOfWork } from "$services/shared/kernel/uow.port";
import { OutboxRepository } from "$services/shared/kernel/outbox/outbox-repository.port";
import { EventBus } from "$services/shared/kernel/outbox/event-bus";
import { TransactionService } from "$services/domain/transactions";
import { ApplyAssetMutationUseCase } from "./apply_asset_mutation.usecase";
import {
  MUTATION_DIRECTION,
  type MutationType,
  type SingleAssetMutationType,
} from "../model/asset-mutation.model";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type { MutationType as MutateAssetCode };

export type MutateAssetInput = {
  userId: ID;
  /** Kode mutasi ala perbankan: CR, DB, TF, EB, ADM. */
  code: MutationType;
  amount: Money;
  /** Wajib untuk CR/DB/EB/ADM. */
  assetId?: ID;
  /** Wajib untuk TF (asset sumber). */
  fromAssetId?: ID;
  /** Wajib untuk TF (asset tujuan). */
  toAssetId?: ID;
  description?: string;
  /** Kategori transaksi; default mengikuti kode mutasi. */
  category?: string;
};

export type MutateAssetResult =
  { code: SingleAssetMutationType; asset: Asset } | { code: "TF"; from: Asset; to: Asset };

/** Metadata pencatatan transaksi (TransactionService) per kode mutasi. */
const TRANSACTION_META: Record<
  SingleAssetMutationType,
  { type: "income" | "outcome"; category: string; describe: (name: string) => string }
> = {
  CR: { type: "income", category: "Credit", describe: (n) => `CR (+) Credit To ( ${n} )` },
  DB: { type: "outcome", category: "Debit", describe: (n) => `DB (-) Debit From ( ${n} )` },
  EB: {
    type: "outcome",
    category: "E-Wallet/Banking",
    describe: (n) => `EB (-) E-Wallet/Banking From ( ${n} )`,
  },
  ADM: {
    type: "outcome",
    category: "Admin Fee",
    describe: (n) => `ADM (-) Admin Fee From ( ${n} )`,
  },
};

/**
 * Mutasi asset terpadu gaya perbankan — satu usecase untuk semua arus dana:
 *
 * | Kode | Arah     | Asset          |
 * |------|----------|----------------|
 * | CR   | credit   | 1 (tujuan)     |
 * | DB   | debit    | 1 (sumber)     |
 * | EB   | debit    | 1 (sumber)     |
 * | ADM  | debit    | 1 (sumber)     |
 * | TF   | transfer | 2 (from → to)  |
 *
 * Semua kode satu-asset mencatat `AssetMutation` + transaksi keuangan.
 * TF mencatat dua `AssetMutation` dalam satu UoW dan memicu event
 * `asset.transferred` (dicatat sebagai transaksi `transfer` oleh subscriber
 * di domain transactions).
 */
export class MutateAssetUseCase extends CoreUsecase<MutateAssetResult, MutateAssetInput> {
  @logMethod(logger)
  async execute(input: MutateAssetInput): Promise<MutateAssetResult> {
    const { code, amount } = input;

    if (!(code in MUTATION_DIRECTION)) {
      throw new ValidationError(`Unknown mutation code: ${String(code)}`);
    }
    if (amount.toNumber() <= 0) {
      throw new ValidationError("amount must be positive");
    }

    if (code === "TF") {
      return this.#transfer(input);
    }
    return this.#singleLeg(input);
  }

  /** Leg tunggal (CR/DB/EB/ADM): mutasi satu asset + catat transaksi. */
  async #singleLeg(input: MutateAssetInput): Promise<MutateAssetResult> {
    const { userId, code, assetId, amount, description, category } = input;

    if (!assetId) {
      throw new ValidationError(`assetId is required for mutation code ${code}`);
    }

    const asset = await this.deps
      .get(ApplyAssetMutationUseCase)
      .execute({ userId, assetId, type: code as SingleAssetMutationType, amount, description });

    const meta = TRANSACTION_META[code as SingleAssetMutationType];
    // Credit: capital = saldo sebelum mutasi. Debit: capital = saldo sesudah mutasi.
    const capital =
      meta.type === "income" ? asset.balance.subtract(amount) : asset.balance.add(amount);

    await TransactionService.getInstance().createTransaction({
      userId: userId.decode,
      payToAssetId: assetId.decode,
      amount,
      capital,
      type: meta.type,
      category: category ?? meta.category,
      description: description ?? meta.describe(asset.name),
      status: "success",
    });

    return { code: code as SingleAssetMutationType, asset };
  }

  /** Transfer (TF): dua leg dalam satu UoW + outbox event `asset.transferred`. */
  async #transfer(input: MutateAssetInput): Promise<MutateAssetResult> {
    const assetRepo = this.deps.get(AssetRepository);
    const uowMutateAsset = this.deps.get(UnitOfWork);
    const outboxRepo = this.deps.get(OutboxRepository);
    const { userId, amount, description, fromAssetId, toAssetId } = input;

    if (!fromAssetId || !toAssetId) {
      throw new ValidationError("fromAssetId and toAssetId are required for mutation code TF");
    }
    if (fromAssetId.decode === toAssetId.decode) {
      throw new ValidationError("fromAssetId and toAssetId must be different assets");
    }

    const fromAsset = await assetRepo.findById(userId, fromAssetId);
    if (!fromAsset) {
      throw new NotFound(`Source asset ${fromAssetId.str}`);
    }
    const toAsset = await assetRepo.findById(userId, toAssetId);
    if (!toAsset) {
      throw new NotFound(`Destination asset ${toAssetId.str}`);
    }
    Asset.validateMutationAmount(amount);
    Asset.canSubtract(fromAsset.balance, amount);

    const fromNext = fromAsset.balance.subtract(amount);
    const toNext = toAsset.balance.add(amount);

    const eventPayload = {
      userId: userId.decode,
      fromAssetId: fromAssetId.decode,
      toAssetId: toAssetId.decode,
      amount: amount.toNumber(),
      currency: amount.currency.code,
      fromAssetName: fromAsset.name,
      toAssetName: toAsset.name,
      description: description ?? `TF ( ${fromAsset.name} to ${toAsset.name} )`,
    };
    const correlationId = `transfer-${userId.decode}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    await uowMutateAsset.run(async (tx) => {
      await assetRepo.createAssetMutation(
        fromAssetId,
        {
          userId,
          assetId: fromAssetId.decode,
          type: "TF",
          amount,
          balanceBefore: fromAsset.balance,
          balanceAfter: fromNext,
          description: `Transfer To ${toAsset.name}`,
        },
        tx,
      );

      await assetRepo.createAssetMutation(
        toAssetId,
        {
          userId,
          assetId: toAssetId.decode,
          type: "TF",
          amount,
          balanceBefore: toAsset.balance,
          balanceAfter: toNext,
          description: `Transfer From ${fromAsset.name}`,
        },
        tx,
      );

      await assetRepo.update(userId, fromAssetId.decode, { balance: fromNext }, tx);
      await assetRepo.update(userId, toAssetId.decode, { balance: toNext }, tx);

      await outboxRepo.save(
        {
          correlationId,
          eventType: "asset.transferred",
          payload: JSON.stringify(eventPayload),
        },
        tx,
      );
    });

    await EventBus.dispatchEvent("asset.transferred", eventPayload);
    await outboxRepo.markProcessedByCorrelation(correlationId);

    return {
      code: "TF",
      from: Asset.new({
        id: fromAssetId.decode,
        userId: fromAsset.userId,
        name: fromAsset.name,
        type: fromAsset.type,
        balance: fromNext,
      }),
      to: Asset.new({
        id: toAssetId.decode,
        userId: toAsset.userId,
        name: toAsset.name,
        type: toAsset.type,
        balance: toNext,
      }),
    };
  }
}

/** Ambil asset tunggal dari hasil mutasi; TF tidak punya satu asset tunggal. */
export function expectSingleAsset(result: MutateAssetResult): Asset {
  if (result.code === "TF") {
    throw new ValidationError("Expected a single-asset mutation result, got TF");
  }
  return result.asset;
}
