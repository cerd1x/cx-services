import { ContactRepository } from "../ports/out/contact-repository.port";
import { Contact } from "../entity/contact.entity";
import { ID } from "$services/shared/kernel";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type CreateContactInput = {
  name: string;
  userId: ID;
  email?: string;
  phones?: string | string[];
  group?: string;
  avatar?: string;
};

export class CreateContactUseCase extends CoreUsecase<Contact, CreateContactInput> {
  @logMethod(logger)
  async execute(input: CreateContactInput): Promise<Contact> {
    const contactRepo = this.deps.get(ContactRepository);
    let { name, userId, email, phones, group, avatar } = input;

    if (email?.length === 0) email = undefined;
    let contact = Contact.new({ name, email, phones, group, avatar, userId }).validateAll();
    contact = await contactRepo.save(userId.toNumb, contact);

    if (!contact.id) {
      throw new Error("Failed to create contact: no id returned");
    }

    return contact;
  }
}
