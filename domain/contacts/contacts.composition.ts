import { Contact } from "./adapters/driven/drizzle/contact.entity";
import { ID } from "$services/shared/kernel";
import { CreateContactUseCase } from "./core/usecase/create-contact.usecase";
import { ContactByIdUseCase } from "./core/usecase/contact-by-id.usecase";
import { ListContactsUseCase } from "./core/usecase/list-contacts.usecase";
import { ListContactsPageUseCase } from "./core/usecase/list-contacts-page.usecase";
import { UpdateContactUseCase } from "./core/usecase/update-contact.usecase";
import { DeleteContactUseCase } from "./core/usecase/delete-contact.usecase";
import { MergeContactsUseCase } from "./core/usecase/merge-contacts.usecase";
import { ImportContactsFromFileUseCase } from "./core/usecase/import-contacts-from-file.usecase";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "./core/value-objects/logger";
import { type ContactPage, type PageRequest } from "./core/model/contact-page.model";
import { ServiceContainer } from "$services/shared/base";
import { ContactRepositoryImpl } from "./adapters/driven/drizzle/contact.repository";
import { ContactRepository } from "./core/ports/out/contact-repository.port";

export class ContactService {
  static #instanceContactService: ContactService;
  #createContact: CreateContactUseCase;
  #contactById: ContactByIdUseCase;
  #listContacts: ListContactsUseCase;
  #listContactsPage: ListContactsPageUseCase;
  #updateContact: UpdateContactUseCase;
  #deleteContact: DeleteContactUseCase;
  #mergeContacts: MergeContactsUseCase;
  #importFromFile: ImportContactsFromFileUseCase;

  @logMethod(logger)
  static init(
    createContact: CreateContactUseCase,
    contactById: ContactByIdUseCase,
    listContacts: ListContactsUseCase,
    listContactsPage: ListContactsPageUseCase,
    updateContact: UpdateContactUseCase,
    deleteContact: DeleteContactUseCase,
    mergeContacts: MergeContactsUseCase,
    importFromFile: ImportContactsFromFileUseCase,
  ): ContactService {
    ContactService.#instanceContactService = new ContactService(
      createContact,
      contactById,
      listContacts,
      listContactsPage,
      updateContact,
      deleteContact,
      mergeContacts,
      importFromFile,
    );
    return ContactService.#instanceContactService;
  }

  @logMethod(logger)
  static getInstance(): ContactService {
    if (!ContactService.#instanceContactService) {
      throw new Error("ContactService not initialized");
    }
    return ContactService.#instanceContactService;
  }

  private constructor(
    createContact: CreateContactUseCase,
    contactById: ContactByIdUseCase,
    listContacts: ListContactsUseCase,
    listContactsPage: ListContactsPageUseCase,
    updateContact: UpdateContactUseCase,
    deleteContact: DeleteContactUseCase,
    mergeContacts: MergeContactsUseCase,
    importFromFile: ImportContactsFromFileUseCase,
  ) {
    this.#createContact = createContact;
    this.#contactById = contactById;
    this.#listContacts = listContacts;
    this.#listContactsPage = listContactsPage;
    this.#updateContact = updateContact;
    this.#deleteContact = deleteContact;
    this.#mergeContacts = mergeContacts;
    this.#importFromFile = importFromFile;
  }

  @logMethod(logger)
  async createContact(
    name: string,
    userId: ID,
    email?: string,
    phones?: string | string[],
    group?: string,
    avatar?: string,
  ): Promise<Contact> {
    return this.#createContact.execute({ name, userId, email, phones, group, avatar });
  }

  @logMethod(logger)
  async contact(userId: ID, contactId: ID): Promise<Contact> {
    return this.#contactById.execute({ userId, contactId });
  }

  @logMethod(logger)
  async contacts(userId: ID): Promise<Contact[]> {
    return this.#listContacts.execute(userId);
  }

  @logMethod(logger)
  async contactsPage(userId: ID, page: PageRequest = {}): Promise<ContactPage> {
    return this.#listContactsPage.execute({ userId, ...page });
  }

  @logMethod(logger)
  async updateContact(
    userId: ID,
    contactId: ID,
    data: {
      name?: string;
      email?: string;
      phone?: string;
      phones?: string | string[];
      group?: string;
    },
  ): Promise<Contact> {
    return this.#updateContact.execute({ userId, contactId, data });
  }

  @logMethod(logger)
  async deleteContact(userId: ID, contactId: ID): Promise<void> {
    return this.#deleteContact.execute({ userId, contactId });
  }

  @logMethod(logger)
  async mergeContacts(userId: ID, phone: string): Promise<{ merged: number; primary: Contact }> {
    return this.#mergeContacts.execute({ userId, phone });
  }

  @logMethod(logger)
  async importFromFile(
    userId: ID,
    file: File,
  ): Promise<{ imported: number; failed: number; merged: number }> {
    return this.#importFromFile.execute({ userId, file });
  }
}

export type ContactAdapters = {
  contactRepo: ContactRepository;
};

export function createContactService({ contactRepo }: ContactAdapters): ContactService {
  const container = new ServiceContainer().set(ContactRepository, contactRepo);

  const createContact = new CreateContactUseCase().setContext(container);
  const contactById = new ContactByIdUseCase().setContext(container);
  const listContacts = new ListContactsUseCase().setContext(container);
  const listContactsPage = new ListContactsPageUseCase().setContext(container);
  const updateContact = new UpdateContactUseCase().setContext(container);
  const deleteContact = new DeleteContactUseCase().setContext(container);
  const mergeContacts = new MergeContactsUseCase().setContext(container);
  const importFromFile = new ImportContactsFromFileUseCase().setContext(container);

  container.set(ContactByIdUseCase, contactById);
  container.set(CreateContactUseCase, createContact);

  return ContactService.init(
    createContact,
    contactById,
    listContacts,
    listContactsPage,
    updateContact,
    deleteContact,
    mergeContacts,
    importFromFile,
  );
}

logger.info("Initializing ContactService...");
export const contactService = createContactService({
  contactRepo: new ContactRepositoryImpl(),
});
logger.info("ContactService initialized");
