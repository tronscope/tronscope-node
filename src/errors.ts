export class TronScopeError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  readonly body?: unknown;

  constructor(input: {
    message: string;
    status: number;
    code?: string;
    requestId?: string;
    body?: unknown;
  }) {
    super(input.message);
    this.name = 'TronScopeError';
    this.status = input.status;
    this.code = input.code || 'UNKNOWN';
    this.requestId = input.requestId;
    this.body = input.body;
  }
}
