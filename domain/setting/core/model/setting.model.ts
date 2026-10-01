import { z } from "zod";
import { ID } from "$services/shared/kernel";

export const DATE_FORMATS = [
  "d MMM yyyy, HH:mm",
  "dd/MM/yyyy",
  "yyyy-MM-dd",
  "MM/dd/yyyy",
] as const;

export const DEFAULT_DATE_FORMAT = "d MMM yyyy, HH:mm";

export const settingSchema = z.object({
  id: z.number().optional(),
  userId: z.number(),
  currency: z.string().min(3).default("IDR"),
  darkMode: z.boolean().default(false),
  dateFormat: z.string().min(1).max(30).default(DEFAULT_DATE_FORMAT),
  defaultAssetCashId: z.number().optional(),
});

export type SettingType = z.infer<typeof settingSchema>;

export type SettingInput = z.input<typeof settingSchema>;
export type SettingData = z.output<typeof settingSchema>;

const currencySchema = settingSchema.shape.currency;
const darkModeSchema = settingSchema.shape.darkMode;
const dateFormatSchema = settingSchema.shape.dateFormat;
const defaultAssetCashIdSchema = settingSchema.shape.defaultAssetCashId;

export class Setting {
  #id?: number;
  #userId: number;
  #currency: string;
  #darkMode: boolean;
  #dateFormat: SettingData["dateFormat"];
  #defaultAssetCashId?: ID;

  private constructor(data: SettingData) {
    if (data.id) this.#id = data.id;
    this.#userId = data.userId;
    this.#currency = data.currency;
    this.#darkMode = data.darkMode;
    this.#dateFormat = data.dateFormat;
    if (data.defaultAssetCashId) this.#defaultAssetCashId = ID.new(data.defaultAssetCashId);
  }

  get id(): number | undefined {
    return this.#id;
  }

  get userId(): number {
    return this.#userId;
  }

  get currency(): string {
    return this.#currency;
  }

  get darkMode(): boolean {
    return this.#darkMode;
  }

  get dateFormat(): SettingData["dateFormat"] {
    return this.#dateFormat;
  }

  get defaultAssetCashId(): ID | undefined {
    return this.#defaultAssetCashId;
  }

  get metadata() {
    return {
      id: this.#id,
      userId: this.#userId,
      currency: this.#currency,
      darkMode: this.#darkMode,
      dateFormat: this.#dateFormat,
      defaultAssetCashId: this.#defaultAssetCashId?.toNumb,
    };
  }

  setCurrency(currency: string): Setting {
    const result = currencySchema.safeParse(currency);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
    this.#currency = result.data;
    return this;
  }

  setDarkMode(darkMode: boolean): Setting {
    const result = darkModeSchema.safeParse(darkMode);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
    this.#darkMode = result.data;
    return this;
  }

  setDateFormat(dateFormat: SettingData["dateFormat"]): Setting {
    const result = dateFormatSchema.safeParse(dateFormat);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
    this.#dateFormat = result.data;
    return this;
  }

  setDefaultAssetCashId(defaultAssetCashId: ID | undefined): Setting {
    if (defaultAssetCashId) {
      const result = defaultAssetCashIdSchema.safeParse(defaultAssetCashId.toNumb);
      if (!result.success) {
        throw new Error(result.error.issues.map((i) => i.message).join(", "));
      }
      this.#defaultAssetCashId = defaultAssetCashId;
    }
    return this;
  }

  static new(data: SettingInput): Setting {
    const result = settingSchema.safeParse(data);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
    return new Setting(result.data);
  }

  static defaults(userId: number): Setting {
    return new Setting({
      userId,
      currency: "IDR",
      darkMode: false,
      dateFormat: DEFAULT_DATE_FORMAT,
    });
  }
}
