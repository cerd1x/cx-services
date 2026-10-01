import { and, desc, eq } from "drizzle-orm";
import { getDB } from "$services/shared/infra/db";
import { D1TxCollector } from "$services/shared/infra/db/d1-tx-collector";
import { assetTable, assetMutationTable } from "$services/shared/infra/db/drizzle-schema";
import {
  Asset,
  type AssetData,
  type AssetType,
  type AssetUpdate,
} from "./asset.entity";
import { Balance } from "../../../core/value-objects/balance.vo";
import { AssetRepository } from "../../../core/ports/out/asset-repository.port";
import { ID } from "$services/shared/kernel";
import type {
  AssetMutationInput,
  AssetMutationData,
} from "./asset-mutation.entity";

type DB = ReturnType<typeof getDB>;

export class AssetRepositoryImpl implements AssetRepository {
  async save(asset: AssetData & { balance: Balance }, tx?: unknown): Promise<Asset | null> {
    const db = (tx ?? getDB()) as DB;
    const result = await db
      .insert(assetTable)
      .values({
        userId: asset.userId.toNumb ?? null,
        name: asset.name,
        type: asset.type,
        balance: asset.balance.value,
        currency: asset.balance.code,
      })
      .returning();

    if (result.length === 0) return null;

    return Asset.new({
      id: result[0].id,
      userId: ID.new(result[0].userId),
      name: result[0].name,
      type: result[0].type as AssetType,
      balance: Balance.new(`${result[0].currency} ${result[0].balance}`),
    });
  }

  async findAll(userId: ID, tx?: unknown): Promise<Asset[]> {
    const db = (tx ?? getDB()) as DB;
    const rows = await db.select().from(assetTable).where(eq(assetTable.userId, userId.toNumb));
    return rows.map((r) =>
      Asset.new({
        id: r.id,
        userId: ID.new(r.userId),
        name: r.name,
        type: r.type as AssetType,
        balance: Balance.new(`${r.currency} ${r.balance}`),
      }),
    );
  }

  async findByName(name: string, userId: ID, tx?: unknown): Promise<Asset | null> {
    const db = (tx ?? getDB()) as DB;
    const rows = await db
      .select()
      .from(assetTable)
      .where(and(eq(assetTable.name, name), eq(assetTable.userId, userId.toNumb)))
      .limit(1);
    if (rows.length === 0) return null;

    return Asset.new({
      id: rows[0].id,
      userId: ID.new(rows[0].userId),
      name: rows[0].name,
      type: rows[0].type as AssetType,
      balance: Balance.new(`${rows[0].currency} ${rows[0].balance}`),
    });
  }

  async findById(userId: ID, assetId: ID, tx?: unknown): Promise<Asset | null> {
    const db = (tx ?? getDB()) as DB;
    const rows = await db
      .select()
      .from(assetTable)
      .where(and(eq(assetTable.id, assetId.toNumb), eq(assetTable.userId, userId.toNumb)))
      .limit(1);
    if (rows.length === 0) return null;

    return Asset.new({
      id: rows[0].id,
      userId: ID.new(rows[0].userId),
      name: rows[0].name,
      type: rows[0].type as AssetType,
      balance: Balance.new(`${rows[0].currency} ${rows[0].balance}`),
    });
  }

  async update(userId: ID, id: number, data: AssetUpdate, tx?: unknown): Promise<Asset> {
    if (D1TxCollector.is(tx)) {
      const db = getDB() as DB;
      const current = await db.select().from(assetTable).where(eq(assetTable.id, id)).limit(1);
      if (current.length === 0) throw new Error("Asset not found");
      if (current[0].userId !== userId.toNumb) throw new Error("Asset not found");

      const q = db
        .update(assetTable)
        .set({
          name: data.name,
          type: data.type,
          balance: data.balance?.value,
          currency: data.balance?.code,
        })
        .where(eq(assetTable.id, id))
        .returning()
        .toSQL();

      tx.add(q.sql, q.params as unknown[]);

      return Asset.new({
        id: current[0].id,
        userId: ID.new(current[0].userId),
        name: data.name ?? current[0].name,
        type: (data.type ?? current[0].type) as AssetType,
        balance: data.balance ?? Balance.new(`${current[0].currency} ${current[0].balance}`),
      });
    }

    const db = (tx ?? getDB()) as DB;
    const current = await db.select().from(assetTable).where(eq(assetTable.id, id)).limit(1);
    if (current.length === 0) throw new Error("Asset not found");
    if (current[0].userId !== userId.toNumb) throw new Error("Asset not found");

    const result = await db
      .update(assetTable)
      .set({
        name: data.name ?? undefined,
        type: data.type ?? undefined,
        balance: data.balance?.value ?? undefined,
        currency: data.balance?.code ?? undefined,
      })
      .where(eq(assetTable.id, id))
      .returning();

    return Asset.new({
      id: result[0].id,
      userId: ID.new(result[0].userId),
      name: result[0].name,
      type: result[0].type as AssetType,
      balance: Balance.new(`${result[0].currency} ${result[0].balance}`),
    });
  }

  async delete(name: string, userId: ID, tx?: unknown): Promise<void> {
    const db = (tx ?? getDB()) as DB;
    await db
      .delete(assetTable)
      .where(and(eq(assetTable.name, name), eq(assetTable.userId, userId.toNumb)));
  }

  async findMutationsByAssetId(assetId: ID, userId: ID): Promise<AssetMutationData[]> {
    const db = getDB() as DB;
    const rows = await db
      .select()
      .from(assetMutationTable)
      .where(
        and(
          eq(assetMutationTable.assetId, assetId.toNumb),
          eq(assetMutationTable.userId, userId.toNumb),
        ),
      )
      .orderBy(desc(assetMutationTable.createdAt));
    return rows.map((r) => ({ ...r, userId: ID.new(r.userId) })) as AssetMutationData[];
  }

  async createAssetMutation(
    assetId: ID,
    data: AssetMutationInput,
    tx?: unknown,
  ): Promise<AssetMutationData> {
    if (D1TxCollector.is(tx)) {
      const db = getDB() as DB;
      const q = db
        .insert(assetMutationTable)
        .values({
          assetId: assetId.toNumb,
          userId: data.userId.toNumb,
          type: data.type,
          amount: data.amount,
          currency: data.currency,
          balanceBefore: data.balanceBefore,
          balanceAfter: data.balanceAfter,
          description: data.description ?? null,
        })
        .returning()
        .toSQL();

      tx.add(q.sql, q.params as unknown[]);

      return {
        id: 0,
        assetId: assetId.toNumb,
        userId: data.userId,
        type: data.type,
        amount: data.amount,
        currency: data.currency,
        balanceBefore: data.balanceBefore,
        balanceAfter: data.balanceAfter,
        description: data.description ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as unknown as AssetMutationData;
    }

    const db = (tx ?? getDB()) as DB;
    const result = await db
      .insert(assetMutationTable)
      .values({
        assetId: assetId.toNumb,
        userId: data.userId.toNumb,
        type: data.type,
        amount: data.amount,
        currency: data.currency,
        balanceBefore: data.balanceBefore,
        balanceAfter: data.balanceAfter,
        description: data.description ?? null,
      })
      .returning();

    return {
      ...result[0],
      userId: ID.new(result[0].userId),
    } as AssetMutationData;
  }
}
