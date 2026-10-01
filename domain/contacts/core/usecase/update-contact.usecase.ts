import { ContactRepository } from "../ports/out/contact-repository.port";
import { Contact, normalizePhones } from "../model/contact.model";
import { ID } from "$services/shared/kernel";
import { ContactByIdUseCase } from "./contact-by-id.usecase";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type UpdateContactData = {
  name?: string;
  email?: string;
  phone?: string;
  phones?: string | string[];
  group?: string;
};

export type UpdateContactInput = {
  userId: ID;
  contactId: ID;
  data: UpdateContactData;
};

export class UpdateContactUseCase extends CoreUsecase<Contact, UpdateContactInput> {
  @logMethod(logger)
  async execute(input: UpdateContactInput): Promise<Contact> {
    const contactRepo = this.deps.get(ContactRepository);
    const { userId, contactId, data } = input;

    const existing = await this.deps.get(ContactByIdUseCase).execute({ userId, contactId });

    if (data.name !== undefined) existing.name = data.name;
    if (data.email !== undefined) existing.email = data.email;
    if (data.phones !== undefined) existing.phones = normalizePhones(data.phones);
    if (data.phone !== undefined) existing.phone = data.phone;
    if (data.group !== undefined) existing.group = data.group;

    existing.validateAll();
    return contactRepo.update(userId.toNumb, existing);
  }
}
