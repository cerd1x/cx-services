import { OrderRepository } from "../ports/out/order-repository.port";
import type { Order as OrderType } from "../model/order.model";
import { Money } from "@lib/money";
import { ID } from "$services/shared/kernel";
import { OrderByIdUseCase } from "./order_by_id.usecase";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type UpdateOrderData = {
  status?: "pending" | "success" | "cancelled";
  paymentMethod?: string;
  paymentStatus?: "unpaid" | "partial" | "paid";
  paidAmount?: Money;
  description?: string;
  customerId?: number;
};

export type UpdateOrderInput = {
  id: ID;
  data: UpdateOrderData;
  userId: ID;
};

export class UpdateOrderUseCase extends CoreUsecase<
  OrderType,
  UpdateOrderInput
> {
  @logMethod(logger)
  async execute(input: UpdateOrderInput): Promise<OrderType> {
    const orderRepo = this.deps.get(OrderRepository);
    const { id, data, userId } = input;

    const existing = await this.deps
      .get(OrderByIdUseCase)
      .execute({ id, userId });

    if (data.status !== undefined) existing.status = data.status;
    if (data.paymentMethod !== undefined)
      existing.paymentMethod = data.paymentMethod;
    if (data.paymentStatus !== undefined)
      existing.paymentStatus = data.paymentStatus;
    if (data.paidAmount !== undefined) existing.paidAmount = data.paidAmount;

    if (data.description !== undefined) existing.description = data.description;
    if (data.customerId !== undefined) existing.customerId = data.customerId;

    existing.validateAll();
    return orderRepo.update(existing, userId.decode);
  }
}
