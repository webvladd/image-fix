export class ProviderError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
  }
}

export class ProviderConfigurationError extends ProviderError {
  constructor(message: string) {
    super(message, 400);
    this.name = "ProviderConfigurationError";
  }
}

export class ProviderQuotaExceededError extends ProviderError {
  constructor(message = "Provider quota exceeded") {
    super(message, 429);
    this.name = "ProviderQuotaExceededError";
  }
}

export class ProviderRequestError extends ProviderError {
  constructor(message: string, status?: number) {
    super(message, status ?? 502);
    this.name = "ProviderRequestError";
  }
}
