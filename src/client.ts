import { randomUUID } from 'node:crypto';
import { TronScopeError } from './errors.js';
import { signRequest } from './hmac.js';
import type {
  Account,
  Balance,
  CreateEnergyOrderInput,
  DepositAddress,
  EnergyConfig,
  EnergyOrder,
  EnergyRate,
  RequestOptions,
  TronScopeClientOptions,
  WalletTransactionsQuery,
  WatchlistCreateInput,
  WatchlistUpdateInput,
} from './types.js';

const DEFAULT_BASE_URL = 'https://api.tronscope.io';

/**
 * Official TronScope Platform API client.
 *
 * Signs every request with HMAC-SHA256 (`X-API-Key`, `X-Timestamp`, `X-Signature`)
 * exactly as documented at https://tronscope.io/docs
 */
export class TronScope {
  readonly apiKey: string;
  readonly baseUrl: string;
  private readonly apiSecret: string;
  private readonly fetchImpl: typeof fetch;
  /** Prevents identical signatures within the same Unix second (server replay window). */
  private readonly recentCanonical = new Set<string>();

  constructor(options: TronScopeClientOptions) {
    if (!options?.apiKey?.trim()) throw new Error('TronScope: apiKey is required');
    if (!options?.apiSecret?.trim()) throw new Error('TronScope: apiSecret is required');
    this.apiKey = options.apiKey.trim();
    this.apiSecret = options.apiSecret.trim();
    this.baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.fetchImpl = options.fetch || globalThis.fetch.bind(globalThis);
  }

  // —— Account / balance ——

  /** Account id, email, and prepaid balance. Scope: `balance:read`. */
  account() {
    return this.get<Account>('/api/v1/account');
  }

  /** Prepaid TRX available for Energy orders. Scope: `balance:read`. */
  balance() {
    return this.get<Balance>('/api/v1/balance');
  }

  /** Recent TRX ledger entries. Scope: `balance:read`. */
  balanceTransactions(limit = 50) {
    return this.get<{ items: unknown[] }>('/api/v1/balance/transactions', { query: { limit } });
  }

  /** Unique TRON Mainnet deposit address for prepaid TRX. Scope: `balance:read`. */
  depositAddress() {
    return this.get<DepositAddress>('/api/v1/deposit-address');
  }

  /** List TRX deposits. Scope: `balance:read`. */
  deposits() {
    return this.get<{ items: unknown[]; requiredConfirmations: number }>('/api/v1/deposits');
  }

  /** Single deposit by id. Scope: `balance:read`. */
  deposit(depositId: string) {
    return this.get<unknown>(`/api/v1/deposits/${encodeURIComponent(depositId)}`);
  }

  // —— Energy rental ——

  /** Public Energy product limits and durations. */
  energyConfig() {
    return this.get<EnergyConfig>('/api/v1/energy/config');
  }

  /** Live Energy rental price quote (does not spend TRX). Scope: `quotes:read`. */
  energyRates(input: { energyAmount?: number; duration?: string } = {}) {
    return this.get<EnergyRate>('/api/v1/energy/rates', {
      query: {
        energyAmount: input.energyAmount,
        duration: input.duration,
      },
    });
  }

  /**
   * Create a TRON Energy rental order from prepaid TRX.
   * Always sends `X-Idempotency-Key`. Scope: `orders:write`.
   */
  createEnergyOrder(input: CreateEnergyOrderInput) {
    const { idempotencyKey, ...body } = input;
    return this.post<EnergyOrder>('/api/v1/energy/orders', {
      body,
      idempotencyKey: idempotencyKey || randomUUID(),
    });
  }

  /** List Energy orders (newest first). Scope: `orders:read`. */
  energyOrders(input: { status?: string; limit?: number } = {}) {
    return this.get<{ items?: unknown[]; total?: number } | unknown>('/api/v1/energy/orders', {
      query: { status: input.status, limit: input.limit },
    });
  }

  /** Fetch one order by TronScope order id. Scope: `orders:read`. */
  energyOrder(orderId: string) {
    return this.get<EnergyOrder | unknown>(`/api/v1/energy/orders/${encodeURIComponent(orderId)}`);
  }

  /** Fetch one order by your `externalOrderId`. Scope: `orders:read`. */
  energyOrderByExternalId(externalOrderId: string) {
    return this.get<EnergyOrder | unknown>(
      `/api/v1/energy/orders/by-external-id/${encodeURIComponent(externalOrderId)}`,
    );
  }

  // —— Watchlist (Pro / Enterprise) ——

  /** List watched addresses. Scope: `watchlist:read`. */
  watchlists() {
    return this.get<unknown>('/api/v1/watchlists');
  }

  /** Distinct watchlist category names. Scope: `watchlist:read`. */
  watchlistCategories() {
    return this.get<string[]>('/api/v1/watchlists/categories');
  }

