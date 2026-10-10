import { getTableConfig, type SQLiteColumn, type SQLiteTable } from "drizzle-orm/sqlite-core";
import { is, SQL } from "drizzle-orm";

/**
 * DDL generator untuk `D1Mock`, diturunkan langsung dari drizzle schema.
 *
 * Sebelumnya DDL ditulis tangan di `d1-mock.ts` dan sudah pernah drift: kolom
 * `user.role` dan `transaction.payment_status` ditambahkan ke schema tapi tidak
 * ke DDL, sehingga 56 test e2e gagal dengan `signUp failed: undefined` — bukan
 * karena bug aplikasi, tapi karena test DB-nya tidak tahu kolom baru. Menulis
 * DDL dari sumber yang sama dengan production menutup kelas bug itu sepenuhnya.
 *
 * Cakupan yang didukung sengaja mengikuti schema yang ada: kolom, PK
 * auto-increment, UNIQUE, CHECK enum, DEFAULT, foreign key, dan index. Kalau
 * schema nanti memakai fitur di luar itu, generator ini akan gagal cepat
 * (atau menghasilkan DDL yang salah) — itu lebih baik daripada diam-diam
 * membuat test DB yang tidak mencerminkan production.
 */

type AnyColumn = SQLiteColumn;

function quote(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/** Nama kolom untuk anggota index; anggota berbasis `SQL` dibiarkan apa adanya. */
function columnName(column: AnyColumn | SQL): string {
  return is(column, SQL) ? (renderValue(column) ?? "") : column.name;
}

/** Render objek `SQL` drizzle ke potongan SQL, atau `null` bila bukan `SQL`. */
function renderSql(value: unknown): string | null {
  if (!is(value, SQL)) return null;
  return value.toQuery({
    escapeName: quote,
    escapeParam: (param: unknown) => String(param),
    escapeString: (str: string) => `'${str.replace(/'/g, "''")}'`,
    invokeSource: undefined,
  }).sql;
}

/**
 * Render literal biasa ke SQL.
 *
 * Dipisah dari {@link renderSql} agar penyempitan tipe oleh `is(value, SQL)`
 * tidak ikut terbawa ke cabang non-`SQL`.
 */
function renderLiteral(value: unknown): string | null {
  if (value === undefined || value === null) return null;

  if (typeof value === "number") return String(value);
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "boolean") return value ? "1" : "0";

  if (typeof value !== "string") return null;

  /**
   * String default pada schema ini selalu literal teks (`"IDR"`,
   * `{"type":"cash"}`, `d MMM yyyy, HH:mm`) — kecuali yang memang ditulis
   * sebagai ekspresi SQL lewat `sql\`...\``, yang sudah tertangani di atas.
   * Karena itu bentuk `nama(` dibaca ekspresi, sisanya selalu literal yang
   * wajib di-escape; tidak ada kebalikan, teks yang lolos adalah SQL rusak.
   */
  return /^[A-Za-z_][A-Za-z0-9_]*\s*\(/.test(value) ? value : quote(value);
}

function renderValue(value: unknown): string | null {
  return renderSql(value) ?? renderLiteral(value);
}

function renderColumn(column: AnyColumn): string {
  const parts: string[] = [];

  // SQLite menolak `NOT NULL` setelah PK literal, dan `AUTOINCREMENT` hanya
  // sah pada `INTEGER PRIMARY KEY` — yang tetap harus ditulis lengkap dengan
  // nama kolomnya. PK integer sudah merepresentasikan baris ada, jadi NOT NULL
  // tidak perlu diulang.
  const isIntegerPk = column.primary && column.getSQLType() === "integer";
  parts.push(quote(column.name));
  parts.push(column.getSQLType().toUpperCase());
  if (column.primary) parts.push("PRIMARY KEY");
  // `autoIncrement` hanya ada pada builder integer, tidak di tipe kolom umum.
  if (isIntegerPk && (column as { autoIncrement?: boolean }).autoIncrement)
    parts.push("AUTOINCREMENT");

  if (column.isUnique) parts.push("UNIQUE");

  const dflt = column.hasDefault ? renderValue(column.default) : null;
  if (dflt !== null) parts.push(`DEFAULT ${dflt}`);

  if (column.enumValues) {
    const allowed = column.enumValues.map((v: string) => quote(v)).join(", ");
    parts.push(`CHECK(${quote(column.name)} IN (${allowed}))`);
  }

  if (column.notNull && !isIntegerPk) parts.push("NOT NULL");

  return parts.join(" ");
}

function renderTable(table: SQLiteTable): string {
  const config = getTableConfig(table);
  const columns = config.columns.map(renderColumn);

  for (const fk of config.foreignKeys) {
    const ref = fk.reference();
    const local = ref.columns.map((c) => quote(c.name)).join(", ");
    const foreignTable = getTableConfig(ref.foreignTable as unknown as SQLiteTable).name;
    const foreign = ref.foreignColumns.map((c) => quote(c.name)).join(", ");
    const clauses = [`FOREIGN KEY (${local}) REFERENCES ${quote(foreignTable)}(${foreign})`];
    if (fk.onDelete && fk.onDelete !== "no action") {
      clauses.push(`ON DELETE ${fk.onDelete.toUpperCase()}`);
    }
    if (fk.onUpdate && fk.onUpdate !== "no action") {
      clauses.push(`ON UPDATE ${fk.onUpdate.toUpperCase()}`);
    }
    columns.push(`CONSTRAINT ${quote(fk.getName())} ${clauses.join(" ")}`);
  }

  for (const unique of config.uniqueConstraints) {
    const cols = unique.columns.map((c) => quote(c.name)).join(", ");
    columns.push(`CONSTRAINT ${quote(unique.getName())} UNIQUE (${cols})`);
  }

  return `CREATE TABLE IF NOT EXISTS ${quote(config.name)} (\n  ${columns.join(",\n  ")}\n);`;
}

function renderIndexes(table: SQLiteTable): string[] {
  const tableName = getTableConfig(table).name;

  return getTableConfig(table).indexes.map((idx) => {
    // `IndexColumn` bisa berupa `SQL` (ekspresi), bukan hanya kolom bernama.
    const cols = idx.config.columns.map((c) => quote(columnName(c))).join(", ");
    const unique = idx.config.unique ? "UNIQUE " : "";
    const where = idx.config.where ? ` WHERE ${renderValue(idx.config.where)}` : "";
    return `CREATE ${unique}INDEX IF NOT EXISTS ${quote(idx.config.name)} ON ${quote(tableName)} (${cols})${where};`;
  });
}

/** Urut berdasarkan dependensi FK agar `PRAGMA foreign_keys = ON` tidak meledak. */
function sortByForeignKeyOrder(tables: SQLiteTable[]): SQLiteTable[] {
  const byName = new Map(tables.map((t) => [getTableConfig(t).name, t]));
  const visited = new Set<string>();
  const out: SQLiteTable[] = [];

  const visit = (table: SQLiteTable, stack: Set<string>) => {
    const name = getTableConfig(table).name;
    if (visited.has(name) || stack.has(name)) return;
    stack.add(name);

    for (const fk of getTableConfig(table).foreignKeys) {
      const parent = getTableConfig(fk.reference().foreignTable as unknown as SQLiteTable).name;
      const parentTable = byName.get(parent);
      if (parentTable) visit(parentTable, stack);
    }

    stack.delete(name);
    visited.add(name);
    out.push(table);
  };

  for (const table of tables) visit(table, new Set());
  return out;
}

/** Semua statement CREATE untuk sekumpulan tabel drizzle. */
export function buildDdl(tables: SQLiteTable[]): string[] {
  const ordered = sortByForeignKeyOrder(tables);
  return ordered.flatMap((t) => [renderTable(t), ...renderIndexes(t)]);
}
