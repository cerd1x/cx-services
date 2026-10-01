export interface ParsedContact {
  name: string;
  email?: string;
  phone?: string;
  group?: string;
}

export interface ParsedProduct {
  name: string;
  price: number;
  currency: string;
  description?: string;
  stock: number;
  capital?: number;
}

export function parseCSV(text: string): ParsedContact[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
  const nameIdx = headers.findIndex((h) => h === "name" || h === "nama");
  const emailIdx = headers.findIndex((h) => h === "email");
  const phoneIdx = headers.findIndex(
    (h) => h === "phone" || h === "tel" || h === "telepon" || h === "handphone" || h === "hp",
  );
  const groupIdx = headers.findIndex((h) => h === "group" || h === "kategori" || h === "category");

  return lines
    .slice(1)
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      const name = nameIdx >= 0 ? cols[nameIdx] : cols[0];
      if (!name || name.trim().length === 0) return null;
      return {
        name: name.trim(),
        email: emailIdx >= 0 ? cols[emailIdx]?.trim() || undefined : undefined,
        phone: phoneIdx >= 0 ? cols[phoneIdx]?.trim() || undefined : undefined,
        group: groupIdx >= 0 ? cols[groupIdx]?.trim() || undefined : undefined,
      };
    })
    .filter(Boolean) as ParsedContact[];
}

export function parseProductCSV(text: string): ParsedProduct[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
  const nameIdx = headers.findIndex(
    (h) => h === "name" || h === "nama" || h === "product" || h === "produk",
  );
  const priceIdx = headers.findIndex(
    (h) => h === "price" || h === "amount" || h === "harga" || h === "jual",
  );
  const currencyIdx = headers.findIndex((h) => h === "currency" || h === "mata uang");
  const descIdx = headers.findIndex(
    (h) => h === "description" || h === "deskripsi" || h === "desc",
  );
  const stockIdx = headers.findIndex(
    (h) => h === "stock" || h === "stok" || h === "quantity" || h === "qty",
  );
  const capitalIdx = headers.findIndex(
    (h) => h === "capital" || h === "modal" || h === "beli" || h === "cost",
  );

  return lines
    .slice(1)
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      const name = nameIdx >= 0 ? cols[nameIdx] : cols[0];
      if (!name || name.trim().length === 0) return null;

      const price =
        priceIdx >= 0 ? parseFloat(cols[priceIdx]?.replace(/[^0-9.\-]/g, "") || "0") : 0;
      if (price <= 0) return null;

      return {
        name: name.trim(),
        price,
        currency: currencyIdx >= 0 ? cols[currencyIdx]?.trim().toUpperCase() || "IDR" : "IDR",
        description: descIdx >= 0 ? cols[descIdx]?.trim() || undefined : undefined,
        stock: stockIdx >= 0 ? parseInt(cols[stockIdx]?.replace(/[^0-9]/g, "") || "0", 10) : 0,
        capital:
          capitalIdx >= 0
            ? parseFloat(cols[capitalIdx]?.replace(/[^0-9.\-]/g, "") || "0") || undefined
            : undefined,
      };
    })
    .filter(Boolean) as ParsedProduct[];
}

import vCard from "vcf";

export function parseVCF(text: string): ParsedContact[] {
  const cards = vCard.parse(text);
  return cards
    .map((card) => {
      const fn = card.get("fn");
      const name = typeof fn === "string" ? fn : fn ? String(fn.valueOf?.() ?? "") : "";
      if (!name || name.trim().length === 0) return null;

      const email = card.get("email");
      const emailStr = Array.isArray(email)
        ? email.map((e) => String(e.valueOf?.() ?? "")).find(Boolean)
        : typeof email === "string"
          ? email
          : email ? String(email.valueOf?.() ?? "") : undefined;

      const tel = card.get("tel");
      const telStr = Array.isArray(tel)
        ? tel.map((t) => String(t.valueOf?.() ?? "")).find(Boolean)
        : typeof tel === "string"
          ? tel
          : tel ? String(tel.valueOf?.() ?? "") : undefined;

      const org = card.get("org");
      const orgStr = Array.isArray(org)
        ? org.map((o) => String(o.valueOf?.() ?? "")).find(Boolean)
        : typeof org === "string"
          ? org
          : org ? String(org.valueOf?.() ?? "") : undefined;

      return {
        name: name.trim(),
        email: emailStr?.trim() || undefined,
        phone: telStr?.trim() || undefined,
        group: orgStr?.trim() || undefined,
      };
    })
    .filter(Boolean) as ParsedContact[];
}

export function parseContactFile(text: string, filename: string): ParsedContact[] {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "vcf") return parseVCF(text);
  return parseCSV(text);
}
