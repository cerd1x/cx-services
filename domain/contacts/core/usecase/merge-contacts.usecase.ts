import { NotFoundError, ValidationError } from "$services/shared/kernel/errors/service-error";
import { ContactRepository } from "../ports/out/contact-repository.port";
import { Contact, MAX_PHONES } from "../../adapters/driven/drizzle/contact.entity";
import { ID } from "$services/shared/kernel";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type MergeContactsInput = {
  userId: ID;
  phone: string;
};

export class MergeContactsUseCase extends CoreUsecase<
  { merged: number; primary: Contact },
  MergeContactsInput
> {
  @logMethod(logger)
  async execute(input: MergeContactsInput): Promise<{ merged: number; primary: Contact }> {
    const contactRepo = this.deps.get(ContactRepository);
    const { userId, phone } = input;

    const normalized = phone.trim();
    if (!normalized) {
      throw new ValidationError("Phone is required to merge contacts");
    }

    const matches = await contactRepo.findByPhone(userId.toNumb, normalized);
    if (matches.length === 0) {
      throw new NotFoundError(`Contact with phone ${normalized}`);
    }

    const [primary, ...duplicates] = matches;
    if (duplicates.length === 0) {
      return { merged: 0, primary };
    }

    const combined = new Set(primary.phones ?? []);
    for (const dup of duplicates) {
      for (const p of dup.phones ?? []) {
        combined.add(p);
      }
    }
    if (combined.size > MAX_PHONES) {
      throw new ValidationError(
        `Cannot merge contacts: combined phone numbers exceed the limit of ${MAX_PHONES}`,
      );
    }

    let merged = 0;
    for (const dup of duplicates) {
      await contactRepo.delete(userId.toNumb, dup.id!.toNumb);
      merged++;
    }

    const newPhones = [...combined];
    if (
      newPhones.length !== (primary.phones ?? []).length ||
      newPhones.some((p, i) => p !== primary.phones?.[i])
    ) {
      primary.phones = newPhones;
      primary.validateAll();
      await contactRepo.update(userId.toNumb, primary);
    }

    return { merged, primary };
  }
}