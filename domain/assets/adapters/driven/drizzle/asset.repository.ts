import { and, desc, eq } from "drizzle-orm";
import { getDB } from "$services/shared/infra/db";
import { D1TxCollector } from "$services/shared/infra/db/d1-tx-collector";
import { fromMinorUnits, toMinorUnits } from "$services/shared/infra/db/money";
import { assetTable, assetMutationTable } from "$services/shared/infra/db/drizzle-schema";
import {
  Asset,
  type AssetData,
  type AssetType,
  type AssetUpdate,
} from "../../../core/model/asset.model";
import type { Money } from "@lib/money";
import { AssetRepository } from "../../../core/ports/out/asset-repository.port";
import { ID } from "$services/shared/kernel";
import type { MutationType } from "../../../core/model/asset-mutation.model";
import type {
  AssetMutationInput,
  AssetMutationData,
} from "../../../core/model/asset-mutation.model";

type DB = ReturnType<typeof getDB>;

/**
 * Minor unit disimpan sebagai integer SQLite. D1 tidak menerima binding
 * `bigint`, jadi nilainya dikonversi ke `number` — masih presisi penuh untuk
 * nominal sampai 2^53 satuan terkecil.
 */
function minorValue(money: Money): number {
  return Number(toMinorUnits(money));
}

export class AssetRepositoryImpl implements AssetRepository {
  async save(asset: AssetData & { balance: Money }, tx?: unknown): Promise<Asset | null> {
    const db = (tx ?? getDB()) as DB;
    const result = await db
      .insert(assetTable)
      .values({
        userId: asset.userId.toNumb ?? null,
        name: asset.name,
        type: asset.type,
        balance: minorValue(asset.balance),
        currency: asset.balance.currency.code,
      })
      .returning();

    if (result.length === 0) return null;

    return Asset.new({
      id: result[0].id,
      userId: ID.new(result[0].userId),
      name: result[0].name,
      type: result[0].type as AssetType,
      balance: fromMinorUnits(result[0].balance, result[0].currency),
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
        balance: fromMinorUnits(r.balance, r.currency),
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
      balance: fromMinorUnits(rows[0].balance, rows[0].currency),
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
      balance: fromMinorUnits(rows[0].balance, rows[0].currency),
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
          balance: data.balance ? minorValue(data.balance) : undefined,
          currency: data.balance?.currency.code,
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
        balance: data.balance ?? fromMinorUnits(current[0].balance, current[0].currency),
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
        balance: data.balance ? minorValue(data.balance) : undefined,
        currency: data.balance?.currency.code ?? undefined,
      })
      .where(eq(assetTable.id, id))
      .returning();

    return Asset.new({
      id: result[0].id,
      userId: ID.new(result[0].userId),
      name: result[0].name,
      type: result[0].type as AssetType,
      balance: fromMinorUnits(result[0].balance, result[0].currency),
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

    return rows.map((r) => ({
      id: r.id,
      assetId: r.assetId,
      userId: ID.new(r.userId),
      type: r.type as MutationType,
      amount: fromMinorUnits(r.amount, r.currency),
      balanceBefore: fromMinorUnits(r.balanceBefore, r.currency),
      balanceAfter: fromMinorUnits(r.balanceAfter, r.currency),
      description: r.description,
      createdAt: r.createdAt,
    }));
  }

  async createAssetMutation(
    assetId: ID,
    data: AssetMutationInput,
    tx?: unknown,
  ): Promise<AssetMutationData> {
    const values = {
      assetId: assetId.toNumb,
      userId: data.userId.toNumb,
      type: data.type,
      amount: minorValue(data.amount),
      currency: data.amount.currency.code,
      balanceBefore: minorValue(data.balanceBefore),
      balanceAfter: minorValue(data.balanceAfter),
      description: data.description ?? null,
    };

    if (D1TxCollector.is(tx)) {
      const db = getDB() as DB;
      const q = db.insert(assetMutationTable).values(values).returning().toSQL();

      tx.add(q.sql, q.params as unknown[]);

      return {
        id: 0,
        assetId: assetId.toNumb,
        userId: data.userId,
        type: data.type,
        amount: data.amount,
        balanceBefore: data.balanceBefore,
        balanceAfter: data.balanceAfter,
        description: data.description ?? null,
        createdAt: new Date().toISOString(),
      };
    }

    const db = (tx ?? getDB()) as DB;
    const result = await db.insert(assetMutationTable).values(values).returning();

    return {
      id: result[0].id,
      assetId: result[0].assetId,
      userId: ID.new(result[0].userId),
      type: result[0].type as MutationType,
      amount: fromMinorUnits(result[0].amount, result[0].currency),
      balanceBefore: fromMinorUnits(result[0].balanceBefore, result[0].currency),
      balanceAfter: fromMinorUnits(result[0].balanceAfter, result[0].currency),
      description: result[0].description,
      createdAt: result[0].createdAt,
    };
  }
}
