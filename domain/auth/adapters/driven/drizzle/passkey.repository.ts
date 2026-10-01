import { and, eq } from "drizzle-orm";
import { getDB } from "$services/shared/infra/db";
import { passkeyTable } from "$services/shared/infra/db/drizzle-schema";
import {
  PasskeyRepository,
  type PasskeyRecord,
} from "../../../core/ports/out/passkey-repository.port";

type PasskeyRow = typeof passkeyTable.$inferSelect;

export class PasskeyRepositoryImpl implements PasskeyRepository {
  async save(data: {
    userId: number;
    credentialId: string;
    publicKey: string;
    counter: number;
    transports: string | null;
    deviceName: string | null;
  }): Promise<PasskeyRecord> {
    const rows = await getDB().insert(passkeyTable).values(data).returning();
    return this.#toRecord(rows[0]);
  }

  async findById(credentialId: string): Promise<PasskeyRecord | null> {
    const rows = await getDB()
      .select()
      .from(passkeyTable)
      .where(eq(passkeyTable.credentialId, credentialId))
      .limit(1);
    return rows.length === 0 ? null : this.#toRecord(rows[0]);
  }

  async findByUserId(userId: number): Promise<PasskeyRecord[]> {
    const rows = await getDB()
      .select()
      .from(passkeyTable)
      .where(eq(passkeyTable.userId, userId));
    return rows.map((row) => this.#toRecord(row));
  }

  async updateCounter(credentialId: string, counter: number): Promise<void> {
    await getDB()
      .update(passkeyTable)
      .set({ counter })
      .where(eq(passkeyTable.credentialId, credentialId));
  }

  async deleteByCredentialId(userId: number, credentialId: string): Promise<boolean> {
    const rows = await getDB()
      .delete(passkeyTable)
      .where(
        and(
          eq(passkeyTable.userId, userId),
          eq(passkeyTable.credentialId, credentialId),
        ),
      )
      .returning();
    return rows.length > 0;
  }

  #toRecord(row: PasskeyRow): PasskeyRecord {
    return {
      id: row.id,
      userId: row.userId,
      credentialId: row.credentialId,
      publicKey: row.publicKey,
      counter: row.counter,
      transports: row.transports,
      deviceName: row.deviceName,
      createdAt: row.createdAt,
    };
  }
}
