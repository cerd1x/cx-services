import { eq, lt, or } from "drizzle-orm";
import { getDB, getD1 } from "$services/shared/infra/db";
import { tokenTable } from "$services/shared/infra/db/drizzle-schema";
import { AuthRepository } from "../../../core/ports/out/auth-repository.port";
import type { TokenRecord } from "../../../core/ports/out/auth-repository.port";

export class AuthRepositoryImpl implements AuthRepository {
  async saveToken(
    userId: number,
    data: {
      sessionToken: string;
      refreshToken: string;
      expiredAtSession: Date;
      expiredAtRefresh: Date;
    },
  ): Promise<TokenRecord & { session: string; refreshToken: string }> {
    try {
      const d1 = getD1();
      await d1
        .prepare(
          "INSERT INTO token (user_id, session_token, refresh_token, expired_at_session, expired_at_refresh) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(
          userId,
          data.sessionToken,
          data.refreshToken,
          data.expiredAtSession,
          data.expiredAtRefresh,
        )
        .run();
    } catch {
      await getDB().insert(tokenTable).values({
        userId,
        sessionToken: data.sessionToken,
        refreshToken: data.refreshToken,
        expiredAtSession: data.expiredAtSession,
        expiredAtRefresh: data.expiredAtRefresh,
      });
    }

    return {
      userId,
      expiredAtSession: data.expiredAtSession,
      expiredAtRefresh: data.expiredAtRefresh,
      session: data.sessionToken,
      refreshToken: data.refreshToken,
    };
  }

  async findToken(token: string): Promise<
    | (TokenRecord & {
        session: string | null;
        refreshToken: string | null;
      })
    | null
  > {
    const rows = await getDB()
      .select()
      .from(tokenTable)
      .where(eq(tokenTable.sessionToken, token))
      .limit(1);

    if (rows.length === 0) return null;

    return {
      userId: rows[0].userId,
      expiredAtSession: rows[0].expiredAtSession,
      expiredAtRefresh: rows[0].expiredAtRefresh,
      session: rows[0].sessionToken ?? null,
      refreshToken: rows[0].refreshToken ?? null,
    };
  }

  async findTokensByUserId(userId: number): Promise<
    | (TokenRecord & {
        session: string | null;
        refreshToken: string | null;
      })
    | null
  > {
    const rows = await getDB().select().from(tokenTable).where(eq(tokenTable.userId, userId));
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      userId: row.userId,
      expiredAtSession: row.expiredAtSession,
      expiredAtRefresh: row.expiredAtRefresh,
      session: row.sessionToken ?? null,
      refreshToken: row.refreshToken ?? null,
    };
  }

  async updateToken(
    userId: number,
    data: Partial<TokenRecord & { session?: string; refresh?: string }>,
  ): Promise<TokenRecord> {
    const setData: Record<string, unknown> = {};
    if (data.expiredAtSession) setData.expiredAtSession = data.expiredAtSession;
    if (data.expiredAtRefresh) setData.expiredAtRefresh = data.expiredAtRefresh;
    if (data.session) setData.sessionToken = data.session;
    if (data.refresh) setData.refreshToken = data.refresh;

    const result = await getDB()
      .update(tokenTable)
      .set(setData)
      .where(eq(tokenTable.userId, userId))
      .returning();

    return {
      userId: result[0].userId,
      expiredAtSession: result[0].expiredAtSession,
      expiredAtRefresh: result[0].expiredAtRefresh,
    };
  }

  async deleteToken(token: string): Promise<void> {
    await getDB()
      .delete(tokenTable)
      .where(or(eq(tokenTable.sessionToken, token), eq(tokenTable.refreshToken, token)));
  }

  async deleteExpiredTokens(): Promise<number> {
    const now = new Date();
    const result = await getDB()
      .delete(tokenTable)
      .where(lt(tokenTable.expiredAtRefresh, now))
      .returning();

    return result.length;
  }
}
