import { NotFoundError } from "$services/shared/kernel/errors/service-error";
import { ContactRepository } from "../ports/out/contact-repository.port";
import { Contact } from "../../adapters/driven/drizzle/contact.entity";
import { ID } from "$services/shared/kernel";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type ContactByIdInput = {
  userId: ID;
  contactId: ID;
};

export class ContactByIdUseCase extends CoreUsecase<Contact, ContactByIdInput> {
  @logMethod(logger)
  async execute(input: ContactByIdInput): Promise<Contact> {
    const contactRepo = this.deps.get(ContactRepository);
    const { userId, contactId } = input;

    const contact = await contactRepo.findById(userId.toNumb, contactId.toNumb);
    if (!contact) {
      throw new NotFoundError(`Contact with id ${contactId.toNumb}`);
    }
    if (contact.userId.toNumb !== userId.toNumb) {
      throw new NotFoundError(`Contact with id ${contactId.toNumb}`);
    }
    return contact;
  }
}