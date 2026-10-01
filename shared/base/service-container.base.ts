import { isMybe } from "$services/shared/kernel";
import { RequiredErr } from "$services/shared/kernel/errors/service-error";

export type ServiceKey = abstract new (...args: never[]) => unknown;

export class ServiceContainer {
  #services = new Map<ServiceKey, unknown>();

  set<T>(ctor: abstract new (...args: never[]) => T, instance: T): this {
    this.#services.set(ctor, instance);
    return this;
  }

  get<T>(ctor: abstract new (...args: never[]) => T): T {
    const service = this.#services.get(ctor);
    if (isMybe(service)) {
      throw new RequiredErr(ctor.name, { class: this });
    }
    return service as T;
  }

  has(ctor: ServiceKey): boolean {
    return this.#services.has(ctor);
  }
}