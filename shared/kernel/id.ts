import Sqids from "sqids";

export class ID {
  /**
   * Codec Sqids untuk hash ID (`minLength: 10`).
   *
   * Disimpan sebagai private static milik class — bukan variabel module —
   * supaya seluruh perilaku identifier (buat, encode, decode) terpusat di
   * {@link ID} dan tidak bocor ke scope luar.
   */
  static #sqids = new Sqids({ minLength: 10 });

  /** Separator antar scope dan hash, contoh: `CT.<hash>`. */
  static readonly #SEPARATOR = ".";

  #id_num!: number;
  #id_str!: string;
  #kind: "num" | "str";

  constructor(id: number | string) {
    if (typeof id === "string") {
      this.#id_str = id;
      this.#kind = "str";
    } else if (typeof id === "number") {
      this.#id_num = id;
      this.#kind = "num";
    } else {
      throw new Error("id invalid");
    }
  }

  static new(id: number | string): ID {
    return new ID(id);
  }

  /** Hash Sqids dari nomor asli. */
  static encode(id: number): string {
    return ID.#sqids.encode([id]);
  }

  /**
   * Membuat ID terenkripsi dari scope (mis. `CT` untuk contact) + hash
   * Sqids dari nomor asli. Contoh: `ID.withScope("CT", 42)` → `CT.<hash>`.
   */
  static withScope(scope: string, num: number): ID {
    const encoded = `${scope}${ID.#SEPARATOR}${ID.encode(num)}`;
    const id = ID.new(encoded);
    return id;
  }

  static is(value: unknown): value is ID {
    if (value instanceof ID) return true;
    if (typeof value === "string") {
      try {
        const hash = value.includes(ID.#SEPARATOR)
          ? value.slice(value.indexOf(ID.#SEPARATOR) + 1)
          : value;
        const decoded = ID.#sqids.decode(hash);
        if (Array.isArray(decoded) && decoded.length > 0 && typeof decoded[0] === "number" && !Number.isNaN(decoded[0])) {
          return true;
        }
      } catch {
        // ignore decode errors
      }
    }
    return false;
  }

  get str(): string {
    if (this.#kind === "str") return this.#id_str;
    return ID.encode(this.#id_num);
  }

  /** @deprecated Use `str` instead. */
  get toHash(): string {
    return this.str;
  }

  /** Decode hash (atau scope + hash, contoh `CT.<hash>`) ke angka asli. */
  get decode(): number {
    if (this.#kind === "num") return this.#id_num;
    const hash = this.#id_str.includes(ID.#SEPARATOR)
      ? this.#id_str.slice(this.#id_str.indexOf(ID.#SEPARATOR) + 1)
      : this.#id_str;
    return ID.#sqids.decode(hash)[0];
  }

  eq(other: ID | string | number): boolean {
    if (other instanceof ID) return this.decode === other.decode;
    if (typeof other === "number") return this.decode === other;
    return this.str === other;
  }
}
