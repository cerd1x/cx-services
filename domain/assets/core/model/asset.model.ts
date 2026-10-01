import { z } from "zod";
import * as Currencies from "dinero.js/currencies";
import { Balance, isoCodeList, type CurrencyMetaType } from "../value-objects/balance.vo";
import { BalanceModel } from "./balance.model";
import { ID, isMybe } from "$services/shared/kernel";
import { myUserID } from "../../../user/core/model/user.model";
import { RequiredErr } from "$services/shared/kernel/errors/service-error";

export const AssetType = {
  bank: "bank",
  ewallet: "ewallet",
  cash: "cash",
  loan: "loan",
  crypto: "crypto",
} as const;

export type AssetType = (typeof AssetType)[keyof typeof AssetType];
export const currencySchema = z.object({
  code: z.enum(isoCodeList),
  base: z.number(),
  exponent: z.number(),
});
export const zBalanceSchema = z.instanceof(Balance);

export type CurrencyType = z.infer<typeof currencySchema>;

export const assetSchema = z.object({
  id: z.number().optional(),
  userId: myUserID,
  balance: zBalanceSchema,
  name: z.string().min(1, "Name is required").max(100, "Name must be at most 100 characters"),
  type: z.enum(AssetType),
});

export type AssetInput = z.input<typeof assetSchema>;
export type AssetData = z.output<typeof assetSchema>;
export type AssetUpdate = Partial<Pick<AssetData, "name" | "type" | "balance">>;

export class Asset {
  #id?: ID;
  #name: string;
  #type: AssetType;
  #balance: Balance;
  #userId: ID;

  private constructor(data: AssetData & { balance: Balance }) {
    if (data.id) this.#id = ID.new(data.id);
    this.#name = data.name;
    this.#type = data.type;
    this.#balance = data.balance;
    this.#userId = data.userId;
  }

  get userId(): ID {
    return this.#userId;
  }

  setId(id: number | string): Asset {
    this.#id = ID.new(id);
    return this;
  }

  get IdStr() {
    if (isMybe(this.#id)) throw new Error("required id");
    return this.#id?.toHash as string;
  }

  get name(): string {
    return this.#name;
  }

  get type(): AssetType {
    return this.#type;
  }

  get currency(): CurrencyMetaType {
    return Currencies[this.#balance.code];
  }

  /**
   * Returns ISO CODE + VALUE as string
   * Example: "USD 100"
   */
  get balance(): string {
    return `${this.#balance.code} ${this.#balance.value}`;
  }

  get metadata() {
    return {
      id: this.#id?.toHash,
      name: this.#name,
      type: this.#type as AssetType,
      balance: this.#balance.value.toString(),
    };
  }

  requiredUserId(): Asset {
    if (isMybe(this.#userId)) throw new RequiredErr("userId", { class: this });
    return this;
  }

  requiredName(): Asset {
    const result = assetSchema.shape.name.safeParse(this.#name);
    if (!result.success) {
      throw new RequiredErr("name", { class: this });
    }
    return this;
  }

  requiredType(): Asset {
    const result = z.enum(AssetType).safeParse(this.#type);
    if (!result.success) {
      throw new RequiredErr("type", { class: this });
    }
    return this;
  }

  requiredBalance(): Asset {
    const result = zBalanceSchema.safeParse(this.#balance);
    if (!result.success) {
      throw new RequiredErr("balance", { class: this });
    }
    return this;
  }

  requiredAll(): Asset {
    return this.requiredUserId().requiredName().requiredType().requiredBalance();
  }

  /**
   * Aturan mutasi saldo yang butuh dua asset (add/subtract/swap).
   * `Balance` di sini adalah nilai uang bersih, bukan saldo asset yang
   * sedang dimutasi.
   */
  static validateMutationAmount(amount: Balance): void {
    if (amount.value <= 0) {
      throw new RequiredErr("amount", { class: Asset });
    }
  }

  static canMutateAsset(asset: Asset, type: "add" | "subtract", amount: Balance): void {
    this.validateMutationAmount(amount);
    if (type === "subtract") {
      BalanceModel.canSubtract(Balance.new(asset.balance), amount);
    }
  }

  static validateSwapPreconditions(fromAsset: Asset, toAsset: Asset, amount: Balance): void {
    if (fromAsset.IdStr === toAsset.IdStr) {
      throw new RequiredErr("swap", { class: Asset });
    }
    this.validateMutationAmount(amount);
    BalanceModel.canSubtract(Balance.new(fromAsset.balance), amount);
  }

  static new(input: AssetInput & { balance: Balance }): Asset {
    const result = assetSchema.safeParse(input);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
    if (input.balance.value < 0) {
      throw new Error("Balance must be non-negative");
    }
    return new Asset({
      id: input.id,
      userId: input.userId,
      name: input.name,
      balance: input.balance,
      type: input.type,
    });
  }
}
