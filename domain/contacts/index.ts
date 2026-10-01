export { contactService, createContactService, ContactService } from "./contacts.composition";
export type { ContactAdapters } from "./contacts.composition";
export type { ContactType } from "./adapters/driven/drizzle/contact.entity";
export {
  Cursor,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  type ContactPage,
  type PageRequest,
} from "./core/model/contact-page.model";
