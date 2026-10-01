import { isMybe } from "$services/shared/kernel";
import { RequiredErr } from "$services/shared/kernel/errors/service-error";
import { ServiceContainer } from "./service-container.base";

export abstract class CoreUsecaseInterface<TOutput, TInput = void> {
  abstract execute(input: TInput): Promise<TOutput>;
}

export abstract class CoreUsecase<TOutput, TInput = void>
  implements CoreUsecaseInterface<TOutput, TInput>
{
  #container!: ServiceContainer;

  setContext(container: ServiceContainer): this;
  setContext(cb: (container: ServiceContainer) => void): this;
  setContext(containerOrCb: ServiceContainer | ((container: ServiceContainer) => void)): this {
    if (containerOrCb instanceof ServiceContainer) {
      this.#container = containerOrCb;
    } else {
      this.#container = new ServiceContainer();
      containerOrCb(this.#container);
    }
    return this;
  }

  protected get deps(): ServiceContainer {
    if (isMybe(this.#container)) {
      throw new RequiredErr("container", { class: this });
    }
    return this.#container;
  }

  abstract execute(input: TInput): Promise<TOutput>;
}