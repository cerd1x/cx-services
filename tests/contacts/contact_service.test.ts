import { afterEach, beforeAll, describe, expect, it, mock } from "bun:test";
import { NotFoundError, ValidationError } from "$services/shared/kernel/errors/service-error";
import { createContactService, ContactService } from "$services/domain/contacts";
import { Contact } from "$services/domain/contacts/core/entity/contact.entity";
import { ID } from "$services/shared/kernel/id";
import { Cursor } from "$services/domain/contacts/core/model/contact-page.model";

describe("ContactService", () => {
  const contactRepo = {
    save: mock(),
    findById: mock(),
    findAll: mock(),
    findPage: mock(),
    findByPhone: mock(),
    update: mock(),
    delete: mock(),
  };

  beforeAll(() => {
    createContactService({ contactRepo: contactRepo as any });
  });

  afterEach(() => {
    for (const m of Object.values(contactRepo)) (m as any).mockClear();
  });

  describe("createContact", () => {
    it("creates and saves a contact", async () => {
      contactRepo.save.mockImplementation(async (_userId: number, c: Contact) => {
        c.setId = 1;
        return c;
      });

      const result = await ContactService.getInstance().createContact(
        "John Doe",
        ID.new(1),
        "john@test.com",
        "08123456789",
        "friends",
      );

      expect(result.id?.toNumb).toBe(1);
      expect(result.name).toBe("John Doe");
      expect(contactRepo.save).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ name: "John Doe" }),
      );
    });

    it("throws when no id returned", async () => {
      contactRepo.save.mockResolvedValue({});

      await expect(
        ContactService.getInstance().createContact("No ID", ID.new(999)),
      ).rejects.toThrow("Failed to create contact: no id returned");
    });

    it("converts empty email string to undefined", async () => {
      contactRepo.save.mockResolvedValue({ id: 1, name: "Test" });

      await ContactService.getInstance().createContact("Test", ID.new(1), "");

      expect(contactRepo.save).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ name: "Test", email: undefined }),
      );
    });

    it("normalizes multiple phone numbers", async () => {
      contactRepo.save.mockImplementation(async (_userId: number, c: Contact) => {
        c.setId = 1;
        return c;
      });

      const result = await ContactService.getInstance().createContact(
        "Multi Phone",
        ID.new(1),
        undefined,
        ["08123456789", "08223456789", "08123456789"],
      );

      expect(result.phones).toEqual(["08123456789", "08223456789"]);
    });
  });

  describe("contact", () => {
    it("returns contact when found", async () => {
      const c = new Contact({ name: "John Doe", email: "john@test.com", userId: ID.new(1) });
      c.setId = 1;
      contactRepo.findById.mockResolvedValue(c);

      const result = await ContactService.getInstance().contact(ID.new(1), ID.new(1));

      expect(result.id?.toNumb).toBe(1);
      expect(result.name).toBe("John Doe");
    });

    it("throws NotFoundError when not found", async () => {
      contactRepo.findById.mockResolvedValue(null);

      await expect(ContactService.getInstance().contact(ID.new(999), ID.new(999))).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe("contacts", () => {
    it("returns all contacts", async () => {
      const c1 = new Contact({ name: "John", userId: ID.new(1) });
      c1.setId = 1;
      const c2 = new Contact({ name: "Jane", userId: ID.new(1) });
      c2.setId = 2;
      contactRepo.findAll.mockResolvedValue([c1, c2]);

      const result = await ContactService.getInstance().contacts(ID.new(1));

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("John");
      expect(result[1].name).toBe("Jane");
    });
  });

  describe("contactsPage", () => {
    function contactsWithIds(ids: number[]): Contact[] {
      return ids.map((id) => {
        const c = new Contact({ name: `Contact ${id}`, userId: ID.new(1) });
        c.setId = id;
        return c;
      });
    }

    it("asks the repository for a forward page and returns cursors", async () => {
      contactRepo.findPage.mockResolvedValue({
        items: contactsWithIds([3, 2]),
        hasMore: true,
        hasLess: false,
      });

      const result = await ContactService.getInstance().contactsPage(ID.new(7), { first: 2 });

      expect(contactRepo.findPage).toHaveBeenCalledWith(7, {
        limit: 2,
        cursor: null,
        direction: "forward",
      });
      expect(result.items.map((c) => c.id?.toNumb)).toEqual([3, 2]);
      expect(result.cursors).toEqual([Cursor.encode(3), Cursor.encode(2)]);
      expect(result.hasNextPage).toBe(true);
      expect(result.hasPreviousPage).toBe(false);
    });

    it("decodes an opaque after cursor before hitting the repository", async () => {
      contactRepo.findPage.mockResolvedValue({ items: [], hasMore: false, hasLess: false });

      await ContactService.getInstance().contactsPage(ID.new(1), {
        first: 5,
        after: Cursor.encode(40),
      });

      expect(contactRepo.findPage.mock.calls[0]![1].cursor?.position).toBe(40);
    });

    it("switches to a backward query for last/before", async () => {
      contactRepo.findPage.mockResolvedValue({
        items: contactsWithIds([12, 11]),
        hasMore: false,
        hasLess: true,
      });

      const result = await ContactService.getInstance().contactsPage(ID.new(1), {
        last: 2,
        before: Cursor.encode(13),
      });

      expect(contactRepo.findPage.mock.calls[0]![1].direction).toBe("backward");
      expect(result.hasPreviousPage).toBe(false);
      expect(result.hasNextPage).toBe(true);
    });

    it("defaults to the first page when no arguments are given", async () => {
      contactRepo.findPage.mockResolvedValue({ items: [], hasMore: false, hasLess: false });

      await ContactService.getInstance().contactsPage(ID.new(1));

      expect(contactRepo.findPage.mock.calls[0]![1].limit).toBe(20);
    });

    it("rejects a malformed cursor before touching the repository", async () => {
      await expect(
        ContactService.getInstance().contactsPage(ID.new(1), { first: 5, after: "not-a-cursor" }),
      ).rejects.toThrow(ValidationError);
      expect(contactRepo.findPage).not.toHaveBeenCalled();
    });

    it("rejects combining first with last", async () => {
      await expect(
        ContactService.getInstance().contactsPage(ID.new(1), { first: 5, last: 5 }),
      ).rejects.toThrow("Cannot combine 'first' with 'last'");
      expect(contactRepo.findPage).not.toHaveBeenCalled();
    });
  });

  describe("updateContact", () => {
    it("updates contact fields", async () => {
      const existing = new Contact({ name: "Old Name", email: "old@test.com", userId: ID.new(1) });
      existing.setId = 1;
      contactRepo.findById.mockResolvedValue(existing);
      contactRepo.update.mockImplementation(async (_userId: number, c) => c);

      const result = await ContactService.getInstance().updateContact(ID.new(1), ID.new(1), {
        name: "New Name",
        email: "new@test.com",
      });

      expect(result.name).toBe("New Name");
      expect(contactRepo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ name: "New Name", email: "new@test.com" }),
      );
    });

    it("throws NotFoundError when contact not found", async () => {
      contactRepo.findById.mockResolvedValue(null);

      await expect(
        ContactService.getInstance().updateContact(ID.new(999), ID.new(999), { name: "Ghost" }),
      ).rejects.toThrow(NotFoundError);
      expect(contactRepo.update).not.toHaveBeenCalled();
    });
  });

  describe("deleteContact", () => {
    it("deletes contact by id", async () => {
      const c = new Contact({ name: "To Delete", userId: ID.new(1) });
      c.setId = 1;
      contactRepo.findById.mockResolvedValue(c);
      contactRepo.delete.mockResolvedValue(undefined);

      await ContactService.getInstance().deleteContact(ID.new(1), ID.new(1));

      expect(contactRepo.delete).toHaveBeenCalledWith(1, 1);
    });

    it("throws NotFoundError when contact to delete not found", async () => {
      contactRepo.findById.mockResolvedValue(null);

      await expect(
        ContactService.getInstance().deleteContact(ID.new(999), ID.new(999)),
      ).rejects.toThrow(NotFoundError);
      expect(contactRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe("mergeContacts", () => {
    it("merges phones of duplicate contacts into the first one and deletes the rest", async () => {
      const primary = new Contact({
        name: "Alice",
        userId: ID.new(1),
        phones: ["08111111111"],
      });
      primary.setId = 1;
      const duplicate = new Contact({
        name: "Bob",
        userId: ID.new(1),
        phones: ["08211111111", "08311111111"],
      });
      duplicate.setId = 2;
      contactRepo.findByPhone.mockResolvedValue([primary, duplicate]);
      contactRepo.delete.mockResolvedValue(undefined);
      contactRepo.update.mockImplementation(async (_userId: number, c) => c);

      const result = await ContactService.getInstance().mergeContacts(ID.new(1), "08111111111");

      expect(result.merged).toBe(1);
      expect(result.primary.name).toBe("Alice");
      expect(result.primary.phones).toEqual(["08111111111", "08211111111", "08311111111"]);
      expect(contactRepo.delete).toHaveBeenCalledWith(1, 2);
      expect(contactRepo.update).toHaveBeenCalled();
    });

    it("returns merged 0 when only one contact holds the phone", async () => {
      const solo = new Contact({
        name: "Solo",
        userId: ID.new(1),
        phones: ["08111111111"],
      });
      solo.setId = 1;
      contactRepo.findByPhone.mockResolvedValue([solo]);

      const result = await ContactService.getInstance().mergeContacts(ID.new(1), "08111111111");

      expect(result.merged).toBe(0);
      expect(result.primary.name).toBe("Solo");
      expect(contactRepo.delete).not.toHaveBeenCalled();
    });

    it("throws NotFoundError when no contact has the phone", async () => {
      contactRepo.findByPhone.mockResolvedValue([]);

      await expect(
        ContactService.getInstance().mergeContacts(ID.new(1), "08999999999"),
      ).rejects.toThrow(NotFoundError);
      expect(contactRepo.delete).not.toHaveBeenCalled();
    });

    it("throws ValidationError when combined phones exceed 10", async () => {
      const primary = new Contact({
        name: "Full",
        userId: ID.new(1),
        phones: Array.from({ length: 9 }, (_, i) => `0810000000${i}`),
      });
      primary.setId = 1;
      const duplicate = new Contact({
        name: "Overflow",
        userId: ID.new(1),
        phones: Array.from({ length: 5 }, (_, i) => `082000000${i}`),
      });
      duplicate.setId = 2;
      contactRepo.findByPhone.mockResolvedValue([primary, duplicate]);
      contactRepo.delete.mockResolvedValue(undefined);

      await expect(
        ContactService.getInstance().mergeContacts(ID.new(1), "08100000000"),
      ).rejects.toThrow("exceed the limit of 10");
      expect(contactRepo.delete).not.toHaveBeenCalled();
    });
  });
});
