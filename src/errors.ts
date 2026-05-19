export class GitbankError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly body?: unknown
  ) {
    super(message);
    this.name = "GitbankError";
  }
}

export class GitbankAuthError extends GitbankError {
  constructor(message = "Not authenticated. Run: gitbank auth login") {
    super(message, 401);
    this.name = "GitbankAuthError";
  }
}

export class GitbankNotFoundError extends GitbankError {
  constructor(resource: string) {
    super(`${resource} not found`, 404);
    this.name = "GitbankNotFoundError";
  }
}

export class GitbankNetworkError extends GitbankError {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "GitbankNetworkError";
  }
}
