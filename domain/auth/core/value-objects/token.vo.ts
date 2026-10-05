/**
 * Entry point tunggal untuk `Token`.
 *
 * Ganti satu baris di bawah untuk pindah implementasi — semua call site
 * (`issue-session`, `authorize`, `sign-up`, test) tidak berubah karena kedua
 * versi punya signature identik (`generate`/`verify`/`from` async).
 *
 * - `./token.vo.jose` → `jose` / Web Crypto. **Wajib untuk Cloudflare Workers.**
 * - `./token.vo.jwt`  → `jsonwebtoken`. Hanya runtime Node/Bun.
 */
export {
  Token,
  tokenSchema,
  type TokenInput,
  type TokenPayload,
  type TokenData,
  type TokenType,
  type DecodedToken,
} from "./token.vo.jose";
