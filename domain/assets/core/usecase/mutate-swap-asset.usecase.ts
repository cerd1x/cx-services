import {
  NotFoundError,
} from "$services/shared/kernel/errors/service-error";
import { AssetRepository } from "../ports/out/asset-repository.port";
import { Asset } from "../../adapters/driven/drizzle/asset.entity";
import { Balance } from "../value-objects/balance.vo";
import { ID } from "$services/shared/kernel";
import {UnitOfWork} from "$services/shared/kernel/uow.port";
import { OutboxRepository } from "$services/shared/kernel/outbox/outbox-repository.port";
import { EventBus } from "$services/shared/kernel/outbox/event-bus";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type MutateSwapAssetInput = {
  userId: ID;
  fromAssetId: ID;
  toAssetId: ID;
  amount: string;
};

export class MutateSwapAssetUseCase extends CoreUsecase<
  { from: Asset; to: Asset },
  MutateSwapAssetInput
> {
  @logMethod(logger)
  async execute(input: MutateSwapAssetInput): Promise<{ from: Asset; to: Asset }> {
    const assetRepo = this.deps.get(AssetRepository);
    const uowMutateAsset = this.deps.get(UnitOfWork);
    const outboxRepo = this.deps.get(OutboxRepository);
    const { userId, fromAssetId, toAssetId, amount } = input;

    const balanceAmount = Balance.new(amount);
    const fromAsset = await assetRepo.findById(userId, fromAssetId);
    if (!fromAsset) {
      throw new NotFoundError(`Source asset ${fromAssetId.toHash}`);
    }
    const toAsset = await assetRepo.findById(userId, toAssetId);
    if (!toAsset) {
      throw new NotFoundError(`Destination asset ${toAssetId.toHash}`);
    }

    const fromCurrent = Balance.new(fromAsset.balance);
    const toCurrent = Balance.new(toAsset.balance);

    fromCurrent.subtract(balanceAmount);
    toCurrent.add(balanceAmount);

    const eventPayload = {
      userId: userId.toNumb,
      fromAssetId: fromAssetId.toNumb,
      toAssetId: toAssetId.toNumb,
      amount: balanceAmount.value,
      currency: balanceAmount.code,
      fromAssetName: fromAsset.name,
      toAssetName: toAsset.name,
    };
    const correlationId = `swap-${userId.toNumb}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    await uowMutateAsset.run(async (tx) => {
      await assetRepo.createAssetMutation(
        fromAssetId,
        {
          userId,
          assetId: fromAssetId.toNumb,
          type: "swap",
          amount: balanceAmount.value,
          currency: balanceAmount.code,
          balanceBefore: fromAsset.balance,
          balanceAfter: fromCurrent.toString(),
          description: `Swap To ${toAsset.name}`,
        },
        tx,
      );

      await assetRepo.createAssetMutation(
        toAssetId,
        {
          userId,
          assetId: toAssetId.toNumb,
          type: "swap",
          amount: balanceAmount.value,
          currency: balanceAmount.code,
          balanceBefore: toAsset.balance,
          balanceAfter: toCurrent.toString(),
          description: `Swap From ${fromAsset.name}`,
        },
        tx,
      );

      await assetRepo.update(
        userId,
        fromAssetId.toNumb,
        { balance: fromCurrent },
        tx,
      );
      await assetRepo.update(
        userId,
        toAssetId.toNumb,
        { balance: toCurrent },
        tx,
      );

      await outboxRepo.save(
        {
          correlationId,
          eventType: "asset.swapped",
          payload: JSON.stringify(eventPayload),
        },
        tx,
      );
    });

    await EventBus.dispatchEvent("asset.swapped", eventPayload);
    await outboxRepo.markProcessedByCorrelation(correlationId);

    return {
      from: Asset.new({
        id: fromAssetId.toNumb,
        userId: fromAsset.userId,
        name: fromAsset.name,
        type: fromAsset.type,
        balance: fromCurrent,
      }),
      to: Asset.new({
        id: toAssetId.toNumb,
        userId: toAsset.userId,
        name: toAsset.name,
        type: toAsset.type,
        balance: toCurrent,
      }),
    };
  }
}