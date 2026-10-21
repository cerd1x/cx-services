import type { RoundingStrategy } from "./decimal";

/**
 * Strategies that can be used to round {@link Money}.
 *
 * Ported from `rusty_money::Round`.
 */
export const Round = {
  /** Round to nearest, with exact midpoints rounded away from zero. */
  HalfUp: "HalfUp",
  /** Round to nearest, with exact midpoints rounded toward zero. */
  HalfDown: "HalfDown",
  /** Round to nearest, with exact midpoints rounded to an even retained digit. */
  HalfEven: "HalfEven",
} as const;

export type Round = (typeof Round)[keyof typeof Round];

/** Maps a {@link Round} strategy onto the underlying decimal rounding mode. */
export function roundingStrategyFor(round: Round): RoundingStrategy {
  switch (round) {
    case Round.HalfUp:
      return "MidpointAwayFromZero";
    case Round.HalfDown:
      return "MidpointTowardZero";
    case Round.HalfEven:
      return "MidpointNearestEven";
  }
}
