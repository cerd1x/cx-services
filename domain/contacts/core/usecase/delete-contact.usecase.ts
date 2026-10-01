import { ContactRepository } from "../ports/out/contact-repository.port";
import { ID } from "$services/shared/kernel";
import { ContactByIdUseCase } from "./contact-by-id.usecase";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type DeleteContactInput = {
  userId: ID;
  contactId: ID;
};

export class DeleteContactUseCase extends CoreUsecase<void, DeleteContactInput> {
  @logMethod(logger)
  async execute(input: DeleteContactInput): Promise<void> {
    const contactRepo = this.deps.get(ContactRepository);
    const { userId, contactId } = input;

    await this.deps.get(ContactByIdUseCase).execute({ userId, contactId });
    await contactRepo.delete(userId.toNumb, contactId.toNumb);
  }
}