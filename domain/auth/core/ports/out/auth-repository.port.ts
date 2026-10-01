export type TokenRecord = {
  userId: number;
  expiredAtSession: Date;
  expiredAtRefresh: Date;
};

export abstract class AuthRepository {
  abstract saveToken(
    userId: number,
    data: {
      sessionToken: string;
      refreshToken: string;
      expiredAtSession: Date;
      expiredAtRefresh: Date;
    },
  ): Promise<TokenRecord & { session: string; refreshToken: string }>;
  abstract findToken(
    token: string,
  ): Promise<(TokenRecord & { session: string | null; refreshToken: string | null }) | null>;
  abstract findTokensByUserId(
    userId: number,
  ): Promise<(TokenRecord & { session: string | null; refreshToken: string | null }) | null>;
  abstract updateToken(
    userId: number,
    data: Partial<TokenRecord & { session?: string; refresh?: string }>,
  ): Promise<TokenRecord>;
  abstract deleteToken(token: string): Promise<void>;
  abstract deleteExpiredTokens(): Promise<number>;
}
