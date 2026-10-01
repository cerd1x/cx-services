import { ContactRepository } from "../ports/out/contact-repository.port";
import { Contact } from "../../adapters/driven/drizzle/contact.entity";
import { ID } from "$services/shared/kernel";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export class ListContactsUseCase extends CoreUsecase<Contact[], ID> {
  @logMethod(logger)
  async execute(userId: ID): Promise<Contact[]> {
    const contactRepo = this.deps.get(ContactRepository);
    return contactRepo.findAll(userId.toNumb);
  }
}