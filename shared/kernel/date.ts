/**
 * Utilitas konversi antara **Unix epoch timestamp** (detik atau milidetik, UTC)
 * dan **string tanggal-waktu standar** (ISO 8601, UTC) yang bisa dibaca manusia.
 *
 * Semua konversi ke/dari string diasumsikan berzona waktu UTC (suffix `Z`),
 * sesuai aturan penyimpanan datetime di repository (epoch unix, UTC 0).
 *
 * Konvensi magnitudo:
 * - nilai < 1e12 dianggap **detik** (Unix epoch standar),
 * - nilai >= 1e12 dianggap **milidetik** (Date.now()).
 * Auto-detect ini membuat util aman dipakai untuk kedua bentuk.
 */

const MS_THRESHOLD = 1e12;

/** Normalisasi input (Date / detik / ms) menjadi milidetik. */
export function toMillis(epoch: number | Date): number {
  if (epoch instanceof Date) return epoch.getTime();
  if (typeof epoch !== "number" || !Number.isFinite(epoch)) {
    throw new TypeError(`toMillis: expected number or Date, got ${typeof epoch}`);
  }
  return epoch < MS_THRESHOLD ? epoch * 1000 : epoch;
}

/** Konversi ke detik (truncated). */
export function toSeconds(epoch: number | Date): number {
  return Math.trunc(toMillis(epoch) / 1000);
}

/** Buat objek `Date` (UTC) dari epoch. */
export function epochToDate(epoch: number | Date): Date {
  return new Date(toMillis(epoch));
}

/** Format epoch → string ISO 8601 UTC standar, mis. "2026-06-21T10:30:00.000Z". */
export function epochToISOString(epoch: number | Date): string {
  return epochToDate(epoch).toISOString();
}

// --- alias yang umum dipakai ---
export const formatEpochToISO = epochToISOString;
export const formatUnixTimestamp = epochToISOString;
export const unixToISOString = epochToISOString;
export const formatTimestamp = epochToISOString;
export const toISOString = epochToISOString;
export const formatEpochToString = epochToISOString;
export const epochToDateTimeString = epochToISOString;
export const toStandardDateTimeString = epochToISOString;

/** Format epoch → string tanggal-waktu yang mudah dibaca manusia (UTC). */
export function formatEpochHuman(
  epoch: number | Date,
  locale: string = "id-ID",
  options: Intl.DateTimeFormatOptions = {},
): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
    ...options,
  }).format(epochToDate(epoch));
}

export const formatEpochReadable = formatEpochHuman;
export const formatEpochToHuman = formatEpochHuman;
export const toHumanReadable = formatEpochHuman;

/** Alias generik `formatEpoch(epoch, options?)` → ISO string standar. */
export function formatEpoch(
  epoch: number | Date,
  _options?: unknown,
): string {
  return epochToISOString(epoch);
}

/** Alias generik `formatDate(epoch)` → ISO string standar. */
export function formatDate(epoch: number | Date): string {
  return epochToISOString(epoch);
}

/** Alias generik `formatDateTime(epoch)` → ISO string standar. */
export function formatDateTime(epoch: number | Date): string {
  return epochToISOString(epoch);
}

/**
 * Parse string tanggal-waktu (ISO 8601 atau format SQLite `YYYY-MM-DD HH:MM:SS`)
 * menjadi `Date` yang diinterpretasikan sebagai UTC.
 */
export function parseUtcTimestamp(raw: string): Date {
  const trimmed = raw.trim();
  if (trimmed.length === 0) throw new TypeError("parseUtcTimestamp: empty input");

  const hasTz = /[zZ]$/.test(trimmed) || /[+-]\d{2}:?\d{2}$/.test(trimmed);
  const hasT = trimmed.includes("T");

  let candidate = trimmed;
  if (!hasT) candidate = candidate.replace(" ", "T");
  if (!hasTz) candidate = candidate + "Z";

  const d = new Date(candidate);
  if (Number.isNaN(d.getTime())) {
    throw new TypeError(`parseUtcTimestamp: invalid date "${raw}"`);
  }
  return d;
}

export function parseISOString(iso: string): Date {
  return parseUtcTimestamp(iso);
}

/** Parse string tanggal-waktu → epoch (detik secara default). */
export function parseToEpoch(
  raw: string,
  unit: "s" | "ms" = "s",
): number {
  const ms = parseUtcTimestamp(raw).getTime();
  return unit === "ms" ? ms : Math.trunc(ms / 1000);
}

export function isoToEpoch(iso: string, unit: "s" | "ms" = "s"): number {
  return parseToEpoch(iso, unit);
}

/** Sekarang, sebagai epoch detik (UTC). */
export function nowEpochSeconds(): number {
  return Math.trunc(Date.now() / 1000);
}

/** Sekarang, sebagai epoch milidetik (UTC). */
export function nowEpochMillis(): number {
  return Date.now();
}

const dateUtils = {
  toMillis,
  toSeconds,
  epochToDate,
  epochToISOString,
  formatEpochToISO,
  formatUnixTimestamp,
  formatTimestamp,
  formatEpoch,
  formatDate,
  formatDateTime,
  formatEpochHuman,
  formatEpochReadable: formatEpochHuman,
  formatEpochToHuman: formatEpochHuman,
  toHumanReadable: formatEpochHuman,
  parseUtcTimestamp,
  parseISOString,
  parseToEpoch,
  isoToEpoch,
  nowEpochSeconds,
  nowEpochMillis,
};

export default dateUtils;