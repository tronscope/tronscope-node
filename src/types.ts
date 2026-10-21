export type TronScopeClientOptions = {
  /** Public API key (`ts_live_…`) from Account → API keys. */
  apiKey: string;
  /** Signing secret (`ts_sec_…`) shown once when the key is created. */
  apiSecret: string;
  /**
   * API origin without trailing slash.
   * @default https://api.tronscope.io
   */
  baseUrl?: string;
  /** Optional fetch implementation (defaults to global fetch). */
  fetch?: typeof fetch;
};

export type EnergyDuration = '1H' | '1D' | '3D' | '30D' | (string & {});

export type CreateEnergyOrderInput = {
  /** TRON Mainnet Base58 address that receives rented Energy. */
  receiverAddress?: string;
  /** Energy units to rent (typically 1,000–50,000,000). */
  energyAmount?: number;
  duration?: EnergyDuration;
  /** Optional quote id from a prior pricing step. */
  quoteId?: string;
  /** Your merchant reference; lookup via energyOrderByExternalId. */
  externalOrderId?: string;
  /** Required by POST /energy/orders. Auto-generated UUID if omitted. */
  idempotencyKey?: string;
};

export type WatchlistCreateInput = {
  address: string;
  nickname?: string;
  category?: string;
  notes?: string;
  watchedAssets?: string[];
  notificationsEnabled?: boolean;
  minNotifyUsd?: number;
};

export type WatchlistUpdateInput = {
  nickname?: string;
  category?: string;
  notes?: string;
  watchedAssets?: string[];
  notificationsEnabled?: boolean;
  minNotifyUsd?: number;
};

export type WalletTransactionsQuery = {
  limit?: number;
  minUsd?: number;
  token?: string;
  direction?: 'in' | 'out' | '';
};

export type RequestOptions = {
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  idempotencyKey?: string;
  headers?: Record<string, string>;
};

/** Prepaid TRX balance (SUN is canonical: 1 TRX = 1,000,000 SUN). */
export type Balance = {
  asset: string;
  availableSun: string;
  available: string;
  reservedSun?: string;
  reserved?: string;
  totalDepositedSun?: string;
  totalDeposited?: string;
  totalSpentSun?: string;
  totalSpent?: string;
};

export type DepositAddress = {
  network: 'TRON' | string;
  asset: 'TRX' | string;
  address: string;
};

export type EnergyConfig = {
  minEnergy: number;
  maxEnergy: number;
  durations: string[];
  sunPerTrx: number;
};

export type EnergyRate = {
  energyAmount: number;
  duration: string;
  durationHours?: number;
  sunPerUnit: number;
  userRateSun?: number;
  listSunPerUnit?: number;
  discountPercent?: number;
  priceSun: string | number;
  priceTrx?: string;
  priceUsd?: string;
  balanceSun?: string | number;
  source?: string;
  expiresAt?: string;
};

export type EnergyOrder = {
  orderId: string;
  externalOrderId?: string | null;
  status: string;
  energyAmount: number;
  duration?: string;
  feeSun?: number | string;
  balanceSun?: number | string;
  createdAt?: string;
};

export type Account = {
  id: string;
  email: string | null;
  balanceSun: string | number;
};
