export interface RetryPolicyConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_CONFIG: RetryPolicyConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

export class RetryPolicy {
  #config: RetryPolicyConfig;

  private constructor(config: RetryPolicyConfig) {
    this.#config = config;
  }

  get maxRetries(): number {
    return this.#config.maxRetries;
  }

  get baseDelayMs(): number {
    return this.#config.baseDelayMs;
  }

  static new(config?: Partial<RetryPolicyConfig>): RetryPolicy {
    return new RetryPolicy({ ...DEFAULT_CONFIG, ...config });
  }

  calculateDelay(attempt: number): number {
    if (attempt <= 0) return this.#config.baseDelayMs;
    const delay = this.#config.baseDelayMs * Math.pow(this.#config.backoffMultiplier, attempt - 1);
    return Math.min(delay, this.#config.maxDelayMs);
  }

  shouldRetry(currentRetryCount: number): boolean {
    return currentRetryCount < this.#config.maxRetries;
  }

  getNextRetryDelay(currentRetryCount: number): number {
    if (!this.shouldRetry(currentRetryCount)) {
      return -1;
    }
    return this.calculateDelay(currentRetryCount + 1);
  }
}

// Abstract token for DI container (ServiceKey requires abstract class)
export abstract class RetryPolicyToken {
  abstract readonly maxRetries: number;
  abstract readonly baseDelayMs: number;
  abstract calculateDelay(attempt: number): number;
  abstract shouldRetry(currentRetryCount: number): boolean;
  abstract getNextRetryDelay(currentRetryCount: number): number;
}