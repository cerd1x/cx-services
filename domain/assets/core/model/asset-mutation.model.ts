import { z } from "zod";
import type { Money } from "@lib/money";
import { ID, isMybe } from "$services/shared/kernel";
import { RequiredErr } from "$services/shared/kernel/errors/service-error";
import { moneySchema } from "./asset.model";

export const MutationType = {
  add: "add",
  subtract: "subtract",
  transaction: "transaction",
  swap: "swap",
} as const;

export type MutationType = (typeof MutationType)[keyof typeof MutationType];

export const assetMutationSchema = z.object({
  id: z.number().optional(),
  assetId: z.number(),
  userId: z.instanceof(ID),
  type: z.enum(["add", "subtract", "transaction", "swap"]),
  amount: moneySchema,
  balanceBefore: moneySchema,
  balanceAfter: moneySchema,
  description: z.string().nullable().optional(),
  createdAt: z.string().optional(),
});

export type AssetMutationInput = z.input<typeof assetMutationSchema>;
export type AssetMutationData = z.output<typeof assetMutationSchema>;

export class AssetMutation {
  #id?: ID;
  #assetId: ID;
  #userId: ID;
  #type: MutationType;
  #amount: Money;
  #balanceBefore: Money;
  #balanceAfter: Money;
  #description: string | null;
  #createdAt?: string;

  private constructor(data: AssetMutationData) {
    if (data.id) this.#id = ID.new(data.id);
    this.#assetId = ID.new(data.assetId);
    this.#userId = data.userId;
    this.#type = data.type;
    this.#amount = data.amount;
    this.#balanceBefore = data.balanceBefore;
    this.#balanceAfter = data.balanceAfter;
    this.#description = data.description ?? null;
    this.#createdAt = data.createdAt;
  }

  get assetId(): ID {
    return this.#assetId;
  }

  get userId(): ID {
    return this.#userId;
  }

  get type(): MutationType {
    return this.#type;
  }

  /** Nominal mutasi sebagai objek uang (`@lib/money`). */
  get amount(): Money {
    return this.#amount;
  }

  /** Kode mata uang, diturunkan dari nominal mutasi. */
  get currency(): string {
    return this.#amount.currency.code;
  }

  get balanceBefore(): Money {
    return this.#balanceBefore;
  }

  get balanceAfter(): Money {
    return this.#balanceAfter;
  }

  get description(): string | null {
    return this.#description;
  }

  get metadata() {
    return {
      id: this.#id?.toHash,
      assetId: this.#assetId.toHash,
      userId: this.#userId.toHash,
      type: this.#type,
      amount: this.#amount,
      currency: this.currency,
      balanceBefore: this.#balanceBefore,
      balanceAfter: this.#balanceAfter,
      description: this.#description,
      createdAt: this.#createdAt,
    };
  }

  requiredId(): AssetMutation {
    if (isMybe(this.#id)) throw new RequiredErr("id", { class: this });
    return this;
  }

  requiredDescription(): AssetMutation {
    if (!this.#description) throw new RequiredErr("description", { class: this });
    return this;
  }

  static new(input: AssetMutationInput): AssetMutation {
    const result = assetMutationSchema.safeParse(input);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
    return new AssetMutation(result.data);
  }

  /** Menormalkan `description` yang nullable menjadi nilai eksplisit sebelum persist. */
  static createMutationData(input: AssetMutationInput): AssetMutationInput {
    return {
      ...input,
      description: input.description ?? null,
    };
  }
}
