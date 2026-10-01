import { Order, type Order as OrderType } from "./core/entity/order.entity";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "./core/value-objects/logger";
import { ID } from "$services/shared/kernel";
import { CreateOrderProductSaleUseCase } from "./core/usecase/create-order-product-sale.usecase";
import { CreateOrderExpenseUseCase } from "./core/usecase/create-order-expense.usecase";
import { CreateOrderLoanUseCase } from "./core/usecase/create-order-loan.usecase";
import { CreateOrderUseCase } from "./core/usecase/create-order.usecase";
import { OrderByIdUseCase } from "./core/usecase/order-by-id.usecase";
import { ListOrdersUseCase } from "./core/usecase/list-orders.usecase";
import { OrdersByDateRangeUseCase } from "./core/usecase/orders-by-date-range.usecase";
import { UpdateOrderUseCase } from "./core/usecase/update-order.usecase";
import { DeleteOrderUseCase } from "./core/usecase/delete-order.usecase";
import { ServiceContainer } from "$services/shared/base";
import { paymentService, type PaymentService } from "$services/domain/payment";
import { OrderRepositoryImpl } from "./adapters/driven/drizzle/order.repository";
import { OrderRepository } from "./core/ports/out/order-repository.port";
import { PaymentServiceCtx } from "./core/usecase/payment-service.ctx";

export class OrderService {
  static #instanceOrderService: OrderService;
  #createOrderProductSale: CreateOrderProductSaleUseCase;
  #createOrderExpense: CreateOrderExpenseUseCase;
  #createOrderLoan: CreateOrderLoanUseCase;
  #createOrder: CreateOrderUseCase;
  #orderById: OrderByIdUseCase;
  #listOrders: ListOrdersUseCase;
  #ordersByDateRange: OrdersByDateRangeUseCase;
  #updateOrder: UpdateOrderUseCase;
  #deleteOrder: DeleteOrderUseCase;

  @logMethod(logger)
  static init(
    createOrderProductSale: CreateOrderProductSaleUseCase,
    createOrderExpense: CreateOrderExpenseUseCase,
    createOrderLoan: CreateOrderLoanUseCase,
    createOrder: CreateOrderUseCase,
    orderById: OrderByIdUseCase,
    listOrders: ListOrdersUseCase,
    ordersByDateRange: OrdersByDateRangeUseCase,
    updateOrder: UpdateOrderUseCase,
    deleteOrder: DeleteOrderUseCase,
  ): OrderService {
    OrderService.#instanceOrderService = new OrderService(
      createOrderProductSale,
      createOrderExpense,
      createOrderLoan,
      createOrder,
      orderById,
      listOrders,
      ordersByDateRange,
      updateOrder,
      deleteOrder,
    );
    return OrderService.#instanceOrderService;
  }

  @logMethod(logger)
  static getInstance(): OrderService {
    if (!OrderService.#instanceOrderService) {
      throw new Error("OrderService not initialized");
    }
    return OrderService.#instanceOrderService;
  }

  private constructor(
    createOrderProductSale: CreateOrderProductSaleUseCase,
    createOrderExpense: CreateOrderExpenseUseCase,
    createOrderLoan: CreateOrderLoanUseCase,
    createOrder: CreateOrderUseCase,
    orderById: OrderByIdUseCase,
    listOrders: ListOrdersUseCase,
    ordersByDateRange: OrdersByDateRangeUseCase,
    updateOrder: UpdateOrderUseCase,
    deleteOrder: DeleteOrderUseCase,
  ) {
    this.#createOrderProductSale = createOrderProductSale;
    this.#createOrderExpense = createOrderExpense;
    this.#createOrderLoan = createOrderLoan;
    this.#createOrder = createOrder;
    this.#orderById = orderById;
    this.#listOrders = listOrders;
    this.#ordersByDateRange = ordersByDateRange;
    this.#updateOrder = updateOrder;
    this.#deleteOrder = deleteOrder;
  }

  @logMethod(logger)
  async createOrderProductSale(data: {
    userId: number;
    productId: ID;
    itemCount: number;
    price: number;
    currency: string;
    paymentMethod?: string;
    customerId?: number;
    description?: string;
    payToAssetId?: number;
  }): Promise<OrderType> {
    return this.#createOrderProductSale.execute(data);
  }

  @logMethod(logger)
  async createOrderExpense(data: {
    userId: number;
    price: number;
    currency: string;
    itemCount: number;
    paymentMethod?: string;
    customerId?: number;
    description?: string;
    payWithAssetId?: number;
  }): Promise<OrderType> {
    return this.#createOrderExpense.execute(data);
  }

  @logMethod(logger)
  async createOrderLoan(data: {
    userId: number;
    price: number;
    currency: string;
    itemCount: number;
    paymentMethod?: string;
    customerId?: number;
    description?: string;
    payWithAssetId?: number;
  }): Promise<OrderType> {
    return this.#createOrderLoan.execute(data);
  }

  @logMethod(logger)
  async createOrder(data: {
    userId?: number;
    price: number;
    currency: string;
    itemCount: number;
    paymentMethod?: string;
    description?: string;
    customerId?: number;
  }): Promise<OrderType> {
    return this.#createOrder.execute(data);
  }

  @logMethod(logger)
  async order(id: ID, userId: ID): Promise<Order> {
    return this.#orderById.execute({ id, userId });
  }

  @logMethod(logger)
  async orders(userId: ID): Promise<OrderType[]> {
    return this.#listOrders.execute(userId);
  }

  @logMethod(logger)
  async ordersByDateRange(start: Date, end: Date, userId: ID): Promise<OrderType[]> {
    return this.#ordersByDateRange.execute({ start, end, userId });
  }

  @logMethod(logger)
  async updateOrder(
    id: ID,
    data: {
      status?: "pending" | "success" | "cancelled";
      paymentMethod?: string;
      description?: string;
      customerId?: number;
    },
    userId: ID,
  ): Promise<OrderType> {
    return this.#updateOrder.execute({ id, data, userId });
  }

  @logMethod(logger)
  async deleteOrder(id: ID, userId: ID): Promise<void> {
    return this.#deleteOrder.execute({ id, userId });
  }
}

export type OrderAdapters = {
  orderRepo: OrderRepository;
  payment: PaymentService;
};

export function createOrderService({ orderRepo, payment }: OrderAdapters): OrderService {
  const container = new ServiceContainer()
    .set(OrderRepository, orderRepo)
    .set(PaymentServiceCtx, payment as unknown as PaymentServiceCtx);

  const createOrderProductSale = new CreateOrderProductSaleUseCase().setContext(container);
  const createOrderExpense = new CreateOrderExpenseUseCase().setContext(container);
  const createOrderLoan = new CreateOrderLoanUseCase().setContext(container);
  const createOrder = new CreateOrderUseCase().setContext(container);
  const orderById = new OrderByIdUseCase().setContext(container);
  const listOrders = new ListOrdersUseCase().setContext(container);
  const ordersByDateRange = new OrdersByDateRangeUseCase().setContext(container);
  const updateOrder = new UpdateOrderUseCase().setContext(container);
  const deleteOrder = new DeleteOrderUseCase().setContext(container);

  container.set(OrderByIdUseCase, orderById);

  return OrderService.init(
    createOrderProductSale,
    createOrderExpense,
    createOrderLoan,
    createOrder,
    orderById,
    listOrders,
    ordersByDateRange,
    updateOrder,
    deleteOrder,
  );
}

logger.info("Initializing OrderService...");
export const orderService = createOrderService({
  orderRepo: new OrderRepositoryImpl(),
  payment: paymentService,
});
logger.info("OrderService initialized");
