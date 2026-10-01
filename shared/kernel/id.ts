import Sqids from "sqids";

const _ = new Sqids({ minLength: 10 });

export class ID {
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

  static is(value: unknown): value is ID {
    return value instanceof ID;
  }

  get toHash(): string {
    if (this.#kind === "str") return this.#id_str;
    return _.encode([this.#id_num]);
  }

  get toNumb(): number {
    if (this.#kind === "num") return this.#id_num;
    return _.decode(this.#id_str)[0];
  }

  eq(other: ID | string | number): boolean {
    if (other instanceof ID) return this.toNumb === other.toNumb;
    if (typeof other === "number") return this.toNumb === other;
    return this.toHash === other;
  }
}
