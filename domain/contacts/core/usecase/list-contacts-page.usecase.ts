import { ContactRepository } from "../ports/out/contact-repository.port";
import { Contact } from "../entity/contact.entity";
import { ID } from "$services/shared/kernel";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";
import {
  resolvePageQuery,
  toContactPage,
  type ContactPage,
  type PageRequest,
} from "../model/contact-page.model";

export type ListContactsPageInput = PageRequest & { userId: ID };

export class ListContactsPageUseCase extends CoreUsecase<ContactPage, ListContactsPageInput> {
  @logMethod(logger)
  async execute(input: ListContactsPageInput): Promise<ContactPage> {
    const { userId, ...request } = input;
    const query = resolvePageQuery(request);
    const contactRepo = this.deps.get(ContactRepository);
    const window = await contactRepo.findPage(userId.toNumb, query);
    return toContactPage(window, query.direction);
  }
}
