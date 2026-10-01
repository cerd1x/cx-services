import type { Contact } from "../../../adapters/driven/drizzle/contact.entity";
import type { PageQuery, PageWindow } from "../../model/contact-page.model";

export abstract class ContactRepository {
  abstract save(userId: number, contact: Contact): Promise<Contact>;
  abstract findById(userId: number, id: number): Promise<Contact | null>;
  abstract findAll(userId: number): Promise<Contact[]>;
  /**
   * Keyset page of a user's contacts ordered by `id DESC`.
   *
   * Implementations must return at most `query.limit` rows and must report
   * `hasMore`/`hasLess` for that page, so the caller can fill Relay's PageInfo
   * without knowing how many rows the user owns in total.
   */
  abstract findPage(userId: number, query: PageQuery): Promise<PageWindow>;
  abstract findByPhone(userId: number, phone: string): Promise<Contact[]>;
  abstract update(userId: number, contact: Contact): Promise<Contact>;
  abstract delete(userId: number, id: number): Promise<void>;
}