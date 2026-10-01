import { GraphQLScalarType, Kind, type ValueNode } from "graphql";

export const DateTimeOrTimestampResolver = new GraphQLScalarType({
  name: "DateTimeOrTimestamp",
  description:
    "Menerima ISO 8601 date string (contoh: '2026-06-21T10:30:00Z') atau Unix epoch timestamp dalam detik (contoh: 1789852200). Selalu mengembalikan ISO string pada output.",

  serialize(value: unknown): string {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "number") return new Date(value * 1000).toISOString();
    if (typeof value === "string") return new Date(value).toISOString();
    throw new TypeError(`DateTimeOrTimestamp: cannot serialize value: ${String(value)}`);
  },

  parseValue(value: unknown): Date {
    if (typeof value === "number") return new Date(value * 1000);
    if (typeof value === "string") {
      const d = new Date(value);
      if (isNaN(d.getTime()))
        throw new TypeError(`DateTimeOrTimestamp: invalid date string: ${value}`);
      return d;
    }
    throw new TypeError(`DateTimeOrTimestamp: expected string or number, got ${typeof value}`);
  },

  parseLiteral(ast: ValueNode, _variables: Record<string, unknown> | null | undefined): Date {
    if (ast.kind === Kind.INT) {
      return new Date(parseInt(ast.value, 10) * 1000);
    }
    if (ast.kind === Kind.STRING) {
      const d = new Date(ast.value);
      if (isNaN(d.getTime()))
        throw new TypeError(`DateTimeOrTimestamp: invalid date string: ${ast.value}`);
      return d;
    }
    throw new TypeError(`DateTimeOrTimestamp: expected Int or String literal`);
  },
});
