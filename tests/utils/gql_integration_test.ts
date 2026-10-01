import app from "$services/app";
import { print } from "graphql";
import type { DocumentNode } from "graphql";

export async function gqlRequest<T extends object>(
  query: string | DocumentNode,
  variables?: Record<string, unknown>,
  headers?: Record<string, string>,
) {
  let q = typeof query === "object" && query.kind === "Document" ? print(query) : query;
  const res = await app.fetch(
    new Request("http://localhost/graphql", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({ query: q, variables }),
    }),
  );

  let result: object | undefined = (await res.json())?.data;

  let data = result ? (result as T) : ({} as T);

  return { data, req: res };
}