  /** Start watching a Mainnet address. Scope: `watchlist:write`. */
  addWatchlist(input: WatchlistCreateInput) {
    return this.post<unknown>('/api/v1/watchlists', { body: input });
  }

  /** Whether an address is already watched. Scope: `watchlist:read`. */
  watchlistContains(address: string) {
    return this.get<{ watching: boolean }>(
      `/api/v1/watchlists/contains/${encodeURIComponent(address)}`,
    );
  }

  /** Update nickname / alerts for a watched address. Scope: `watchlist:write`. */
  updateWatchlist(address: string, input: WatchlistUpdateInput) {
    return this.patch<unknown>(`/api/v1/watchlists/${encodeURIComponent(address)}`, { body: input });
  }

  /** Stop watching an address. Scope: `watchlist:write`. */
  removeWatchlist(address: string) {
    return this.delete<unknown>(`/api/v1/watchlists/${encodeURIComponent(address)}`);
  }

  // —— Wallet analyze (Pro / Enterprise) ——

  /** Wallet balances, Energy, bandwidth. Scope: `wallets:read`. */
  wallet(address: string) {
    return this.get<unknown>(`/api/v1/wallets/${encodeURIComponent(address)}`);
  }

  /** Recent transfers for an address. Scope: `wallets:read`. */
  walletTransactions(address: string, query: WalletTransactionsQuery = {}) {
    return this.get<unknown>(`/api/v1/wallets/${encodeURIComponent(address)}/transactions`, {
      query: {
        limit: query.limit,
        minUsd: query.minUsd,
        token: query.token,
        direction: query.direction,
      },
    });
  }

  // —— Low-level HTTP ——

  get<T>(path: string, options: Omit<RequestOptions, 'body' | 'idempotencyKey'> = {}) {
    return this.request<T>('GET', path, options);
  }

  post<T>(path: string, options: RequestOptions = {}) {
    return this.request<T>('POST', path, options);
  }

  patch<T>(path: string, options: RequestOptions = {}) {
    return this.request<T>('PATCH', path, options);
  }

  delete<T>(path: string, options: Omit<RequestOptions, 'body'> = {}) {
    return this.request<T>('DELETE', path, options);
  }

  async request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
    if (!path.startsWith('/')) {
      throw new Error(`TronScope: path must start with /, got ${path}`);
    }

    const queryString = buildQuery(options.query);
    const rawBody =
      options.body === undefined || options.body === null
        ? ''
        : typeof options.body === 'string'
          ? options.body
          : JSON.stringify(options.body);

    const timestamp = await this.nextTimestamp(method, path, queryString, rawBody);
    const signature = signRequest({
      secret: this.apiSecret,
      timestamp,
      method,
      path,
      query: queryString,
      rawBody,
    });

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-API-Key': this.apiKey,
      'X-Timestamp': timestamp,
      'X-Signature': signature,
      ...(options.headers || {}),
    };
    if (rawBody) headers['Content-Type'] = 'application/json';
    if (options.idempotencyKey) headers['X-Idempotency-Key'] = options.idempotencyKey;

    const url = `${this.baseUrl}${path}${queryString ? `?${queryString}` : ''}`;
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method,
        headers,
        body: rawBody || undefined,
      });
    } catch (error) {
      throw new TronScopeError({
        message: error instanceof Error ? error.message : 'Network request failed',
        status: 0,
        code: 'NETWORK_ERROR',
      });
    }

    const requestId = res.headers.get('x-request-id') || undefined;
    const text = await res.text();
    let parsed: unknown = undefined;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    if (!res.ok) {
      const errBody =
        parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
      const nested =
        errBody.error && typeof errBody.error === 'object'
          ? (errBody.error as Record<string, unknown>)
          : null;
      const code = String(nested?.code || errBody.code || 'HTTP_ERROR');
      const message = String(
        nested?.message || errBody.message || errBody.error || res.statusText || 'Request failed',
      );
      throw new TronScopeError({
        message,
        status: res.status,
        code,
        requestId: requestId || (typeof nested?.requestId === 'string' ? nested.requestId : undefined),
        body: parsed,
      });
    }

    return parsed as T;
  }

  /**
   * Unix-second timestamps + identical GET bodies collide under server replay protection.
   * Wait for a free second when the same method/path/query/body would repeat.
   */
  private async nextTimestamp(
    method: string,
    path: string,
    query: string,
    rawBody: string,
  ): Promise<string> {
    const identity = [method.toUpperCase(), path, query, rawBody].join('\n');
    for (;;) {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const key = `${timestamp}\n${identity}`;
      if (!this.recentCanonical.has(key)) {
        this.recentCanonical.add(key);
        setTimeout(() => this.recentCanonical.delete(key), 2_100).unref?.();
        return timestamp;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}

function buildQuery(
  query?: Record<string, string | number | boolean | undefined | null>,
): string {
  if (!query) return '';
  const parts: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.join('&');
}
