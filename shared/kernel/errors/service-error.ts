export interface ServiceErrorOptions {
  cause?: unknown;
  class?: object;
  /**
   * Pakai `resource` apa adanya tanpa menambah akhiran `" not found"`.
   * Berguna ketika pesan final harus presisi (mis. sudah uppercase).
   */
  exact?: boolean;
}

export class ServiceError extends Error {
  readonly code: number;

  constructor(message: string, code = 500, options?: ServiceErrorOptions) {
    super(message, options);
    this.name = "ServiceError";
    this.code = code;
  }
}

export class ValidationError extends ServiceError {
  constructor(message: string, options?: ServiceErrorOptions) {
    super(message, 400, options);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends ServiceError {
  constructor(resource: string, options?: ServiceErrorOptions) {
    super(options?.exact ? resource : `${resource} not found`, 404, options);
    this.name = "NotFoundError";
  }
}

export class AuthenticationError extends ServiceError {
  constructor(message = "Authentication failed", options?: ServiceErrorOptions) {
    super(message, 401, options);
    this.name = "AuthenticationError";
  }
}

export class ConflictError extends ServiceError {
  constructor(message: string, options?: ServiceErrorOptions) {
    super(message, 409, options);
    this.name = "ConflictError";
  }
}

export class UnauthorizedError extends ServiceError {
  constructor(message = "Unauthorized", options?: ServiceErrorOptions) {
    super(message, 403, options);
    this.name = "UnauthorizedError";
  }
}

export class RequiredErr extends ServiceError {
  constructor(field: string, options?: ServiceErrorOptions) {
    const positionClassErr = options?.class ? `in class: ${options.class.constructor.name}` : "";
    super(`${field} is required ${positionClassErr}`, 422, options);
    this.name = "RequiredErr";
  }
}
