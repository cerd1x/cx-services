import { z } from "zod";
import { ID, isMybe } from "$services/shared/kernel";
import { RequiredErr } from "$services/shared/kernel/errors/service-error";

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
  amount: z.number(),
  currency: z.string().length(3),
  balanceBefore: z.string(),
  balanceAfter: z.string(),
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
  #amount: number;
  #currency: string;
  #balanceBefore: string;
  #balanceAfter: string;
  #description: string | null;
  #createdAt?: string;

  private constructor(data: AssetMutationData) {
    if (data.id) this.#id = ID.new(data.id);
    this.#assetId = ID.new(data.assetId);
    this.#userId = data.userId;
    this.#type = data.type;
    this.#amount = data.amount;
    this.#currency = data.currency;
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

  get amount(): number {
    return this.#amount;
  }

  get currency(): string {
    return this.#currency;
  }

  get balanceBefore(): string {
    return this.#balanceBefore;
  }

  get balanceAfter(): string {
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
      currency: this.#currency,
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
