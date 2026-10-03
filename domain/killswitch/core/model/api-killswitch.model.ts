import { z } from "zod";
import { ServiceUnavailableError } from "$services/shared/kernel/errors/service-error";

/** Type root GraphQL yang bisa dimatikan. */
export const KILLSWITCH_ROOT_TYPES = ["Query", "Mutation"] as const;
export type KillswitchRootType = (typeof KILLSWITCH_ROOT_TYPES)[number];

/**
 * Kunci operation dalam bentuk `"<Type>.<field>"`.
 *
 * Noble: nama field GraphQL tidak pernah mengandung `.`, jadi `split(".")`
 * selalu menghasilkan tepat dua bagian dan tidak bisa ambigu.
 */
export function buildOperationKey(type: string, field: string): string {
  return `${type}.${field}`;
}

const OPERATION_KEY_PATTERN = /^(Query|Mutation)\.[_A-Za-z][_0-9A-Za-z]*$/;

export const operationKeySchema = z
  .string()
  .regex(
    OPERATION_KEY_PATTERN,
    'Operation key must look like "Query.<field>" or "Mutation.<field>"',
  );

export const apiKillswitchSchema = z.object({
  operation: operationKeySchema,
  reason: z.string().max(200).optional(),
  disabledAt: z.date(),
});

export type ApiKillswitch = z.infer<typeof apiKillswitchSchema>;
export type OperationKey = z.infer<typeof operationKeySchema>;

/**
 * Error yang dilempar ke client saat operation dimatikan.
 *
 * Mewarisi `ServiceUnavailableError` (bukan `Error` biasa) karena
 * `maskedErrors` di `yoga-server.ts` hanya meneruskan message + code untuk
 * `ServiceError`. `GraphQLError` yang dilempar langsung dari resolver akan
 * dibuang menjadi `"Internal server error"`, dan kode 503-nya ikut hilang.
 */
export class ApiDisabledError extends ServiceUnavailableError {
  readonly operation: string;
  readonly reason: string | null;

  constructor(operation: string, reason: string | null) {
    super(
      reason
        ? `API "${operation}" is temporarily disabled: ${reason}`
        : `API "${operation}" is temporarily disabled`,
    );
    this.name = "ApiDisabledError";
    this.operation = operation;
    this.reason = reason;
  }
}