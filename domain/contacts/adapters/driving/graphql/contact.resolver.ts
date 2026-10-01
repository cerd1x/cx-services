import type { YogaContext } from "$services/shared/infra/graphql/yoga-context";
import type { Contact } from "../../../core/model/contact.model";
import { ID } from "$services/shared/kernel";
import typeDefs from "./contact.gql?raw";
import type { Resolvers } from "$services/shared/infra/graphql/types";
import { UnauthorizedError } from "$services/shared/kernel/errors/service-error";

const toContactShape = (c: Contact) => ({
  id: c.id?.toHash ?? "",
  userId: c.userId?.toHash ?? "",
  name: c.name,
  email: c.email,
  phone: c.phone,
  phones: c.phones,
  group: c.group,
  avatar: c.avatar,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
});

const resolvers: Resolvers<YogaContext> = {
  Query: {
    contact: async (_parent, args, { contact, userAuth }) => {
      if (!userAuth) throw new UnauthorizedError("Not authenticated");
      const result = await contact.contact(userAuth.id, ID.new(args.id));
      return toContactShape(result);
    },
    contacts: async (_parent, _args, { contact, userAuth }) => {
      if (!userAuth) throw new UnauthorizedError("Not authenticated");
      const contacts = await contact.contacts(userAuth.id);
      return contacts.map(toContactShape);
    },
    contactConnection: async (_parent, args, { contact, userAuth }) => {
      if (!userAuth) throw new UnauthorizedError("Not authenticated");
      const page = await contact.contactsPage(userAuth.id, {
        first: args.first ?? null,
        after: args.after ?? null,
        last: args.last ?? null,
        before: args.before ?? null,
      });
      return {
        edges: page.items.map((node, i) => ({
          cursor: page.cursors[i]!,
          node: toContactShape(node),
        })),
        pageInfo: {
          hasNextPage: page.hasNextPage,
          hasPreviousPage: page.hasPreviousPage,
          startCursor: page.cursors[0] ?? null,
          endCursor: page.cursors.at(-1) ?? null,
        },
      };
    },
  },
  Mutation: {
    createContact: async (_parent, args, { contact, userAuth }) => {
      if (!userAuth) throw new UnauthorizedError("Not authenticated");
      const result = await contact.createContact(
        args.input.name,
        args.input.userId ? ID.new(args.input.userId) : userAuth.id,
        args.input.email ?? undefined,
        args.input.phones ?? args.input.phone ?? undefined,
        args.input.group ?? undefined,
        args.input.avatar ?? undefined,
      );
      return toContactShape(result);
    },
    updateContact: async (_parent, args, { contact, userAuth }) => {
      if (!userAuth) throw new UnauthorizedError("Not authenticated");
      const result = await contact.updateContact(userAuth.id, ID.new(args.id), {
        name: args.input.name ?? undefined,
        email: args.input.email ?? undefined,
        phone: args.input.phone ?? undefined,
        phones: args.input.phones ?? undefined,
        group: args.input.group ?? undefined,
      });
      return toContactShape(result);
    },
    deleteContact: async (_parent, args, { contact, userAuth }) => {
      if (!userAuth) throw new UnauthorizedError("Not authenticated");
      await contact.deleteContact(userAuth.id, ID.new(args.id));
      return true;
    },
    importContacts: async (_parent, args, { contact, userAuth }) => {
      if (!userAuth) throw new UnauthorizedError("Not authenticated");
      const buffer = Buffer.from(args.content, "base64");
      const file = new File([buffer], args.filename, {
        type: args.filename.endsWith(".vcf") ? "text/vcard" : "text/csv",
      });
      const result = await contact.importFromFile(userAuth.id, file);
      return {
        imported: result.imported,
        failed: result.failed,
        merged: result.merged,
      };
    },
    mergeContacts: async (_parent, args, { contact, userAuth }) => {
      if (!userAuth) throw new UnauthorizedError("Not authenticated");
      const result = await contact.mergeContacts(userAuth.id, args.phone);
      return {
        merged: result.merged,
        primary: toContactShape(result.primary),
      };
    },
  },
};

export { typeDefs as contactTypeDefs };
export const contactResolvers = resolvers;
