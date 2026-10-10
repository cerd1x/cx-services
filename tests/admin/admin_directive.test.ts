import { describe, expect, it } from "bun:test";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { execute, parse } from "graphql";
import {
  adminDirectiveTypeDefs,
  adminDirectiveTransformer,
} from "$services/shared/infra/graphql/directives";
import {
  AuthenticationError,
  UnauthorizedError,
} from "$services/shared/kernel/errors/service-error";
import type { UserRole } from "$services/domain/user";

/**
 * Gate `@admin` diuji langsung terhadap schema kecil, bukan lewat `app.fetch()`.
 *
 * Yang diuji adalah keputusan otorisasi itu sendiri — 401 tanpa token, 403
 * untuk user biasa — dan itu tidak perlu D1, cookie, maupun JWT asli. Test
 * integrasi yang memalsukan token hanya akan menguji plumbing-nya.
 */
const typeDefs = /* sdl */ `
  ${adminDirectiveTypeDefs}
  type Query {
    adminOnly: String! @admin
    bothGates: String! @authorized @admin
    open: String!
  }
  directive @authorized on OBJECT | FIELD_DEFINITION
`;

function makeSchema() {
  const base = makeExecutableSchema({
    typeDefs,
    resolvers: {
      Query: {
        adminOnly: () => "secret",
        bothGates: () => "secret",
        open: () => "public",
      },
    },
  });
  return adminDirectiveTransformer(base);
}

const schema = makeSchema();

async function run(
  query: string,
  userAuth: { id: unknown; username: string; role: UserRole } | null,
) {
  const result = await execute({
    schema,
    document: parse(query),
    contextValue: { userAuth },
  });
  return result;
}

/** Error asli dari resolver — `execute()` tidak melakukan masking seperti yoga. */
function originalError(result: Awaited<ReturnType<typeof run>>) {
  return result.errors?.[0]?.originalError ?? null;
}

describe("directive @admin", () => {
  it("menolak request tanpa token dengan AuthenticationError (401)", async () => {
    const result = await run("{ adminOnly }", null);

    expect(result.data?.adminOnly).toBeUndefined();
    expect(originalError(result)).toBeInstanceOf(AuthenticationError);
    expect(originalError(result)?.message).toBe("Missing or expired token");
  });

  it("menolak user biasa dengan UnauthorizedError (403)", async () => {
    const result = await run("{ adminOnly }", { id: 2, username: "budi", role: "user" });

    expect(result.data?.adminOnly).toBeUndefined();
    expect(originalError(result)).toBeInstanceOf(UnauthorizedError);
    expect(originalError(result)?.message).toBe("Forbidden: admin role required");
  });

  it("mengizinkan user dengan role admin", async () => {
    const result = await run("{ adminOnly }", { id: 1, username: "cerdix", role: "admin" });

    expect(result.errors).toBeUndefined();
    expect(result.data?.adminOnly).toBe("secret");
  });

  it("hanya `role` yang dihitung: field lain di context tidak menaikkan hak akses", async () => {
    const result = await run("{ adminOnly }", {
      id: 2,
      username: "budi",
      role: "user",
      isAdmin: true,
      permissions: ["admin"],
    } as never);

    expect(result.data?.adminOnly).toBeUndefined();
    expect(originalError(result)).toBeInstanceOf(UnauthorizedError);
  });

  it("tetap menolak anonymous walau field juga memakai @authorized", async () => {
    const result = await run("{ bothGates }", null);

    expect(result.data?.bothGates).toBeUndefined();
    expect(originalError(result)).toBeInstanceOf(AuthenticationError);
  });

  it("tidak menyentuh field tanpa @admin", async () => {
    const result = await run("{ open }", null);

    expect(result.errors).toBeUndefined();
    expect(result.data?.open).toBe("public");
  });
});
