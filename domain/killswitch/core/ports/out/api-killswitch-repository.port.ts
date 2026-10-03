import type { ApiKillswitch } from "../../model/api-killswitch.model";

// Di-re-export supaya adapter cukup mengimpor satu file (port) untuk kontrak
// dan tipe datanya.
export type { ApiKillswitch };

export interface DisabledState {
  disabled: boolean;
  reason: string | null;
}

export abstract class ApiKillswitchRepository {
  /** Semua operation yang sedang dimatikan. */
  abstract listDisabled(): Promise<ApiKillswitch[]>;
  /** Status satu operation, untuk jalur hot path per request. */
  abstract isDisabled(operation: string): Promise<DisabledState>;
  /** Matikan satu operation. Idempotent. */
  abstract disable(operation: string, reason?: string): Promise<ApiKillswitch>;
  /** Nyalakan kembali satu operation. `false` bila memang tidak ada yang dinyalakan. */
  abstract enable(operation: string): Promise<boolean>;
  /** Buang cache lokal; pembaca berikutnya akan query D1. */
  abstract invalidateCache(): void;
}