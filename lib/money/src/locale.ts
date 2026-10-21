/**
 * Regions with unique formatting standards for currencies.
 *
 * Ported from `rusty_money::Locale`. Each locale maps 1:1 to a
 * {@link LocalFormat}, which holds the characteristics used while formatting.
 */
export const Locale = {
  EnUs: "EnUs",
  EnIn: "EnIn",
  EnEu: "EnEu",
  EnBy: "EnBy",
} as const;

export type Locale = (typeof Locale)[keyof typeof Locale];

/** Currency formatting metadata for a specific region (e.g. `EnUs`). */
export interface LocalFormat {
  /** Identifier of the locale, e.g. `en-us`. */
  readonly name: string;
  /** Character used to group digits, e.g. `,`. */
  readonly digitSeparator: string;
  /** Group sizes applied from the right, e.g. `[3, 3, 3]`. */
  readonly digitSeparatorPattern: readonly number[];
  /** Character used to separate the whole part from the fraction, e.g. `.`. */
  readonly exponentSeparator: string;
}

const PATTERN_3_3_3: readonly number[] = [3, 3, 3];
const PATTERN_3_2_2: readonly number[] = [3, 2, 2];

const FORMATS: Record<Locale, LocalFormat> = {
  EnUs: {
    name: "en-us",
    digitSeparator: ",",
    digitSeparatorPattern: PATTERN_3_3_3,
    exponentSeparator: ".",
  },
  EnIn: {
    name: "en-in",
    digitSeparator: ",",
    digitSeparatorPattern: PATTERN_3_2_2,
    exponentSeparator: ".",
  },
  EnEu: {
    name: "en-eu",
    digitSeparator: ".",
    digitSeparatorPattern: PATTERN_3_3_3,
    exponentSeparator: ",",
  },
  EnBy: {
    name: "en-by",
    digitSeparator: " ",
    digitSeparatorPattern: PATTERN_3_3_3,
    exponentSeparator: ",",
  },
};

/** Returns the formatting metadata associated with a locale. */
export function localFormatFromLocale(locale: Locale): LocalFormat {
  return FORMATS[locale];
}

/** All supported locales. */
export const LOCALES: readonly Locale[] = Object.values(Locale);
